const { DataTypes } = require("sequelize");
const sequelize = require("../../config/dbConnection");

const TubeMaster = sequelize.define(
  "barcode_tubes",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tubecolor: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tubecode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    maxttest: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    departmentid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "departments",
        key: "id",
      },
    },
    subdepartmentid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "subdepartments",
        key: "id",
      },
    },
    specimenid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "specimens",
        key: "id",
      },
    },

    usable_volume_ml: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    draw_volume_ml: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    isactive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  },
  { timestamps: false, tableName: "barcode_tube" },
);

module.exports = TubeMaster;
