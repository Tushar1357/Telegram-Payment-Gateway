const User = require("../database/models/users/User.js");

const sendMessage = async (bot, text) => {
  try {
    const userList = await User.findAll();
    for (const user of userList) {
      if (user?.tgId) {
        bot
          .sendMessage(Number(user.tgId), text, {
            parse_mode: "HTML",
          })
          .catch((error) =>
            console.log(
              `Error sending message to ${user.tgId}. Error : ${error?.message}`
            )
          );
      }
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = sendMessage;
