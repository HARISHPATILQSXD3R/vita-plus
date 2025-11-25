// backend/src/routes/staffTokenRouter.js
import express from "express";
import Token from "../models/Token.js";

const router = express.Router();

// Get all tokens (sorted by date desc, tokenNumber asc)
router.get("/all", async (req, res) => {
  try {
    const tokens = await Token.find().sort({ tokenDate: -1, tokenNumber: 1 });
    res.json(tokens);
  } catch (err) {
    console.error("Error fetching all tokens:", err);
    res.status(500).json({ message: "Error fetching all tokens" });
  }
});

// Count tokens for today
router.get("/count", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const count = await Token.countDocuments({ tokenDate: today });
    res.json({ count });
  } catch (err) {
    console.error("Error counting tokens:", err);
    res.status(500).json({ message: "Error counting tokens" });
  }
});

// Staff: mark waiting
router.put("/wait/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const token = await Token.findByIdAndUpdate(
      id,
      { status: "waiting", waitingAt: new Date(), updatedAt: new Date() },
      { new: true }
    );
    if (!token) return res.status(404).json({ message: "Token not found" });
    res.json({ message: "Marked as waiting", token });
  } catch (err) {
    console.error("Error marking waiting:", err);
    res.status(500).json({ message: "Error marking waiting" });
  }
});

// Staff: mark go / patient arrived (active)
router.put("/go/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const token = await Token.findByIdAndUpdate(
      id,
      { status: "active", arrivedAt: new Date(), updatedAt: new Date() },
      { new: true }
    );
    if (!token) return res.status(404).json({ message: "Token not found" });
    res.json({ message: "Patient marked as active (arrived)", token });
  } catch (err) {
    console.error("Error marking go:", err);
    res.status(500).json({ message: "Error marking go" });
  }
});

// Staff: mark done
router.put("/done/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const token = await Token.findByIdAndUpdate(
      id,
      { status: "done", updatedAt: new Date() },
      { new: true }
    );
    if (!token) return res.status(404).json({ message: "Token not found" });
    res.json({ message: "Marked done", token });
  } catch (err) {
    console.error("Error marking done:", err);
    res.status(500).json({ message: "Error marking done" });
  }
});

// Staff: cancel wait (set back to pending)
router.put("/cancel-wait/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const token = await Token.findByIdAndUpdate(
      id,
      { status: "pending", waitingAt: null, updatedAt: new Date() },
      { new: true }
    );
    if (!token) return res.status(404).json({ message: "Token not found" });
    res.json({ message: "Wait cancelled, token back to pending", token });
  } catch (err) {
    console.error("Error cancelling wait:", err);
    res.status(500).json({ message: "Error cancelling wait" });
  }
});

// Add manual token (by staff) - assigns tokenDate and tokenNumber
router.post("/add-manual", async (req, res) => {
  try {
    const { patientName, phone } = req.body;
    if (!patientName || !phone) return res.status(400).json({ message: "Name and phone required" });

    const today = new Date().toISOString().slice(0, 10);
    const lastToken = await Token.findOne({ tokenDate: today }).sort({ tokenNumber: -1 });
    const nextTokenNumber = lastToken ? lastToken.tokenNumber + 1 : 1;

    const newToken = new Token({
      patientName,
      phone,
      tokenNumber: nextTokenNumber,
      tokenDate: today,
      tokenTime: new Date(),
      status: "manual",
    });
    await newToken.save();
    res.json({ message: "Manual token added", token: newToken });
  } catch (err) {
    console.error("Error adding manual token:", err);
    res.status(500).json({ message: "Error adding manual token" });
  }
});

export default router;
