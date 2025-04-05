const w3 = require("../configs/web3.js");
const crypto = require("crypto");

const generateWallet = () => {
  const wallet = w3.eth.accounts.create();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
};


const algorithm = "aes-256-cbc";
const secretKey = process.env.ENCRYPTION_SECRET;
const iv = crypto.randomBytes(16);

const encrypt = (text) => {
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return {
    iv: iv.toString("hex"),
    encryptedData: encrypted,
  };
};


const decrypt = (encryptedData, ivHex) => {
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(secretKey),
    Buffer.from(ivHex, "hex")
  );
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};


module.exports = { generateWallet,encrypt,decrypt };
