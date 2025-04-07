const {w3, basew3} = require("./web3")
require("dotenv").config();
const ERC20_ABI = require("./abi")


const USDT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS;
const BASE_USDC_ADDRESS = process.env.BASE_USDC_ADDRESS;

if (!USDT_ADDRESS || !BASE_USDC_ADDRESS) {
  throw new Error("Token contract addresses must be defined in .env");
}


const chains = {
  bsc: {
    web3: w3,
    tokenAddress: USDT_ADDRESS,
    decimals: 18,
    symbol: "USDC",
    contract: new w3.eth.Contract(ERC20_ABI, USDT_ADDRESS)
  },
  base: {
    web3: basew3,
    tokenAddress: BASE_USDC_ADDRESS,
    decimals: 6,
    symbol: "USDC",
    contract: new basew3.eth.Contract(ERC20_ABI, BASE_USDC_ADDRESS)
  },
};

module.exports = chains;
