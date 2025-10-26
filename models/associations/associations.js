const Patient = require("../relationalModels/patient");
const Investigation = require("../relationalModels/investigation");
const PatientTest = require("../relationalModels/patientTests");
const Hospital = require("../relationalModels/hospital");
const PPPMode = require("../relationalModels/ppTest");


// Associations

// Patient ↔ PatientTest
Patient.hasMany(PatientTest, { foreignKey: "patient_id", as: "patientTests" });
PatientTest.belongsTo(Patient, { foreignKey: "patient_id", as: "patient" });

//  Investigation ↔ PatientTest
Investigation.hasMany(PatientTest, {
  foreignKey: "investigation_id",
  as: "investigationTests",
});
PatientTest.belongsTo(Investigation, {
  foreignKey: "investigation_id",
  as: "investigation",
});

//**Hospital ↔ Investigation (This one might be valid if tests are done at specific hospitals)* */  
Hospital.hasMany(Investigation, {
  foreignKey: "hospital_id",
  as: "hospitalTests",
});
Investigation.belongsTo(Hospital, { foreignKey: "hospital_id", as: "hospital" });


//  Patient ↔ PPPMode (ONLY - remove hospital relationship)
Patient.hasMany(PPPMode, { foreignKey: "patient_id", as: "patientPPModes" });
PPPMode.belongsTo(Patient, { foreignKey: "patient_id", as: "patient" });

//  Patient ↔ Hospital
Patient.belongsTo(Hospital, { foreignKey: "hospital_id", as: "hospital" });
Hospital.hasMany(Patient, { foreignKey: "hospital_id", as: "patients" });



//  Patient - Investigation many-to-many via PatientTest
Patient.belongsToMany(Investigation, {
  through: PatientTest,
  foreignKey: "patient_id",
  otherKey: "id",
});
Investigation.belongsToMany(Patient, {
  through: PatientTest,
  foreignKey: "id",
  otherKey: "patient_id",
});

// PatientTest ↔ Hospital
PatientTest.belongsTo(Hospital, {
  foreignKey: "hospital_id",
  as: "hospital",
});

Hospital.hasMany(PatientTest, {
  foreignKey: "hospital_id",
  as: "patientTests",
});





module.exports = {
  Patient,
  Investigation,
  PatientTest,
  Hospital,
  PPPMode,

};
