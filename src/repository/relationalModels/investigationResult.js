const { DataTypes } = require("sequelize");
const sequelize = require("../../config/dbConnection");

const InvestigationResult = sequelize.define(
  "inv_result",

  {
    resultname: { type: DataTypes.STRING },
    otherlang: { type: DataTypes.STRING },
    extrsltid: { type: DataTypes.STRING },
    unit: { type: DataTypes.STRING },
    valueType: { type: DataTypes.STRING },
    formula: { type: DataTypes.STRING },
    order: { type: DataTypes.INTEGER },
    roundOff: { type: DataTypes.INTEGER },
    normalvalues: { type: DataTypes.JSONB },
    mandatoryvalues: { type: DataTypes.JSONB },
    reflextest: { type: DataTypes.JSONB },
    showTrends: { type: DataTypes.BOOLEAN },
    defaultValue: { type: DataTypes.INTEGER },
    investigationid: { type: DataTypes.INTEGER },
  },
  { timestamps: false }
);

module.exports = InvestigationResult;
