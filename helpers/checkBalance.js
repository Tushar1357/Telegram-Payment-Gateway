const w3 = require("../configs/web3.js");
const Wallets = require("../database/models/wallets/Wallets.js");
const User = require("../database/models/users/User.js");

const TIMEOUT = 30 * 60 * 1000;

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

      if (parseFloat(balanceEth) >= 0.01) {
        const result = await Wallets.update(
          {
            status: "paid",
          },
          {
            where: {
              id: wallet.id,
            },
          }
        );

        if (!result) {
          console.log("There was an error while updating the payment status.")
        }
        bot.sendMessage(
          user.tgId,
          `You have successfully purhcased your subscription. Here is the telegram link to the channel.\nTelegram Link:- @MrBean000`
        );
      }
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = checkBalance;
