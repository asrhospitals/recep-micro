const { Op } = require("sequelize");
const sequelize = require("../config/dbConnection");
const {
  Patient,
  PatientTest,
} = require("../repository/associationModels/associations");
const Order = require("../repository/relationalModels/order");
const Investigation = require("../repository/relationalModels/investigation");
const SpecimenTransaction = require("../repository/relationalModels/specimenTransaction");
const SpecimenTest = require("../repository/relationalModels/specimenTestModel");
const TubeMaster = require("../repository/relationalModels/tubeMaster");

// -------------------- HELPERS --------------------
const ddmmyy = (d) => {
  const dt = new Date(d);
  return (
    String(dt.getDate()).padStart(2, "0") +
    String(dt.getMonth() + 1).padStart(2, "0") +
    String(dt.getFullYear()).slice(-2)
  );
};

const checkDigit = (s) =>
  s
    .replace(/\D/g, "")
    .split("")
    .reduce((a, b) => a + Number(b), 0) % 10;

const getAccession = async (orderId) =>
  `ACN${String(orderId).padStart(5, "0")}`;

// -------------------- MAIN --------------------
const generateSpecimens = async (orderId, hospitalId) => {
  const tx = await sequelize.transaction();
  try {
    /* 1️⃣ Order */
    const order = await Order.findOne({
      where: { id: orderId, hospitalid: hospitalId },
      transaction: tx,
    });
    if (!order) throw new Error("Order not found");

    /* 2️⃣ Verified Patient */
    const patient = await Patient.findOne({
      where: { id: order.pid, p_status: "verified" },
      transaction: tx,
    });
    if (!patient) throw new Error("Patient not verified");

    /* 3️⃣ Prevent duplicate barcode */
    const exists = await SpecimenTransaction.findOne({
      where: { order_id: orderId },
      transaction: tx,
    });
    if (exists) throw new Error("Barcode already generated");

    /* 4️⃣ Fetch tests */
    const tests = await PatientTest.findAll({
      where: {
        order_id: orderId,
        status: { [Op.in]: ["center", "pending"] },
      },
      include: [{ model: Investigation, as: "investigation" }],
      transaction: tx,
    });
    if (!tests.length) throw new Error("No tests found");

    /* 5️⃣ Group by specimen + tube */
    const groups = {};
    for (const t of tests) {
      const inv = t.investigation;
      if (!inv) throw new Error("Missing investigation mapping for a test");

      const key = `${inv.sampletypeId}|${inv.containertype}`;
      if (!groups[key]) {
        groups[key] = {
          specimen_type: inv.sampletypeId,
          tube_type: inv.containertype,
          collection_timepoint: inv.collectiontimepoint,
          tests: [],
        };
      }
      groups[key].tests.push(t);
    }

    /* 6️⃣ Create tubes + barcodes (capacity-aware) */
    const accession = await getAccession(orderId);
    const barcodes = [];
    let tubeSeq = 0;

    for (const key of Object.keys(groups)) {
      const group = groups[key];

      const tubeMaster = await TubeMaster.findOne({
        where: { tubecolor: group.tube_type },
        transaction: tx,
      });
      if (!tubeMaster)
        throw new Error(`Tube master missing for ${group.tube_type}`);

      const maxPerTube = tubeMaster.maxttest;

      // 🔑 SPLIT TESTS BY CAPACITY
      for (let i = 0; i < group.tests.length; i += maxPerTube) {
        tubeSeq++;

        const base = `${patient.uhid}-${ddmmyy(
          group.tests[0].createdAt,
        )}-${order.daily_order_number}-${String(tubeSeq).padStart(
          2,
          "0",
        )}-${String(hospitalId).padStart(2, "0")}`;

        const barcode = `${base}-${checkDigit(base)}`;

        const chunkTests = group.tests.slice(i, i + maxPerTube);
        const specimen = await SpecimenTransaction.create(
          {
            pid: patient.id,
            order_id: orderId,
            hospitalid: hospitalId,
            nodalid: order.nodalid,
            barcode_value: barcode,
            status: "CREATED",
            specimen_type: group.specimen_type,
            tube_type: group.tube_type,
            collection_timepoint: group.collection_timepoint,
          },
          { transaction: tx },
        );

        // MAP TESTS TO THIS TUBE
        await SpecimenTest.bulkCreate(
          chunkTests.map((inv) => ({
            specimen_id: specimen.id,
            investigation_id: inv.id,
          })),
          { transaction: tx },
        );

        barcodes.push(barcode);
      }
    }

    await tx.commit();
    return { orderId, barcodes };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
};

module.exports = { generateSpecimens };
