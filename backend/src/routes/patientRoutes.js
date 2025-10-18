import express from "express";
import jwt from "jsonwebtoken";
import Patient from "../models/Patient.js";

const router = express.Router();

// Send OTP (dummy OTP)
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone number required" });

  const otp = "123456"; // Dummy OTP
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

  let patient = await Patient.findOne({ phone });
  if (patient) {
    patient.otp = otp;
    patient.otpExpiry = otpExpiry;
  } else {
    patient = new Patient({ phone, otp, otpExpiry });
  }

  await patient.save();

  console.log(`✅ Dummy OTP for ${phone}: ${otp}`);
  res.json({ message: "OTP sent successfully! Use 123456" });
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  const patient = await Patient.findOne({ phone });

  if (!patient) return res.status(400).json({ message: "Phone number not found" });

  if (otp !== "123456") return res.status(400).json({ message: "Invalid OTP" });
  if (patient.otpExpiry < new Date()) return res.status(400).json({ message: "OTP expired" });

  const token = jwt.sign({ phone }, process.env.JWT_SECRET, { expiresIn: "1h" });

  patient.otp = null;
  patient.otpExpiry = null;
  await patient.save();

  res.json({ message: "Login successful", token });
});

export default router;
