const { generateWallet, encrypt } = require("../utils/cryptoUtils.js");
const User = require("../database/models/users/User.js");
const Wallet = require("../database/models/wallets/Wallets.js");
require("dotenv").config();

const createWalletForUser = async (tgId, tgName, tgUserName, paymentChain, tokenSymbol) => {
  try {
    let user = await User.findOne({ where: { tgId } });

    if (!user) {
      user = await User.create({
        tgId,
        tgName,
        tgUserName,
        subscriptionStatus: false,
      });
    }

    if (!paymentChain || !tokenSymbol) {
      console.log("Missing payment chain or token symbol.");
      return { address: "", createdAt: "" };
    }

    const existingWallet = await Wallet.findOne({
      where: {
        userId: user.id,
        status: "unpaid",
      },
      order: [["createdAt", "DESC"]],
    });

    const THIRTY_MINUTES = 30 * 60 * 1000;

    if (existingWallet) {
      const walletAge = Date.now() - new Date(existingWallet.createdAt).getTime();

      // Handle chain OR token change
      if (
        existingWallet.paymentChain !== paymentChain ||
        existingWallet.tokenSymbol !== tokenSymbol
      ) {
        await Wallet.update(
          {
            paymentChain,
            tokenSymbol,
            createdAt: new Date(Date.now()),
          },
          {
            where: { id: existingWallet.id },
          }
        );

        return {
          status: "changed_chain",
          address: existingWallet.address,
          createdAt: new Date(Date.now()),
        };
      }

      if (walletAge < THIRTY_MINUTES) {
        return {
          status: "old",
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
      tokenSymbol,
    });

    return {
      status: "new",
      address: wallet.address,
      createdAt: wallet.createdAt,
    };
  } catch (error) {
    console.log(`Error while creating wallet address. Error: ${error?.message}`);
  }
};


module.exports = { createWalletForUser };
