const { DataTypes, Sequelize } = require("sequelize");

const sequelize = require("../../../configs/connection.js");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    unique: true,
    defaultValue: Sequelize.UUIDV4,
    autoIncrement: false,
  },
  tgId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  tgName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tgUserName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  subscriptionStatus: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  expiration: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reminderSent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  }
});

module.exports = User;
