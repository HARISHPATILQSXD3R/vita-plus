import express from "express";
import Doctor from "../models/Doctor.js"; // ✅ correct model path

const router = express.Router();

// Check API status
router.get("/", (req, res) => {
  res.send("Doctor API working!");
});

// ✅ Doctor login (temporary hardcoded fallback)
router.post("/login", async (req, res) => {
  try {
    const { doctorId, password } = req.body;

    // Hardcoded default login for now
    if (doctorId === "2206" && password === "1234") {
      return res.json({ success: true, message: "Login successful", doctorId });
    }

    // Optional: if you later use MongoDB doctors
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

export default router;
