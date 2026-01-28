const { app, sequelize } = require("./src/index");
const http = require("http");


// 1. Centralized Configuration
const PORT = process.env.PORT || 3006;
const server = http.createServer(app);

// const PatientTest = require("./src/repository/relationalModels/patientTests");

const startServer = async () => {
  try {
    // 1. Database Connectivity Check
    console.log("Connecting to database...");
    await sequelize.authenticate();
    console.log("Database connected successfully");

    // 2. Sync Database (Optional: Only use {alter: true} in dev, use Migrations for prod)
    if (process.env.NODE_ENV === "development") {
      //  await PatientTest.sync({ alter: true });
      console.log("Database synced");
    }

    // 3. Start Listening
    server.listen(PORT, () => {
      console.log(
        `Phlebotomist-Micro running in ${
          process.env.NODE_ENV || "development"
        } mode on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error.stack);
    process.exit(1); // Exit with failure
  }
};

// 2. Graceful Shutdown Logic
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      await sequelize.close();
      console.log("Database connection closed.");
      process.exit(0);
    } catch (err) {
      console.error("Error during database shutdown:", err);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds if graceful fails
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// 3. Global Unhandled Error Catching
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message);
  shutdown("UNHANDLED REJECTION");
});

startServer();
