const { DataTypes } = require('sequelize');
const sequelize=require('../../../db/connectDB');


const Accession= sequelize.define('accession',{
    id:{
        type:DataTypes.INTEGER,
        primaryKey:true,
        autoIncrement:true
    },
    a_year:{
        type:DataTypes.INTEGER
    },
    a_location_id:{
        type:DataTypes.INTEGER
    },
    a_container_id:{
          type:DataTypes.INTEGER
    },
    a_department:{
          type:DataTypes.INTEGER
    },
    a_sample_id:{
          type:DataTypes.BIGINT,
          unique:true
    }
});
module.exports=Accession