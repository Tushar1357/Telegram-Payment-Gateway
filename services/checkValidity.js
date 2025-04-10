const User = require("../database/models/users/User.js");

const checkValidity = async (tgId) => {
  try {
    const user = await User.findOne({ where: { tgId } });

    if (!user) {
      return "No user found with this ID.";
    }

    const expiration = user.expiration;

    if (!expiration) {
      return "No active plan for user. Please click on /subscribe to buy your plan.";
    }

    const now = Date.now();
    const expirationTime = expiration.getTime();

    if (now > expirationTime) {
      return `Plan has already expired on ${expiration.toDateString()}. Please click on /subscribe to renew your plan.`;
    }

    const remainingDays = Math.max(
      0,
      Math.ceil((expirationTime - now) / (24 * 60 * 60 * 1000))
    );

    return `🗓 Plan validity: ${expiration.toDateString()}\n\n🕒 Remaining days: ${remainingDays}\n\nIf you want to add more days to the current plan, please click on /subscribe to increase the validity.`;
  } catch (error) {
    console.error(`Error while checking validity for user ${tgId}:`, error);
    return "❌ Error while checking validity. Please try again.";
  }
};


module.exports = checkValidity;