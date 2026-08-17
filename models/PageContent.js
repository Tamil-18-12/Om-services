const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PageContent = sequelize.define(
  "PageContent",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pageId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    pageName: {
      type: DataTypes.STRING,
    },
    heroImage: {
      type: DataTypes.STRING,
    },
    heroTitle: {
      type: DataTypes.STRING,
    },
    heroSubtitle: {
      type: DataTypes.STRING,
    },
    sections: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    contactInfo: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    dynamicMap: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
  },
  {
    tableName: "page_contents",
  }
);

module.exports = PageContent;
