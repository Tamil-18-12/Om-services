const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING,
    },
    address: {
      type: DataTypes.TEXT,
    },
    password: {
      type: DataTypes.STRING,
    },
    location: {
      type: DataTypes.STRING,
    },
    age: {
      type: DataTypes.INTEGER,
    },
    profileImage: {
      type: DataTypes.TEXT("long"),
    },
    isProfileComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    _id: {
      type: DataTypes.VIRTUAL,
      get() {
        const idVal = this.getDataValue("id");
        return idVal ? idVal.toString() : null;
      },
    },
  },
  {
    tableName: "users",
  }
);

module.exports = User;
