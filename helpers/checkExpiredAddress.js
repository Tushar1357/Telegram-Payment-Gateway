const Wallets = require("../database/models/wallets/Wallets.js");
const User = require("../database/models/users/User.js");
require("dotenv").config();
const chains = require("../configs/chains.js");
const { formatUnits } = require("../helpers/common.js");

const MIN_AMOUNT = 0.01;

const checkExpiredAddress = async (tgId) => {
  try {
    const user = await User.findOne({
      where: {
        tgId,
      },
    });
    if (!user) {
      return "No user found with this telegram Id.";
    }
    const expiredWallets = await Wallets.findAll({
      where: {
        status: "expired",
        userId: user.id,
      },
    });

    for (const wallet of expiredWallets) {
      try {
        const tokenBalance = await chains[wallet.paymentChain].contract.methods
          .balanceOf(wallet.address)
          .call();
        const tokenBalanceFormatted = formatUnits(
          tokenBalance,
          chains[wallet.paymentChain].decimals
        );

        if (parseFloat(tokenBalanceFormatted) >= MIN_AMOUNT) {
          await Wallets.update(
            {
              status: "unpaid",
              createdAt: new Date(Date.now() + 60 * 1000),
            },
            {
              where: {
                id: wallet.id,
              },
            }
          );
          return `Checked all expiry addresses and found expiry address ${wallet.address} with payment.`;
        }
      } catch (error) {
        console.log(
          `Error while checking expired address ${wallet.address}. Error: ${error?.message}`
        );
      }
    }

    return "No expiry addresses found with payment.";
  } catch (error) {
    console.log("Error while checking expired addresses", error?.message);
    return "Error while checking addresses.";
  }
};

module.exports = checkExpiredAddress;
