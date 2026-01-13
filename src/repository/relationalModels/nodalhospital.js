const { DataTypes } = require("sequelize");
const sequialize = require("../../src/db/dbConnection");
const Nodal = require("../relationalModels/nodalMaster");
const Hospital = require("../relationalModels/hospital");

const NodalHospital = sequialize.define(
  "nodalhospital",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    nodalid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Nodal,
        key: "id",
      },
    },
    hospitalid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Hospital,
        key: "id",
      },
    },
    isactive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  },
  { timestamps: false }
);

module.exports = NodalHospital;
