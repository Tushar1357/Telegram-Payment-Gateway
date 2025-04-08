const User = require("../database/models/users/User.js");

const createUser = async (tgId, tgName, tgUserName) => {
  try {
    await User.create({
      tgId,
      tgName,
      tgUserName,
      subscriptionStatus: false,
    });
  } catch (error) {
    console.log("Error while creating user. Error:", error?.message);
  }
};

module.exports = createUser;