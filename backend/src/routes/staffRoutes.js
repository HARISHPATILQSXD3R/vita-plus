import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Staff from "../models/Staff.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { staffId, password } = req.body;

  if (!staffId || !password)
    return res.status(400).json({ message: "All fields required" });

  const staff = await Staff.findOne({ staffId });
  if (!staff) return res.status(400).json({ message: "Invalid ID or password" });

  const isMatch = await bcrypt.compare(password, staff.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid ID or password" });

  const token = jwt.sign({ staffId }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.json({ message: "Login successful", token });
});

export default router;
