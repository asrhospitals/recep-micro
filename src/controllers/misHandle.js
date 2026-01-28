const { Op } = require("sequelize");
const {
  Patient,
  PatientTest,
  PPPMode,
  Investigation,
} = require("../repository/associationModels/associations");

/**
 * Utility to build date range condition
 */
const buildDateRange = (startDate, endDate, column) => {
  if (!startDate || !endDate) return {};

  return {
    [column]: {
      [Op.between]: [
        new Date(`${startDate} 00:00:00`),
        new Date(`${endDate} 23:59:59`),
      ],
    },
  };
};

// 1. KPI STRIP
const kpis = async (req, res) => {
  try {
    const { hospitalid: hospitalId } = req.user;
    const { startDate, endDate } = req.query;

    const patientWhere = { hospitalid: hospitalId };
    const testWhere = { hospitalid: hospitalId };

    const patientDateFilter = buildDateRange(startDate, endDate, "p_regdate");
    const testCreatedFilter = buildDateRange(startDate, endDate, "createdAt");
    const collectedDateFilter = buildDateRange(
      startDate,
      endDate,
      "sample_collected_time",
    );

    const totalOrders = await Patient.count({
      where: { ...patientWhere, ...patientDateFilter },
    });

    const collected = await PatientTest.count({
      where: {
        ...testWhere,
        sample_collected_time: { [Op.ne]: null },
        ...collectedDateFilter,
      },
    });

    const pending = await PatientTest.count({
      where: {
        ...testWhere,
        status: "pending",
        ...testCreatedFilter,
      },
    });

    const recollect = await PatientTest.count({
      where: {
        ...testWhere,
        status: "recollect",
        ...testCreatedFilter,
      },
    });

    const statSamples = await PatientTest.count({
      where: { ...testWhere, ...testCreatedFilter },
      include: [
        {
          model: Investigation,
          as: "investigation",
          where: { stattest: true },
        },
      ],
    });

    const preAnalyticalErrorPercent =
      collected === 0 ? 0 : Number(((recollect / collected) * 100).toFixed(2));

    return res.json({
      success: true,
      message: "KPI data retrieved successfully.",
      data: {
        totalOrders,
        collected,
        pending,
        recollect,
        statSamples,
        preAnalyticalErrorPercent,
      },
    });
  } catch (error) {
    console.error("KPI STRIP ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// 2. Time-based KPIs
// 2.1 Order to Collection TAT

const getOrderToCollectionTAT = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { hospitalid: hospitalId } = req.user;

    const patientWhere = { hospitalid: hospitalId };

    // 1. Improved Date Handling: Ensure endDate covers the whole day
    if (startDate && endDate) {
      patientWhere.createdAt = {
        [Op.between]: [
          new Date(startDate).setHours(0, 0, 0, 0),
          new Date(endDate).setHours(23, 59, 59, 999),
        ],
      };
    }

    const patients = await Patient.findAll({
      where: patientWhere,
      attributes: ["id", "createdAt"],
      include: [
        {
          model: PatientTest,
          as: "patientTests",
          attributes: ["sample_collected_time"],
          // Keep required: true to only get patients who actually had samples collected
          where: {
            sample_collected_time: { [Op.ne]: null },
          },
          required: true,
          include: [
            {
              model: Investigation,
              as: "investigation",
              attributes: ["stattest"],
            },
          ],
        },
        {
          model: PPPMode,
          as: "patientPPModes",
          attributes: ["pop"],
        },
      ],
    });

    const stats = {
      OP: { total: 0, green: 0, amber: 0, red: 0 },
      IP: { total: 0, green: 0, amber: 0, red: 0 },
      STAT: { total: 0, green: 0, amber: 0, red: 0 },
    };

    const diffMins = (start, end) => {
      const d1 = new Date(start);
      const d2 = new Date(end);
      if (isNaN(d1) || isNaN(d2)) return null;
      return Math.round((d2 - d1) / 60000);
    };

    patients.forEach((p) => {
      // Safely extract the Patient Type (POP)
      const pop = p.patientPPModes?.[0]?.pop || "OP";

      p.patientTests.forEach((t) => {
        const mins = diffMins(p.createdAt, t.sample_collected_time);

        // Skip if date calculation failed
        if (mins === null) return;

        // Determine bucket: STAT priority, then IP/OP
        let bucketKey = t.investigation?.stattest
          ? "STAT"
          : pop === "IP"
            ? "IP"
            : "OP";
        let bucket = stats[bucketKey];

        bucket.total++;

        // Threshold Logic
        if (bucketKey === "STAT") {
          if (mins <= 15) bucket.green++;
          else if (mins <= 25) bucket.amber++;
          else bucket.red++;
        } else if (bucketKey === "IP") {
          if (mins <= 20) bucket.green++;
          else if (mins <= 30) bucket.amber++;
          else bucket.red++;
        } else {
          // Default: OP
          if (mins <= 30) bucket.green++;
          else if (mins <= 45) bucket.amber++;
          else bucket.red++;
        }
      });
    });

    return res.json({
      success: true,
      count: patients.length, // Useful for debugging
      data: stats,
    });
  } catch (err) {
    console.error("Order→Collection TAT Error:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};
// 2.2 Collection to Dispatch TAT
const getCollectionToDispatchTAT = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { hospitalid: hospitalId } = req.user;

    const testWhere = {
      hospitalid: hospitalId,
      sample_collected_time: { [Op.ne]: null },
      dispatch_time: { [Op.ne]: null },
      status: { [Op.in]: ["intransit", "center", "accept"] },
    };

    // Apply date filter ONLY if present
    if (startDate && endDate) {
      testWhere.sample_collected_time = {
        [Op.between]: [
          new Date(`${startDate} 00:00:00`),
          new Date(`${endDate} 23:59:59`),
        ],
      };
    }

    const tests = await PatientTest.findAll({
      where: testWhere,
      attributes: ["sample_collected_time", "dispatch_time"],
    });

    const stats = { total: 0, green: 0, amber: 0, red: 0 };

    tests.forEach((t) => {
      const mins = Math.round(
        (new Date(t.dispatch_time) - new Date(t.sample_collected_time)) / 60000,
      );

      if (mins < 0) return; // safety check

      stats.total++;
      if (mins <= 15) stats.green++;
      else if (mins <= 30) stats.amber++;
      else stats.red++;
    });

    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error("TAT ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 2.3 Dispatch to Receipt TAT
const getDispatchToReceiptTAT = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { hospitalid: hospitalId } = req.user;

    const testWhere = {
      hospitalid: hospitalId,
      dispatch_time: { [Op.ne]: null },
      received_time: { [Op.ne]: null },
      status: "accept",
    };

    // Apply date filter ONLY if provided
    if (startDate && endDate) {
      testWhere.dispatch_time = {
        [Op.between]: [
          new Date(`${startDate} 00:00:00`),
          new Date(`${endDate} 23:59:59`),
        ],
      };
    }

    const tests = await PatientTest.findAll({
      where: testWhere,
      attributes: ["dispatch_time", "receive_time"],
    });

    const stats = { total: 0, green: 0, amber: 0, red: 0 };

    tests.forEach((t) => {
      const mins = Math.round(
        (new Date(t.receive_time) - new Date(t.dispatch_time)) / 60000,
      );

      if (mins < 0) return; // safety

      stats.total++;
      if (mins <= 20) stats.green++;
      else if (mins <= 40) stats.amber++;
      else stats.red++;
    });

    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error("DISPATCH → RECEIPT TAT ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
// 2.4 Backlog For sample collected but not dispatched
const backlog = async (req, res) => {
  try {
    const { hospitalid: hospitalId } = req.user;
    const { startDate, endDate } = req.query;

    // Define the "Not Dispatched" criteria
    const whereClause = {
      hospitalid: hospitalId,
      // 1. Must have a collection timestamp
      sample_collected_time: { [Op.ne]: null },
      // 2. Status is NOT in transit or already received/completed
      status: "collected",
    };

    // Date filtering
    if (startDate && endDate) {
      whereClause.sample_collected_time = {
        [Op.between]: [
          new Date(`${startDate}T00:00:00`),
          new Date(`${endDate}T23:59:59`),
        ],
      };
    }

    const backlogCount = await PatientTest.count({ where: whereClause });

    // Thresholds: Green: 0-5, Amber: 6-10, Red: >10
    let severity = "green";
    if (backlogCount > 10) severity = "red";
    else if (backlogCount > 5) severity = "amber";

    return res.json({
      success: true,
      data: {
        backlogCount,
        severity,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. COLLECTION PERFORMANCE (CORE METRICS)

const avgCollectionTime = async (req, res) => {
  try {
    const { hospitalid: hospitalId } = req.user;
    const { startDate, endDate } = req.query;

    const testDateFilter = {};
    if (startDate && endDate) {
      testDateFilter.sample_collected_time = {
        [Op.between]: [
          new Date(`${startDate} 00:00:00`),
          new Date(`${endDate} 23:59:59`),
        ],
      };
    }

    const patients = await Patient.findAll({
      where: { hospitalid: hospitalId },
      attributes: ["id", "createdAt"],
      include: [
        {
          model: PatientTest,
          as: "patientTests",
          attributes: ["sample_collected_time"],
          where: {
            sample_collected_time: { [Op.ne]: null },
            ...testDateFilter,
          },
          required: true,
        },
        {
          model: PPPMode,
          as: "patientPPModes",
          attributes: ["pop"],
          required: true,
        },
      ],
    });

    const stats = {
      OP: { totalMins: 0, count: 0 },
      IP: { totalMins: 0, count: 0 },
    };

    patients.forEach((p) => {
      const pop = p.patientPPModes[0]?.pop || "OP";

      // earliest collection time per patient
      const firstCollection = p.patientTests
        .map((t) => new Date(t.sample_collected_time))
        .sort((a, b) => a - b)[0];

      const mins = (firstCollection - new Date(p.createdAt)) / 60000;

      if (mins < 0) return;

      if (pop === "IP") {
        stats.IP.totalMins += mins;
        stats.IP.count++;
      } else {
        stats.OP.totalMins += mins;
        stats.OP.count++;
      }
    });

    const opdAvg =
      stats.OP.count === 0
        ? 0
        : Math.round(stats.OP.totalMins / stats.OP.count);

    const ipdAvg =
      stats.IP.count === 0
        ? 0
        : Math.round(stats.IP.totalMins / stats.IP.count);

    res.json({
      success: true,
      data: {
        opdAvgMins: opdAvg,
        opdColor: opdAvg === 0 ? "green" : opdAvg <= 12 ? "amber" : "red",

        ipdAvgMins: ipdAvg,
        ipdColor: ipdAvg === 0 ? "green" : ipdAvg <= 18 ? "amber" : "red",
      },
    });
  } catch (err) {
    console.error("Avg Collection Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const avgDispatchDelay = async (req, res) => {
  try {
    const { hospitalid: hospitalId } = req.user;
    const { startDate, endDate } = req.query;

    const testWhere = { hospitalid: hospitalId };

    if (startDate && endDate) {
      testWhere.updatedAt = {
        [Op.between]: [
          new Date(`${startDate} 00:00:00`),
          new Date(`${endDate} 23:59:59`),
        ],
      };
    }

    const tests = await PatientTest.findAll({
      where: {
        ...testWhere,
        sample_collected_time: { [Op.ne]: null },
        status: { [Op.in]: ["intransit", "accept"] },
      },
      attributes: ["sample_collected_time", "dispatch_time", "updatedAt"],
    });

    let totalMins = 0;
    let count = 0;

    tests.forEach((t) => {
      const mins =
        (new Date(t.dispatch_time) - new Date(t.sample_collected_time)) / 60000;

      if (mins >= 0) {
        totalMins += mins;
        count++;
      }
    });

    res.json({
      success: true,
      data: {
        avgDispatchDelay: count === 0 ? 0 : Math.round(totalMins / count),
      },
    });
  } catch (err) {
    console.error("Avg Dispatch Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. PHLEBOTOMIST PERFORMANCE MATRIX

const getMyPerformance = async (req, res) => {
  try {
    // 1. Get current Phlebotomist ID from token
    const hospitalId = req.user.hospitalid;
    const { startDate, endDate } = req.query;

    const patientWhere = { hospitalid: hospitalId };

    // Apply Date Filter
    if (startDate && endDate) {
      patientWhere.p_regdate = {
        [Op.between]: [
          new Date(`${startDate}T00:00:00`),
          new Date(`${endDate}T23:59:59`),
        ],
      };
    }

    const patients = await Patient.findAll({
      where: patientWhere,
      attributes: ["createdAt", "p_regdate", "id"],
      include: [
        {
          model: PatientTest,
          as: "patientTests",
          required: true,
          // Only fetch tests assigned to the logged-in user
          where: { collected_by: req.user.username },
          attributes: ["status", "sample_collected_time"],
        },
      ],
    });

    // 2. Initialize Stats
    let stats = {
      assigned: 0,
      collected: 0,
      pending: 0,
      recollectCount: 0,
      totalMins: 0,
      avgCollectionTime: 0,
      recollectPercent: 0,
    };

    // 3. Process Data
    patients.forEach((patient) => {
      patient.patientTests.forEach((test) => {
        stats.assigned++;

        if (test.status === "recollect") {
          stats.recollectCount++;
        }

        if (test.sample_collected_time) {
          stats.collected++;

          // Calculate TAT: Collection - Registration
          const diff = Math.round(
            (new Date(test.sample_collected_time) -
              new Date(patient.createdAt)) /
              60000,
          );
          if (diff >= 0) stats.totalMins += diff;
        }
      });
    });

    // 4. Final Math
    stats.pending = stats.assigned - stats.collected;
    stats.avgCollectionTime =
      stats.collected > 0 ? Math.round(stats.totalMins / stats.collected) : 0;
    stats.recollectPercent =
      stats.collected > 0
        ? Number(((stats.recollectCount / stats.collected) * 100).toFixed(2))
        : 0;

    // Remove internal helper
    delete stats.totalMins;

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. RECOLLECTION & ERROR ANALYSIS (NABL GOLD)
/* Recollection Summary */
const recollectionSummary = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const { startDate, endDate } = req.query;
    const rows = await PatientTest.findAll({
      where: {
        status: "recollect",
        hospitalid: hospitalId,
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      attributes: ["recollection_reason"],
    });

    const summary = {};
    rows.forEach((r) => {
      summary[r.recollection_reason] =
        (summary[r.recollection_reason] || 0) + 1;
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* Tube-wise Errors */
const tubeWiseErrors = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const { startDate, endDate } = req.query;

    if (!hospitalId) {
      res
        .status(400)
        .json({ success: false, message: "No valid hospital ID found" });
    }

    const tests = await PatientTest.findAll({
      where: {
        status: "recollect",
        hospitalid: hospitalId,
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          model: Investigation,
          as: "investigation",
          attributes: ["containertype"],
        },
      ],
    });

    const result = {};
    tests.forEach((t) => {
      const tube = t.Investigation?.containertype || "Unknown";
      result[tube] = (result[tube] || 0) + 1;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  kpis,
  getOrderToCollectionTAT,
  getCollectionToDispatchTAT,
  getDispatchToReceiptTAT,
  backlog,
  avgCollectionTime,
  avgDispatchDelay,
  getMyPerformance,
  recollectionSummary,
  tubeWiseErrors,
};
