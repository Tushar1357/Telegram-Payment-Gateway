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
        const tokenBalance = await chains[wallet.paymentChain].contract.methods
          .balanceOf(wallet.address)
          .call();
        const tokenBalanceFormatted = formatUnits(
          tokenBalance,
          chains[wallet.paymentChain].decimals
        );

        if (parseFloat(tokenBalanceFormatted) >= MIN_TOLERANCE) {
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
            console.log(
              "There was an error while updating the payment status."
            );
          }

          if (!user.subscriptionStatus) {
            const channelLink = await bot.createChatInviteLink(chatId, {
              member_limit: 1,
              expire_date: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
            });
            bot
              .sendMessage(
                user.tgId,
                `🎉 *Subscription Activated!*\n\n✅ You’ve successfully purchased your subscription.\n\n🔗 *Access the Channel:*\n[Click here to join](${
                  channelLink.invite_link
                })\n\n🕒 *Subscription Valid Till:*\n${new Date(
                  expirationTime
                ).toUTCString()}\n\nThank you for subscribing! If you face any issues, feel free to reach out to @Skelter10 or @MrBean000.`,
                {
                  parse_mode: "Markdown",
                  disable_web_page_preview: true,
                }
              )
              .catch((error) =>
                console.log(
                  "Error while sending subscription activation message. Error",
                  error?.message
                )
              );

            bot
              .sendMessage(
                ADMIN_CHATID,
                `🎉 *New Subscription Alert!*\n\n${user.tgName} just bought premium subscription for 1 month.`,
                {
                  parse_mode: "Markdown",
                }
              )
              .catch((error) => console.log(error?.message));
            bot
              .sendMessage(
                ADMIN_CHATID_2,
                `🎉 *New Subscription Alert!*\n\n${user.tgName} just bought premium subscription for 1 month.`,
                {
                  parse_mode: "Markdown",
                }
              )
              .catch((error) => console.log(error?.message));
          } else {
            bot
              .sendMessage(
                user.tgId,
                `✅ Thanks for extending your subscription.\n\nYour subscription has been extended by 30 days.\n\n🕒 *Subscription Valid Till:*\n${new Date(
                  expirationTime
                ).toUTCString()}`,
                {
                  parse_mode: "Markdown",
                }
              )
              .catch((error) =>
                console.log(
                  "Error while sending extending message. Error",
                  error?.message
                )
              );
            bot
              .sendMessage(
                ADMIN_CHATID,
                `🎉 *Renewal Alert!*\n\n${user.tgName} just renewed premium subscription for 1 month.`,
                {
                  parse_mode: "Markdown",
                }
              )
              .catch((error) => console.log(error?.message));
            bot
              .sendMessage(
                ADMIN_CHATID_2,
                `🎉 *Renewal Alert!*\n\n${user.tgName} just renewed premium subscription for 1 month.`,
                {
                  parse_mode: "Markdown",
                }
              )
              .catch((error) => console.log(error?.message));


          }

          return `Checked all addressess and found ${wallet.address} with min tolerance amount.`
        }
      } catch (error) {
        console.log(
          `Error while checking expired address ${wallet.address}. Error: ${error?.message}`
        );
        return "Error while checking addresses."; 
      }
    }

    return "No address found with minimum tolerance amount.";
  } catch (error) {
    console.log("Error while checking expired addresses", error?.message);
    return "Error while checking addresses.";
  }
};

module.exports = checkToleranceAmount;