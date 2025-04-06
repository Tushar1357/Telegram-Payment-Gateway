const w3 = require("../configs/web3.js");
const Wallets = require("../database/models/wallets/Wallets.js");
const User = require("../database/models/users/User.js");
const updateSubscription = require("../services/subscriptionService.js");
require("dotenv").config();

const TIMEOUT = 30 * 60 * 1000;

const chatId = process.env.CHATID;

const checkBalance = async (bot) => {
  try {
    console.log("Checking balance...");
    const walletDetail = await Wallets.findAll({
      where: {
        status: "unpaid",
      },
    });
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
      if (createdAt + TIMEOUT < Date.now()) {
        await Wallets.destroy({
          where: {
            id: wallet.id,
          },
        });
        bot.sendMessage(
          user.tgId,
          "Your payment time is over and the wallet address has been removed. Kindly click on /subscribe to start the process."
        );
        continue;
      }
      const balanceWei = await w3.eth.getBalance(wallet.address);
      const balanceEth = w3.utils.fromWei(balanceWei, "ether");

      if (parseFloat(balanceEth) >= 0) {
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
        });
        bot.sendMessage(
          user.tgId,
          `You have successfully purhcased your subscription. Here is the telegram link to the channel.\nTelegram Link:- ${
            channelLink.invite_link
          }\n\nYour subscription will expire on ${new Date(
            expirationTime
          ).toUTCString()}`,{
            disable_web_page_preview: true
          }
        );
      }
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = checkBalance;
