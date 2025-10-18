import Doctor from "../models/Doctor.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerDoctor = async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const doctor = await Doctor.create({ name, email, password: hashed, specialization });
    res.status(201).json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const loginDoctor = async (req, res) => {
  const { email, password } = req.body;
  const doctor = await Doctor.findOne({ email });
  if (!doctor) return res.status(404).json({ message: "User not found" });

  const match = await bcrypt.compare(password, doctor.password);
  if (!match) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ id: doctor._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
  res.json({ token, doctor });
};
