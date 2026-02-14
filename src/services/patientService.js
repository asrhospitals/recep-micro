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
  const { status, startDate, endDate, searchKey } = queryParams;

  const today = new Date()
    .toLocaleString("en-CA", { timeZone: "Asia/Kolkata" })
    .split(",")[0];

  const whereClause = {
    hospitalid: hospitalId,
    p_flag: { [Op.in]: [1, 2] },
  };

  // Status Filter
  if (status) {
    whereClause.p_status = status;
  } else {
    whereClause.p_status = "default";
  }

  // Search Filter
  if (searchKey) {
    const searchConditions = [
      { p_name: { [Op.iLike]: `%${searchKey}%` } },
      { p_lname: { [Op.iLike]: `%${searchKey}%` } },
      { uhid: { [Op.iLike]: `%${searchKey}%` } },
      { p_mobile: { [Op.iLike]: `%${searchKey}%` } },
      // { "$patientPPModes.pbarcode$": { [Op.iLike]: `%${searchKey}%` } },
      { "$hospital.hospitalname$": { [Op.iLike]: `%${searchKey}%` } },
      { p_status: { [Op.iLike]: `%${searchKey}%` } },
    ];

    if (!isNaN(searchKey)) {
      searchConditions.push({ id: parseInt(searchKey) });
    }

    whereClause[Op.or] = searchConditions;
  }

  // Date Filter (using p_regdate)
  if (startDate && endDate) {
    whereClause.p_regdate = {
      [Op.between]: [startDate, endDate],
    };
  } else if (startDate) {
    whereClause.p_regdate = {
      [Op.gte]: startDate,
    };
  } else if (endDate) {
    whereClause.p_regdate = {
      [Op.lte]: endDate,
    };
  }

  const { count, rows } = await Patient.findAndCountAll({
    where: whereClause,
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
    // subQuery: false,
    distinct: true,
    col: "id",
  });

  if (!rows) throw new Error("No data available for the given criteria.");

  const processedRows = rows.map((patient) => _derivePStatus(patient));

  return _formatPaginationResponse(processedRows, count, limit, page);
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

  const processedRows = rows.map((patient) => _derivePStatus(patient));

  return _formatPaginationResponse(processedRows, count, limit, page);
}

/**
 * DATA RETRIEVAL:  Test specific data marked as collected after Patient Verified
 */

async function getCollectedData({ hospitalId }, queryParams) {
  const hospital = await Hospital.findByPk(hospitalId);
  if (!hospital) throw new Error("Hospital not found");

  const { limit, offset, page } = _getPagination(queryParams);
  const { searchKey, startDate, endDate, status } = queryParams;

  const whereClause = {
    hospitalid: hospitalId,
    p_flag: { [Op.in]: [1, 2] },
  };

  // Search Filter
  if (searchKey) {
    const searchConditions = [
      { p_name: { [Op.iLike]: `%${searchKey}%` } },
      { p_lname: { [Op.iLike]: `%${searchKey}%` } },
      { uhid: { [Op.iLike]: `%${searchKey}%` } },
      { p_mobile: { [Op.iLike]: `%${searchKey}%` } },
      // { "$patientPPModes.pbarcode$": { [Op.iLike]: `%${searchKey}%` } },
      { "$hospital.hospitalname$": { [Op.iLike]: `%${searchKey}%` } },
      { p_status: { [Op.iLike]: `%${searchKey}%` } },
    ];
    if (!isNaN(searchKey)) {
      searchConditions.push({ id: parseInt(searchKey) });
    }
    whereClause[Op.or] = searchConditions;
  }

  // Date Filter (using p_regdate)
  if (startDate && endDate) {
    whereClause.p_regdate = {
      [Op.between]: [startDate, endDate],
    };
  } else if (startDate) {
    whereClause.p_regdate = {
      [Op.gte]: startDate,
    };
  } else if (endDate) {
    whereClause.p_regdate = {
      [Op.lte]: endDate,
    };
  }

  // Base query options
  const findOptions = {
    where: whereClause,
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
    include: _getCollectedSample(),
    order: [["id", "DESC"]],
    subQuery: false,
    distinct: true,
    col: "id",
  };

  // // Pagination (Optional: return all if limit/page not provided)
  // if (queryParams.limit || queryParams.page) {
  //   findOptions.limit = limit;
  //   findOptions.offset = offset;
  // }

  // const { count, rows } = await Patient.findAndCountAll(findOptions);

  const rows = await Patient.findAll(findOptions);

  if (!rows) throw new Error("No data available for the given criteria.");

  // Derive pStatus for each row
  let processedRows = rows.map((patient) => _derivePStatus(patient));

  const totalItems = processedRows.length;
  const start = (page - 1) * limit;
  const paginatedRows = processedRows.slice(start, start + limit);

  return _formatPaginationResponse(paginatedRows, totalItems, limit, page);
}

