// backend/src/routes/tokenRoute.js
import express from "express";
import Token from "../models/Token.js";
import ServiceStat from "../models/ServiceStat.js";
import { tokenEvents } from "../utils/tokenEvents.js";

const router = express.Router();

// Helper: today's ISO date string (YYYY-MM-DD)
const todayISO = () => new Date().toISOString().split("T")[0];

/**
 * POST /token/take-token
 * Create a token (patient)
 */
router.post("/take-token", async (req, res) => {
  try {
    const { patientName, phone, doctorId } = req.body;
    if (!patientName || !phone) {
      return res.status(400).json({ message: "Name and phone required" });
    }

    const tokenDate = todayISO();

    // Prevent duplicate active/pending/waiting token for same phone today
    const existing = await Token.findOne({
      phone,
      tokenDate,
      status: { $in: ["pending", "waiting", "active"] },
    });

    if (existing) {
      return res.status(400).json({ message: "You already have a token for today." });
    }

    // Compute next tokenNumber for today
    const last = await Token.findOne({ tokenDate }).sort({ tokenNumber: -1 });
    const tokenNumber = last ? last.tokenNumber + 1 : 1;

    const token = new Token({
      patientName,
      phone,
      tokenTime: new Date(),
      tokenDate,
      tokenNumber,
      status: "pending",
      doctorId: doctorId || "global",
    });

    await token.save();

    // Emit SSE event for subscribers (patient pages, staff dashboards)
    tokenEvents.emit("tokenCreated", token);

    res.json({ message: "Token created", token });
  } catch (err) {
    console.error("Error in /take-token:", err);
    res.status(500).json({ message: "Server error while creating token" });
  }
});

/**
 * GET /token/patient/:phone
 * Get all tokens for a patient (most recent first)
 */
router.get("/patient/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const tokens = await Token.find({ phone }).sort({ tokenTime: -1 });
    res.json(tokens);
  } catch (err) {
    console.error("Error fetching tokens for patient:", err);
    res.status(500).json({ message: "Server error while fetching tokens" });
  }
});

/**
 * GET /token/today
 * Get today's tokens (sorted by tokenNumber asc)
 */
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

/**
 * GET /token/date/:date
 * Get tokens for a provided date (YYYY-MM-DD or parseable date)
 */
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

/**
 * PUT /token/update/:id
 * General update (kept for backward compatibility)
 */
router.put("/update/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const update = req.body || {};
    update.updatedAt = new Date();

    const token = await Token.findByIdAndUpdate(id, update, { new: true });
    if (!token) return res.status(404).json({ message: "Token not found" });

    // emit update for SSE subscribers
    tokenEvents.emit("tokenUpdated", token);

    res.json({ message: "Token updated", token });
  } catch (err) {
    console.error("Error updating token:", err);
    res.status(500).json({ message: "Server error while updating token" });
  }
});

/**
 * DELETE /token/delete/:id
 */
router.delete("/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Token.findByIdAndDelete(id);
    if (deleted) tokenEvents.emit("tokenUpdated", { ...deleted.toObject(), deleted: true });

    res.json({ message: "Token deleted successfully" });
  } catch (err) {
    console.error("Error deleting token:", err);
    res.status(500).json({ message: "Server error while deleting token" });
  }
});

/**
 * PATCH /token/doctor-update/:id
 * Doctor updates patient details (diagnosis, medicine, nextVisit, status)
 */
router.patch("/doctor-update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, medicine, nextVisit, status } = req.body;

    const update = { updatedAt: new Date() };
    if (diagnosis !== undefined) update.diagnosis = diagnosis;
    if (medicine !== undefined) update.medicine = medicine;
    if (nextVisit !== undefined) update.nextVisit = nextVisit;
    if (status !== undefined) update.status = status;

    const updated = await Token.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return res.status(404).json({ message: "Token not found" });

    tokenEvents.emit("tokenUpdated", updated);

    res.json({ message: "Patient details updated", token: updated });
  } catch (err) {
    console.error("Error updating token by doctor:", err);
    res.status(500).json({ message: "Server error while updating patient details" });
  }
});

/**
 * GET /token/eta/:id
 * Compute ETA for a given token id based on average service time (EWMA) and current queue
 *
 * Response:
 * { tokenId, tokensAhead, estimatedMs, estimatedAt, avgMs }
 */
router.get("/eta/:id", async (req, res) => {
  try {
    const token = await Token.findById(req.params.id);
    if (!token) return res.status(404).json({ message: "Token not found" });

    // use per-doctor stats if available, otherwise global
    const who = token.doctorId || "global";
    let stat = await ServiceStat.findOne({ doctorId: who });
    if (!stat) {
      stat = await ServiceStat.findOne({ doctorId: "global" });
    }
    const avgMs = stat ? stat.avgMs : 10 * 60 * 1000; // default 10min

    const day = token.tokenDate; // you already store tokenDate as YYYY-MM-DD

    // tokens ahead for today with smaller tokenNumber and relevant statuses
    let aheadList = await Token.find({
      tokenDate: day,
      tokenNumber: { $lt: token.tokenNumber },
      status: { $in: ["pending", "waiting", "active"] },
    }).sort({ tokenNumber: 1 });

    // count tokens ahead (including an active if present)
    const tokensAheadCount = aheadList.length;

    let remainingMs = 0;

    // if there's an active patient ahead, compute their remaining time
    const active = aheadList.find((t) => t.status === "active");
    if (active) {
      const elapsed = active.startedAt ? Date.now() - new Date(active.startedAt).getTime() : 0;
      remainingMs += Math.max(0, avgMs - elapsed);
      // remove active from further average-sum
      aheadList = aheadList.filter((t) => t._id.toString() !== active._id.toString());
    }

    // add average time for other patients ahead
    remainingMs += aheadList.length * avgMs;

    const etaDate = new Date(Date.now() + remainingMs);

    res.json({
      tokenId: token._id,
      tokensAhead: tokensAheadCount,
      estimatedMs: remainingMs,
      estimatedAt: etaDate.toISOString(),
      avgMs,
    });
  } catch (err) {
    console.error("Error computing ETA:", err);
    res.status(500).json({ message: "Error computing ETA" });
  }
});

export default router;
