// backend/src/routes/staffTokenRoute.js
import express from "express";
import mongoose from "mongoose";
import Token from "../models/Token.js";
import ServiceStat from "../models/ServiceStat.js";
import Counter from "../models/Counter.js";
import { tokenEvents } from "../utils/tokenEvents.js";
import { recomputeEstimatedAtForToday } from "../utils/etaHelpers.js";

const router = express.Router();

// Helper: today's date string YYYY-MM-DD
const todayISO = () => new Date().toISOString().split("T")[0];

/**
 * GET /staff/tokens/all
 * Return all tokens (sorted by date desc, tokenNumber asc)
 */
router.get("/all", async (req, res) => {
  try {
    const tokens = await Token.find().sort({ tokenDate: -1, tokenNumber: 1 });
    res.json(tokens);
  } catch (err) {
    console.error("Error fetching all tokens:", err);
    res.status(500).json({ message: "Error fetching all tokens" });
  }
});

/**
 * GET /staff/tokens/count
 * Count tokens for today
 */
router.get("/count", async (req, res) => {
  try {
    const today = todayISO();
    const count = await Token.countDocuments({ tokenDate: today });
    res.json({ count });
  } catch (err) {
    console.error("Error counting tokens:", err);
    res.status(500).json({ message: "Error counting tokens" });
  }
});

/**
 * PUT /staff/tokens/wait/:id
 * Mark token as waiting (reserved). Set waitingAt timestamp.
 */
router.put("/wait/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const token = await Token.findByIdAndUpdate(
      id,
      { status: "waiting", waitingAt: new Date(), updatedAt: new Date() },
      { new: true }
    );
    if (!token) return res.status(404).json({ message: "Token not found" });

    // recompute ETAs and emit updates
    const { updatedTokens } = await recomputeEstimatedAtForToday(token.doctorId);
    tokenEvents.emit("tokenUpdated", token);
    if (updatedTokens && updatedTokens.length) updatedTokens.forEach(t => tokenEvents.emit("tokenUpdated", t));

    res.json({ message: "Marked as waiting", token });
  } catch (err) {
    console.error("Error marking waiting:", err);
    res.status(500).json({ message: "Error marking waiting" });
  }
});

/**
 * PUT /staff/tokens/go/:id
 * Mark token as active (patient arrived / doctor started)
 */
router.put("/go/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const token = await Token.findById(id);
    if (!token) return res.status(404).json({ message: "Token not found" });

    const now = new Date();
    if (!token.startedAt) token.startedAt = now;
    token.status = "active";
    token.arrivedAt = token.arrivedAt || now;
    token.updatedAt = now;
    await token.save();

    // recompute ETAs
    const { updatedTokens } = await recomputeEstimatedAtForToday(token.doctorId);
    tokenEvents.emit("tokenUpdated", token);
    if (updatedTokens && updatedTokens.length) updatedTokens.forEach(t => tokenEvents.emit("tokenUpdated", t));

    res.json({ message: "Patient marked active (arrived)", token });
  } catch (err) {
    console.error("Error marking go:", err);
    res.status(500).json({ message: "Error marking go" });
  }
});

/**
 * PUT /staff/tokens/done/:id
 * Mark token done, compute actualDuration and update ServiceStat (EWMA)
 */
router.put("/done/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const token = await Token.findById(id);
    if (!token) return res.status(404).json({ message: "Token not found" });

    const now = new Date();
    const startedAt = token.startedAt || token.tokenTime || now;
    const actualMs = Math.max(0, now - new Date(startedAt));

    token.status = "done";
    token.doneAt = now;
    token.actualDuration = actualMs;
    token.updatedAt = now;
    await token.save();

    // update EWMA ServiceStat
    const who = token.doctorId || "global";
    let stat = await ServiceStat.findOne({ doctorId: who });
    if (!stat) {
      stat = new ServiceStat({ doctorId: who, avgMs: 10 * 60 * 1000 });
    }
    const alpha = typeof stat.alpha === "number" ? stat.alpha : 0.2;
    stat.avgMs = Math.round(alpha * actualMs + (1 - alpha) * (stat.avgMs || 10 * 60 * 1000));
    stat.updatedAt = new Date();
    await stat.save();

    // recompute ETAs for remaining tokens
    const { updatedTokens } = await recomputeEstimatedAtForToday(token.doctorId);

    tokenEvents.emit("tokenUpdated", token);
    tokenEvents.emit("statUpdated", { doctorId: who, stat });
    if (updatedTokens && updatedTokens.length) updatedTokens.forEach(t => tokenEvents.emit("tokenUpdated", t));

    res.json({ message: "Marked done and stat updated", token, stat });
  } catch (err) {
    console.error("Error marking done:", err);
    res.status(500).json({ message: "Error marking done" });
  }
});

