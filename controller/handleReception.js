const {
  Patient,
  Investigation,
  Hospital,
  PPPMode,
  PatientTest,
} = require("../models/associations/associations");
const { fn, col } = require("sequelize");

//1. Get all Tests from a center
const getCenterSample = async (req, res) => {
  try {
    // Get the current date in YYYY-MM-DD format
    const todayDateOnly = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    // Get The Details of the Center Sample
    const patientTests = await PatientTest.findAll({
      where: {
        status: "node",
        test_created_date: todayDateOnly,
      },
      attributes: [
        [fn("COUNT", col("test_id")), "total_tests"],
        [col("hospital.hospitalname"), "hospitalname"],
      ],
      include: [
        {
          model: Hospital,
          as: "hospital",
          attributes: [],
          required: true,
        },
      ],

      group: ["hospital.hospitalname"],
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
    const { hospital_names } = req.body;

    if (!Array.isArray(hospital_names) || hospital_names.length === 0) {
      return res.status(400).json({ message: "Select at least one hospital" });
    }

    // Step 1: Get hospital IDs from names
    const hospitals = await Hospital.findAll({
      where: { hospitalname: hospital_names },
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
          hospital_id: hospitalIds,
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
      message: err.message || "Something went wrong while accepting samples",
    });
  }
};

/// 3. Get All Details of Accepted Samples from Diffrent Hospitals
const allSamples = async (req, res) => {
  try {
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
      limit:limit,
      offset:offset,
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

/// 5. Get all Hospitals that belongs to the same nodal center
const getNodalHospitals = async (req, res) => {
  try {
    const { nodal_center_id } = req.params;

    const hospitals = await Hospital.findAll({
      where: { nodal_center_id },
      attributes: ["id", "hospitalname"],
    });

    if (!hospitals || hospitals.length === 0) {
      return res.status(404).json({
        message: "No hospitals found for the given nodal center.",
      });
    }

    return res.status(200).json({
      data: hospitals,
    });
  } catch (error) {
    res.status(500).json({
      message:
        error.message || "Something went wrong while fetching hospitals",
    });
  }
};


module.exports = { getCenterSample, acceptCenterSample, allSamples, sendTest };
