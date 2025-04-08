const Wallets = require("../database/models/wallets/Wallets.js");
const { w3 } = require("../configs/web3.js");
const { decrypt } = require("../utils/cryptoUtils.js");
require("dotenv").config();

const { formatUnits } = require("../helpers/common.js");
const chains = require("../configs/chains.js");

const RECEIVER_ADDRESS = process.env.RECEIVER_ADDRESS;
const MAIN_PRIVATE_KEY = process.env.MAIN_PRIVATE_KEY;
const MAIN_ADDRESS =
  w3.eth.accounts.privateKeyToAccount(MAIN_PRIVATE_KEY).address;
const MIN_BNB_BALANCE = 0.001;
const MIN_ETH_BALANCE = 0.00001;

const MIN_ETH_TOPUP = 0.00001;

const balanceSend = async () => {
  try {
    const walletDetails = await Wallets.findAll({
      where: {
        balanceSent: false,
      },
    });
    console.log("Sending balance...");

    const mainBnbBalance = await chains["bsc"].web3.eth.getBalance(
      MAIN_ADDRESS
    );
    const mainEthBalance = await chains["base"].web3.eth.getBalance(
      MAIN_ADDRESS
    );

    const formattedmainBnbBalance = parseFloat(
      chains["bsc"].web3.utils.fromWei(mainBnbBalance, "ether")
    );
    const formattedmainEthBalance = parseFloat(
      chains["base"].web3.utils.fromWei(mainEthBalance, "ether")
    );
    if (
      parseFloat(chains["bsc"].web3.utils.fromWei(mainBnbBalance, "ether")) <
      MIN_BNB_BALANCE
    ) {
      console.log("Insufficient BNB in main wallet to top up all addresses.");
    } else if (
      parseFloat(chains["base"].web3.utils.fromWei(mainEthBalance, "ether")) <
      MIN_ETH_BALANCE
    ) {
      console.log("Insufficient ETH in main wallet to top up all addresses.");
    }

    for (const wallet of walletDetails) {
      try {
        if (wallet.paymentChain === "base") {
          if (formattedmainEthBalance < MIN_ETH_BALANCE) {
            continue;
          }
        } else {
          if (formattedmainBnbBalance < MIN_BNB_BALANCE) {
            continue;
          }
        }
        const chain = chains[wallet.paymentChain];
        const web3 = chain.web3;

        const tokenBalance = await chain.contract.methods
          .balanceOf(wallet.address)
          .call();
        const tokenBalanceFormatted = formatUnits(tokenBalance, chain.decimals);

        if (parseFloat(tokenBalanceFormatted) >= 0.01) {
          console.log(
            `🔍 Preparing to send ${tokenBalanceFormatted} USDC from ${wallet.address} (${wallet.paymentChain})`
          );

          const decryptedPrivKey = decrypt(wallet.privateKey, wallet.iv);
          const account =
            web3.eth.accounts.privateKeyToAccount(decryptedPrivKey);
          const tokenContract = chain.contract;

          const data = tokenContract.methods
            .transfer(RECEIVER_ADDRESS, tokenBalance)
            .encodeABI();

          const gasPrice = await web3.eth.getGasPrice();

          const gasLimit = await tokenContract.methods
            .transfer(RECEIVER_ADDRESS, tokenBalance)
            .estimateGas({ from: wallet.address });

          let requiredNative;
          if (wallet.paymentChain === "base") {
            requiredNative = BigInt(w3.utils.toWei(MIN_ETH_TOPUP, "ether"));
          } else {
            requiredNative = BigInt(gasLimit) * BigInt(gasPrice);
          }

          const nativeBalance = await web3.eth.getBalance(wallet.address);
          const nativeBalanceBN = BigInt(nativeBalance);

          if (nativeBalanceBN < requiredNative) {
            const topUpAmount = requiredNative - nativeBalanceBN;

            if (wallet.paymentChain === "base") {
              if (topUpAmount > mainEthBalance) {
                console.log("TopUp amount is more than the main ETH balance.");
                continue;
              }
            } else {
              if (topUpAmount > mainBnbBalance) {
                console.log("TopUp amount is more than the main BNB balance.");
                continue;
              }
            }

            const mainNonce = await web3.eth.getTransactionCount(
              MAIN_ADDRESS,
              "latest"
            );

            const topUpTx = {
              from: MAIN_ADDRESS,
              to: wallet.address,
              value: topUpAmount.toString(),
              gas: 21000,
              gasPrice,
              nonce: mainNonce,
            };

            const signedTopUpTx = await web3.eth.accounts.signTransaction(
              topUpTx,
              MAIN_PRIVATE_KEY
            );
            const topUpReceipt = await web3.eth.sendSignedTransaction(
              signedTopUpTx.rawTransaction
            );

            console.log(
              `✅ Sent ${web3.utils.fromWei(
                topUpAmount.toString(),
                "ether"
              )} ETH/BNB to ${wallet.address} for gas. TxHash: ${
                topUpReceipt.transactionHash
              }`
            );
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }

          const nonce = await web3.eth.getTransactionCount(
            wallet.address,
            "latest"
          );

          const tx = {
            from: wallet.address,
            to: chain.tokenAddress,
            data,
            gas: gasLimit,
            gasPrice,
            nonce,
          };

          const signedTx = await account.signTransaction(tx);
          const receipt = await web3.eth.sendSignedTransaction(
            signedTx.rawTransaction
          );

          await Wallets.update(
            { balanceSent: true },
            { where: { id: wallet.id } }
          );

          console.log(
            `✅ [${wallet.paymentChain.toUpperCase()}] Sent ${tokenBalanceFormatted} USDC from ${
              wallet.address
            }. TxHash: ${receipt.transactionHash}`
          );

          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (error) {
        console.log(
          `Error while sending balance from wallet ${wallet.address}. Error: ${error?.message}`
        );
      }
    }
  } catch (error) {
    console.error("Error sending USDC:", error);
  }
};

module.exports = { balanceSend };
