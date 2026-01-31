const { Op } = require("sequelize");
const sequelize = require("../config/dbConnection");
const {
  Patient,
  PatientTest,
  PPPMode,
  Investigation,
  Hospital,
  Department,
  Nodal,
  BarcodeTraceability,
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

/**
 * Utility to build common filters for MIS APIs
 */
const buildCommonFilters = (query, hospitalId) => {
  const {
    startDate,
    endDate,
    locationType,
    departmentId,
    collectionCenterId,
    phlebotomist,
    priority,
  } = query;

  const testWhere = { hospitalid: hospitalId };
  const patientWhere = { hospitalid: hospitalId };
  const investigationWhere = {};
  const pppWhere = {};

  // Date range filter
  if (startDate && endDate) {
    testWhere.createdAt = {
      [Op.between]: [
        new Date(`${startDate} 00:00:00`),
        new Date(`${endDate} 23:59:59`),
      ],
    };
  }

  // Location Type (OPD/IPD/Home) -> mapped from PPPMode.pop
  if (locationType) {
    pppWhere.pop = locationType;
  }

  // Department
  if (departmentId) {
    investigationWhere.departmentId = departmentId;
  }

  // Collection Center -> mapped from nodalid
  if (collectionCenterId) {
    testWhere.nodalid = collectionCenterId;
  }

  // Phlebotomist -> mapped from collected_by
  if (phlebotomist) {
    testWhere.collected_by = phlebotomist;
  }

  // Priority (STAT / Routine)
  if (priority) {
    investigationWhere.stattest = priority.toLowerCase() === "stat";
  }

  return { testWhere, patientWhere, investigationWhere, pppWhere };
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

    // Add average minutes
    Object.values(stats).forEach((b) => {
      b.avgMins = b.total === 0 ? 0 : Math.round(b.totalMins / b.total);
      delete b.totalMins;
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
      receive_time: { [Op.ne]: null },
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
    const hospitalId = req.user.hospitalid;
    const { startDate, endDate } = req.query;

    const patientWhere = { hospitalid: hospitalId };

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
      attributes: ["createdAt", "id"],
      include: [
        {
          model: PatientTest,
          as: "patientTests",
          required: true,
          attributes: [
            "status",
            "sample_collected_time",
            "collected_by",
          ],
        },
      ],
    });

    const statsMap = {};

    patients.forEach((patient) => {
      patient.patientTests.forEach((test) => {
        const user = test.collected_by || "Unassigned";

        if (!statsMap[user]) {
          statsMap[user] = {
            collected_by: user,
            assigned: 0,
            collected: 0,
            pending: 0,
            recollectCount: 0,
            totalMins: 0,
          };
        }

        const s = statsMap[user];
        s.assigned++;

        if (test.status === "recollect") s.recollectCount++;

        if (test.sample_collected_time) {
          s.collected++;
          const diff =
            (new Date(test.sample_collected_time) -
              new Date(patient.createdAt)) /
            60000;
          if (diff >= 0) s.totalMins += diff;
        }
      });
    });

    const result = Object.values(statsMap).map((s) => {
      s.pending = s.assigned - s.collected;
      s.avgCollectionTime =
        s.collected > 0 ? Math.round(s.totalMins / s.collected) : 0;
      s.recollectPercent =
        s.collected > 0
          ? Number(((s.recollectCount / s.collected) * 100).toFixed(2))
          : 0;

      delete s.totalMins;
      return s;
    });

    return res.json({ success: true, data: result });
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
      attributes: ["recollect_reason"],
    });

    const summary = {};
    rows.forEach((r) => {
      summary[r.rrecollect_reason] = (summary[r.recollect_reason] || 0) + 1;
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

/* Barcode & Traceability Monitor */

// API 1: Barcode Summary
const getBarcodeSummary = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const { startDate, endDate } = req.query;
    const {
      testWhere,
      patientWhere,
      investigationWhere,
    } = buildCommonFilters(req.query, hospitalId);

    const barcodeDateFilter = buildDateRange(startDate, endDate, "createdAt");

    // 1. Get unique BarcodeTraceability IDs that match all filters
    const matchingRecords = await BarcodeTraceability.findAll({
      where: { ...barcodeDateFilter, hospitalid: hospitalId },
      attributes: ["id"],
      include: [
        {
          model: Patient,
          as: "patient",
          where: patientWhere,
          required: true,
          attributes: [],
          include: [
            {
              model: PatientTest,
              as: "patientTests",
              where: testWhere,
              required: true,
              attributes: [],
              include: [
                {
                  model: Investigation,
                  as: "investigation",
                  where: investigationWhere,
                  required: true,
                  attributes: [],
                },
              ],
            },
          ],
        },
      ],
      raw: true,
    });

    const uniqueIds = [...new Set(matchingRecords.map((r) => r.id))];

    let totalPrinted = 0;
    let reprints = 0;

    if (uniqueIds.length > 0) {
      // 2. Perform Database Aggregation on unique IDs to avoid duplication from joins
      const summary = await BarcodeTraceability.findOne({
        where: { id: uniqueIds },
        attributes: [
          [sequelize.fn("SUM", sequelize.col("total_prints")), "totalPrinted"],
          [sequelize.fn("SUM", sequelize.col("reprint_count")), "reprints"],
        ],
        raw: true,
      });

      totalPrinted = Number(summary.totalPrinted) || 0;
      reprints = Number(summary.reprints) || 0;
    }
    const reprintPercent =
      totalPrinted === 0 ? 0 : Number(((reprints / totalPrinted) * 100).toFixed(2));

    const targetPercent = 5;

    res.json({
      success: true,
      data: {
        totalPrinted,
        reprints,
        reprintPercent,
        targetPercent,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// API 2: Top Reprint Reasons
const getTopReprintReasons = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const { startDate, endDate } = req.query;
    const {
      testWhere,
      patientWhere,
      investigationWhere,
    } = buildCommonFilters(req.query, hospitalId);

    const barcodeDateFilter = buildDateRange(startDate, endDate, "createdAt");

    // 1. Get unique IDs for records with reprints
    const matchingRecords = await BarcodeTraceability.findAll({
      where: {
        ...barcodeDateFilter,
        hospitalid: hospitalId,
        reprint_count: { [Op.gt]: 0 },
      },
      attributes: ["id"],
      include: [
        {
          model: Patient,
          as: "patient",
          where: patientWhere,
          required: true,
          attributes: [],
          include: [
            {
              model: PatientTest,
              as: "patientTests",
              where: testWhere,
              required: true,
              attributes: [],
              include: [
                {
                  model: Investigation,
                  as: "investigation",
                  where: investigationWhere,
                  required: true,
                  attributes: [],
                },
              ],
            },
          ],
        },
      ],
      raw: true,
    });

    const uniqueIds = [...new Set(matchingRecords.map((r) => r.id))];

    const reasonCounts = {};

    if (uniqueIds.length > 0) {
      // 2. Fetch reasons for these unique IDs only
      const records = await BarcodeTraceability.findAll({
        where: { id: uniqueIds },
        attributes: ["reprint_reasons"],
        raw: true,
      });

      records.forEach((rec) => {
        const reasons = rec.reprint_reasons || [];
        reasons.forEach((entry) => {
          // Fix for [object Object] - extract the reason text
          const reasonText = typeof entry === "string" ? entry : entry.reason || "Unknown";
          reasonCounts[reasonText] = (reasonCounts[reasonText] || 0) + 1;
        });
      });
    }

    const sortedReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // Return only top 3 reasons as per requirements

    res.json({
      success: true,
      data: sortedReasons,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* STAT & Critical Sample Tracking */

// API 3: STAT Summary
const getStatSummary = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const {
      testWhere,
      patientWhere,
      investigationWhere,
      pppWhere,
    } = buildCommonFilters(req.query, hospitalId);

    const statTests = await PatientTest.findAll({
      where: testWhere,
      include: [
        {
          model: Investigation,
          as: "investigation",
          where: { ...investigationWhere, stattest: true },
          attributes: ["stattest"],
          required: true,
        },
        {
          model: Patient,
          as: "patient",
          where: patientWhere,
          required: true,
          attributes: ["createdAt"],
          include: [
            {
              model: PPPMode,
              as: "patientPPModes",
              where: pppWhere,
              required: true,
            },
          ],
        },
      ],
    });

    const totalStat = statTests.length;
    let collectedWithin15Min = 0;
    let delayedCount = 0;

    statTests.forEach((t) => {
      if (t.sample_collected_time && t.patient?.createdAt) {
        const mins = Math.round(
          (new Date(t.sample_collected_time) - new Date(t.patient.createdAt)) / 60000
        );
        if (mins <= 15) {
          collectedWithin15Min++;
        } else {
          delayedCount++;
        }
      } else if (!t.sample_collected_time) {
        // If not collected yet and already past 15 min from order
        const mins = Math.round((new Date() - new Date(t.patient.createdAt)) / 60000);
        if (mins > 15) {
          delayedCount++;
        }
      }
    });

    const collectedWithin15MinPercent =
      totalStat === 0 ? 0 : Number(((collectedWithin15Min / totalStat) * 100).toFixed(2));

    res.json({
      success: true,
      data: {
        totalStat,
        collectedWithin15MinPercent,
        delayedCount,
        targetMinutes: 15,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// API 4: Delayed STAT Cases List
const getDelayedStatCases = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const {
      testWhere,
      patientWhere,
      investigationWhere,
      pppWhere,
    } = buildCommonFilters(req.query, hospitalId);

    const statTests = await PatientTest.findAll({
      where: testWhere,
      include: [
        {
          model: Investigation,
          as: "investigation",
          where: { ...investigationWhere, stattest: true },
          attributes: ["testname"],
          required: true,
        },
        {
          model: Patient,
          as: "patient",
          where: patientWhere,
          required: true,
          attributes: ["id", "p_name", "createdAt"],
          include: [
            {
              model: PPPMode,
              as: "patientPPModes",
              where: pppWhere,
              required: true,
            },
          ],
        },
      ],
    });

    const delayedCases = [];

    statTests.forEach((t) => {
      let mins = 0;
      if (t.sample_collected_time && t.patient?.createdAt) {
        mins = Math.round(
          (new Date(t.sample_collected_time) - new Date(t.patient.createdAt)) / 60000
        );
      } else if (!t.sample_collected_time && t.patient?.createdAt) {
        mins = Math.round((new Date() - new Date(t.patient.createdAt)) / 60000);
      }

      if (mins > 15) {
        delayedCases.push({
          patientId: t.patient?.id,
          patientName: t.patient?.p_name,
          testName: t.investigation?.testname,
          delayMinutes: mins,
          phlebotomistName: t.collected_by || "Pending",
          delayReason: t.rejection_reason || "Not specified",
        });
      }
    });

    res.json({
      success: true,
      data: delayedCases,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* Dispatch & Transport Monitor */

// API 5: Dispatch Summary
const getDispatchSummary = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const {
      testWhere,
      patientWhere,
      investigationWhere,
      pppWhere,
    } = buildCommonFilters(req.query, hospitalId);

    const thresholdMinutes = 30; // Default threshold

    const commonInclude = [
      {
        model: Investigation,
        as: "investigation",
        where: investigationWhere,
        required: true,
      },
      {
        model: Patient,
        as: "patient",
        where: patientWhere,
        required: true,
        include: [
          {
            model: PPPMode,
            as: "patientPPModes",
            where: pppWhere,
            required: true,
          },
        ],
      },
    ];

    const notDispatchedOverThreshold = await PatientTest.count({
      where: {
        ...testWhere,
        sample_collected_time: { [Op.ne]: null },
        dispatch_time: null,
        [Op.and]: sequelize.literal(
          `EXTRACT(EPOCH FROM (NOW() - "patient_test"."sample_collected_time"))/60 > ${thresholdMinutes}`
        ),
      },
      include: commonInclude,
    });

    const inTransit = await PatientTest.count({
      where: {
        ...testWhere,
        status: "intransit",
      },
      include: commonInclude,
    });

    const delayedInTransit = await PatientTest.count({
      where: {
        ...testWhere,
        status: "intransit",
        dispatch_time: { [Op.ne]: null },
        [Op.and]: sequelize.literal(
          `EXTRACT(EPOCH FROM (NOW() - "patient_test"."dispatch_time"))/60 > 60` // Assume 60 min transit threshold
        ),
      },
      include: commonInclude,
    });

    res.json({
      success: true,
      data: {
        notDispatchedOverThreshold,
        inTransit,
        delayedInTransit,
        coldChainComplianceStatus: "Maintained", // Placeholder
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// API 6: Dispatch Threshold Info
const getDispatchThresholdInfo = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const {
      testWhere,
      patientWhere,
      investigationWhere,
      pppWhere,
    } = buildCommonFilters(req.query, hospitalId);

    const thresholdMinutes = 30;

    const delayedCount = await PatientTest.count({
      where: {
        ...testWhere,
        sample_collected_time: { [Op.ne]: null },
        dispatch_time: null,
        [Op.and]: sequelize.literal(
          `EXTRACT(EPOCH FROM (NOW() - "patient_test"."sample_collected_time"))/60 > ${thresholdMinutes}`
        ),
      },
      include: [
        {
          model: Investigation,
          as: "investigation",
          where: investigationWhere,
          required: true,
        },
        {
          model: Patient,
          as: "patient",
          where: patientWhere,
          required: true,
          include: [
            {
              model: PPPMode,
              as: "patientPPModes",
              where: pppWhere,
              required: true,
            },
          ],
        },
      ],
    });

    let status = "GREEN";
    if (delayedCount > 10) status = "RED";
    else if (delayedCount > 5) status = "AMBER";

    res.json({
      success: true,
      data: {
        dispatchThresholdMinutes: thresholdMinutes,
        status,
        delayedCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* Trend Analysis */

// API 7: Hourly Collection Load
const getHourlyCollectionLoad = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const {
      testWhere,
      patientWhere,
      investigationWhere,
      pppWhere,
    } = buildCommonFilters(req.query, hospitalId);

    const loads = await PatientTest.findAll({
      where: {
        ...testWhere,
        sample_collected_time: { [Op.ne]: null },
      },
      raw: true,
      attributes: [
        [sequelize.fn("EXTRACT", sequelize.literal('HOUR FROM "patient_test"."sample_collected_time"')), "hour"],
        [sequelize.fn("COUNT", sequelize.col("patient_test.id")), "count"],
      ],
      include: [
        {
          model: Investigation,
          as: "investigation",
          where: investigationWhere,
          required: true,
          attributes: [],
        },
        {
          model: Patient,
          as: "patient",
          where: patientWhere,
          required: true,
          attributes: [],
          include: [
            {
              model: PPPMode,
              as: "patientPPModes",
              where: pppWhere,
              required: true,
              attributes: [],
            },
          ],
        },
      ],
      group: [sequelize.literal("hour")],
      order: [[sequelize.literal("hour"), "ASC"]],
    });

    res.json({
      success: true,
      data: loads.map((l) => ({
        hour: Number(l.hour),
        count: Number(l.count),
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// API 8: Recollection Rate Trend
const getRecollectionRateTrend = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const {
      testWhere,
      patientWhere,
      investigationWhere,
      pppWhere,
    } = buildCommonFilters(req.query, hospitalId);

    const trends = await PatientTest.findAll({
      where: testWhere,
      raw: true,
      attributes: [
        [sequelize.fn("DATE", sequelize.col("patient_test.createdAt")), "date"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal("CASE WHEN \"patient_test\".\"status\" = 'recollect' THEN 1 ELSE 0 END")
          ),
          "recollectCount",
        ],
        [sequelize.fn("COUNT", sequelize.col("patient_test.id")), "totalCount"],
      ],
      include: [
        {
          model: Investigation,
          as: "investigation",
          where: investigationWhere,
          required: true,
          attributes: [],
        },
        {
          model: Patient,
          as: "patient",
          where: patientWhere,
          required: true,
          attributes: [],
          include: [
            {
              model: PPPMode,
              as: "patientPPModes",
              where: pppWhere,
              required: true,
              attributes: [],
            },
          ],
        },
      ],
      group: [sequelize.literal("date")],
      order: [[sequelize.literal("date"), "ASC"]],
    });

    res.json({
      success: true,
      data: trends.map((t) => ({
        date: t.date,
        recollectionPercent:
          Number(t.totalCount) === 0
            ? 0
            : Number(
                ((Number(t.recollectCount) / Number(t.totalCount)) * 100).toFixed(2)
              ),
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// API 9: Delay Trend
const getDelayTrend = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const {
      testWhere,
      patientWhere,
      investigationWhere,
      pppWhere,
    } = buildCommonFilters(req.query, hospitalId);

    const trends = await PatientTest.findAll({
      where: {
        ...testWhere,
        sample_collected_time: { [Op.ne]: null },
      },
      raw: true,
      include: [
        {
          model: Patient,
          as: "patient",
          where: patientWhere,
          attributes: [],
          required: true,
          include: [
            {
              model: PPPMode,
              as: "patientPPModes",
              where: pppWhere,
              required: true,
              attributes: [],
            },
          ],
        },
        {
          model: Investigation,
          as: "investigation",
          where: investigationWhere,
          required: true,
          attributes: [],
        },
      ],
      attributes: [
        [sequelize.fn("DATE", sequelize.col("patient_test.createdAt")), "date"],
        [
          sequelize.fn(
            "AVG",
            sequelize.literal(
              'EXTRACT(EPOCH FROM ("patient_test"."sample_collected_time" - "patient_test"."createdAt"))/60'
            )
          ),
          "avgDelay",
        ],
      ],
      group: [sequelize.literal("date")],
      order: [[sequelize.literal("date"), "ASC"]],
    });

    res.json({
      success: true,
      data: trends.map((t) => ({
        date: t.date,
        avgCollectionDelayMinutes: Number(Number(t.avgDelay).toFixed(2)),
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* Filter & Configuration Support */

// API 10: Filter Data API
const getFilterData = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalid;
    const { startDate, endDate } = req.query;

    const testDateFilter = buildDateRange(startDate, endDate, "createdAt");

    // Get departments that have tests in the date range
    const departments = await Department.findAll({
      attributes: ["id", "dptname"],
      include: [
        {
          model: Investigation,
          as: "investigations",
          attributes: [],
          required: true,
          include: [
            {
              model: PatientTest,
              as: "investigationTests",
              where: { hospitalid: hospitalId, ...testDateFilter },
              attributes: [],
              required: true,
            },
          ],
        },
      ],
      group: ["department.id", "department.dptname"],
    });

    const phlebotomists = await PatientTest.findAll({
      where: { 
        hospitalid: hospitalId, 
        collected_by: { [Op.ne]: null },
        ...testDateFilter,
      },
      attributes: [[sequelize.fn("DISTINCT", sequelize.col("collected_by")), "name"]],
    });

    // Get collection centers (Nodals) that have tests in the date range
    const collectionCenters = await Nodal.findAll({
      attributes: ["id", "nodalname"],
      include: [
        {
          model: PatientTest,
          as: "nodalTests",
          where: { hospitalid: hospitalId, ...testDateFilter },
          attributes: [],
          required: true,
        },
      ],
      group: ["nodal.id", "nodal.nodalname"],
    });

    res.json({
      success: true,
      data: {
        departments: departments.map((d) => ({ id: d.id, name: d.dptname })),
        phlebotomists: phlebotomists.map((p) => p.get("name")),
        collectionCenters: collectionCenters.map((c) => ({ id: c.id, name: c.nodalname })),
        locationTypes: ["OPD", "IPD", "Home"],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// API 11: KPI Threshold Config
const getKPIThresholdConfig = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        statCollectionTimeTarget: 15,
        dispatchDelayThreshold: 30,
        reprintPercentTarget: 5,
        tatThresholds: {
          green: 30,
          amber: 45,
          red: 60,
        },
      },
    });
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
  getBarcodeSummary,
  getTopReprintReasons,
  getStatSummary,
  getDelayedStatCases,
  getDispatchSummary,
  getDispatchThresholdInfo,
  getHourlyCollectionLoad,
  getRecollectionRateTrend,
  getDelayTrend,
  getFilterData,
  getKPIThresholdConfig,
};
