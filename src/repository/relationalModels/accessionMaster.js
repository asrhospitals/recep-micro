const { DataTypes } = require('sequelize');
const sequelize = require("../../config/dbConnection");

const Accession = sequelize.define('accession', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING
    },
    is_add: {
        type: DataTypes.BOOLEAN
    },
    sample_data: {
        type: DataTypes.STRING,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
    },
    created_by: {
        type: DataTypes.STRING,
    },
    updated_by: {
        type: DataTypes.STRING,
    }
}, {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "update_at",
    tableName: "accession",
    underscored: false
});


module.exports = Accession