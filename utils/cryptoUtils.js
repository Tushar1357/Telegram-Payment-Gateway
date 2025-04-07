const {w3,basew3} = require("../configs/web3.js");
const crypto = require("crypto");
require('dotenv').config()

const generateWallet = () => {
  const wallet = w3.eth.accounts.create();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
};


const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

if (key.length !== 32) {
  throw new Error("Encryption key must be 32 bytes (64 hex characters)");
}

const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return {
    encryptedPrivateKey: encrypted,
    iv: iv.toString("hex"),
  };
};

const decrypt = (encryptedData, ivHex) => {
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};


module.exports = { generateWallet,encrypt,decrypt };
