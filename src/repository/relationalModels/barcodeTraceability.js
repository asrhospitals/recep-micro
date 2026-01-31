const { DataTypes } = require("sequelize");
const sequelize = require("../../config/dbConnection");

const BarcodeTraceability = sequelize.define(
  "barcode_traceability",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    barcode: { type: DataTypes.STRING, allowNull: false },
    pid: { type: DataTypes.INTEGER, allowNull: false },
    hospitalid: { type: DataTypes.INTEGER, allowNull: false },
    total_prints: { type: DataTypes.INTEGER, defaultValue: 1 },
    reprint_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    reprint_reasons: { type: DataTypes.JSONB, defaultValue: [] },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    timestamps: true,
    tableName: "barcode_traceability",
  }
);

module.exports = BarcodeTraceability;
