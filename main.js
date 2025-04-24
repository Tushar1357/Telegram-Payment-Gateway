const { Web3 } = require("web3");
const TelegramBot = require("node-telegram-bot-api");
const syncDb = require("./database/sequelize.js");
const { createWalletForUser } = require("./services/walletService.js");
const checkBalance = require("./services/checkBalance.js");
const { balanceSend } = require("./services/balanceSender.js");
const { subscriptionChecker } = require("./services/subscriptionChecker.js");
const checkExpiredAddress = require("./services/checkExpiredAddress.js");
const checkValidity = require("./services/checkValidity.js");
const createUser = require("./services/createUser.js");
const { checkBothChains } = require("./services/checkBothChains.js");
const { MIN_AMOUNT } = require("./configs/common.js");
const createInviteLink = require("./services/createInviteLink.js");
const checkToleranceAmount = require("./services/checkToleranceamount.js");
const getTgId = require("./services/getTgId.js");
const sendMessage = require("./services/sendMessage.js");

const CHECK_BALANCE_INTERVAL = 15 * 1000;
const BALANCE_SEND_INTERVAL = 10 * 60 * 1000;
const SUBSCRIPTION_CHECK_INTERVAL = 10 * 60 * 1000;
const ADMIN_CHATID = process.env.ADMIN_CHATID;
const ADMIN_CHATID_2 = process.env.ADMIN_CHATID_2;

const bot = new TelegramBot(process.env.TOKEN, {
  polling: true,
});
syncDb();

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await createUser(msg.chat.id, msg.chat.first_name, msg.chat.username);

  const message = `
👋 *Welcome to Mr. S Premium!*

To access our private channel, you’ll need to purchase a subscription using *USDC on BSC (BEP-20) or BASE (Base Chain)*.

💳 *Steps to Subscribe:*
1. A unique wallet address will be generated for your payment.
2. Send the required USDC to that address within *30 minutes*.
3. Once payment is confirmed, you'll receive an invite link to join the channel.

🔁 We'll remind you 5 minutes before the address expires.

To get started, just click /subscribe

Need help? Contact @Skelter10 or @MrBean000.
`;

  await bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });
});

bot.onText(/\/subscribe/, async (msg) => {
  const chatId = msg.chat.id;

  const message = `💳 *Choose your payment method to proceed with the subscription:*`;
  const options = {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "USDC (BSC)", callback_data: "bsc" }],
        [{ text: "USDC (BASE)", callback_data: "base" }],
      ],
    },
  };

  await bot.sendMessage(chatId, message, options);
});

bot.onText(/\/check_expiry/, async (message) => {
  try {
    const chatId = message.chat.id;
    if (chatId === Number(ADMIN_CHATID) || chatId === Number(ADMIN_CHATID_2)) {
      const text = message.text.split(" ");
      const usertgId = Number(text[1]);
      const result = await checkExpiredAddress(usertgId);
      await bot.sendMessage(chatId, result);
    } else {
      await bot.sendMessage(
        message.chat.id,
        "Only admin can call this command."
      );
    }
  } catch (error) {
    console.log(error);
  }
});

bot.onText(/\/create_invite_link/, async (message) => {
  try {
    const chatId = message.chat.id;
    if (chatId === Number(ADMIN_CHATID) || chatId === Number(ADMIN_CHATID_2)) {
      const text = message.text.split(" ");
      const usertgId = Number(text[1]);
      const [result, status] = await createInviteLink(usertgId, bot);
      if (status) {
        bot
          .sendMessage(usertgId, result, {
            parse_mode: "Markdown",
            disable_web_page_preview: true,
          })
          .catch((error) =>
            console.log("Error while creating invite link", error?.message)
          );
      } else {
        return bot
          .sendMessage(chatId, result)
          .catch((error) => console.log(error?.message));
      }

      bot
        .sendMessage(chatId, "Link has been sent to the user.")
        .catch((error) =>
          console.log("Error while sending message to admin", error?.message)
        );
    } else {
      await bot.sendMessage(
        message.chat.id,
        "Only admin can call this command."
      );
    }
  } catch (error) {
    console.log(error);
  }
});

bot.onText(/\/check_both_chains/, async (message) => {
  try {
    const chatId = message.chat.id;
    if (chatId === Number(ADMIN_CHATID) || chatId === Number(ADMIN_CHATID_2)) {
      const text = message.text.split(" ");
      const usertgId = Number(text[1]);
      const result = await checkBothChains(usertgId);
      await bot.sendMessage(chatId, result);
    } else {
      await bot.sendMessage(
        message.chat.id,
        "Only admin can call this command."
      );
    }
  } catch (error) {
    console.log(error);
  }
});

