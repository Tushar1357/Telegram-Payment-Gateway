const ethers = require("ethers");

const formatUnits = (number, decimal) => ethers.formatUnits(number, decimal);

const parseUnits = (number, decimal) => ethers.parseUnits(number, decimal);

module.exports = { formatUnits, parseUnits };
