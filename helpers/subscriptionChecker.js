const User = require("../database/models/users/User.js");

const REMINDER_DURATION = 5 * 24 * 60 * 60 * 1000;

const subscriptionChecker = async (bot) => {
  try {
    const users = await User.findAll({
      where: {
        subscriptionStatus: true,
      },
    });

    const now = Date.now();

    for (const user of users) {
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
          bot.sendMessage(
            user.tgId,
            `❗️ Your subscription expired on ${new Date(
              expiration
            ).toUTCString()}.\nPlease renew to continue using our services.\nThanks!`
          );
        }

        continue;
      }

      if (
        expiration - now <= REMINDER_DURATION &&
        expiration - now > 0 &&
        !user.reminderSent
      ) {
        bot.sendMessage(
          user.tgId,
          `⏳ Reminder: Your subscription will expire on ${new Date(
            expiration
          ).toUTCString()}.\nPlease renew within 5 days to avoid service interruption.`
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
    }
  } catch (error) {
    console.log("Error while checking subscription:", error);
  }
};

module.exports = { subscriptionChecker };
