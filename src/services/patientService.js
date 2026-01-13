const sequelize = require("../config/dbConnection");
const {
  Patient,
  PPPMode,
  PatientTest,
  Investigation,
  Hospital,
  Nodal,
  Result,
  DerivedTestComponent,
} = require("../repository/associationModels/associations");

const { Op } = require("sequelize");

/**
 * DATA RETRIEVAL:  Get Test specific data from Reception
 */
async function getPatientTestData({ hospitalId }, queryParams) {
  const hospital = await Hospital.findByPk(hospitalId);
  if (!hospital) throw new Error("Hospital not found");

  const { limit, offset, page } = _getPagination(queryParams);
  const today = new Date()
    .toLocaleString("en-CA", { timeZone: "Asia/Kolkata" })
    .split(",")[0];

  const { count, rows } = await Patient.findAndCountAll({
    where: {
      p_regdate: today,
      hospitalid: hospitalId,
      p_flag: { [Op.in]: [1, 2] },
      p_status: "default",
    },
    attributes: [
      "id",
      "p_name",
      "p_age",
      "p_gender",
      "p_regdate",
      "p_lname",
      "p_mobile",
      "uhid",
      "p_status",
    ],
    include: _getPPPIncludes(),
    limit,
    offset,
    order: [["id", "DESC"]],
    subQuery: false,
    distinct: true,
    col: "id",
  });

  if (!rows) throw new Error("No data available for the given criteria.");
  return _formatPaginationResponse(rows, count, limit, page);
}

/**
 * DATA RETRIEVAL:  Get Verify the Registered Patients Data
 */

async function getVerifiedPatientTestData({ hospitalId }, queryParams) {
  const hospital = await Hospital.findByPk(hospitalId);
  if (!hospital) throw new Error("Hospital not found");

  const { limit, offset, page } = _getPagination(queryParams);
  const today = new Date()
    .toLocaleString("en-CA", { timeZone: "Asia/Kolkata" })
    .split(",")[0];

  const { count, rows } = await Patient.findAndCountAll({
    where: {
      p_regdate: today,
      hospitalid: hospitalId,
      p_flag: { [Op.in]: [1, 2] },
      p_status: "verified",
    },
    attributes: [
      "id",
      "p_name",
      "p_age",
      "p_gender",
      "p_regdate",
      "p_lname",
      "p_mobile",
      "uhid",
      "p_status",
    ],
    include: _getPPPIncludes(),
    limit,
    offset,
    order: [["id", "DESC"]],
    subQuery: false,
    distinct: true,
    col: "id",
  });

  if (!rows) throw new Error("No data available for the given criteria.");
  return _formatPaginationResponse(rows, count, limit, page);
}

/**
 * DATA RETRIEVAL:  Test specific data marked as collected after Patient Verified
 */

async function getCollectedData({ hospitalId }, queryParams) {
  const hospital = await Hospital.findByPk(hospitalId);
  if (!hospital) throw new Error("Hospital not found");

  const { limit, offset, page } = _getPagination(queryParams);
  const today = new Date()
    .toLocaleString("en-CA", { timeZone: "Asia/Kolkata" })
    .split(",")[0];

  const { count, rows } = await Patient.findAndCountAll({
    where: {
      p_regdate: today,
      hospitalid: hospitalId,
      p_flag: { [Op.in]: [1, 2] },
    },
    attributes: [
      "id",
      "p_name",
      "p_age",
      "p_gender",
      "p_regdate",
      "p_lname",
      "p_mobile",
      "uhid",
    ],
    include: _getCollectedSample(),
    limit,
    offset,
    order: [["id", "DESC"]],
    subQuery: false,
    distinct: true,
    col: "id",
  });

  if (!rows) throw new Error("No data available for the given criteria.");
  return _formatPaginationResponse(rows, count, limit, page);
}

// ==========================================
// PRIVATE HELPER LOGIC (Internal Use Only)
// ==========================================

function _getPagination(params) {
  const page = parseInt(params.page) || 1;
  const limit = parseInt(params.limit) || 10;
  return { page, limit, offset: (page - 1) * limit };
}

function _formatPaginationResponse(rows, count, limit, page) {
  return {
    data: rows,
    totalItems: count,
    itemsPerPage: limit,
    currentPage: page,
    totalPages: Math.ceil(count / limit),
  };
}

function _getPPPIncludes() {
  return [
    { model: PPPMode, as: "patientPPModes", required: true },
    {
      model: PatientTest,
      as: "patientTests",
      where: { status: "center" },
      attributes: ["id", "createdAt", "status"],
      required: true,
      include: [
        {
          model: Investigation,
          as: "investigation",
          attributes: [
            "testname",
            "shortname",
            "shortcode",
            "sampleqty",
            "containertype",
            "tatunit",
            "tat",
          ],
        },
      ],
    },
    { model: Hospital, as: "hospital", attributes: ["hospitalname"] },
  ];
}

// For collected sample
function _getCollectedSample() {
  return [
    { model: PPPMode, as: "patientPPModes", required: true },
    {
      model: PatientTest,
      as: "patientTests",
      where: {
        status: {
          [Op.in]: ["collected", "intransit", "delivered", "inprogress"],
        },
      },

      attributes: ["id", "status", "createdAt", "updatedAt"],
      required: true,
      include: [
        {
          model: Investigation,
          as: "investigation",
          attributes: [
            "testname",
            "shortname",
            "shortcode",
            "sampleqty",
            "containertype",
            "tatunit",
            "tat",
          ],
        },
      ],
    },
    { model: Hospital, as: "hospital", attributes: ["hospitalname"] },
  ];
}

module.exports = {
  getVerifiedPatientTestData,
  getPatientTestData,
  getCollectedData,
};
