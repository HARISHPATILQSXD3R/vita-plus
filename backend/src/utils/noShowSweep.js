// backend/src/utils/noShowSweep.js
import Token from "../models/Token.js";
import { tokenEvents } from "./tokenEvents.js";

/**
 * Mark tokens as 'left' if they are older than NO_SHOW_MS and still pending/waiting.
 * NO_SHOW_MS can be configured; choose a reasonable default (e.g. 30 minutes).
 */
export async function sweepNoShows(opts = {}) {
  const NO_SHOW_MS = opts.noShowMs ?? 30 * 60 * 1000; // 30 minutes default
  try {
    const cutoffDate = new Date(Date.now() - NO_SHOW_MS);

    // Consider waitingAt first (if present) else tokenTime
    const res = await Token.find({
      status: { $in: ["pending", "waiting"] },
      $or: [
        { waitingAt: { $lte: cutoffDate } },
        { waitingAt: null, tokenTime: { $lte: cutoffDate } }
      ]
    });

    if (res && res.length) {
      for (const t of res) {
        t.status = "left";
        t.leftAt = new Date();
        t.updatedAt = new Date();
        await t.save();
        tokenEvents.emit("tokenUpdated", t);
      }
    }
    return { processed: (res && res.length) || 0 };
  } catch (err) {
    console.error("sweepNoShows error:", err);
    return { processed: 0, error: err.message };
  }
}
