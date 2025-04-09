const Wallets = require("../database/models/wallets/Wallets.js");
const { w3 } = require("../configs/web3.js");
const { decrypt } = require("../utils/cryptoUtils.js");
require("dotenv").config();
const {
  MIN_AMOUNT,
  MIN_BNB_BALANCE,
  MIN_ETH_BALANCE,
  MIN_ETH_TOPUP,
} = require("../configs/common.js");
const { formatUnits } = require("../helpers/common.js");
const chains = require("../configs/chains.js");
const { parseUnits } = require("ethers");

const RECEIVER_ADDRESS = process.env.RECEIVER_ADDRESS;
const MAIN_PRIVATE_KEY = process.env.MAIN_PRIVATE_KEY;
const MAIN_ADDRESS =
  w3.eth.accounts.privateKeyToAccount(MAIN_PRIVATE_KEY).address;

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

    if (formattedmainBnbBalance < MIN_BNB_BALANCE) {
      console.log("Insufficient BNB in main wallet to top up all addresses.");
    }
    if (formattedmainEthBalance < MIN_ETH_BALANCE) {
      console.log("Insufficient ETH in main wallet to top up all addresses.");
    }

    const mainNonces = {
      base: await chains["base"].web3.eth.getTransactionCount(
        MAIN_ADDRESS,
        "pending"
      ),
      bsc: await chains["bsc"].web3.eth.getTransactionCount(
        MAIN_ADDRESS,
        "pending"
      ),
    };

    for (const wallet of walletDetails) {
      try {
        const chain = chains[wallet.paymentChain];
        const web3 = chain.web3;

        if (
          wallet.paymentChain === "base" &&
          formattedmainEthBalance < MIN_ETH_BALANCE
        )
          continue;
        if (
          wallet.paymentChain === "bsc" &&
          formattedmainBnbBalance < MIN_BNB_BALANCE
        )
          continue;

        const tokenBalance = await chain.contract.methods
          .balanceOf(wallet.address)
          .call();
        const tokenBalanceFormatted = formatUnits(tokenBalance, chain.decimals);

        if (parseFloat(tokenBalanceFormatted) >= MIN_AMOUNT) {
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
            const mainChainBalance =
              wallet.paymentChain === "base"
                ? BigInt(mainEthBalance)
                : BigInt(mainBnbBalance);

            if (topUpAmount > mainChainBalance) {
              console.log(
                `TopUp amount is more than the main ${wallet.paymentChain.toUpperCase()} balance.`
              );
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
              )} to ${wallet.address}. TxHash: ${topUpReceipt.transactionHash}`
            );

            mainNonces[wallet.paymentChain]++; // increment nonce
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }

          const nonce = await web3.eth.getTransactionCount(
            wallet.address,
            "pending"
          );

          let tx = {
            from: wallet.address,
            to: chain.tokenAddress,
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
        }

        await new Promise((r) => setTimeout(r, 500));
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
