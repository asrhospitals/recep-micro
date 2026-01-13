const express = require("express");
const cors = require("cors");

const sequelize = require("./config/dbConnection");
const PhlebRoutes = require("./routes/routes");
const verifyToken = require("./middlewares/authMiddileware");
const role = require("./middlewares/roleMiddleware");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/api/phleb", verifyToken, role("phlebotomist"), PhlebRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to ASR Lab Phlebotomist Microservice",
    status: "running",
    time: new Date().toISOString(),
  });
});

module.exports = { app, sequelize };