bot.onText(/\/check_validity/, async (message) => {
  try {
    const chatId = message.chat.id;
    const result = await checkValidity(Number(chatId));

    if (result) {
      await bot.sendMessage(chatId, result);
    }
  } catch (error) {
    console.log(error);
  }
});

bot.onText(/\/check_tolerance/, async (message) => {
  try {
    const chatId = message.chat.id;
    if (chatId === Number(ADMIN_CHATID)) {
      const text = message.text.split(" ");
      const usertgId = Number(text[1]);
      const result = await checkToleranceAmount(usertgId, bot);
      if (result) {
        bot.sendMessage(chatId, result);
      }
    } else {
      await bot.sendMessage(
        message.chat.id,
        "Only admin can call this command."
      );
    }
  } catch (error) {
    console.log(error?.message);
  }
});

bot.onText(/^\/send_message (.+)/s, async (msg, match) => {
  const chatId = msg.chat.id;
  const textToSend = match[1];

  if (chatId === Number(ADMIN_CHATID)) {
    try {
      await bot.sendMessage(chatId, textToSend, {
        parse_mode: "HTML",
      });
    } catch (error) {
      console.error("Error sending message:", error?.message);
      bot.sendMessage(chatId, "❌ Failed to send message.");
    }
  }
});

bot.onText(/^\/send_message_all (.+)/s, async (msg, match) => {
  const chatId = msg.chat.id;
  const textToSend = match[1];

  if (chatId === Number(ADMIN_CHATID)) {
    try {
      await sendMessage(bot, textToSend);
      bot.sendMessage(chatId, "Message has been sent to all users.");
    } catch (error) {
      console.error("Error sending message:", error);
      bot.sendMessage(chatId, "❌ Failed to send message.");
    }
  }
});

bot.on("message", async (message) => {
  try {
    const chatId = message.chat.id;

    if (
      message?.forward_from &&
      message?.forward_date &&
      (chatId === Number(ADMIN_CHATID) || chatId === Number(ADMIN_CHATID_2))
    ) {
      const firstName = message.forward_from.first_name || "Unknown";
      const userId = message.forward_from.id;

      if (userId) {
        bot.sendMessage(chatId, `${firstName} - \`${userId}\``, {
          parse_mode: "Markdown",
        });
      } else {
        bot.sendMessage(chatId, "Couldn't extract forwarded user ID.");
      }
    } else if (message?.forward_sender_name) {
      const result = await getTgId(message.forward_sender_name);
      bot.sendMessage(chatId, result, {
        parse_mode: "Markdown",
      });
    }
  } catch (error) {
    console.error("Error handling forwarded message:", error);
  }
});

