const Wallets = require("../database/models/wallets/Wallets.js");
const User = require("../database/models/users/User.js");
const updateSubscription = require("./subscriptionService.js");
require("dotenv").config();
const { MIN_AMOUNT } = require("../configs/common.js");
const { formatUnits } = require("../helpers/common.js");
const chains = require("../configs/chains.js");

const TIMEOUT = 30 * 60 * 1000;
const REMINDER_TIME = 5 * 60 * 1000;

const ADMIN_CHATID = process.env.ADMIN_CHATID;
const ADMIN_CHATID_2 = process.env.ADMIN_CHATID_2;
const chatId = process.env.CHATID;

const checkBalance = async (bot) => {
  try {
    const walletDetail = await Wallets.findAll({
      where: {
        status: "unpaid",
      },
    });

    for (const wallet of walletDetail) {
      try {
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
          bot
            .sendMessage(
              user.tgId,
              `⏰ Reminder: You have 5 minutes left to complete your payment of ${MIN_AMOUNT} USDC (${wallet.paymentChain.toUpperCase()}). Please complete it soon or the address will expire.`
            )
            .catch((error) =>
              console.log(
                "Error while sending 5 minute reminder. Error:",
                error?.message
              )
            );
        }
        if (time < Date.now()) {
          await Wallets.update(
            { status: "expired" },
            { where: { id: wallet.id } }
          );
          bot
            .sendMessage(
              user.tgId,
              `Your payment time is over and the wallet address ${wallet.address} has expired. Kindly click on /subscribe to restart the process.`
            )
            .catch((error) =>
              console.log(
                "Error while sending expiry reminder. Error: ",
                error?.message
              )
            );
          continue;
        }

        const tokenBalance = await chains[wallet.paymentChain].contract.methods
          .balanceOf(wallet.address)
          .call();
        const tokenBalanceFormatted = formatUnits(
          tokenBalance,
          chains[wallet.paymentChain].decimals
        );

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
        }
        await new Promise((r) => setTimeout(r, 100));
      } catch (error) {
        console.log(
          `Error while checking wallet ${wallet.address}. Error:`,
          error?.message
        );
      }
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = checkBalance;
