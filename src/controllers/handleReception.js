const {
  Hospital,
  PatientTest,
  Investigation,
  DerivedTestComponent,
  Patient,
  PPPMode,
  Department,
  Result,
  BarcodeTraceability,
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
 * @description Reverify patient data (for patients in pending collection).
 * Restricted strictly to Reception and Phlebotomist roles for their own hospital.
 */
const reverifyPatient = async (req, res) => {
  try {
    const { roleType, hospitalid: hospitalId } = req.user || {};
    const normalizedRole = roleType?.toLowerCase();

    const allowedRoles = ["reception", "phlebotomist"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res
        .status(403)
        .json({ message: "Access denied. Unauthorized role." });
    }

    if (!hospitalId) {
      return res.status(401).json({
        message: "Unauthorized: missing hospitalId in token.",
      });
    }

    const { pid } = req.params;

    const checkForPatient = await Patient.findOne({
      where: { id: pid, hospitalid: hospitalId },
    });

    if (!checkForPatient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    checkForPatient.reverification_status = "verified";
    await checkForPatient.save();

    return res.status(200).json({
      success: true,
      message: "Patient re-verified successfully",
    });
  } catch (error) {
    console.error("Reverify Patient Error:", error);
    res.status(500).json({ success: false, message: "Something went wrong" });
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
          where: { status: { [Op.in]: ["center", "pending"] } },
          required: false,
          attributes: [
            "id",
            "status",
            "collect_later_reason",
            "createdAt",
            "updatedAt",
          ],
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
 * @description Mark test as 'collected' or 'collect_later' for PPP or Bill mode.
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

    // 2. Extract identifiers and body
    const { pid, testid } = req.params;
    const { action, remark } = req.body;

    if (!action || !["collect", "pending"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'collect' or 'pending'.",
      });
    }

    // 3. Find the test record
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

    // 4. Validation: Only Phlebotomist can mark pending
    if (action === "pending" && normalizedRole !== "phlebotomist") {
      return res.status(403).json({
        success: false,
        message: "Only Phlebotomists can mark tests for later collection.",
      });
    }

    // 5. Logic based on action
    const currentTime = new Date();

    if (action === "collect") {
      // Transition: verified -> collected OR pending -> collected
      const validStatusesForCollect = ["center", "pending"];
      if (!validStatusesForCollect.includes(patientTest.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot collect sample. Current status is ${patientTest.status}.`,
        });
      }

      patientTest.status = "collected";
      patientTest.sample_collected_time = currentTime;
      patientTest.collected_by=req.user.username;
      // Clear collect_later fields if previously set
      patientTest.collect_later_reason = null;
      patientTest.collect_later_marked_at = null;
    } else if (action === "pending") {
      // Remark is mandatory
      if (!remark || remark.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Remark is mandatory for later collection.",
        });
      }

      // Transition: verified (center) -> pending
      if (patientTest.status !== "center") {
        return res.status(400).json({
          success: false,
          message: `Cannot mark for later collection. Current status is ${patientTest.status}.`,
        });
      }

      patientTest.status = "pending";
      patientTest.collect_later_reason = remark;
      patientTest.collect_later_marked_at = currentTime;

      // Set patient reverification status to 'default' when marking for later collection
      const patient = await Patient.findByPk(pid);
      if (patient) {
        patient.reverification_status = "default";
        await patient.save();
      }
    }

    await patientTest.save();

    return res.status(200).json({
      success: true,
      message: `Sample marked as ${
        action === "collect" ? "collected" : "collect later"
      }.`,
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
 * @description Log barcode print/reprint for MIS tracking.
 * This should be called whenever a barcode is printed.
 */
const logBarcodePrint = async (req, res) => {
  const t = await BarcodeTraceability.sequelize.transaction();
  try {
    const { hospitalid: hospitalId, id: userId } = req.user;
    const { pbarcode, pid, isReprint, reason } = req.body;

    if (!pbarcode || !pid) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Barcode and PID are required" });
    }

    // Validate that the patient exists and belongs to this hospital
    const patient = await Patient.findByPk(pid);
    if (!patient || Number(patient.hospitalid) !== Number(hospitalId)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid patient or patient does not belong to this hospital",
      });
    }

    const reprint = isReprint === true || isReprint === "true";

    if (reprint && !reason) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Reprint reason is required" });
    }

    let log = await BarcodeTraceability.findOne({
      where: { barcode: pbarcode, hospitalid: hospitalId }, // 🔥 hospital level uniqueness
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!log) {
      log = await BarcodeTraceability.create({
        barcode: pbarcode,
        pid, // stored only for reference
        hospitalid: hospitalId,
        total_prints: 1,
        reprint_count: reprint ? 1 : 0,
        reprint_reasons: reprint
          ? [{ reason, printed_at: new Date(), printed_by: userId }]
          : [],
      }, { transaction: t });
    } else {
      // Throttling: Check if this is a duplicate call within a 5-second window
      const now = new Date();
      const lastUpdate = new Date(log.updatedAt);
      const diffSeconds = (now - lastUpdate) / 1000;

      // If called within 5 seconds for the same barcode/reason, skip incrementing
      // but still return success to the frontend.
      if (diffSeconds < 5) {
        await t.commit();
        return res.json({ 
          success: true, 
          message: "Print event already logged recently", 
          data: log,
          throttled: true 
        });
      }

      log.total_prints += 1;

      if (reprint) {
        log.reprint_count += 1;

        const reasons = Array.isArray(log.reprint_reasons) ? [...log.reprint_reasons] : [];
        reasons.push({ reason, printed_at: new Date(), printed_by: userId });
        log.reprint_reasons = reasons;
      }

      await log.save({ transaction: t });
    }

    await t.commit();
    await log.reload();

    return res.json({ success: true, message: "Print event logged successfully", data: log });

  } catch (error) {
    await t.rollback();
    return res.status(500).json({ success: false, message: error.message });
  }
};



/**
 * @description Retrieves patients who have at least one test marked collect_later.
 */
const getPendingCollection = async (req, res) => {
  try {
    const {
      roleType,
      hospitalid: hospitalId,
      nodalid: nodalId,
    } = req.user || {};
    const normalizedRole = roleType?.toLowerCase();

    const allowedRoles = ["reception", "phlebotomist"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res
        .status(403)
        .json({ message: "Access denied. Unauthorized role." });
    }

    if (!hospitalId || !nodalId) {
      return res.status(401).json({
        message: "Unauthorized: missing hospitalId or nodalId in token.",
      });
    }

    const result = await patientService.getPendingCollection(
      { hospitalId, nodalId },
      req.query
    );

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
    console.error("Get Pending Collection Error:", error);
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
  reverifyPatient,
  getVerifiedTestData,
  getTestDataById,
  collectSample,
  getPendingCollection,
  showCollectedSample,
  sendToNodal,
  logBarcodePrint,
};
