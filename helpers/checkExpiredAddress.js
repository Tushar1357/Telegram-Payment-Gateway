const Wallets = require("../database/models/wallets/Wallets.js");
const User = require('../database/models/users/User.js')
const w3 = require("../configs/web3.js")
require("dotenv").config();

const ERC20_ABI = require("../configs/abi.js");

const USDT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS;

const MIN_AMOUNT = 0.01;

const checkExpiredAddress = async (tgId) => {
  try {

    const user = await User.findOne({
      where: {
        tgId,
      }
    })
    if (!user){
      return "No user found with this telegram Id.";
    }
    const expiredWallets = await Wallets.findAll({
      where: {
        status: "expired",
        userId: user.id
      },
    });

    const usdtContract = new w3.eth.Contract(ERC20_ABI, USDT_ADDRESS);

    for (const wallet of expiredWallets) {
      const tokenBalance = await usdtContract.methods
        .balanceOf(wallet.address)
        .call();
      const tokenBalanceFormatted = w3.utils.fromWei(tokenBalance, "ether");

      if (parseFloat(tokenBalanceFormatted) >= MIN_AMOUNT) {
        await Wallets.update(
          {
            status: "unpaid",
            createdAt: new Date(Date.now() + 60 * 1000)
          },
          {
            where: {
              id: wallet.id,
            },
          }
        );
      }
    }

    return `Checked all expiry addresses of user ${user.id}`
  } catch (error) {
    console.log("Error while checking expired addresses", error?.message);
    return "Error while checking addresses."
  }
};

module.exports = checkExpiredAddress;
