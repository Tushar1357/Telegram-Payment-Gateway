const { generateWallet, encrypt } = require("../utils/cryptoUtils.js");
const User = require("../database/models/users/User.js");
const Wallet = require("../database/models/wallets/Wallets.js");
require("dotenv").config();

const createWalletForUser = async (tgId, tgName, tgUserName) => {
  let user = await User.findOne({ where: { tgId } });

  if (!user) {
    user = await User.create({
      tgId,
      tgName,
      tgUserName,
      subscriptionStatus: false,
    });
  }

  const existingWallet = await Wallet.findOne({
    where: { userId: user.id, status: "unpaid" },
    order: [["createdAt", "DESC"]],
  });

  if (existingWallet) {
    const walletAge = Date.now() - new Date(existingWallet.createdAt).getTime();
    const THIRTY_MINUTES = 30 * 60 * 1000;

    if (walletAge < THIRTY_MINUTES) {
      return {address: existingWallet.address, createdAt: existingWallet.createdAt};
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
  });

  return {address: wallet.address, createdAt: wallet.createdAt};
};

module.exports = { createWalletForUser };
