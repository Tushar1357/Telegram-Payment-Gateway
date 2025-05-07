const { w3, basew3 } = require("./web3");
require("dotenv").config();
const ERC20_ABI = require("./abi");

const BSC_USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const BSC_USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_USDT_ADDRESS = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";

if (!BSC_USDC_ADDRESS || !BASE_USDC_ADDRESS) {
  throw new Error("Token contract addresses must be defined in .env");
}

const chains = {
  bsc: {
    usdc: {
      web3: w3,
      tokenAddress: BSC_USDC_ADDRESS,
      decimals: 18,
      symbol: "USDC",
      contract: new w3.eth.Contract(ERC20_ABI, BSC_USDC_ADDRESS),
    },
    usdt: {
      web3: w3,
      tokenAddress: BSC_USDT_ADDRESS,
      decimals: 18,
      symbol: "USDT",
      contract: new w3.eth.Contract(ERC20_ABI, BSC_USDT_ADDRESS),
    },
  },
  base: {
    usdc: {
      web3: basew3,
      tokenAddress: BASE_USDC_ADDRESS,
      decimals: 6,
      symbol: "USDC",
      contract: new basew3.eth.Contract(ERC20_ABI, BASE_USDC_ADDRESS),
    },
    usdt: {
      web3: basew3,
      tokenAddress: BASE_USDT_ADDRESS,
      decimals: 6,
      symbol: "USDT",
      contract: new basew3.eth.Contract(ERC20_ABI, BASE_USDT_ADDRESS),
    },
  },
};

module.exports = chains;
