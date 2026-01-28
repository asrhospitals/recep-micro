const { DataTypes } = require("sequelize");
const sequelize = require("../../config/dbConnection");

const Investigation = sequelize.define(
  "investigation",
  {
    /// Test Info
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    loniccode: {
      type: DataTypes.STRING,
    },
    cptcode: {
      type: DataTypes.STRING,
    },
    testname: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    testcategory: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    shortname: {
      type: DataTypes.STRING,
    },
    shortcode: {
      type: DataTypes.INTEGER,
      unique: true,
    },
    departmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "departments",
        key: "id",
      },
    },
    subdepartmentId: {
      type: DataTypes.INTEGER,
      references: {
        model: "subdepartments",
        key: "id",
      },
    },
    roletypeId: {
      type: DataTypes.INTEGER,
      references: {
        model: "roles",
        key: "id",
      },
    },
    sampletypeId: {
      type: DataTypes.INTEGER,
      references: {
        model: "specimens",
        key: "id",
      },
    },
    reportid: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "reporttypes",
        key: "id",
      },
    },
    instrumenttypeId: {
      type: DataTypes.INTEGER,
      references: {
        model: "instruments",
        key: "id",
      },
    },
    sampleqty: {
      type: DataTypes.INTEGER,
    },
    sampletemp: {
      type: DataTypes.INTEGER,
    },
    testmethod: {
      type: DataTypes.STRING,
    },

    description: {
      type: DataTypes.STRING,
    },
    sac: {
      type: DataTypes.STRING,
    },
    order: {
      type: DataTypes.INTEGER,
    },
    derivedtest: {
      type: DataTypes.STRING,
    },
   external_test_id: {
    type: DataTypes.STRING,
    unique: true,
  },
    containertype: {
      type: DataTypes.STRING,
    },
    seperateprint: {
      type: DataTypes.BOOLEAN,
    },
    qrcode: {
      type: DataTypes.BOOLEAN,
    },
    labreg: {
      type: DataTypes.BOOLEAN,
    },
    noheader: {
      type: DataTypes.BOOLEAN,
    },
    enableautoemail: {
      type: DataTypes.BOOLEAN,
    },
    enaautosms: {
      type: DataTypes.BOOLEAN,
    },
    enableautowhatsap: {
      type: DataTypes.BOOLEAN,
    },
    enableintermidiate: {
      type: DataTypes.BOOLEAN,
    },
    enablestags: {
      type: DataTypes.BOOLEAN,
    },
    showtext: {
      type: DataTypes.BOOLEAN,
    },
    separatebarcode: {
      type: DataTypes.BOOLEAN,
    },
    attatchimage: {
      type: DataTypes.BOOLEAN,
    },
    stattest: {
      type: DataTypes.BOOLEAN,
    },
     checkimage: {
      type: DataTypes.BOOLEAN,
    },

    ///---Test Price
    normalprice: {
      type: DataTypes.FLOAT,
    },

   

    // ------Accreditation

    acreeditionname: {
      type: DataTypes.ARRAY(DataTypes.STRING),
    },
    acreeditiondate: {
      type: DataTypes.ARRAY(DataTypes.DATE),
    },

    // ----Lab Consumables

    labconsumables: {
      type: DataTypes.ARRAY(DataTypes.STRING),
    },
    consumableitems: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
    },

    // ---- Out Sourcing
    checkoutsrc: {
      type: DataTypes.BOOLEAN,
    },
    labname: {
      type: DataTypes.ARRAY(DataTypes.STRING),
    },
    outsourceprice: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
    },

    // --- TAT & Status
    tat: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tatunit: {
      type: DataTypes.STRING,
    },
    stat: {
      type: DataTypes.INTEGER,
    },
    statunit: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.STRING,
    },

    // Instructions
    instruction: {
      type: DataTypes.TEXT,
    },
    interpretation: {
      type: DataTypes.TEXT,
    },
    remark: {
      type: DataTypes.TEXT,
    },
    test_collection: {
      type: DataTypes.ENUM("Yes", "No"),
      allowNull: false,
    },
  },
  { timestamps: false },
);

module.exports = Investigation;
