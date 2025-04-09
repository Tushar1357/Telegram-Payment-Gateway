const User = require("../database/models/users/User.js");
require("dotenv").config();

const REMINDER_DURATION = 5 * 24 * 60 * 60 * 1000;

const chatId = process.env.CHATID;

const subscriptionChecker = async (bot) => {
  try {
    console.log("Checking subscription...");
    const users = await User.findAll({
      where: {
        subscriptionStatus: true,
      },
    });

    const now = Date.now();

    for (const user of users) {
      try {
        const expiration = new Date(user.expiration).getTime();

        if (expiration < now) {
          const [updated] = await User.update(
            {
              subscriptionStatus: false,
            },
            {
              where: {
                id: user.id,
              },
            }
          );

          if (!updated) {
            console.log(
              "Error while updating subscription status for user:",
              user.id
            );
          } else {
            await bot.banChatMember(chatId, user.tgId);
            await bot.unbanChatMember(chatId, user.tgId);
            bot
              .sendMessage(
                user.tgId,
                `❗️ Your subscription expired on ${new Date(
                  expiration
                ).toUTCString()}.\nPlease renew to continue using our services.\nThanks!`
              )
              .catch((error) =>
                console.log(
                  "Error while sending subscription expiry. Error:",
                  error?.message
                )
              );
          }

          continue;
        }

        if (
          expiration - now <= REMINDER_DURATION &&
          expiration - now > 0 &&
          !user.reminderSent
        ) {
          bot
            .sendMessage(
              user.tgId,
              `⏳ Reminder: Your subscription will expire on ${new Date(
                expiration
              ).toUTCString()}.\nPlease renew within 5 days to avoid service interruption.`
            )
            .catch((error) =>
              console.log(
                "Error while sending 5 day reminder. Error",
                error?.message
              )
            );
          await User.update(
            {
              reminderSent: true,
            },
            {
              where: {
                id: user.id,
              },
            }
          );
        }
      } catch (error) {
        console.log(
          `Error while checking subscription of user: ${users.tgId}. Error: ${error?.message}`
        );
      }
    }
  } catch (error) {
    console.log("Error while checking subscription:", error);
  }
};

module.exports = { subscriptionChecker };
