// backend/src/routes/doctorRoutes.js
import express from "express";
import Doctor from "../models/Doctor.js";
import Token from "../models/Token.js";
import { recomputeEstimatedAtForToday } from "../utils/etaHelpers.js";
import { tokenEvents } from "../utils/tokenEvents.js";
import ServiceStatus from "../models/ServiceStatus.js"; // <-- use this existing model

const router = express.Router();
const DOCTOR_ID = "global";

// simple health check
router.get("/", (req, res) => {
  res.send("Doctor API working!");
});

// --- LOGIN (same as you had) ---
router.post("/login", async (req, res) => {
  try {
    const { doctorId, password } = req.body;

    if (doctorId === "2206" && password === "1234") {
      return res.json({ success: true, message: "Login successful", doctorId });
    }

    const doctor = await Doctor.findOne({ email: doctorId });
    if (doctor && doctor.password === password) {
      return res.json({
        success: true,
        message: "Login successful",
        doctorId: doctor._id,
      });
    }

    res.status(401).json({ success: false, message: "Invalid credentials" });
  } catch (err) {
    console.error("Doctor login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- SERVICE STATUS ---
// returns { running: Boolean, startedAt: Date|null }
router.get("/status", async (req, res) => {
  try {
    // ServiceStatus model statics.get ensures a doc exists
    const state = await ServiceStatus.get("global");
    res.json({ running: !!state.running, startedAt: state.startedAt || null });
  } catch (err) {
    console.error("doctor/status error:", err);
    res.status(500).json({ running: false });
  }
});

// --- START SERVICE ---
router.post("/start", async (req, res) => {
  try {
    const now = new Date();
    const state = await ServiceStatus.findByIdAndUpdate(
      "global",
      { running: true, startedAt: now, stoppedAt: null, updatedAt: now },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // recompute ETAs for today
    const { updatedTokens } = await recomputeEstimatedAtForToday(DOCTOR_ID);

    // emit SSE
    tokenEvents.emit("serviceStarted", { running: true, startedAt: state.startedAt });
    if (updatedTokens && updatedTokens.length) updatedTokens.forEach((t) => tokenEvents.emit("tokenUpdated", t));

    res.json({ ok: true, status: { running: true, startedAt: state.startedAt } });
  } catch (err) {
    console.error("doctor/start error:", err);
    res.status(500).json({ ok: false, message: "Failed to start service" });
  }
});

// --- STOP SERVICE ---
router.post("/stop", async (req, res) => {
  try {
    const now = new Date();
    const state = await ServiceStatus.findByIdAndUpdate(
      "global",
      { running: false, stoppedAt: now, updatedAt: now },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // clear estimatedAt for today's pending/waiting/active tokens
    const today = new Date().toISOString().split("T")[0];
    const list = await Token.find({
      tokenDate: today,
      status: { $in: ["pending", "waiting", "active"] },
    });

    for (const t of list) {
      if (t.estimatedAt) {
        t.estimatedAt = null;
        await t.save();
      }
      tokenEvents.emit("tokenUpdated", t);
    }

    tokenEvents.emit("serviceStopped", { running: false, stoppedAt: state.stoppedAt });

    res.json({ ok: true, status: { running: false, stoppedAt: state.stoppedAt } });
  } catch (err) {
    console.error("doctor/stop error:", err);
    res.status(500).json({ ok: false, message: "Failed to stop service" });
  }
});

export default router;