/**
 * DATA RETRIEVAL: Get Patients with tests marked for Later Collection
 */
async function getPendingCollection({ hospitalId }, queryParams) {
  const hospital = await Hospital.findByPk(hospitalId);
  if (!hospital) throw new Error("Hospital not found");

  const { limit, offset, page } = _getPagination(queryParams);
  const { searchKey, startDate, endDate, status } = queryParams;

  const whereClause = {
    hospitalid: hospitalId,
    p_flag: { [Op.in]: [1, 2] },
  };

  // Reverification Status Filter (Default to 'default' if not provided)
  if (status) {
    whereClause.reverification_status = status;
  } else {
    whereClause.reverification_status = "default";
  }

  // Search Filter
  if (searchKey) {
    const searchConditions = [
      { p_name: { [Op.iLike]: `%${searchKey}%` } },
      { p_lname: { [Op.iLike]: `%${searchKey}%` } },
      { uhid: { [Op.iLike]: `%${searchKey}%` } },
      { p_mobile: { [Op.iLike]: `%${searchKey}%` } },
      // { "$patientPPModes.pbarcode$": { [Op.iLike]: `%${searchKey}%` } },
    ];
    if (!isNaN(searchKey)) {
      searchConditions.push({ id: parseInt(searchKey) });
    }
    whereClause[Op.or] = searchConditions;
  }

  // Date Filter (using p_regdate)
  if (startDate && endDate) {
    whereClause.p_regdate = { [Op.between]: [startDate, endDate] };
  } else if (startDate) {
    whereClause.p_regdate = { [Op.gte]: startDate };
  } else if (endDate) {
    whereClause.p_regdate = { [Op.lte]: endDate };
  }

  const findOptions = {
    where: whereClause,
    attributes: [
      "id",
      "p_name",
      "p_lname",
      "p_age",
      "p_gender",
      "p_regdate",
      "p_mobile",
      "uhid",
      "p_status",
      "reverification_status",
    ],
    include: [
      { model: PPPMode, as: "patientPPModes", required: !!searchKey }, // Only required if searching barcode
      {
        model: PatientTest,
        as: "patientTests",
        where: { status: "pending" },
        required: true, // Must have at least one pending test
        attributes: [
          "id",
          "status",
          "collect_later_reason",
          "collect_later_marked_at",
          "createdAt",
        ],
        include: [
          {
            model: Investigation,
            as: "investigation",
            attributes: ["testname", "shortname", "sampleqty", "containertype"],
          },
        ],
      },
    ],
    order: [["id", "DESC"]],
    subQuery: false,
    distinct: true,
    col: "id",
  };

  const rows = await Patient.findAll(findOptions);

  if (!rows) throw new Error("No data available for the given criteria.");

  const processedRows = rows.map((patient) => {
    const patientData = patient.toJSON();
    return {
      ...patientData,
      pStatus: patientData.reverification_status,
    };
  });

  const totalItems = processedRows.length;
  const start = (page - 1) * limit;
  const paginatedRows = processedRows.slice(start, start + limit);

  return _formatPaginationResponse(paginatedRows, totalItems, limit, page);
}

// ==========================================
// PRIVATE HELPER LOGIC (Internal Use Only)
// ==========================================

function _derivePStatus(patient) {
  const patientData = patient.toJSON();
  let pStatus = patientData.p_status; // default to p_status

  if (patientData.patientTests && patientData.patientTests.length > 0) {
    const statuses = patientData.patientTests.map((t) => t.status);
    if (statuses.every((s) => s === "delivered")) {
      pStatus = "delivered";
    } else if (
      statuses.some(
        (s) => s === "collected" || s === "intransit" || s === "inprogress",
      )
    ) {
      pStatus = "collected";
    }
  }
  return { ...patientData, pStatus };
}

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
      attributes: ["id", "createdAt", "status", "order_id"],
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
            "stattest",
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

      attributes: [
        "id",
        "status",
        "createdAt",
        "updatedAt",
        "sample_collected_time",
      ],
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
            "stattest",
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
  getPendingCollection
};
