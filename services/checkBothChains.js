const Wallets = require("../database/models/wallets/Wallets.js");
const chains = require("../configs/chains.js");
const User = require("../database/models/users/User.js");
const { formatUnits } = require("../helpers/common.js");
const { MIN_AMOUNT } = require("../configs/common.js");

const checkBothChains = async (tgId) => {
  try {
    const user = await User.findOne({ where: { tgId } });
    if (!user) {
      return "❌ No user found with this Telegram ID.";
    }

    const wallets = await Wallets.findAll({
      where: {
        userId: user.id,
        status: ["unpaid", "expired"],
      },
      order: [["createdAt", "DESC"]],
    });

    if (!wallets || wallets.length === 0) {
      return "✅ No unpaid or expired wallets found for your account.";
    }

    for (const wallet of wallets) {
      try {
        for (const chainName of ["bsc", "base"]) {
          for (const tokenSymbol of ["usdc", "usdt"]) {
            try {
              const tokenConfig = chains?.[chainName]?.[tokenSymbol];
              if (!tokenConfig) continue;

              const tokenBalance = await tokenConfig.contract.methods
                .balanceOf(wallet.address)
                .call();

              const formattedBalance = parseFloat(
                formatUnits(tokenBalance, tokenConfig.decimals)
              );

              if (formattedBalance >= MIN_AMOUNT) {
                await Wallets.update(
                  {
                    status: "unpaid", // mark for reprocessing
                    paymentChain: chainName,
                    tokenSymbol: tokenSymbol.toUpperCase(),
                    createdAt: new Date(Date.now() + 60 * 1000),
                  },
                  {
                    where: { id: wallet.id },
                  }
                );
              
                return `✅ Wallet \`${wallet.address}\` marked as *UNPAID* on ${chainName.toUpperCase()} (${tokenSymbol.toUpperCase()})\n📥 Balance: ${formattedBalance}`;
              }
              
            
            } catch (error) {
              console.log(
                `Error checking ${tokenSymbol.toUpperCase()} on ${chainName.toUpperCase()} for ${wallet.address}:`,
                error?.message
              );
            }
          }
        }
        await new Promise((r) => setTimeout(r, 200));
      } catch (error) {
        console.log(`Error processing wallet ${wallet.address}:`, error?.message);
      }
    }

    return "🔍 Check complete. No wallet found with sufficient funds on any chain/token.";
  } catch (error) {
    console.error("❌ Error in checkBothChains:", error);
    return "❌ An error occurred while checking wallets. Please try again.";
  }
};

module.exports = { checkBothChains };