/**
 * PUT /staff/tokens/cancel-wait/:id
 * Cancel waiting and put back to pending
 */
router.put("/cancel-wait/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const token = await Token.findByIdAndUpdate(
      id,
      { status: "pending", waitingAt: null, updatedAt: new Date() },
      { new: true }
    );
    if (!token) return res.status(404).json({ message: "Token not found" });

    const { updatedTokens } = await recomputeEstimatedAtForToday(token.doctorId);
    tokenEvents.emit("tokenUpdated", token);
    if (updatedTokens && updatedTokens.length) updatedTokens.forEach(t => tokenEvents.emit("tokenUpdated", t));

    res.json({ message: "Wait cancelled, token back to pending", token });
  } catch (err) {
    console.error("Error cancelling wait:", err);
    res.status(500).json({ message: "Error cancelling wait" });
  }
});

/**
 * PUT /staff/tokens/left/:id
 * Mark a token as left/no-show; keeps record for history and possible reactivate later
 */
router.put("/left/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const now = new Date();
    const token = await Token.findByIdAndUpdate(
      id,
      { status: "left", leftAt: now, updatedAt: now },
      { new: true }
    );
    if (!token) return res.status(404).json({ message: "Token not found" });

    const { updatedTokens } = await recomputeEstimatedAtForToday(token.doctorId);
    tokenEvents.emit("tokenUpdated", token);
    if (updatedTokens && updatedTokens.length) updatedTokens.forEach(t => tokenEvents.emit("tokenUpdated", t));

    res.json({ message: "Marked as left/no-show", token });
  } catch (err) {
    console.error("Error marking left:", err);
    res.status(500).json({ message: "Error marking left" });
  }
});

/**
 * PUT /staff/tokens/reactivate/:id
 * Reactivate a left/no-show token to waiting (staff can choose)
 */
router.put("/reactivate/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const token = await Token.findByIdAndUpdate(
      id,
      { status: "waiting", leftAt: null, waitingAt: new Date(), updatedAt: new Date() },
      { new: true }
    );
    if (!token) return res.status(404).json({ message: "Token not found" });

    const { updatedTokens } = await recomputeEstimatedAtForToday(token.doctorId);
    tokenEvents.emit("tokenUpdated", token);
    if (updatedTokens && updatedTokens.length) updatedTokens.forEach(t => tokenEvents.emit("tokenUpdated", t));

    res.json({ message: "Token reactivated (waiting)", token });
  } catch (err) {
    console.error("Error reactivating token:", err);
    res.status(500).json({ message: "Error reactivating token" });
  }
});

/**
 * POST /staff/tokens/add-manual
 * Add manual token by staff. Uses Counter for atomic tokenNumber.
 */
router.post("/add-manual", async (req, res) => {
  try {
    const { patientName, phone } = req.body;
    if (!patientName || !phone) return res.status(400).json({ message: "Name and phone required" });

    const today = todayISO();
    const counterKey = `tokens:${today}`;
    const nextSeq = await Counter.next(counterKey); // atomic increment

    const newToken = new Token({
      patientName,
      phone,
      tokenNumber: nextSeq,
      tokenDate: today,
      tokenTime: new Date(),
      status: "manual",
    });
    await newToken.save();

    // recompute ETAs for today
    const { updatedTokens } = await recomputeEstimatedAtForToday(newToken.doctorId);

    tokenEvents.emit("tokenCreated", newToken);
    if (updatedTokens && updatedTokens.length) updatedTokens.forEach(t => tokenEvents.emit("tokenUpdated", t));

    res.json({ message: "Manual token added", token: newToken });
  } catch (err) {
    console.error("Error adding manual token:", err);
    res.status(500).json({ message: "Error adding manual token" });
  }
});

export default router;
