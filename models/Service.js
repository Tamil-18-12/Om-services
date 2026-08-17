const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Service = sequelize.define(
  "Service",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    discount: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.TEXT,
    },
    packages: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
  },
  {
    tableName: "services",
  }
);

module.exports = Service;
