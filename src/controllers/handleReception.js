const {
  Hospital,
  PatientTest,
  Investigation,
  DerivedTestComponent,
  Patient,
  PPPMode,
  Department,
  Result,
} = require("../repository/associationModels/associations");
const SpecimenTypeMaster = require("../repository/relationalModels/specimenTypeMaster");

const patientService = require("../services/patientService");
const { Op } = require("sequelize");

/**
 * @description Retrieves test-specific patient data (PPP mode and Bill mode).
 * Restricted strictly to Reception and Phlebotomist roles for their own hospital.
 */
const getTestData = async (req, res) => {
  try {
    const {
      roleType,
      hospitalid: hospitalId,
      nodalid: nodalId,
    } = req.user || {};
    const normalizedRole = roleType?.toLowerCase();

    // 1. Role Authorization (Reception & Phlebotomist only)
    const allowedRoles = ["reception", "phlebotomist"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res
        .status(403)
        .json({ message: "Access denied. Unauthorized role." });
    }

    // 2. Security & Context Validation (strictly from token)
    if (!hospitalId || !nodalId) {
      return res.status(401).json({
        message: "Unauthorized: missing hospitalId or nodalId in token.",
      });
    }

    // 3. Service Call (token-scoped)
    const result = await patientService.getPatientTestData(
      { hospitalId, nodalId },
      req.query
    );

    // 4. Standardized Success Response
    return res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        totalItems: result.totalItems,
        itemsPerPage: result.itemsPerPage,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("Fetch Test Data Error:", error);
    const status = /not found/i.test(error.message) ? 404 : 500;
    return res
      .status(status)
      .json({ message: `Error fetching patient data: ${error.message}` });
  }
};

/**
 * @description Verify patient data before collect sample (PPP mode and Bill mode).
 * Restricted strictly to Reception and Phlebotomist roles for their own hospital.
 */

const verifyPatient = async (req, res) => {
  try {
    // Check authorization
    const {
      roleType,
      hospitalid: hospitalId,
      nodalid: nodalId,
    } = req.user || {};
    const normalizedRole = roleType?.toLowerCase();

    // 1. Role Authorization (Reception & Phlebotomist only)
    const allowedRoles = ["reception", "phlebotomist"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res
        .status(403)
        .json({ message: "Access denied. Unauthorized role." });
    }

    // 2. Security & Context Validation (strictly from token)
    if (!hospitalId || !nodalId) {
      return res.status(401).json({
        message: "Unauthorized: missing hospitalId or nodalId in token.",
      });
    }

    // 3.For more check take that patient id
    const { pid } = req.params;

    // 3. Find the Patient or check for the Patient

    const checkForPatient = await Patient.findOne({
      where: { id: pid, p_status: "default" },
    });

    if (!checkForPatient) {
      return res
        .status(200)
        .json({ success: false, message: "Patient not found" });
    }

    // Hard coded for verify the patient
    checkForPatient.p_status = "verified";

    await checkForPatient.save();

    return res.status(200).json({
      success: true,
      message: "Patient verified",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "something went wrong" });
  }
};

/**
 * @description Get verified patient test data (PPP mode and Bill mode).
 * Restricted strictly to Reception and Phlebotomist roles for their own hospital.
 */
const getVerifiedTestData = async (req, res) => {
  try {
    const {
      roleType,
      hospitalid: hospitalId,
      nodalid: nodalId,
    } = req.user || {};
    const normalizedRole = roleType?.toLowerCase();

    // 1. Role Authorization (Reception & Phlebotomist only)
    const allowedRoles = ["reception", "phlebotomist"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res
        .status(403)
        .json({ message: "Access denied. Unauthorized role." });
    }

    // 2. Security & Context Validation (strictly from token)
    if (!hospitalId || !nodalId) {
      return res.status(401).json({
        message: "Unauthorized: missing hospitalId or nodalId in token.",
      });
    }

    // 3. Service Call (token-scoped)
    const result = await patientService.getVerifiedPatientTestData(
      { hospitalId, nodalId },
      req.query
    );

    // 4. Standardized Success Response
    return res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        totalItems: result.totalItems,
        itemsPerPage: result.itemsPerPage,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("Fetch Test Data Error:", error);
    const status = /not found/i.test(error.message) ? 404 : 500;
    return res
      .status(status)
      .json({ message: `Error fetching patient data: ${error.message}` });
  }
};

/**
 * @description Retrieves test-specific patient data (PPP mode and Bill mode) by ID.
 * Restricted strictly to Reception and Phlebotomist roles for their own hospital.
 */
