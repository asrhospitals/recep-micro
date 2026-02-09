const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('./logger');

const sequelize = new Sequelize(
  config.db.name,
  config.db.user,
  config.db.pass,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: config.db.dialect,
    logging: (msg) => logger.debug(msg), // Redirect SQL queries to Winston debug level
    benchmark: true, // Logs execution time for queries
    pool: {
      max: 15,           // Max simultaneous connections
      min: 5,            // Min connections to keep alive
      acquire: 30000,    // Timeout for connection acquisition
      idle: 10000        // Time before releasing idle connection
    },
    retry: {
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /TimeoutError/
      ],
      max: 3 // Retry 3 times on connection failure
    }
  }
);

// const sequelize = new Sequelize(
//   "devdb", // database name
//   "devuser", // username
//   "devpass", // password
//   {
//     host: "localhost",
//     dialect: "postgres",
//     port: 5433,
//   },
// );


module.exports = sequelize;