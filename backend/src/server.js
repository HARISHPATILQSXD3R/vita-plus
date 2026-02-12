// backend/src/server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import aiRoutes from "./routes/ai.js";

import staffRoutes from "./routes/staffRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import tokenRoutes from "./routes/tokenRoute.js";
import staffTokenRoutes from "./routes/staffTokenRoute.js";
import doctorRoutes from "./routes/doctorRoutes.js";

import { tokenEvents } from "./utils/tokenEvents.js";
import { sweepNoShows } from "./utils/noShowSweep.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ DB connection failed:", err));

// Routes
app.use("/staff", staffRoutes);
app.use("/patient", patientRoutes);
app.use("/token", tokenRoutes);
app.use("/staff/tokens", staffTokenRoutes);
app.use("/doctor", doctorRoutes);
app.use("/api/ai", aiRoutes);

// Port
const PORT = process.env.PORT || 4000;

/**
 * SSE endpoint for real-time events
 * Emits events:
 *  - tokenUpdated
 *  - tokenCreated
 *  - statUpdated
 *  - serviceStarted
 *  - serviceStopped
 */
app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      // writing may throw if connection closed
      console.warn("SSE send error", err);
    }
  };

  // initial handshake
  send("connected", { ok: true });

  // listener functions (single declarations)
  const onUpdate = (data) => send("tokenUpdated", data);
  const onCreate = (data) => send("tokenCreated", data);
  const onStat = (data) => send("statUpdated", data);
  const onServiceStart = (data) => send("serviceStarted", data);
  const onServiceStop = (data) => send("serviceStopped", data);

  // subscribe to events
  tokenEvents.on("tokenUpdated", onUpdate);
  tokenEvents.on("tokenCreated", onCreate);
  tokenEvents.on("statUpdated", onStat);
  tokenEvents.on("serviceStarted", onServiceStart);
  tokenEvents.on("serviceStopped", onServiceStop);

  // clean up when client disconnects
  req.on("close", () => {
    tokenEvents.off("tokenUpdated", onUpdate);
    tokenEvents.off("tokenCreated", onCreate);
    tokenEvents.off("statUpdated", onStat);
    tokenEvents.off("serviceStarted", onServiceStart);
    tokenEvents.off("serviceStopped", onServiceStop);
    try { res.end(); } catch (err) {}
  });
});

// start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// sweep no-shows periodically
const NO_SHOW_MS = process.env.NO_SHOW_MS ? Number(process.env.NO_SHOW_MS) : 30 * 60 * 1000;
setInterval(async () => {
  try {
    const r = await sweepNoShows({ noShowMs: NO_SHOW_MS });
    if (r && r.processed) console.log(`sweepNoShows: marked ${r.processed} tokens left`);
  } catch (err) {
    console.error("sweep interval error:", err);
  }
}, 60 * 1000);
