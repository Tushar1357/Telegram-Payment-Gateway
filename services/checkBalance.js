const Wallets = require("../database/models/wallets/Wallets.js");
const User = require("../database/models/users/User.js");
const updateSubscription = require("./subscriptionService.js");
require("dotenv").config();
const {MIN_AMOUNT} = require("../configs/common.js")
const { formatUnits } = require("../helpers/common.js");
const chains = require("../configs/chains.js");

const TIMEOUT = 30 * 60 * 1000;
const REMINDER_TIME = 5 * 60 * 1000;

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
          await bot.sendMessage(
            user.tgId,
            `⏰ Reminder: You have 5 minutes left to complete your payment of ${MIN_AMOUNT} USDC (${wallet.paymentChain.toUpperCase()}). Please complete it soon or the address will expire.`
          );
        }
        if (time < Date.now()) {
          await Wallets.update(
            { status: "expired" },
            { where: { id: wallet.id } }
          );
          await bot.sendMessage(
            user.tgId,
            `Your payment time is over and the wallet address ${wallet.address} has expired. Kindly click on /subscribe to restart the process.`
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

          const channelLink = await bot.createChatInviteLink(chatId, {
            member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 60,
          });
          await bot.sendMessage(
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
          );
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
