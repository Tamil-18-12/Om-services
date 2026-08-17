const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Partner = sequelize.define(
  "Partner",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [["Catering", "Travels", "Photography", "Sweets"]],
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobile: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    details: {
      type: DataTypes.TEXT,
    },
    teamSize: {
      type: DataTypes.STRING,
    },
    menuItems: {
      type: DataTypes.TEXT,
    },
    vehicleModel: {
      type: DataTypes.STRING,
    },
    cameraModel: {
      type: DataTypes.STRING,
    },
    sweetType: {
      type: DataTypes.STRING,
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "Pending",
      validate: {
        isIn: [["Pending", "Approved", "Rejected"]],
      },
    },
    adminNote: {
      type: DataTypes.TEXT,
      defaultValue: "",
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
    tableName: "partners",
  }
);

module.exports = Partner;
