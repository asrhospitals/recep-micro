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
const SpecimenTransaction = require("../repository/relationalModels/specimenTransaction");
const { generateSpecimens } = require("../services/barcode.service");

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
      req.query,
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
    const allowedRoles = ["phlebotomist"];
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
      where: { id: pid, p_status: "default", hospitalid: hospitalId },
    });

    if (!checkForPatient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found or already verified",
      });
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
      req.query,
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
 * Auto-generates barcodes on first retrieval if not already generated.
 * Restricted strictly to Phlebotomist role for their own hospital.
 */
const getTestDataById = async (req, res) => {
  try {
    /* 1. Authorization */
    const { roleType, hospitalid: userHospitalId } = req.user;
    if (roleType?.toLowerCase() !== "phlebotomist") {
      return res.status(403).json({
        success: false,
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
          attributes: ["remark", "attatchfile", "pop", "popno"],
        },
        {
          model: PatientTest,
          as: "patientTests",
          where: { status: { [Op.in]: ["center", "pending"] } },
          required: false,
          attributes: [
            "id",
            "status",
            "order_id",
            "collect_later_reason",
            "createdAt",
            "updatedAt",
          ],
          include: [
            {
              model: SpecimenTransaction,
              as: "specimenTransactions",
              attributes: [
                "id",
                "barcode_value",
                "specimen_type",
                "tube_type",
                "status",
              ],
              required: false,
            },
            {
              model: Investigation,
              as: "investigation",
              attributes: [
                "testname",
                "testmethod",
                "sampleqty",
                "containertype",
                "sampletypeId",
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
                  attributes: ["id", "specimenname"],
                  required: false,
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

    if (patient && patient.patientTests && patient.patientTests.length > 0) {
      // ==================== GENERATE BARCODES ====================
      // Get unique order IDs from patient tests
      const orderIds = [
        ...new Set(
          patient.patientTests
            .map((t) => t.order_id)
            .filter((oid) => oid != null)
        ),
      ];

      if (orderIds.length > 0) {
        for (const orderId of orderIds) {
          // Check if barcodes already exist for this order
          const existingBarcodes = await SpecimenTransaction.findOne({
            where: { order_id: orderId },
          });

          // Generate only if no barcodes exist
          if (!existingBarcodes) {
            try {
              await generateSpecimens(orderId, userHospitalId);
              console.log(`Barcodes generated for order ${orderId}`);
            } catch (barcodeError) {
              console.error(
                `Barcode generation failed for order ${orderId}:`,
                barcodeError.message
              );
              // Re-throw to fail the entire request
              throw new Error(`Failed to generate barcodes for order ${orderId}: ${barcodeError.message}`);
            }
          }
        }
      }

      // ==================== FETCH GROUPED DATA ====================
      // Refresh patient data to include newly generated barcodes
      const refreshedPatient = await Patient.findOne({
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
            attributes: ["remark", "attatchfile", "pop", "popno"],
          },
          {
            model: PatientTest,
            as: "patientTests",
            where: { status: { [Op.in]: ["center", "pending"] } },
            required: false,
            attributes: [
              "id",
              "status",
              "order_id",
              "collect_later_reason",
              "createdAt",
              "updatedAt",
            ],
            include: [
              {
                model: SpecimenTransaction,
                as: "specimenTransactions",
                attributes: [
                  "id",
                  "barcode_value",
                  "specimen_type",
                  "tube_type",
                  "status",
                ],
                required: false,
              },
              {
                model: Investigation,
                as: "investigation",
                attributes: [
                  "testname",
                  "testmethod",
                  "sampleqty",
                  "containertype",
                  "sampletypeId",
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
                    attributes: ["id", "specimenname"],
                    required: false,
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

      // Get all unique specimen type IDs from transactions to fetch names
      const specimenTypeIds = new Set();
      refreshedPatient.patientTests.forEach((test) => {
        if (test.specimenTransactions) {
          test.specimenTransactions.forEach((st) => {
            if (st.specimen_type && !isNaN(st.specimen_type)) {
              specimenTypeIds.add(parseInt(st.specimen_type));
            }
          });
        }
      });

      // Fetch specimen names for all IDs at once
      const specimenMap = {};
      if (specimenTypeIds.size > 0) {
        const specimens = await SpecimenTypeMaster.findAll({
          where: { id: Array.from(specimenTypeIds) },
          attributes: ["id", "specimenname"],
        });
        specimens.forEach((s) => {
          specimenMap[s.id] = s.specimenname;
        });
      }

      // Group tests by specimen type
      const groupedBySpecimen = {};

      refreshedPatient.patientTests.forEach((test) => {
        const investigation = test.investigation;
        if (!investigation) return;

        // Use specimen association if available, otherwise fall back to sampletypeId
        const specimenId =
          investigation.specimen?.id || investigation.sampletypeId || "unknown";
        const specimenName =
          investigation.specimen?.specimenname ||
          specimenMap[specimenId] ||
          `Specimen ${specimenId}`;

        if (!groupedBySpecimen[specimenId]) {
          groupedBySpecimen[specimenId] = {
            specimen_type_id: specimenId,
            specimen_name: specimenName,
            tests: [],
            specimens: [],
            addedSpecimenIds: new Set(), // Track added specimen IDs to prevent duplicates
          };
        }

        // Add test investigation details
        groupedBySpecimen[specimenId].tests.push({
          test_id: test.id,
          test_name: investigation.testname,
          test_method: investigation.testmethod,
          sample_qty: investigation.sampleqty,
          container_type: investigation.containertype,
          department: investigation.department?.dptname,
          status: test.status,
          collect_later_reason: test.collect_later_reason,
          order_id: test.order_id,
        });

        // Add related specimen transactions (only for this specimen type)
        if (test.specimenTransactions && test.specimenTransactions.length > 0) {
          test.specimenTransactions.forEach((specimen) => {
            const specTypeId =
              specimen.specimen_type && !isNaN(specimen.specimen_type)
                ? parseInt(specimen.specimen_type)
                : specimen.specimen_type;

            // Only add if specimen transaction matches this group's specimen type (prevent duplicates)
            if (
              specTypeId == specimenId &&
              !groupedBySpecimen[specimenId].addedSpecimenIds.has(specimen.id)
            ) {
              groupedBySpecimen[specimenId].specimens.push({
                id: specimen.id,
                barcode: specimen.barcode_value,
                specimen_type_id: specTypeId,
                specimen_type_name:
                  specimenMap[specTypeId] || specimen.specimen_type,
                tube_type: specimen.tube_type,
                status: specimen.status,
              });
              // Mark this specimen as added
              groupedBySpecimen[specimenId].addedSpecimenIds.add(specimen.id);
            }
          });
        }
      });

      // Convert to array and remove the tracking Set
      const groupedData = Object.values(groupedBySpecimen).map((group) => {
        const { addedSpecimenIds, ...rest } = group;
        return rest;
      });

      return res.status(200).json({
        success: true,
        data: {
          patient: {
            id: refreshedPatient.id,
            name: refreshedPatient.p_name,
            lname: refreshedPatient.p_lname,
            age: refreshedPatient.p_age,
            gender: refreshedPatient.p_gender,
            uhid: refreshedPatient.uhid,
            status: refreshedPatient.p_status,
            hospital: refreshedPatient.hospital?.hospitalname,
            pppMode: refreshedPatient.patientPPModes,
          },
          grouped_by_specimen: groupedData,
        },
      });
    }

    return res.status(200).json({ success: true, data: patient });
  } catch (error) {
    console.error("Get Test Data By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: `Something went wrong while fetching patient ${error.message}`,
    });
  }
};

// Generate Barcode

const generateBarcode = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { roleType, hospitalid } = req.user;

    if (roleType?.toLowerCase() !== "phlebotomist") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const result = await generateSpecimens(orderId, hospitalid);

    return res.status(200).json({
      success: true,
      message: "Barcodes generated successfully",
      data: result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * @description Mark test(s) as 'collected' or 'pending' for PPP or Bill mode.
 * Supports bulk updates - accepts array of test IDs.
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
    const { pid } = req.params;
    const { testIds, action, remark } = req.body;

    // Validate inputs
    if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "testIds array is required and must not be empty.",
      });
    }

    if (!action || !["collect", "pending"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'collect' or 'pending'.",
      });
    }

    // 3. Validation: Only Phlebotomist can mark pending
    if (action === "pending" && normalizedRole !== "phlebotomist") {
      return res.status(403).json({
        success: false,
        message: "Only Phlebotomists can mark tests for later collection.",
      });
    }

    // 4. Find all test records
    const patientTests = await PatientTest.findAll({
      where: {
        id: testIds,
        pid: pid,
        hospitalid: userHospitalId,
      },
    });

    if (patientTests.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No test records found or unauthorized access.",
      });
    }

    if (patientTests.length !== testIds.length) {
      return res.status(400).json({
        success: false,
        message: `Found ${patientTests.length} tests out of ${testIds.length} requested. Some test IDs are invalid.`,
      });
    }

    const currentTime = new Date();
    const updateData = {};
    const errors = [];

    if (action === "collect") {
      // Barcode Generation Checks

      // 1️⃣ Patient must be verified
      const patient = await Patient.findOne({
        where: { id: pid, p_status: "verified" },
      });

      if (!patient) {
        return res.status(400).json({
          success: false,
          message: "Patient is not verified for sample collection",
        });
      }

      // 2️⃣ Validate each test
      for (const test of patientTests) {
        // Check if order exists
        if (!test.order_id) {
          errors.push(`Test ${test.id}: Order not linked`);
          continue;
        }

        // Check if barcode exists
        const barcodeExists = await SpecimenTransaction.findOne({
          where: { order_id: test.order_id },
        });

        if (!barcodeExists) {
          errors.push(`Test ${test.id}: Barcode not generated`);
          continue;
        }

        // Check valid status
        const validStatusesForCollect = ["center", "pending"];
        if (!validStatusesForCollect.includes(test.status)) {
          errors.push(`Test ${test.id}: Invalid status '${test.status}'`);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Validation failed for some tests",
          errors: errors,
        });
      }

      // Perform bulk update
      const [updatedCount] = await PatientTest.update(
        {
          status: "collected",
          sample_collected_time: currentTime,
          collected_by: req.user.username,
          collect_later_reason: null,
          collect_later_marked_at: null,
        },
        {
          where: {
            id: testIds,
            pid: pid,
            hospitalid: userHospitalId,
            status: { [Op.in]: ["center", "pending"] },
          },
        },
      );

      return res.status(200).json({
        success: true,
        message: `${updatedCount} sample(s) marked as collected.`,
        updated: updatedCount,
      });
    } else if (action === "pending") {
      // Remark is mandatory
      if (!remark || remark.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Remark is mandatory for later collection.",
        });
      }

      // Validate status for pending
      for (const test of patientTests) {
        if (test.status !== "center") {
          errors.push(
            `Test ${test.id}: Cannot mark for later collection. Current status is ${test.status}`,
          );
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Validation failed for some tests",
          errors: errors,
        });
      }

      // Perform bulk update
      const [updatedCount] = await PatientTest.update(
        {
          status: "pending",
          collect_later_reason: remark,
          collect_later_marked_at: currentTime,
        },
        {
          where: {
            id: testIds,
            pid: pid,
            hospitalid: userHospitalId,
            status: "center",
          },
        },
      );

      // Set patient reverification status to 'default' when marking for later collection
      const patient = await Patient.findByPk(pid);
      if (patient) {
        patient.reverification_status = "default";
        await patient.save();
      }

      return res.status(200).json({
        success: true,
        message: `${updatedCount} sample(s) marked for later collection.`,
        updated: updatedCount,
      });
    }
  } catch (error) {
    console.error("Collection Error:", error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`,
    });
  }
};

/**
 * @description Checks if a barcode has been printed before.
 */
const checkBarcodePrintStatus = async (req, res) => {
  try {
    const { hospitalid: hospitalId } = req.user;
    const { barcode } = req.query;

    if (!barcode) {
      return res
        .status(400)
        .json({ success: false, message: "Barcode is required" });
    }

    const log = await BarcodeTraceability.findOne({
      where: { barcode, hospitalid: hospitalId },
    });

    if (!log || log.total_prints === 1) {
      return res.json({
        success: true,
        data: {
          status: "FIRST_PRINT",
          totalPrinted: 0,
          reprints: 0,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        status: "REPRINT",
        totalPrinted: log.total_prints,
        reprints: log.reprint_count,
      },
    });
  } catch (error) {
    console.error("Check Barcode Print Status Error:", error);
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
    const { hospitalid: hospitalId, userid, id } = req.user;
    const currentUserId = userid || id;
    const { pbarcode, pid, isReprint, reason } = req.body;

    if (!pbarcode || !pid) {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Barcode and PID are required" });
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
      return res
        .status(400)
        .json({ success: false, message: "Reprint reason is required" });
    }

    let log = await BarcodeTraceability.findOne({
      where: { barcode: pbarcode, hospitalid: hospitalId }, // 🔥 hospital level uniqueness
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!log) {
      log = await BarcodeTraceability.create(
        {
          barcode: pbarcode,
          pid,
          hospitalid: hospitalId,
          total_prints: 1,
          reprint_count: 0, // First record: reprint_count is always 0
          reprint_reasons: reprint
            ? [{ reason, printed_at: new Date(), printed_by: currentUserId }]
            : [],
          created_by: currentUserId,
          updated_by: currentUserId,
        },
        { transaction: t },
      );
    } else {
      // Throttling: Check if this is a duplicate call within a 5-second window
      const now = new Date();
      const lastUpdate = new Date(log.updatedAt);
      const diffSeconds = (now - lastUpdate) / 1000;

      if (diffSeconds < 5) {
        await t.commit();
        return res.json({
          success: true,
          message: "Print event already logged recently",
          data: log,
          throttled: true,
        });
      }

      log.total_prints += 1;
      log.updated_by = currentUserId;

      // Increment reprint_count only from the second print onwards
      if (reprint || log.total_prints > 1) {
        log.reprint_count += 1;

        const reasons = Array.isArray(log.reprint_reasons)
          ? [...log.reprint_reasons]
          : [];
        reasons.push({
          reason: reason || "Reprint",
          printed_at: new Date(),
          printed_by: currentUserId,
        });
        log.reprint_reasons = reasons;
      }

      await log.save({ transaction: t });
    }

    await t.commit();
    await log.reload();

    return res.json({
      success: true,
      message: "Print event logged successfully",
      data: log,
    });
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
      req.query,
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
      req.query,
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

    // 1.Validation
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
        status: "technician",
        dispatch_time: new Date(),
      },
      {
        where: {
          pid: ids,
          hospitalid: userHospitalId,
          status: "collected",
        },
      },
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
  checkBarcodePrintStatus,
  generateBarcode,
};
