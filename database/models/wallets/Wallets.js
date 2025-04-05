const { DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../../../configs/connection.js");
const User = require("../users/User.js");

const Wallets = sequelize.define("Wallets", {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    unique: true,
    defaultValue: Sequelize.UUIDV4,
    autoIncrement: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  privateKey: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  iv: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: "Users",
      key: "id",
    },
  },
});

User.hasMany(Wallets, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});

Wallets.belongsTo(User, {
  foreignKey: "userId",
});

module.exports = Wallets;
