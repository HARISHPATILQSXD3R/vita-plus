import express from "express";
import Token from "../models/Token.js";

const router = express.Router();

// 🧾 1️⃣ Get all tokens (sorted by date + number)
router.get("/all", async (req, res) => {
  try {
    const tokens = await Token.find().sort({ tokenDate: -1, tokenNumber: 1 });
    res.json(tokens);
  } catch (err) {
    res.status(500).json({ message: "Error fetching all tokens" });
  }
});

// 🧮 2️⃣ Get total token count (today or all)
router.get("/count", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const count = await Token.countDocuments({ tokenDate: today });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Error counting tokens" });
  }
});

// ✏️ 3️⃣ Update token status (pending → waiting/done/removed)
router.put("/status/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Token.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json({ message: "Status updated", token: updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating status" });
  }
});

// ➕ 4️⃣ Add manual token by staff
router.post("/add-manual", async (req, res) => {
  try {
    const { patientName, phone } = req.body;
    if (!patientName || !phone)
      return res.status(400).json({ message: "Name and phone required" });

    const today = new Date().toISOString().slice(0, 10);
    const lastToken = await Token.findOne({ tokenDate: today })
      .sort({ tokenNumber: -1 });
    const nextTokenNumber = lastToken ? lastToken.tokenNumber + 1 : 1;

    const newToken = new Token({
      patientName,
      phone,
      tokenNumber: nextTokenNumber,
      tokenDate: today,
      status: "manual",
    });
    await newToken.save();
    res.json({ message: "Manual token added", token: newToken });
  } catch (err) {
    res.status(500).json({ message: "Error adding manual token" });
  }
});

export default router;
