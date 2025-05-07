const Wallets = require("../database/models/wallets/Wallets.js");
const { w3 } = require("../configs/web3.js");
const { decrypt } = require("../utils/cryptoUtils.js");
require("dotenv").config();
const {
  MIN_AMOUNT,
  MIN_BNB_BALANCE,
  MIN_ETH_BALANCE,
  MIN_ETH_TOPUP,
  MIN_TOLERANCE,
} = require("../configs/common.js");
const { formatUnits } = require("../helpers/common.js");
const chains = require("../configs/chains.js");
const { parseUnits } = require("ethers");

const RECEIVER_ADDRESS = process.env.RECEIVER_ADDRESS;
const MAIN_PRIVATE_KEY = process.env.MAIN_PRIVATE_KEY;
const MAIN_ADDRESS = w3.eth.accounts.privateKeyToAccount(MAIN_PRIVATE_KEY).address;

const balanceSend = async () => {
  try {
    const walletDetails = await Wallets.findAll({ where: { balanceSent: false } });
    console.log("Sending balance...");

    const mainBnbBalance = await chains.bsc.usdc.web3.eth.getBalance(MAIN_ADDRESS);
    const mainEthBalance = await chains.base.usdc.web3.eth.getBalance(MAIN_ADDRESS);

    const formattedMainBnb = parseFloat(chains.bsc.usdc.web3.utils.fromWei(mainBnbBalance, "ether"));
    const formattedMainEth = parseFloat(chains.base.usdc.web3.utils.fromWei(mainEthBalance, "ether"));

    if (formattedMainBnb < MIN_BNB_BALANCE) {
      console.log("❌ Insufficient BNB in main wallet.");
    }
    if (formattedMainEth < MIN_ETH_BALANCE) {
      console.log("❌ Insufficient ETH in main wallet.");
    }

    const mainNonces = {
      base: await chains.base.usdc.web3.eth.getTransactionCount(MAIN_ADDRESS, "pending"),
      bsc: await chains.bsc.usdc.web3.eth.getTransactionCount(MAIN_ADDRESS, "pending"),
    };

    for (const wallet of walletDetails) {
      try {
        const chainTokenConfig = chains?.[wallet.paymentChain]?.[wallet.tokenSymbol?.toLowerCase()];
        if (!chainTokenConfig) {
          console.log(`⚠️ No token config found for ${wallet.paymentChain} / ${wallet.tokenSymbol}`);
          continue;
        }

        const web3 = chainTokenConfig.web3;
        const contract = chainTokenConfig.contract;
        const decimals = chainTokenConfig.decimals;
        const tokenLabel = wallet.tokenSymbol.toUpperCase();

        const nativeBalance = await web3.eth.getBalance(wallet.address);
        const tokenBalance = await contract.methods.balanceOf(wallet.address).call();
        const tokenBalanceFormatted = formatUnits(tokenBalance, decimals);

        if (parseFloat(tokenBalanceFormatted) >= MIN_TOLERANCE) {
          console.log(`🔍 Preparing to send ${tokenBalanceFormatted} ${tokenLabel} from ${wallet.address} (${wallet.paymentChain})`);

          const decryptedPrivKey = decrypt(wallet.privateKey, wallet.iv);
          const account = web3.eth.accounts.privateKeyToAccount(decryptedPrivKey);

          const data = contract.methods.transfer(RECEIVER_ADDRESS, tokenBalance).encodeABI();
          const gasPrice = await web3.eth.getGasPrice();
          const gasLimit = await contract.methods.transfer(RECEIVER_ADDRESS, tokenBalance).estimateGas({ from: wallet.address });

          let requiredNative;
          if (wallet.paymentChain === "base") {
            requiredNative = BigInt(w3.utils.toWei(MIN_ETH_TOPUP, "ether"));
          } else {
            requiredNative = BigInt(gasLimit) * BigInt(gasPrice);
          }

          const nativeBalanceBN = BigInt(nativeBalance);
          if (nativeBalanceBN < requiredNative) {
            const topUpAmount = requiredNative - nativeBalanceBN;
            const mainChainBalance = wallet.paymentChain === "base" ? BigInt(mainEthBalance) : BigInt(mainBnbBalance);

            if (topUpAmount > mainChainBalance) {
              console.log(`❌ Top-up required (${wallet.paymentChain}) exceeds main wallet balance.`);
              continue;
            }

            let topUpTx = {
              from: MAIN_ADDRESS,
              to: wallet.address,
              value: topUpAmount.toString(),
              gas: 21000,
              gasPrice,
              nonce: mainNonces[wallet.paymentChain],
            };

            if (wallet.paymentChain === "base") {
              topUpTx.maxFeePerGas = parseUnits("0.1", "gwei");
              topUpTx.maxPriorityFeePerGas = parseUnits("0.1", "gwei");
              delete topUpTx.gasPrice;
            }

            const signedTopUpTx = await web3.eth.accounts.signTransaction(topUpTx, MAIN_PRIVATE_KEY);
            const topUpReceipt = await web3.eth.sendSignedTransaction(signedTopUpTx.rawTransaction);

            console.log(`✅ Topped up native token to ${wallet.address}. Tx: ${topUpReceipt.transactionHash}`);
            mainNonces[wallet.paymentChain]++;
            await new Promise((res) => setTimeout(res, 3000));
          }

          const nonce = await web3.eth.getTransactionCount(wallet.address, "pending");

          let tx = {
            from: wallet.address,
            to: chainTokenConfig.tokenAddress,
            data,
            gas: gasLimit,
            gasPrice,
            nonce,
          };

          if (wallet.paymentChain === "base") {
            tx.maxFeePerGas = parseUnits("0.1", "gwei");
            tx.maxPriorityFeePerGas = parseUnits("0.1", "gwei");
            delete tx.gasPrice;
          }

          const signedTx = await account.signTransaction(tx);
          const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

          await Wallets.update({ balanceSent: true }, { where: { id: wallet.id } });

          console.log(`✅ Sent ${tokenBalanceFormatted} ${tokenLabel} from ${wallet.address}. Tx: ${receipt.transactionHash}`);
        }

        await new Promise((res) => setTimeout(res, 500));
      } catch (error) {
        console.log(`❌ Error sending from ${wallet.address}. ${error?.message}`);
      }
    }
  } catch (error) {
    console.error("❌ Error in balanceSend:", error);
  }
};

module.exports = { balanceSend };
