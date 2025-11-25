import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import staffRoutes from "./routes/staffRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import tokenRoutes from "./routes/tokenRoute.js"; // make sure path is correct
import staffTokenRoutes from "./routes/staffTokenRoute.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import { tokenEvents } from "./utils/tokenEvents.js";


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
// SSE: Live events for patients & staff
app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send("connected", { ok: true });

  const onUpdate = (data) => send("tokenUpdated", data);
  const onCreate = (data) => send("tokenCreated", data);
  const onStat   = (data) => send("statUpdated", data);

  tokenEvents.on("tokenUpdated", onUpdate);
  tokenEvents.on("tokenCreated", onCreate);
  tokenEvents.on("statUpdated", onStat);

  req.on("close", () => {
    tokenEvents.off("tokenUpdated", onUpdate);
    tokenEvents.off("tokenCreated", onCreate);
    tokenEvents.off("statUpdated", onStat);
    res.end();
  });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
