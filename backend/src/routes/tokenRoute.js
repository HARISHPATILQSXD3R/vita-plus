// backend/src/routes/tokenRoute.js
import express from 'express';
import Token from '../models/Token.js';
import { recomputeEstimatedAtForToday } from "../utils/etaHelpers.js";
import { tokenEvents } from "../utils/tokenEvents.js";

const router = express.Router();

/**
 * Helper: today's ISO date string (YYYY-MM-DD)
 */
const todayISO = () => new Date().toISOString().split('T')[0];

/**
 * Normalize phone to digits only
 */
const normalizePhone = (p = '') => (p || '').toString().replace(/\D/g, '');

/**
 * TAKE TOKEN (patient)
 */
router.post('/take-token', async (req, res) => {
  try {
    const { patientName, phone } = req.body;
    if (!patientName || !phone) {
      return res.status(400).json({ message: 'Name and phone required' });
    }
    const tokenDate = todayISO();
    const normPhone = normalizePhone(phone);

    // Prevent duplicate active/pending/waiting tokens for same day
    const existing = await Token.findOne({
      phone: { $in: [normPhone, '0' + normPhone] },
      tokenDate,
      status: { $in: ['pending', 'waiting', 'active'] },
    });
    if (existing) {
      return res.status(400).json({ message: 'You already have a token for today.' });
    }

    // tokenNumber for today
    const last = await Token.findOne({ tokenDate }).sort({ tokenNumber: -1 });
    const tokenNumber = last ? last.tokenNumber + 1 : 1;

    const token = new Token({
      patientName,
      phone: normPhone,
      tokenTime: new Date(),
      tokenDate,
      tokenNumber,
      status: 'pending',
    });

    await token.save();

    // recompute ETAs for today and persist; returns updated tokens
    const { updatedTokens } = await recomputeEstimatedAtForToday();

    // emit events: token created + any token updates
    tokenEvents.emit("tokenCreated", token);
    if (updatedTokens && updatedTokens.length) {
      updatedTokens.forEach((t) => tokenEvents.emit("tokenUpdated", t));
    }

    res.json({ message: 'Token created', token });
  } catch (err) {
    console.error('Error in /take-token:', err);
    res.status(500).json({ message: 'Server error while creating token' });
  }
});

/* --- the rest of your routes remain the same except we added recompute + emits in some actions --- */

/**
 * GET tokens for a patient (all) — tolerant to formatting
 * Accepts a phone param which can be normalized digits, start with 0, etc.
 */
router.get('/patient/:phone', async (req, res) => {
  try {
    const raw = req.params.phone || '';
    const norm = normalizePhone(raw);
    if (!norm) return res.json([]);

    // Build regex to match stored entries that end with the normalized digits
    // This covers "+91xxxxx", "0xxxx", or just the digits.
    const endsWith = new RegExp(norm + '$');

    const tokens = await Token.find({
      $or: [
        { phone: norm },
        { phone: '0' + norm },
        { phone: { $regex: endsWith } },
      ],
    }).sort({ tokenTime: -1 });

    res.json(tokens);
  } catch (err) {
    console.error('Error fetching tokens:', err);
    res.status(500).json({ message: 'Server error while fetching tokens' });
  }
});

/**
 * GET today's tokens (ordered by tokenNumber)
 */
router.get('/today', async (req, res) => {
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
    console.error('Error fetching today tokens:', err);
    res.status(500).json({ message: 'Server error fetching today tokens' });
  }
});

/**
 * GET tokens by date (YYYY-MM-DD)
 */
router.get('/date/:date', async (req, res) => {
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
    console.error('Error fetching tokens by date:', err);
    res.status(500).json({ message: 'Server error fetching tokens by date' });
  }
});

/**
 * ETA endpoint — returns estimated wait for a token id
 * - Will now return estimatedAt (if present) and estimatedMs computed client-side from it
 */
router.get('/eta/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const token = await Token.findById(id);
    if (!token) return res.status(404).json({ message: 'Token not found' });

    // tokens ahead (for same day with lower tokenNumber)
    const tokensAhead = await Token.countDocuments({
      tokenDate: token.tokenDate,
      tokenNumber: { $lt: token.tokenNumber },
      status: { $in: ['pending', 'waiting', 'active'] },
    });

    // compute average service time (ms) from recent done tokens
    const recentDone = await Token.find({ status: 'done', updatedAt: { $exists: true } })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    let avgMs = 10 * 60 * 1000; // fallback 10 minutes
    if (recentDone.length > 0) {
      const diffs = recentDone
        .map((t) => {
          const start = t.arrivedAt || t.waitingAt || t.tokenTime;
          const end = t.updatedAt || t.tokenTime;
          if (!start || !end) return null;
          const d = new Date(end).getTime() - new Date(start).getTime();
          return isFinite(d) && d > 0 ? d : null;
        })
        .filter(Boolean);
      if (diffs.length > 0) {
        const sum = diffs.reduce((s, v) => s + v, 0);
        avgMs = Math.round(sum / diffs.length);
      }
    }

    // If token has stored estimatedAt, prefer that. Otherwise compute estimatedAt = now + tokensAhead*avgMs
    const estimatedAt = token.estimatedAt ? new Date(token.estimatedAt).toISOString() : new Date(Date.now() + tokensAhead * avgMs).toISOString();
    const estimatedMs = Math.max(0, new Date(estimatedAt).getTime() - Date.now());

    res.json({
      tokenId: id,
      tokensAhead,
      avgMs,
      estimatedMs,
      estimatedAt,
    });
  } catch (err) {
    console.error('Error computing ETA:', err);
    res.status(500).json({ message: 'Server error computing ETA' });
  }
});

/**
 * General update route (kept for compatibility)
 */
router.put('/update/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const update = req.body || {};
    update.updatedAt = new Date();
    const token = await Token.findByIdAndUpdate(id, update, { new: true });
    if (!token) return res.status(404).json({ message: 'Token not found' });
    res.json({ message: 'Token updated', token });
  } catch (err) {
    console.error('Error updating token:', err);
    res.status(500).json({ message: 'Server error while updating token' });
  }
});

/**
 * Delete token
 */
router.delete('/delete/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await Token.findByIdAndDelete(id);
    res.json({ message: 'Token deleted successfully' });
  } catch (err) {
    console.error('Error deleting token:', err);
    res.status(500).json({ message: 'Server error while deleting token' });
  }
});

/**
 * Doctor updates patient info (kept as-is)
 */
router.patch('/doctor-update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, medicine, nextVisit, status } = req.body;

    const updated = await Token.findByIdAndUpdate(
      id,
      { diagnosis, medicine, nextVisit, status, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Token not found' });

    res.json({ message: 'Patient details updated', token: updated });
  } catch (err) {
    console.error('Error updating token by doctor:', err);
    res.status(500).json({ message: 'Server error while updating patient details' });
  }
});

export default router;
