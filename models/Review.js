const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Review = sequelize.define(
  "Review",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true,
      },
    },
    name: {
      type: DataTypes.STRING,
    },
    rating: {
      type: DataTypes.INTEGER,
    },
    comment: {
      type: DataTypes.TEXT,
    },
    serviceType: {
      type: DataTypes.STRING,
    },
    image: {
      type: DataTypes.TEXT("long"),
    },
    likes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
    tableName: "reviews",
  }
);

module.exports = Review;
