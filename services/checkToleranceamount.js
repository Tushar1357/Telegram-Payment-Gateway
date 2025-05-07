const Wallets = require("../database/models/wallets/Wallets.js");
const User = require("../database/models/users/User.js");
require("dotenv").config();
const chains = require("../configs/chains.js");
const { formatUnits } = require("../helpers/common.js");
const { MIN_AMOUNT, MIN_TOLERANCE } = require("../configs/common.js");
const updateSubscription = require("./subscriptionService.js");

const ADMIN_CHATID = process.env.ADMIN_CHATID;
const ADMIN_CHATID_2 = process.env.ADMIN_CHATID_2;
const chatId = process.env.CHATID;

const checkToleranceAmount = async (tgId, bot) => {
  try {
    const user = await User.findOne({ where: { tgId } });
    if (!user) return "❌ No user found with this Telegram ID.";

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
      for (const tokenSymbol of ["usdc", "usdt"]) {
        try {
          const tokenConfig = chains?.[wallet.paymentChain]?.[tokenSymbol];
          if (!tokenConfig) continue;

          const tokenBalance = await tokenConfig.contract.methods
            .balanceOf(wallet.address)
            .call();

          const tokenBalanceFormatted = parseFloat(
            formatUnits(tokenBalance, tokenConfig.decimals)
          );

          if (tokenBalanceFormatted >= MIN_TOLERANCE) {
            await Wallets.update(
              {
                status: "paid",
                tokenSymbol: tokenSymbol.toUpperCase(),
                balanceSent: false,
              },
              { where: { id: wallet.id } }
            );

            const expirationTime = await updateSubscription(user);

            const channelLink = await bot.createChatInviteLink(chatId, {
              member_limit: 1,
              expire_date: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
            });

            const isNewSub = !user.subscriptionStatus;

            if (isNewSub) {
              await bot.sendMessage(
                user.tgId,
                `🎉 *Subscription Activated!*\n\n✅ You’ve successfully purchased your subscription.\n\n🔗 *Access the Channel:*\n[Click here to join](${channelLink.invite_link})\n\n🕒 *Subscription Valid Till:*\n${new Date(
                  expirationTime
                ).toUTCString()}\n\nThank you for subscribing! If you face any issues, feel free to reach out to @Skelter10 or @MrBean000.`,
                {
                  parse_mode: "Markdown",
                  disable_web_page_preview: true,
                }
              );

              await bot.sendMessage(
                ADMIN_CHATID,
                `🎉 *New Subscription Alert!*\n\n${user.tgName} subscribed using ${tokenSymbol.toUpperCase()} on ${wallet.paymentChain.toUpperCase()}.`,
                { parse_mode: "Markdown" }
              );

              await bot.sendMessage(
                ADMIN_CHATID_2,
                `🎉 *New Subscription Alert!*\n\n${user.tgName} subscribed using ${tokenSymbol.toUpperCase()} on ${wallet.paymentChain.toUpperCase()}.`,
                { parse_mode: "Markdown" }
              );
            } else {
              await bot.sendMessage(
                user.tgId,
                `✅ Thanks for extending your subscription.\n\nYour subscription has been extended by 30 days.\n\n🕒 *Valid Till:*\n${new Date(expirationTime).toUTCString()}`,
                { parse_mode: "Markdown" }
              );

              await bot.sendMessage(
                ADMIN_CHATID,
                `🎉 *Renewal Alert!*\n\n${user.tgName} renewed using ${tokenSymbol.toUpperCase()} on ${wallet.paymentChain.toUpperCase()}.`,
                { parse_mode: "Markdown" }
              );

              await bot.sendMessage(
                ADMIN_CHATID_2,
                `🎉 *Renewal Alert!*\n\n${user.tgName} renewed using ${tokenSymbol.toUpperCase()} on ${wallet.paymentChain.toUpperCase()}.`,
                { parse_mode: "Markdown" }
              );
            }

            return `✅ Found tolerance amount (${tokenBalanceFormatted} ${tokenSymbol.toUpperCase()}) on ${wallet.address}. Subscription updated.`;
          }
        } catch (error) {
          console.log(
            `❌ Error checking ${tokenSymbol.toUpperCase()} on ${wallet.paymentChain.toUpperCase()} for ${wallet.address}: ${error?.message}`
          );
          return "❌ Error occurred while checking wallet balances.";
        }
      }
    }

    return "🔍 No wallet found with minimum tolerance amount in any token.";
  } catch (error) {
    console.log("❌ Error while checking tolerance amount:", error?.message);
    return "❌ An error occurred while checking tolerance amount.";
  }
};

module.exports = checkToleranceAmount;
