const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Otp = sequelize.define(
  "Otp",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    otp: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userData: {
      type: DataTypes.JSON,
    },
  },
  {
    tableName: "otps",
  }
);

module.exports = Otp;
