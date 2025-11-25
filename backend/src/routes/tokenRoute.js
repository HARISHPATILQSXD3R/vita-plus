// backend/src/routes/tokenRouter.js
import express from "express";
import Token from "../models/Token.js";

const router = express.Router();

// Helper: today's ISO date string
const todayISO = () => new Date().toISOString().split("T")[0];

// Take token (patient)
router.post("/take-token", async (req, res) => {
  try {
    const { patientName, phone } = req.body;
    if (!patientName || !phone) return res.status(400).json({ message: "Name and phone required" });

    const tokenDate = todayISO();

    // Check if patient already has an active/pending/waiting token for today
    const existing = await Token.findOne({
      phone,
      tokenDate,
      status: { $in: ["pending", "waiting", "active"] },
    });

    if (existing) {
      return res.status(400).json({ message: "You already have a token for today." });
    }

    // Compute tokenNumber for today
    const last = await Token.findOne({ tokenDate }).sort({ tokenNumber: -1 });
    const tokenNumber = last ? last.tokenNumber + 1 : 1;

    const token = new Token({
      patientName,
      phone,
      tokenTime: new Date(),
      tokenDate,
      tokenNumber,
      status: "pending",
    });

    await token.save();
    res.json({ message: "Token created", token });
  } catch (err) {
    console.error("Error in /take-token:", err);
    res.status(500).json({ message: "Server error while creating token" });
  }
});

// Get tokens for a patient (all)
router.get("/patient/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const tokens = await Token.find({ phone }).sort({ tokenTime: -1 });
    res.json(tokens);
  } catch (err) {
    console.error("Error fetching tokens:", err);
    res.status(500).json({ message: "Server error while fetching tokens" });
  }
});

// Get today's tokens (for staff)
router.get("/today", async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const tokens = await Token.find({
      tokenTime: { $gte: start, $lte: end },
    }).sort({ tokenNumber: 1 });

    res.json(tokens);
  } catch (err) {
    console.error("Error fetching today tokens:", err);
    res.status(500).json({ message: "Server error fetching today tokens" });
  }
});

// Get tokens by date (YYYY-MM-DD or ISO date)
router.get("/date/:date", async (req, res) => {
  try {
    const dateParam = req.params.date;
    const date = new Date(dateParam);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const tokens = await Token.find({
      tokenTime: { $gte: start, $lte: end },
    }).sort({ tokenNumber: 1 });

    res.json(tokens);
  } catch (err) {
    console.error("Error fetching tokens by date:", err);
    res.status(500).json({ message: "Server error fetching tokens by date" });
  }
});

// Update token general (kept simple, but staff endpoints should be used)
router.put("/update/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const update = req.body || {};
    update.updatedAt = new Date();
    const token = await Token.findByIdAndUpdate(id, update, { new: true });
    if (!token) return res.status(404).json({ message: "Token not found" });
    res.json({ message: "Token updated", token });
  } catch (err) {
    console.error("Error updating token:", err);
    res.status(500).json({ message: "Server error while updating token" });
  }
});

// Delete
router.delete("/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await Token.findByIdAndDelete(id);
    res.json({ message: "Token deleted successfully" });
  } catch (err) {
    console.error("Error deleting token:", err);
    res.status(500).json({ message: "Server error while deleting token" });
  }
});

// Doctor updates patient info (kept as-is)
router.patch("/doctor-update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, medicine, nextVisit, status } = req.body;

    const updated = await Token.findByIdAndUpdate(
      id,
      { diagnosis, medicine, nextVisit, status, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Token not found" });

    res.json({ message: "Patient details updated", token: updated });
  } catch (err) {
    console.error("Error updating token by doctor:", err);
    res.status(500).json({ message: "Server error while updating patient details" });
  }
});

export default router;
