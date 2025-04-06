const w3 = require("../configs/web3.js");
const Wallets = require("../database/models/wallets/Wallets.js");
const User = require("../database/models/users/User.js");
const updateSubscription = require("../services/subscriptionService.js");
require("dotenv").config();
const ERC20_ABI = require("../configs/abi.js");

const USDT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS;

const TIMEOUT = 30 * 60 * 1000;
const REMINDER_TIME = 5 * 60 * 1000;

const MIN_AMOUNT = 0.01;

const chatId = process.env.CHATID;

const checkBalance = async (bot) => {
  try {
    const walletDetail = await Wallets.findAll({
      where: {
        status: "unpaid",
      },
    });
    const usdtContract = new w3.eth.Contract(ERC20_ABI, USDT_ADDRESS);

    for (const wallet of walletDetail) {
      const user = await User.findOne({
        where: {
          id: wallet.userId,
        },
      });

      if (!user || !user.tgId) {
        console.log(`No user found for wallet ${wallet.address}`);
        continue;
      }
      const createdAt = new Date(wallet.createdAt).getTime();
      const time = createdAt + TIMEOUT;

      if (
        time - Date.now() < REMINDER_TIME &&
        time - Date.now() > REMINDER_TIME - 15 * 1000
      ) {
        await bot.sendMessage(
          user.tgId,
          "⏰ Reminder: You have 5 minutes left to complete your payment of 0.01 USDC (BEP-20). Please complete it soon or the address will expire."
        );
      }
      if (time < Date.now()) {
        await Wallets.update(
          { status: "expired" },
          { where: { id: wallet.id } }
        );
        bot.sendMessage(
          user.tgId,
          `Your payment time is over and the wallet address ${wallet.address} has been removed. Kindly click on /subscribe to start the process.`
        );
        continue;
      }
      const tokenBalance = await usdtContract.methods
        .balanceOf(wallet.address)
        .call();
      const tokenBalanceFormatted = w3.utils.fromWei(tokenBalance, "ether");

      if (parseFloat(tokenBalanceFormatted) >= MIN_AMOUNT) {
        const result = await Wallets.update(
          {
            status: "paid",
            balanceSent: false,
          },
          {
            where: {
              id: wallet.id,
            },
          }
        );
        const expirationTime = await updateSubscription(user);

        if (!result) {
          console.log("There was an error while updating the payment status.");
        }

        const channelLink = await bot.createChatInviteLink(chatId, {
          member_limit: 1,
          expire_date: Math.floor(Date.now() / 1000) + 60,
        });
        bot.sendMessage(
          user.tgId,
          `🎉 *Subscription Activated!*\n\n✅ You’ve successfully purchased your subscription.\n\n🔗 *Access the Channel:*\n[Click here to join](${
            channelLink.invite_link
          })\n\n🕒 *Subscription Valid Till:*\n${new Date(
            expirationTime
          ).toUTCString()}\n\nThank you for subscribing! If you face any issues, feel free to reach out to @MrBean000.`,
          {
            parse_mode: "Markdown",
            disable_web_page_preview: true,
          }
        );
      }
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = checkBalance;
