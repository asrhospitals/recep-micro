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
const Accession = require("../repository/relationalModels/accessionMaster");
const Hospital = require("../repository/relationalModels/hospital");

// -------------------- HELPERS --------------------
const ddmmyy = (d) => {
  const dt = new Date(d);
  return (
    String(dt.getDate()).padStart(2, "0") +
    String(dt.getMonth() + 1).padStart(2, "0") +
    String(dt.getFullYear()).slice(-2)
  );
};

function checkDigit(barcode) {
  // Remove hyphens
  const clean = barcode.replace(/-/g, "").toUpperCase();
  // Convert letters to numbers
  let numericString = "";

  for (let char of clean) {
    if (/[A-Z]/.test(char)) {
      numericString += char.charCodeAt(0) - 55;
      // A=65 → 10 (65-55)
    } else if (/[0-9]/.test(char)) {
      numericString += char;
    }
  }

  // Convert to single digit array
  const digits = numericString.split("").map(Number);
  //Apply Luhn from RIGHT
  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9; // same as adding digits
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }
  console.log("Luhn sum before modulo:", sum);
  //Calculate check digit
  return (10 - (sum % 10)) % 10;
}

// -------------------- MAIN --------------------
const generateSpecimens = async (orderId, hospitalId, pid) => {
  const tx = await sequelize.transaction();
  try {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    /* Order */
    const maxOrderNumber = await Order.max("daily_order_number", {
      where: {
        hospitalid: hospitalId,
        order_date: today,
      },
      transaction: tx,
    });

    if (!maxOrderNumber) throw new Error("Max  umber of orders not found");

    const order = await Order.findOne({
      where: { id: orderId, hospitalid: hospitalId },
      transaction: tx,
    });

    if (!order) throw new Error("Order not found");

    const hospital = await Hospital.findOne({
      where: { id: hospitalId, isactive: true },
      transaction: tx,
    });
    if (!hospital) throw new Error("Hospital not verified");


    /* Verified Patient */
    const patient = await Patient.findOne({
      where: { id: pid, p_status: "verified" },
      transaction: tx,
    });
    if (!patient) throw new Error("Patient not verified");

    /* Fetch tests */
    const tests = await PatientTest.findAll({
      where: {
        order_id: orderId,
        status: { [Op.in]: ["center", "pending"] },
      },
      include: [{ model: Investigation, as: "investigation" }],
      transaction: tx,
    });
    if (!tests.length) throw new Error("No tests found");

    const accessionFields = await Accession.findAll({
      where: { is_add: true },
      order: [['id', 'ASC']],
      transaction: tx,
    });

    if (accessionFields && accessionFields.length === 0) throw new Error("No accession master found");

    /* Group by specimen + tube */
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

      //SPLIT TESTS BY CAPACITY
      for (let i = 0; i < group.tests.length; i += maxPerTube) {
        tubeSeq++;

        const parts = [];

        for (const field of accessionFields) {
          switch (field.name) {
            case "Center Name":
              parts.push(hospital.hospitalname && hospital.hospitalname.slice(0, 3) || "AGT");
              break;
            case "UHID":
              parts.push(patient.uhid);
              break;
            case "Date (ddmmyy)":
              parts.push(ddmmyy(today));
              break;
            case "Daily Order":
              parts.push(String(maxOrderNumber || 0).padStart(5, "0"));
              break;
            case "Tube Sequence":
              parts.push(String(tubeSeq).padStart(2, "0"));
              break;
            // case "Patient Name":
            //   parts.push(patient.name);
            //   break;

            // case "Test Short Names":
            //   const shortNames = group.tests
            //     .slice(i, i + maxPerTube)
            //     .map(t => t.investigation.shortname)
            //     .join("");
            //   parts.push(shortNames);
            //   break;
          }
        }
        const base = parts.join("-");
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
            collection_timepoint: group.collection_timepoint
          },
          { transaction: tx },
        );

        // MAP TESTS TO THIS TUBE
        if (specimen && specimen.id) {
          await SpecimenTest.bulkCreate(
            chunkTests.map((inv) => ({
              specimen_id: specimen.id,
              investigation_id: inv.id,
            })),
            { transaction: tx },
          );
        }

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
