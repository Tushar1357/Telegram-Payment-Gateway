const { Web3 } = require("web3");
const TelegramBot = require("node-telegram-bot-api");
const syncDb = require("./database/sequelize.js");
const { createWalletForUser } = require("./services/walletService.js");
const checkBalance = require("./helpers/checkBalance.js");
const { balanceSend } = require("./helpers/balanceSender.js");
const { subscriptionChecker } = require("./helpers/subscriptionChecker.js");
const checkExpiredAddress = require("./helpers/checkExpiredAddress.js");

const CHECK_BALANCE_INTERVAL = 15 * 1000;
const BALANCE_SEND_INTERVAL = 3 * 1000;
const SUBSCRIPTION_CHECK_INTERVAL = 10 * 60 * 1000;
const ADMIN_CHATID = process.env.ADMIN_CHATID;
const ADMIN_CHATID_2 = process.env.ADMIN_CHATID_2;

const bot = new TelegramBot(process.env.TOKEN, {
  polling: true,
});
syncDb();

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const message = `
👋 *Welcome to Mr. S Premium!*

To access our private channel, you’ll need to purchase a subscription using *USDC on BSC (BEP-20) or BASE (Base Chain)*.

💳 *Steps to Subscribe:*
1. A unique wallet address will be generated for your payment.
2. Send the required USDC to that address within *30 minutes*.
3. Once payment is confirmed, you'll receive an invite link to join the channel.

🔁 We'll remind you 5 minutes before the address expires.

To get started, just click /subscribe

Need help? Contact @MrBean000.
`;

  bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });
});

bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;

  const message = `💳 *Choose your payment method to proceed with the subscription:*`;

  const options = {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "USDC (BSC)", callback_data: "bsc" }],
        [{ text: "USDC (BASE)", callback_data: "base" }],
      ],
    },
  };

  bot.sendMessage(chatId, message, options);
});

bot.onText(/\/check-expiry/, async (message) => {
  try {
    const chatId = message.chat.id;
    if (chatId === Number(ADMIN_CHATID) || chatId === Number(ADMIN_CHATID_2)) {
      const text = message.text.split(" ");
      const usertgId = Number(text[1]);
      const result = await checkExpiredAddress(usertgId);
      bot.sendMessage(chatId, result);
    } else {
      bot.sendMessage(message.chat.id, "Only admin can call this command.");
    }
  } catch (error) {
    console.log(error);
  }
});

bot.on("callback_query", async (query) => {
  try {
    const chatId = query.message.chat.id;
    const choice = query.data;

    if (!["bsc", "base"].includes(choice)) {
      await bot.sendMessage(
        chatId,
        "No chain selected for payment or Invalid chain."
      );
      return;
    }
    await bot.answerCallbackQuery(query.id);
    const chainLabel = choice === "bsc" ? "BSC" : "BASE";

    await bot.sendMessage(
      chatId,
      `🔗 Generating a ${chainLabel} USDC wallet for you...`
    );
    let wallet;
    try {
      wallet = await createWalletForUser(
        query.from.id,
        query.from.first_name,
        query.from.username,
        choice
      );
    } catch (err) {
      console.error("Wallet creation failed:", err);
      return bot.sendMessage(
        chatId,
        "⚠️ Failed to create wallet. Please try again later."
      );
    }

    const { address, createdAt } = wallet;

    const expiry = new Date(new Date(createdAt).getTime() + 30 * 60 * 1000);

    await bot.sendMessage(
      chatId,
      `💰 USDC Amount: *0.01*\n\n📥 Send only *USDC (${chainLabel})* to:\n\`${address}\`\n\n⏳ You have 30 minutes to complete the payment. Your address will expire at ${expiry.toUTCString()}\n❗ If you pay late, please contact support at @MrBean000.\n\n✅ *Important Notes:*\n- No need to send transaction hash or screenshot.\n- Your deposit will be detected automatically.\n- Transaction fees must be covered by you.\n- Make sure the amount is *not less* than the required *0.01 USDC*.\n- Send only *(${chainLabel}) USDC* (${
        choice === "bsc" ? "Binance smart chain" : "Base Chain"
      }). Sending from other networks may result in loss of funds.`,
      {
        parse_mode: "Markdown",
      }
    );
  } catch (error) {
    console.error("Error in callback_query:", error);
    bot.sendMessage(
      query.message.chat.id,
      "⚠️ Something went wrong. Please try again later."
    );
  }
});

setInterval(() => {
  checkBalance(bot);
}, CHECK_BALANCE_INTERVAL);

setInterval(() => {
  balanceSend();
}, BALANCE_SEND_INTERVAL);

setInterval(() => {
  subscriptionChecker(bot);
}, SUBSCRIPTION_CHECK_INTERVAL);

process.on("SIGINT", () => {
  console.log("Bot shutting down...");
  bot.stopPolling();
  process.exit();
});
