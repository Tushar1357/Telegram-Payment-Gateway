const sequelize = require("../configs/connection.js");
const User = require("./models/users/User.js");
const Wallets = require("./models/wallets/Wallets.js");

const syncDb = async () => {
  try {
    await sequelize.authenticate();
    console.log("DB connected ✅");

    await sequelize.sync({ force: true });
    console.log("Tables synced ✅");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
};

module.exports = syncDb;
