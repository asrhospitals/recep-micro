const { DataTypes } = require("sequelize");
const sequelize = require("../../config/dbConnection");

  const SpecimenTest= sequelize.define(
    "specimen_tests",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      specimen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      investigation_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
  {timestamps:false}
  );

  module.exports=SpecimenTest
