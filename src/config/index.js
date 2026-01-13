require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3003,
  jwtSecret: process.env.JWT_SECRET,
  db: {
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
  },
  cors: {
    origins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  }
};

// Safety check for production
if (!config.jwtSecret && config.env === 'production') {
  throw new Error("FATAL: JWT_SECRET is not defined in production environment.");
}

module.exports = config;