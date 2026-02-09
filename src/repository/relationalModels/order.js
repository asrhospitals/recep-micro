const sequelize = require("../../config/dbConnection");
const { DataTypes } = require("sequelize");

const Order = sequelize.define("orders", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  hospitalid: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  pid: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  order_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  daily_order_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  status: {
    type: DataTypes.STRING,
    defaultValue: "CREATED",
  },
},{
  timestamps:false
});

module.exports = Order;
