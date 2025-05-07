const Wallets = require("../database/models/wallets/Wallets.js");
const User = require("../database/models/users/User.js");
require("dotenv").config();
const chains = require("../configs/chains.js");
const { formatUnits } = require("../helpers/common.js");
const { MIN_AMOUNT } = require("../configs/common.js");

const checkExpiredAddress = async (tgId) => {
  try {
    const user = await User.findOne({ where: { tgId } });

    if (!user) {
      return "❌ No user found with this Telegram ID.";
    }

    const expiredWallets = await Wallets.findAll({
      where: {
        status: "expired",
        userId: user.id,
      },
      order: [["createdAt", "DESC"]],
    });

    if (!expiredWallets.length) {
      return "✅ No expired wallets found for this user.";
    }

    for (const wallet of expiredWallets) {
      for (const tokenSymbol of ["usdc", "usdt"]) {
        try {
          const tokenConfig = chains?.[wallet.paymentChain]?.[tokenSymbol];
          if (!tokenConfig) continue;

          const tokenBalance = await tokenConfig.contract.methods
            .balanceOf(wallet.address)
            .call();

          const formattedBalance = parseFloat(formatUnits(tokenBalance, tokenConfig.decimals));

          if (formattedBalance >= MIN_AMOUNT) {
            await Wallets.update(
              {
                status: "unpaid",
                tokenSymbol: tokenSymbol.toUpperCase(),
                createdAt: new Date(Date.now() + 60 * 1000),
              },
              {
                where: { id: wallet.id },
              }
            );

            return `✅ Found expired wallet \`${wallet.address}\` funded with ${formattedBalance} ${tokenSymbol.toUpperCase()} on ${wallet.paymentChain.toUpperCase()}.\nWallet has been reactivated.`;
          }
        } catch (error) {
          console.log(
            `❌ Error checking ${tokenSymbol.toUpperCase()} on ${wallet.paymentChain.toUpperCase()} for ${wallet.address}: ${error?.message}`
          );
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    return "🔍 No expired wallet had sufficient USDC or USDT balance.";
  } catch (error) {
    console.log("❌ Error while checking expired addresses:", error?.message);
    return "❌ Failed to check expired wallets. Please try again.";
  }
};

module.exports = checkExpiredAddress;
