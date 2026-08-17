const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Booking = sequelize.define(
  "Booking",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    serviceType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    serviceName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    age: {
      type: DataTypes.INTEGER,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
    },
    date: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    guests: {
      type: DataTypes.INTEGER,
    },
    eventDuration: {
      type: DataTypes.STRING,
    },
    mealType: {
      type: DataTypes.STRING,
    },
    cateringStyle: {
      type: DataTypes.STRING,
    },
    pickupLocation: {
      type: DataTypes.STRING,
    },
    dropDestination: {
      type: DataTypes.STRING,
    },
    travelDuration: {
      type: DataTypes.STRING,
    },
    passengerCount: {
      type: DataTypes.INTEGER,
    },
    eventType: {
      type: DataTypes.STRING,
    },
    photographyDuration: {
      type: DataTypes.STRING,
    },
    sweetQuantity: {
      type: DataTypes.STRING,
    },
    functionTime: {
      type: DataTypes.STRING,
    },
    departureSlot: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "Pending",
      validate: {
        isIn: [["Pending", "Confirmed", "Completed", "Cancelled"]],
      },
    },
    statusHistory: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    notes: {
      type: DataTypes.TEXT,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
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
    tableName: "bookings",
  }
);

module.exports = Booking;
