const Wallets = require("../database/models/wallets/Wallets.js");
const w3 = require("../configs/web3.js");
const { decrypt } = require("../utils/cryptoUtils.js");
require("dotenv").config();
const ERC20_ABI = require("../configs/abi.js");

const USDT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS;
const RECEIVER_ADDRESS = process.env.RECEIVER_ADDRESS;
const MAIN_PRIVATE_KEY = process.env.MAIN_PRIVATE_KEY;
const MAIN_ADDRESS = w3.eth.accounts.privateKeyToAccount(MAIN_PRIVATE_KEY).address;
const TOPUP_AMOUNT = w3.utils.toWei("0.001", "ether"); 

const balanceSend = async () => {
  try {
    const walletDetails = await Wallets.findAll({
      where: {
        balanceSent: false,
      },
    });
    console.log("Sending balance...");

    const usdtContract = new w3.eth.Contract(ERC20_ABI, USDT_ADDRESS);

    for (const wallet of walletDetails) {
      const tokenBalance = await usdtContract.methods.balanceOf(wallet.address).call();
      const tokenBalanceFormatted = w3.utils.fromWei(tokenBalance, "ether");

      if (parseFloat(tokenBalanceFormatted) >= 0.01) {
        const mainNonce = await w3.eth.getTransactionCount(MAIN_ADDRESS, "latest");
        const gasPrice = await w3.eth.getGasPrice();

        const gasTx = {
          from: MAIN_ADDRESS,
          to: wallet.address,
          value: TOPUP_AMOUNT,
          gas: 21000,
          gasPrice,
          nonce: mainNonce,
        };

        const signedGasTx = await w3.eth.accounts.signTransaction(gasTx, MAIN_PRIVATE_KEY);
        const gasReceipt = await w3.eth.sendSignedTransaction(signedGasTx.rawTransaction);

        console.log(`✅ Sent ${w3.utils.fromWei(TOPUP_AMOUNT)} BNB to ${wallet.address}. TxHash: ${gasReceipt.transactionHash}`);

        await new Promise(resolve => setTimeout(resolve, 3000));

        const decryptedPrivKey = decrypt(wallet.privateKey, wallet.iv);
        const account = w3.eth.accounts.privateKeyToAccount(decryptedPrivKey);
        const nonce = await w3.eth.getTransactionCount(wallet.address, "latest");

        const data = usdtContract.methods.transfer(RECEIVER_ADDRESS, tokenBalance).encodeABI();

        const tx = {
          from: wallet.address,
          to: USDT_ADDRESS,
          gas: 100000,
          gasPrice,
          data,
          nonce,
        };

        const signedTx = await account.signTransaction(tx);
        const receipt = await w3.eth.sendSignedTransaction(signedTx.rawTransaction);

        await Wallets.update(
          { balanceSent: true },
          { where: { id: wallet.id } }
        );

        console.log(`✅ Sent ${tokenBalanceFormatted} USDT from ${wallet.address}. TxHash: ${receipt.transactionHash}`);
      }
    }
  } catch (error) {
    console.error("Error sending USDT:", error);
  }
};

module.exports = { balanceSend };