bot.on("callback_query", async (query) => {
  try {
    const chatId = query.message.chat.id;
    const choice = query.data;

    await bot.answerCallbackQuery(query.id);
    if (!["bsc", "base"].includes(choice)) {
      await bot.sendMessage(
        chatId,
        "No chain selected for payment or Invalid chain."
      );
      return;
    }
    const chainLabel = choice === "bsc" ? "BSC" : "BASE";

    let wallet;
    try {
      wallet = await createWalletForUser(
        query.from.id,
        query.from.first_name,
        query.from.username,
        choice
      );
    } catch (err) {
      console.error("Wallet creation failed:", err);
      return bot
        .sendMessage(
          chatId,
          "⚠️ Failed to create wallet. Please try again later."
        )
        .catch((error) => console.log(error));
    }

    const { status, address, createdAt } = wallet;

    const expiry = new Date(new Date(createdAt).getTime() + 30 * 60 * 1000);

    if (status === "new") {
      await bot.sendMessage(
        chatId,
        `🔗 Generating a ${chainLabel} USDC wallet for you...`
      );
      await new Promise((r) => setTimeout(r, 500));
      await bot.sendMessage(
        chatId,
        `💰 USDC Amount: *${MIN_AMOUNT}*\n\n📥 Send only *USDC (${chainLabel})* to:\n\`${address}\`\n\n⏳ You have 30 minutes to complete the payment. Your address will expire at ${expiry.toUTCString()}\n❗ If you pay late, please contact support at @Skelter10 or @MrBean000.\n\n✅ *Important Notes:*\n- No need to send transaction hash or screenshot.\n- Your deposit will be detected automatically. (Will roughly take 15-20 seconds.)\n- Transaction fees must be covered by you.\n- Make sure the amount is *not less* than the required *${MIN_AMOUNT} USDC*.\n- Send only *(${chainLabel}) USDC* (${
          choice === "bsc" ? "Binance smart chain" : "Base Chain"
        }). Sending from other networks may result in loss of funds.`,
        {
          parse_mode: "Markdown",
        }
      );
    } else if (status === "changed_chain") {
      await bot.sendMessage(
        chatId,
        `Note: _You have changed the chain from ${
          choice === "base" ? "BSC" : "BASE"
        } to ${choice.toUpperCase()}._\n\n💰 USDC Amount: *${MIN_AMOUNT}*\n\n📥 Send only *USDC (${chainLabel})* to:\n\`${address}\`\n\n⏳ You have 30 minutes to complete the payment. Your address will expire at ${expiry.toUTCString()}\n❗ If you pay late, please contact support at @Skelter10 or @MrBean000.\n\n✅ *Important Notes:*\n- No need to send transaction hash or screenshot.\n- Your deposit will be detected automatically. (Will roughly take 15-20 seconds.)\n- Transaction fees must be covered by you.\n- Make sure the amount is *not less* than the required *${MIN_AMOUNT} USDC*.\n- Send only *(${chainLabel}) USDC* (${
          choice === "bsc" ? "Binance smart chain" : "Base Chain"
        }). Sending from other networks may result in loss of funds.`,
        {
          parse_mode: "Markdown",
        }
      );
    } else if (status === "old") {
      await bot.sendMessage(
        chatId,
        `Note: _You are already having a pending payment of 10$ on ${choice.toUpperCase()} chain. Please complete that or wait for 30 minutes to generate a new address._\n\n💰 USDC Amount: *${MIN_AMOUNT}*\n\n📥 Send only *USDC (${chainLabel})* to:\n\`${address}\`\n\n⏳ You have 30 minutes to complete the payment. Your address will expire at ${expiry.toUTCString()}\n❗ If you pay late, please contact support at @Skelter10 or @MrBean000.\n\n✅ *Important Notes:*\n- No need to send transaction hash or screenshot.\n- Your deposit will be detected automatically. (Will roughly take 15-20 seconds.)\n- Transaction fees must be covered by you.\n- Make sure the amount is *not less* than the required *${MIN_AMOUNT} USDC*.\n- Send only *(${chainLabel}) USDC* (${
          choice === "bsc" ? "Binance smart chain" : "Base Chain"
        }). Sending from other networks may result in loss of funds.`,
        {
          parse_mode: "Markdown",
        }
      );
    }

    try {
      await bot.deleteMessage(query.message.chat.id, query.message.message_id);
    } catch (err) {
      console.log("Failed to delete message:", err.message);
    }
  } catch (error) {
    console.error("Error in callback_query:", error);
    bot.sendMessage(
      query.message.chat.id,
      "⚠️ Something went wrong. Please try again later."
    );
  }
});

bot.on("chat_join_request", async (request) => {
  try {
    const chatId = request.from.id;
    const groupId = request.chat.id;
    const constGroupId = -4608904469;
    if (groupId === constGroupId) {
      const result = await bot.getChatMember(process.env.CHATID, chatId);
      if (result.status === "member") {
        bot.approveChatJoinRequest(groupId, chatId);
      } else {
        bot.declineChatJoinRequest(groupId, chatId);
        console.log(
          `${result.user.id} - ${result.user.first_name} ${result.user.last_name}`
        );
      }
    }
  } catch (error) {
    console.log(error?.message);
  }
});

bot.onText(/\/support/, (message) => {
  bot
    .sendMessage(
      message.chat.id,
      "Please contact support at @Skelter10 or @MrBean000."
    )
    .catch((error) =>
      console.log("Error while sending support message", error?.message)
    );
});

setInterval(() => {
  checkBalance(bot);
}, CHECK_BALANCE_INTERVAL);

setInterval(() => {
  balanceSend();
}, BALANCE_SEND_INTERVAL);

setInterval(() => {
  subscriptionChecker(bot);
}, SUBSCRIPTION_CHECK_INTERVAL);

process.on("SIGINT", () => {
  console.log("Bot shutting down...");
  bot.stopPolling();
  process.exit();
});
