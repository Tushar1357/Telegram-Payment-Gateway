const { Web3 } = require("web3");
const TelegramBot = require("node-telegram-bot-api");
const syncDb = require("./database/sequelize.js");
const { createWalletForUser } = require("./services/walletService.js");
const checkBalance = require("./helpers/checkBalance.js");
const { balanceSend } = require("./helpers/balanceSender.js");
const { subscriptionChecker } = require("./helpers/subscriptionChecker.js");

const CHECK_BALANCE_INTERVAL = 15 * 1000;
const BALANCE_SEND_INTERVAL = 30 * 60 * 1000;
const SUBSCRIPTION_CHECK_INTERVAL = 10 * 60 * 1000;

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
        `💰 USDT Amount: <b>10</b>\n\n📥 Send only USDT (BEP-20) to:\n<pre>${address}</pre>\n\n⏳ You have 30 minutes to complete the payment.\n❗ If you pay late, please contact support at @MrBean000.`,
        {
          parse_mode: "HTML",
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
