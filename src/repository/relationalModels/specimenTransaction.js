const { DataTypes } = require("sequelize");
const sequelize = require("../../config/dbConnection");

const SpecimenTransaction = sequelize.define(
  "specimens_transaction",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    hospitalid: DataTypes.INTEGER,
    nodalid: DataTypes.INTEGER,

    pid: { type: DataTypes.INTEGER, allowNull: false },
    order_id: { type: DataTypes.INTEGER, allowNull: false },

    barcode_value: { type: DataTypes.STRING, allowNull: false, unique: true },

    specimen_type: DataTypes.STRING,
    tube_type: DataTypes.STRING,

    collection_timepoint: DataTypes.STRING,

    status: {
      type: DataTypes.ENUM("CREATED", "COLLECTED", "RECEIVED"),
      defaultValue: "CREATED",
    },
  },
  {
    tableName: "specimens_transaction",
    timestamps: false,
  },
);

module.exports = SpecimenTransaction;