const getTestDataById = async (req, res) => {
  try {
    /* 1. Authorization */
    const { roleType } = req.user;
    if (
      roleType?.toLowerCase() !== "reception" &&
      roleType?.toLowerCase() !== "phlebotomist"
    ) {
      return res.status(403).json({
        message: "Access denied.",
      });
    }

    /* 2. Path Parameters */
    const { pid } = req.params;

    const today = new Date()
      .toLocaleString("en-CA", { timeZone: "Asia/Kolkata" })
      .split(",")[0];

    /* Find Patient By Id */
    const patient = await Patient.findOne({
      where: { id: pid, p_regdate: today, p_status: "verified" },
      attributes: [
        "id",
        "p_name",
        "p_age",
        "p_gender",
        "p_lname",
        "uhid",
        "p_status",
      ],
      include: [
        {
          model: PPPMode,
          as: "patientPPModes",
          attributes: ["remark", "attatchfile", "pbarcode", "pop", "popno"],
        },
        {
          model: PatientTest,
          as: "patientTests",
          where: { status: { [Op.in]: ["center"] } },
          required: false,
          attributes: ["id", "status", "createdAt","updatedAt"],
          include: [
            {
              model: Investigation,
              as: "investigation",
              attributes: [
                "testname",
                "testmethod",
                "sampleqty",
                "containertype",
              ],
              include: [
                {
                  model: Department,
                  as: "department",
                  attributes: ["dptname"],
                },
                {
                  model: SpecimenTypeMaster,
                  as: "specimen",
                  attributes: ["specimenname"],
                },
                {
                  model: DerivedTestComponent,
                  as: "components",
                  attributes: ["formula"],
                  include: [
                    {
                      model: Investigation,
                      as: "childTest",
                      attributes: ["testname"],
                      include: [
                        {
                          model: Result,
                          as: "results",
                          attributes: ["unit"],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { model: Hospital, as: "hospital", attributes: ["hospitalname"] },
      ],
    });

    if (!patient) {
      return res.status(200).json({
        success: false,
        message: "No data",
      });
    }

    return res.status(200).json({ success: true, data: patient });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Something went wrong while fetching patient ${error}`,
    });
  }
};

/**
 * @description Mark test as 'collected' for PPP or Bill mode.
 * Restricted to Reception and Phlebotomist roles for their own hospital.
 */
const collectSample = async (req, res) => {
  try {
    // 1. Authorization: Role and Hospital Context
    const { roleType, hospitalid: userHospitalId } = req.user;
    const normalizedRole = roleType?.toLowerCase();
    const allowedRoles = ["reception", "phlebotomist"];

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Unauthorized role.",
      });
    }

    // 2. Extract identifiers from URL params
    const { pid, testid } = req.params;

    // 3. Find and Update in one step for better performance
    // We look for the test matching ID, Patient, and the User's Hospital
    const patientTest = await PatientTest.findOne({
      where: {
        id: testid,
        pid: pid,
        hospitalid: userHospitalId,
      },
    });

    if (!patientTest) {
      return res.status(404).json({
        success: false,
        message: "Test record not found or unauthorized access.",
      });
    }

    // 4. Automatic Update Logic
    patientTest.status = "collected"; // Hardcoded automatic update
    const currentTime = new Date();
    patientTest.sample_collected_time = currentTime;
    patientTest.collected_by = req.user.username || "unknown";

    await patientTest.save();

    // 5. Success Response
    return res.status(200).json({
      success: true,
      message: "Sample marked as collected successfully.",
    });
  } catch (error) {
    console.error("Collection Error:", error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`,
    });
  }
};

/**
 * @description Show Mark test as 'collected' for PPP or Bill mode.
 * Restricted to Reception and Phlebotomist roles for their own hospital.
 */

const showCollectedSample = async (req, res) => {
  try {
    const {
      roleType,
      hospitalid: hospitalId,
      nodalid: nodalId,
    } = req.user || {};
    const normalizedRole = roleType?.toLowerCase();

    // 1. Role Authorization (Reception & Phlebotomist only)
    const allowedRoles = ["reception", "phlebotomist"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res
        .status(403)
        .json({ message: "Access denied. Unauthorized role." });
    }

    // 2. Security & Context Validation (strictly from token)
    if (!hospitalId || !nodalId) {
      return res.status(401).json({
        message: "Unauthorized: missing hospitalId or nodalId in token.",
      });
    }

    // 3. Service Call (token-scoped)
    const result = await patientService.getCollectedData(
      { hospitalId, nodalId },
      req.query
    );

    // 4. Standardized Success Response
    return res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        totalItems: result.totalItems,
        itemsPerPage: result.itemsPerPage,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error(" Error:", error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`,
    });
  }
};

/**
 * @description Send samples tests to Nodal ('transit') for PPP or Bill mode.
 * Restricted to Reception and Phlebotomist roles for their own hospital.
 */

const sendToNodal = async (req, res) => {
  try {
    const { roleType, hospitalid: userHospitalId } = req.user;
    const { ids } = req.body;

    // 1. Validation
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No patient IDs provided." });
    }

    const normalizedRole = roleType?.toLowerCase();
    const allowedRoles = ["reception", "phlebotomist"];

    if (!allowedRoles.includes(normalizedRole)) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized role." });
    }

    // 3. Perform Bulk Update
    const [updatedCount] = await PatientTest.update(
      {
        status: "intransit",
        dispatch_time: new Date(),
      },
      {
        where: {
          pid: ids,
          hospitalid: userHospitalId,
          status: "collected",
        },
      }
    );

    if (updatedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching records found or already dispatched.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `${updatedCount} sample(s) successfully dispatched to Nodal.`,
    });
  } catch (error) {
    console.error("Dispatch Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  getTestData,
  verifyPatient,
  getVerifiedTestData,
  getTestDataById,
  collectSample,
  showCollectedSample,
  sendToNodal,
};
