const { Web3 } = require("web3");
require("dotenv").config();

const w3 = new Web3(process.env.RPC_URL);

module.exports = w3;
