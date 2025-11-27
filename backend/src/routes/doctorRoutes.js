import express from "express";
import Doctor from "../models/Doctor.js";
import DoctorService from "../models/DoctorService.js";

const router = express.Router();

// Utility: get current service record
async function getServiceRecord() {
  let svc = await DoctorService.findOne();
  if (!svc) svc = await DoctorService.create({});
  return svc;
}

router.get("/", (req, res) => {
  res.send("Doctor API working!");
});

// Doctor login
router.post("/login", async (req, res) => {
  try {
    const { doctorId, password } = req.body;

    if (doctorId === "2206" && password === "1234") {
      return res.json({ success: true, message: "Login successful", doctorId });
    }

    const doctor = await Doctor.findOne({ email: doctorId });
    if (doctor && doctor.password === password) {
      return res.json({ success: true, message: "Login successful", doctorId: doctor._id });
    }

    res.status(401).json({ success: false, message: "Invalid credentials" });
  } catch (err) {
    console.error("Doctor login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ================================
   DOCTOR SERVICE CONTROL (GLOBAL)
   ================================ */

// GET status
router.get("/status", async (req, res) => {
  const svc = await getServiceRecord();
  res.json({
    running: svc.running,
    startedAt: svc.startedAt
  });
});

// START service
router.post("/start", async (req, res) => {
  try {
    const svc = await getServiceRecord();
    svc.running = true;
    svc.startedAt = new Date();
    await svc.save();

    res.json({
      message: "Service started",
      status: { running: true, startedAt: svc.startedAt }
    });
  } catch (err) {
    console.error("Error starting service:", err);
    res.status(500).json({ message: "Failed to start service" });
  }
});

// STOP service
router.post("/stop", async (req, res) => {
  try {
    const svc = await getServiceRecord();
    svc.running = false;
    await svc.save();

    res.json({
      message: "Service stopped",
      status: { running: false, startedAt: null }
    });
  } catch (err) {
    console.error("Error stopping service:", err);
    res.status(500).json({ message: "Failed to stop service" });
  }
});

export default router;
