const Patient = require("../relationalModels/patient");
const Investigation = require("../relationalModels/investigation");
const PatientTest = require("../relationalModels/patientTests");
const Hospital = require("../relationalModels/hospital");
const PPPMode = require("../relationalModels/ppTest");
const Nodal = require("../relationalModels/nodalMaster");
const NodalHospital = require("../relationalModels/nodalhospital");


// Associations

// Patient ↔ PatientTest
Patient.hasMany(PatientTest, { foreignKey: "patient_id", as: "patientTests" });
PatientTest.belongsTo(Patient, { foreignKey: "patient_id", as: "patient" });

//  Investigation ↔ PatientTest
Investigation.hasMany(PatientTest, { foreignKey: "investigation_id",as: "investigationTests",});
PatientTest.belongsTo(Investigation, {foreignKey: "investigation_id",as: "investigation",});

//  Patient ↔ PPPMode (ONLY - remove hospital relationship)
Patient.hasMany(PPPMode, { foreignKey: "patient_id", as: "patientPPModes" });
PPPMode.belongsTo(Patient, { foreignKey: "patient_id", as: "patient" });

//  Patient ↔ Hospital
Patient.belongsTo(Hospital, { foreignKey: "hospitalid", as: "hospital" });
Hospital.hasMany(Patient, { foreignKey: "hospitalid", as: "patients" });

//  Patient ↔ Nodal
Patient.belongsTo(Nodal, { foreignKey: "nodalid", as: "nodal" });
Nodal.hasMany(Patient, { foreignKey: "nodalid", as: "patients" });


//  Patient - Investigation many-to-many via PatientTest
Patient.belongsToMany(Investigation, {through: PatientTest,foreignKey: "patient_id",otherKey: "id",});
Investigation.belongsToMany(Patient, {through: PatientTest,foreignKey: "id",otherKey: "patient_id"});

// PatientTest ↔ Hospital
PatientTest.belongsTo(Hospital, {foreignKey: "hospitalid",as: "hospital",});
Hospital.hasMany(PatientTest, {foreignKey: "hospitalid",as: "patientTests",});

// PatientTest ↔ Nodal
PatientTest.belongsTo(Nodal, {foreignKey: "nodalid",as: "nodal",});
Nodal.hasMany(PatientTest, {foreignKey: "nodalid",as: "patientTests",});

// Nodal - NodalHospital one-to-many
//NodalHospital belongs to Nodal through nodalid
NodalHospital.belongsTo(Nodal, {
  foreignKey: "nodalid", // This should match the column name in NodalHospital
  targetKey: "id", // This is the primary key in Nodal table
  as: "nodal",
});

// NodalHospital belongs to Hospital through hospitalid
NodalHospital.belongsTo(Hospital, {
  foreignKey: "hospitalid", // This should match the column name in NodalHospital
  targetKey: "id", // This is the primary key in Hospital table
  as: "hospital",
});


module.exports = {
  Patient,
  Investigation,
  PatientTest,
  Hospital,
  PPPMode,
  Nodal,
  NodalHospital

};
