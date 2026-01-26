const { DataTypes } = require('sequelize');
const sequalize=require('../../config/dbConnection');

const SpecimenTypeMaster=sequalize.define('specimen',{
    id:{
        type:DataTypes.INTEGER,
        primaryKey:true,
        autoIncrement:true
    },
    specimenname:{
        type:DataTypes.STRING,
        allowNull:false,
        unique:true
    },
    specimendes:{
        type:DataTypes.STRING,
        allowNull:false
    },
    isactive:{
        type:DataTypes.BOOLEAN,
        allowNull:false
    },
}, {timestamps:false});

module.exports=SpecimenTypeMaster;