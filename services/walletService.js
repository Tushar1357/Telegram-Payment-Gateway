const { generateWallet, encrypt } = require("../utils/cryptoUtils.js");
const User = require("../database/models/users/User.js");
const Wallet = require("../database/models/wallets/Wallets.js");
require("dotenv").config();

const createWalletForUser = async (tgId, tgName, tgUserName, paymentChain) => {
  let user = await User.findOne({ where: { tgId } });

  if (!user) {
    user = await User.create({
      tgId,
      tgName,
      tgUserName,
      subscriptionStatus: false,
    });
  }

  if (!paymentChain) {
    console.log("No payment chain");
    return { address: "", createdAt: "" };
  }

  const existingWallet = await Wallet.findOne({
    where: { userId: user.id, status: "unpaid" },
    order: [["createdAt", "DESC"]],
  });

  if (existingWallet) {
    const walletAge = Date.now() - new Date(existingWallet.createdAt).getTime();
    const THIRTY_MINUTES = 30 * 60 * 1000;

    if (existingWallet.paymentChain !== paymentChain) {
      await Wallet.update(
        {
          paymentChain,
          createdAt: new Date(Date.now()),
        },
        {
          where: {
            id: existingWallet.id,
          },
        }
      );
      return {
        address: existingWallet.address,
        createdAt: new Date(Date.now()),
      };
    }
    if (walletAge < THIRTY_MINUTES) {
      return {
        address: existingWallet.address,
        createdAt: existingWallet.createdAt,
      };
    } else {
      await Wallet.update(
        { status: "expired" },
        { where: { id: existingWallet.id } }
      );
    }
  }

  const { address, privateKey } = generateWallet();
  const { encryptedPrivateKey, iv } = encrypt(privateKey);
  const wallet = await Wallet.create({
    address,
    privateKey: encryptedPrivateKey,
    iv,
    status: "unpaid",
    userId: user.id,
    paymentChain,
  });

  return { address: wallet.address, createdAt: wallet.createdAt };
};

module.exports = { createWalletForUser };
