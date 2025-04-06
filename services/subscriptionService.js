const User = require("../database/models/users/User.js");

const DURATION = 30 * 24 * 60 * 60 * 1000;

const updateSubscription = async (user) => {
  try {
    let newExpirationTime;

    if (user.subscriptionStatus && user.expiration) {
      const currentExpirationTime = new Date(user.expiration).getTime();
      newExpirationTime = currentExpirationTime + DURATION;
    } else {
      newExpirationTime = Date.now() + DURATION;
    }

    const [updated] = await User.update(
      {
        expiration: new Date(newExpirationTime),
        subscriptionStatus: true,
        reminderSent: false
      },
      {
        where: {
          id: user.id,
        },
      }
    );

    if (!updated) {
      console.log("Could not update expiration time for user:", user.id);
    }

    return newExpirationTime
  } catch (error) {
    console.error("Error in updateSubscription:", error);
    return null;
  }
};

module.exports = updateSubscription;
