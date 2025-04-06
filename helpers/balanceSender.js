const Wallets = require("../database/models/wallets/Wallets.js");
const w3 = require("../configs/web3.js");
const { decrypt } = require("../utils/cryptoUtils.js");
require("dotenv").config();
const ERC20_ABI = require("../configs/abi.js")


const USDT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS;
const RECEIVER_ADDRESS = process.env.RECEIVER_ADDRESS;

const balanceSend = async () => {
  try {
    const walletDetails = await Wallets.findAll({
      where: {
        balanceSent: false,
      },
    });

    const usdtContract = new w3.eth.Contract(ERC20_ABI, USDT_ADDRESS);

    for (const wallet of walletDetails) {
      const tokenBalance = await usdtContract.methods.balanceOf(wallet.address).call();
      const tokenBalanceFormatted = w3.utils.fromWei(tokenBalance, "ether");

      if (parseFloat(tokenBalanceFormatted) > 0.01) {
        const decryptedPrivKey = decrypt(wallet.privateKey, wallet.iv);
        const account = w3.eth.accounts.privateKeyToAccount(decryptedPrivKey);
        const nonce = await w3.eth.getTransactionCount(wallet.address, "latest");

        const gasPrice = await w3.eth.getGasPrice();
        const data = usdtContract.methods.transfer(RECEIVER_ADDRESS, tokenBalance).encodeABI();

        const tx = {
          from: wallet.address,
          to: USDT_ADDRESS,
          gas: 100000, 
          gasPrice: 0,
          data: data,
          nonce,
        };

        const signedTx = await account.signTransaction(tx);
        const receipt = await w3.eth.sendSignedTransaction(signedTx.rawTransaction);

        await Wallets.update(
          { balanceSent: true },
          { where: { id: wallet.id } }
        );

        console.log(`Sent ${tokenBalanceFormatted} USDT from ${wallet.address}. TxHash: ${receipt.transactionHash}`);
      }
    }
  } catch (error) {
    console.error("Error sending USDT:", error);
  }
};

module.exports = { balanceSend };
