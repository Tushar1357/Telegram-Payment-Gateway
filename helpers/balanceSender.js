const Wallets = require("../database/models/wallets/Wallets.js");
const w3 = require("../configs/web3.js");
const { decrypt } = require("../utils/cryptoUtils.js")
require("dotenv").config();

const balanceSend = async () => {
  try {
    const walletDetails = await Wallets.findAll({
      where: {
        balanceSent: false,
      },
    });

    for (const wallet of walletDetails) {
      const balanceWei = await w3.eth.getBalance(wallet.address);
      const balanceEth = w3.utils.fromWei(balanceWei, "ether");

      if (parseFloat(balanceEth) > 0.0001) {
        const decryptedPrivKey = decrypt(wallet.privateKey, wallet.iv);

        const account = w3.eth.accounts.privateKeyToAccount(decryptedPrivKey)
        const nonce = await w3.eth.getTransactionCount(wallet.address, "latest");

        const gasPrice = await w3.eth.getGasPrice();
        const gasLimit = 21000;

        const tx = {
          from: wallet.address,
          to: process.env.RECEIVER_ADDRESS,
          value: balanceWei - BigInt(gasLimit) * BigInt(gasPrice),
          gas: gasLimit,
          gasPrice: gasPrice,
          nonce,
        };

        const signedTx = await account.signTransaction(tx);
        const receipt = await w3.eth.sendSignedTransaction(signedTx.rawTransaction);

        await Wallets.update(
          { balanceSent: true },
          { where: { id: wallet.id } }
        );

        console.log(`Sent ${balanceEth} BNB from ${wallet.address}. TxHash: ${receipt.transactionHash}`);
      }
    }
  } catch (error) {
    console.error("Error sending balance:", error);
  }
};

module.exports = { balanceSend };
