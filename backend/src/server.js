import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import staffRoutes from "./routes/staffRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import tokenRoutes from "./routes/tokenRoute.js"; // make sure path is correct
import staffTokenRoutes from "./routes/staffTokenRoute.js";
import doctorRoutes from "./routes/doctorRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


// ✅ MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ DB connection failed:", err));

// ✅ Existing Staff routes
app.use("/staff", staffRoutes);

// ✅ Added Patient routes
app.use("/patient", patientRoutes);

// token
app.use("/token",tokenRoutes);

//staff token
app.use("/staff/tokens", staffTokenRoutes);

//Docter page
app.use("/doctor", doctorRoutes);


// ✅ Default port setup
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
