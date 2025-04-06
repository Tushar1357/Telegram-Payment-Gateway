const { Web3 } = require("web3");
const TelegramBot = require("node-telegram-bot-api");
const syncDb = require("./database/sequelize.js");
const { createWalletForUser } = require("./services/walletService.js");
const checkBalance = require("./helpers/checkBalance.js");
const { balanceSend } = require("./helpers/balanceSender.js");
const { subscriptionChecker } = require("./helpers/subscriptionChecker.js");


const CHECK_BALANCE_INTERVAL = 15 * 1000;
const BALANCE_SEND_INTERVAL = 30 * 60 * 1000;
const SUBSCRIPTION_CHECK_INTERVAL = 30 * 60 * 1000;

const bot = new TelegramBot(process.env.TOKEN, {
  polling: true,
});
syncDb();

bot.onText(/\/start/, (message) => {
  bot.sendMessage(message.chat.id, "Hello There!!");
});

bot.onText(/\/subscribe/, async (message) => {
  try {
    const address = await createWalletForUser(
      message?.from?.id,
      message?.from?.first_name,
      message?.from?.username
    );
    bot.sendMessage(
      message.chat.id,
      `Here is your address: <pre>${address}</pre>\nYou have 30 minutes to pay the specified amount. If you make payment after that then please contact the support team.`,
      {
        parse_mode: "HTML",
      }
    );
    
  } catch (error) {
    console.log(error);
    bot.sendMessage(message.chat.id, "There was an error on server side.");
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
