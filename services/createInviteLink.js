const User = require("../database/models/users/User.js");
require("dotenv").config();
const channelchatId = process.env.CHATID;

const createInviteLink = async (tgId, bot) => {
  try {
    const user = await User.findOne({
      where: {
        tgId,
      },
    });
    if (!user) {
      return ["No user found with this id", false];
    }

    const details = await bot.getChatMember(channelchatId, tgId)
    
    if (details.status === "member"){
      return ["User has already joined the channel", false]
    }

    if (user.subscriptionStatus && user.expiration) {
      const expiration = new Date(user.expiration).getTime();
      if (expiration - Date.now() >= 60 * 60 * 1000) {
        const channelLink = await bot.createChatInviteLink(channelchatId, {
          member_limit: 1,
          expire_date: Math.floor(Date.now() / 1000) + 60 * 60,
        });
        return [
          `Here is your new invite Link\n\n🔗 *Access the Channel:*\n[Click here to join](${channelLink.invite_link})\n\nLink is valid for 1 hour.`,
          true,
        ];
      } else {
        return ["User expiration is less than 1 hour.", false];
      }
    }
    return ["User isn't subscribe to the channel", false];
  } catch (error) {
    console.log("Error while creating invite link.", error?.message);
    return [`Error while creating invite link., ${error?.message}`, false];
  }
};

module.exports = createInviteLink;
