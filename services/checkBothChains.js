const Wallets = require("../database/models/wallets/Wallets.js");
const chains = require("../configs/chains.js");
const User = require("../database/models/users/User.js");
const { formatUnits } = require("../helpers/common.js");
const { MIN_AMOUNT } = require("../configs/common.js");

const checkBothChains = async (tgId) => {
  try {
    const user = await User.findOne({
      where: {
        tgId,
      },
    });
    if (!user) {
      return "No user found with this telegram Id.";
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
        for (const chainName of ["base", "bsc"]) {
          try {
            const chain = chains[chainName];
            const tokenBalance = await chain.contract.methods
              .balanceOf(wallet.address)
              .call();

            const formattedBalance = parseFloat(
              formatUnits(tokenBalance, chain.decimals)
            );

            if (formattedBalance >= MIN_AMOUNT) {
              await Wallets.update(
                {
                  status: "unpaid",
                  paymentChain: chainName,
                  createdAt: new Date(Date.now() + 60 * 1000),
                },
                {
                  where: { id: wallet.id },
                }
              );

              return `✅ Wallet ${
                wallet.address
              } marked as PAID on ${chainName.toUpperCase()} (Balance: ${formattedBalance})`;
            }
          } catch (error) {
            `Error while checking funds on both chains. Error: ${error?.message}`;
          }
        }
        await new Promise((r) => setTimeout(r, 200));
      } catch (error) {
        console.log(
          `Error while checking funds on both chains. Error: ${error?.message}`
        );
      }
    }

    return "🔍 Check complete. No wallet found with sufficient funds on both chains.";
  } catch (error) {
    console.error("❌ Error in checkBothChains:", error);
    return "❌ An error occurred while checking wallets. Please try again.";
  }
};

module.exports = { checkBothChains };
