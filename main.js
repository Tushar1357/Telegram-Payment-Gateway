const { Web3 } = require("web3");
const TelegramBot = require("node-telegram-bot-api");
const syncDb = require("./database/sequelize.js");
const { createWalletForUser } = require("./services/walletService.js");
const checkBalance = require("./helpers/checkBalance.js");
const { balanceSend } = require("./helpers/balanceSender.js");
const { subscriptionChecker } = require("./helpers/subscriptionChecker.js");
const checkExpiredAddress = require("./helpers/checkExpiredAddress.js");

const CHECK_BALANCE_INTERVAL = 15 * 1000;
const BALANCE_SEND_INTERVAL = 30 * 60 * 1000;
const SUBSCRIPTION_CHECK_INTERVAL = 10 * 60 * 1000;
const ADMIN_CHATID = process.env.ADMIN_CHATID

const bot = new TelegramBot(process.env.TOKEN, {
  polling: true,
});
syncDb();

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const message = `
👋 *Welcome to Mr. S Premium!*

To access our private channel, you’ll need to purchase a subscription using *USDT on BSC (BEP-20)*.

💳 *Steps to Subscribe:*
1. A unique wallet address will be generated for your payment.
2. Send the required USDT to that address within *30 minutes*.
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
        [{ text: "USDT (BEP-20)", callback_data: "pay_bep20" }],
      ],
    },
  };

  bot.sendMessage(chatId, message, options);
});

bot.onText(/\/check-expiry/,async (message) => {
  try{
    const chatId = message.chat.id;
    if (chatId === Number(ADMIN_CHATID)){
      const text = message.text.split(" ");
      const usertgId = Number(text[1])
      const result = await checkExpiredAddress(usertgId)
      bot.sendMessage(ADMIN_CHATID,result)
    }
    else{
      bot.sendMessage(message.chat.id, "Only admin can call this command.")
    }
  }
  catch(error){
    console.log(error)
  }
})

bot.on("callback_query", async (query) => {
  try {
    const chatId = query.message.chat.id;
    const choice = query.data;

    if (choice === "pay_bep20") {
      await bot.answerCallbackQuery(query.id);

      await bot.sendMessage(
        chatId,
        "🔗 Generating a BEP-20 (BSC) USDT wallet for you..."
      );

      const address = await createWalletForUser(
        query.from.id,
        query.from.first_name,
        query.from.username
      );

      await bot.sendMessage(
        chatId,
        `💰 USDT Amount: *1*\n\n📥 Send only *USDT (BEP-20)* to:\n\`${address}\`\n\n⏳ You have 30 minutes to complete the payment.\n❗ If you pay late, please contact support at @MrBean000.\n\n✅ *Important Notes:*\n- No need to send transaction hash or screenshot.\n- Your deposit will be detected automatically.\n- Transaction fees must be covered by you.\n- Make sure the amount is *not less* than the required *1 USDT*.\n- Send only *BEP-20 USDT* (Binance Smart Chain). Sending from other networks may result in loss of funds.`,
        {
          parse_mode: "Markdown",
        }
      );
      
      
    }
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
