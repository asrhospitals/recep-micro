const express = require("express");
const app = express();
const cors=require('cors');
const PORT = 3006;
const sequelize = require("./db/dbConnection");
const ReceptionRoutes=require('./routes/routes');
const verifyToken=require('./middlewares/authMiddileware');
const role=require('./middlewares/roleMiddleware');

app.use(express.json());
app.use(cors());




// Reception routes
app.use('/recp',verifyToken,role('reception'),ReceptionRoutes);



const server = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected");
    app.listen(PORT, () => {
      console.log(`Server connected on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Something went wrong ${error}`);
  }
};

server();
