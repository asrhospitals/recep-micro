const sequelize = require("../../config/dbConnection");
const { DataTypes, DATE } = require("sequelize");
const Patient = require("../relationalModels/patient");
const Investigation = require("../relationalModels/investigation");
const Hospital = require("../relationalModels/hospital");
const Nodal = require("../relationalModels/nodalMaster");

const PatientTest = sequelize.define("patient_test", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  hospitalid: {
    type: DataTypes.INTEGER,
    references: {
      model: Hospital,
      key: "id",
    },
  },
  nodalid: {
    type: DataTypes.INTEGER,
    references: {
      model: Nodal,
      key: "id",
    },
  },
  pid: {
    type: DataTypes.INTEGER,
    references: {
      model: Patient,
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  },

  investigation_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Investigation,
      key: "id",
    },
  },

  rejection_reason: {
    type: DataTypes.STRING,
  },

  test_result: {
    type: DataTypes.STRING,
  },
  test_image: {
    type: DataTypes.STRING,
  },
  h_l_flag: {
    type: DataTypes.ENUM("H", "L", "N", "C"),
  },
  units: {
    type: DataTypes.STRING,
  },
  reference_range: {
    type: DataTypes.STRING,
  },
  critical_range: {
    type: DataTypes.STRING,
  },
  method: {
    type: DataTypes.STRING,
  },
  sample_type: {
    type: DataTypes.STRING,
  },
  sample_collected_time: {
    type: DataTypes.DATE,
  },
  dispatch_time:{
    type: DataTypes.DATE,
  },
  collect_later_marked_at:{
    type: DataTypes.DATE,
  },
  collect_later_reason:{
    type: DataTypes.STRING,
  },
  receive_time: {
    type: DataTypes.DATE,
  },
  collected_by:{
    type: DataTypes.STRING,
  },
  varified_by:{
    type: DataTypes.STRING,
  },
  recollection_reason:{
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.ENUM(
      "collected",
      "node",
      "center",
      "motherlab",
      "technician",
      "doctor",
      "pending",
      "accept",
      "redo",
      "reject",
      "recollect",
      "docpending",
      "completed",
      "inprogress",
      "delivered",
      "intransit"
    ),
    allowNull: false,
    defaultValue: "center",
  },
});

module.exports = PatientTest;
