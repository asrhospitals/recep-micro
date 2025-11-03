const {
  Patient,
  Investigation,
  Hospital,
  PPPMode,
  PatientTest,
  Nodal,
  NodalHospital,
} = require("../models/associations/associations");
const { fn, col } = require("sequelize");

//1. Get all Tests from a center
const getCenterSample = async (req, res) => {
  try {
    // 1. Check if the user is authenticated and has a Nodal Center Role
    const { nodalid } = req.user;

    // 2. Validate the Nodal Center Is available or not
    const nodal = await Nodal.findByPk(nodalid);
    if (!nodal) {
      await transaction.rollback();
      return res.status(400).json({
        message: `Nodal name mismatch or not found. Please check the nodal name in the URL.`,
      });
    }

    // Get the current date in YYYY-MM-DD format
    const todayDateOnly = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    // Get The Details of the Center Sample
    const patientTests = await PatientTest.findAll({
      where: {
        status: "node",
        test_created_date: todayDateOnly,
        nodalid: nodalid,
      },
      attributes: [
        [fn("COUNT", col("test_id")), "total_tests"],
        [col("hospital.hospitalname"), "hospitalname"],
      ],
      include: [
        {
          model: Hospital,
          as: "hospital",
          attributes: ["id"],
          required: true,
        },
        {
          model: Nodal,
          as: "nodal",
          attributes: [],
          required: true,
        },
      ],

      group: ["hospital.hospitalname", "nodal.id", "hospital.id"],
    });
    if (!patientTests) {
      return res
        .status(404)
        .json({ message: "No patient tests found for today." });
    }
    res.status(200).json({
      data: patientTests,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: `Something went wrong while fetching patient tests ${err}`,
    });
  }
};

// 2.Accept Sample from a centers
const acceptCenterSample = async (req, res) => {
  try {
    const { hospital_ids } = req.body;

    if (!Array.isArray(hospital_ids) || hospital_ids.length === 0) {
      return res.status(400).json({ message: "Select at least one hospital" });
    }

    // Step 1: Get hospital IDs from names
    const hospitals = await Hospital.findAll({
      where: { id: hospital_ids },
      attributes: ["id"],
    });

    const hospitalIds = hospitals.map((h) => h.id);

    if (hospitalIds.length === 0) {
      return res.status(404).json({ message: "No matching hospitals found" });
    }

    // //Must be current date
    const todayDateOnly = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const [updateTest] = await PatientTest.update(
      { status: "collected" },
      {
        where: {
          status: "node",
          hospitalid: hospitalIds,
          test_created_date: todayDateOnly,
        },
      }
    );
    return res.status(200).json({
      message: "Sample accepted successfully",
      data: updateTest,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

/// 3. Get All Details of Accepted Samples from Diffrent Hospitals that Belongs Same Nodal Center
const allSamples = async (req, res) => {
  try {
    const { hospitalid } = req.params;
    /* 1. Validate Hospital ID */
    const hospital = await Hospital.findByPk(hospitalid);
    if (!hospital) {
      return res.status(400).json({
        message: `Hospital ID mismatch or not found. Please check the hospital ID in the URL.`,
      });
    }

    /* 2. Pagination Details*/
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    let offset = (page - 1) * limit;

    /* 3. Get current date in 'YYYY-MM-DD' format */
    const currentDate = new Date()
      .toLocaleString("en-CA", { timeZone: "Asia/Kolkata" })
      .split(",")[0];

    /* 5. Find Patient  */
    const { count, rows } = await Patient.findAndCountAll({
      where: {
        p_regdate: currentDate,
        hospitalid: hospitalid,
      },
      attributes: [
        "id",
        "p_name",
        "p_age",
        "p_gender",
        "p_regdate",
        "p_lname",
        "p_mobile",
        "reg_by",
      ],
      include: [
        {
          model: PPPMode,
          as: "patientPPModes",
          required: false,
          attributes: [
            "remark",
            "attatchfile",
            "pbarcode",
            "trfno",
            "pop",
            "popno",
          ],
        },
        {
          model: PatientTest,
          as: "patientTests",
          where: { status: "collected", test_created_date: currentDate },
          attributes: [
            "test_id",
            "status",
            "rejection_reason",
            "test_created_date",
            "test_updated_date",
            "test_result",
            "test_image",
          ],
          include: [
            {
              model: Investigation,
              as: "investigation",
              where: { test_collection: "No" },
              attributes: [
                "testname",
                "testmethod",
                "sampletype",
                "test_collection",
              ],
            },
          ],
        },
        {
          model: Hospital,
          as: "hospital",
          attributes: ["hospitalname"],
        },
      ],
      limit: limit,
      offset: offset,
      order: [["id", "ASC"]],
      subQuery: false,
    });

    const totalPages = Math.ceil(count / limit);

    if (!rows) {
      return res.status(404).json({
        message: "No data available for the given hospital and date.",
      });
    }

    return res.status(200).json({
      data: rows,
      meta: {
        totalItems: count,
        itemsPerPage: limit,
        currentPage: page,
        totalPages: totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      message:
        error.message || "Something went wrong while fetching sample details",
    });
  }
};

/// 4. Send Tests to Specific Departments Or Technician
const sendTest = async (req, res) => {
  try {
    // Collect all the Patient data to send
    const { patient_ids } = req.body;
    // Check Patient details added or not
    if (!Array.isArray(patient_ids) || patient_ids.length === 0) {
      return res.status(400).json({ message: "Select at least one patients" });
    }
    //Test Must be for the current date
    const todayDateOnly = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const [sendSample] = await PatientTest.update(
      { status: "technician" },
      {
        where: {
          status: "collected",
          patient_id: patient_ids,
          test_created_date: todayDateOnly,
        },
      }
    );

    res.status(200).json({
      message: "Sample send successfully to the technician",
      data: sendSample,
    });
  } catch (error) {
    res.status(500).json({
      message:
        error.message || "Something went wrong while send test to departments",
    });
  }
};

/// 5. Get All Nodal Centers
const getAllNodalHospitals = async (req, res) => {
  try {
    /*1. Get Nodal Hospitals According To the Nodal ID From Token */
    const nodalId = req.user.nodalid;

    /*2. Filter Out By Nodal ID */
    const nodalHospitals = await NodalHospital.findAll({
      where: { nodalid: nodalId },
      include: [
        {
          model: Nodal,
          as: "nodal",
          attributes: ["nodalname", "id"],
        },
        {
          model: Hospital,
          as: "hospital",
          attributes: ["hospitalname", "id"],
        },
      ],
    });

    if (!nodalHospitals || nodalHospitals.length === 0) {
      return res.status(404).json({ message: "No Nodal Hospitals found" });
    }

    const formattedData = nodalHospitals.map((record) => ({
      nodalname: record.nodal?.nodalname,
      hospitalid: record.hospital?.id,
      hospitalname: record.hospital?.hospitalname,
      isactive: record.isactive,
    }));

    return res.status(200).json(formattedData);
  } catch (e) {
    return res.status(400).json({ message: `Something went wrong ${e}` });
  }
};

module.exports = {
  getCenterSample,
  acceptCenterSample,
  allSamples,
  sendTest,
  getAllNodalHospitals,
};
