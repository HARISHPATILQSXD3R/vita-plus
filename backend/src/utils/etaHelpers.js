// backend/src/utils/etaHelpers.js
import Token from "../models/Token.js";
import ServiceStat from "../models/ServiceStat.js";

/**
 * computeAvgMs(doctorId)
 * - Prefer ServiceStat
 * - Fallback: recent done tokens
 * - Final fallback: 10 minutes
 * - CLAMP between 3 min and 30 min to avoid crazy values
 */
export async function computeAvgMs(doctorId = "global") {
  let avg = 10 * 60 * 1000; // default 10 minutes

  try {
    const stat = await ServiceStat.findOne({ doctorId });
    if (stat && stat.avgMs) {
      avg = stat.avgMs;
    } else {
      const recent = await Token.find({ status: "done" })
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean();

      if (recent.length) {
        const diffs = recent
          .map((t) => {
            // prefer actual consultation start time then arrival/waiting/tokenTime
            const start = t.startedAt || t.arrivedAt || t.waitingAt || t.tokenTime;
            const end = t.updatedAt || t.doneAt || null;
            if (!start || !end) return null;
            const d = new Date(end).getTime() - new Date(start).getTime();
            return isFinite(d) && d > 0 ? d : null;
          })
          .filter(Boolean);

        if (diffs.length) {
          const sum = diffs.reduce((s, v) => s + v, 0);
          avg = Math.round(sum / diffs.length);
        }
      }
    }
  } catch (err) {
    console.error("computeAvgMs error:", err);
  }

  // 🔒 Clamp between 3 and 30 minutes
  const MIN = 3 * 60 * 1000;
  const MAX = 30 * 60 * 1000;
  if (avg < MIN) avg = MIN;
  if (avg > MAX) avg = MAX;

  return avg;
}

/**
 * recomputeEstimatedAtForToday(doctorId)
 * - Only assign ETA to tokens with status 'pending' or 'active'
 * - If a token has other status (e.g. waiting/manual/left) we clear estimatedAt
 * - Anchor uses currently active token (if exists) to compute remaining for that active,
 *   otherwise anchor = now.
 */
export async function recomputeEstimatedAtForToday(doctorId = "global") {
  try {
    const today = new Date().toISOString().split("T")[0];
    const avgMs = await computeAvgMs(doctorId);

    // fetch all today's tokens (we need to inspect statuses and preserve ordering)
    const tokens = await Token.find({ tokenDate: today }).sort({ tokenNumber: 1 });

    // allowed statuses to receive ETAs
    const ALLOWED = new Set(["pending", "active"]);

    // find active token (if any)
    const active = tokens.find((t) => t.status === "active");
    let running = Date.now();

    if (active) {
      const startMs = active.startedAt
        ? new Date(active.startedAt).getTime()
        : active.arrivedAt
        ? new Date(active.arrivedAt).getTime()
        : active.tokenTime
        ? new Date(active.tokenTime).getTime()
        : Date.now();

      const elapsed = Math.max(0, Date.now() - startMs);
      const remaining = Math.max(0, avgMs - elapsed);
      running = Date.now() + remaining;
    } else {
      running = Date.now();
    }

    const updatedTokens = [];

    for (const t of tokens) {
      // done tokens: clear ETA if present
      if (t.status === "done") {
        if (t.estimatedAt) {
          t.estimatedAt = null;
          await t.save();
          updatedTokens.push(t);
        }
        continue;
      }

      // If token status is NOT allowed (waiting, manual, left, missed...), clear ETA if present
      if (!ALLOWED.has(t.status)) {
        if (t.estimatedAt) {
          t.estimatedAt = null;
          await t.save();
          updatedTokens.push(t);
        }
        continue;
      }

      // Now t.status is 'pending' or 'active' -> compute desired ETA
      const desiredEstMs = running;
      const desiredEstDate = new Date(desiredEstMs);

      // Preserve existing ETA if it still has enough remaining (avoid jitter):
      if (t.estimatedAt) {
        const prevMs = new Date(t.estimatedAt).getTime();
        const remainingMs = prevMs - Date.now();

        // if previously saved ETA still has more than half an avg block remaining, keep it
        if (remainingMs > Math.floor(avgMs / 2)) {
          // advance running to follow that preserved ETA
          running = prevMs + avgMs;
          continue; // no save
        }
      }

      // Assign new ETA and save
      t.estimatedAt = desiredEstDate;
      await t.save();
      updatedTokens.push(t);

      // increment running by avg for the next token that receives ETA
      running = desiredEstMs + avgMs;
    }

    return { updatedTokens, avgMs };
  } catch (err) {
    console.error("recomputeEstimatedAtForToday error:", err);
    return { updatedTokens: [], avgMs: 10 * 60 * 1000 };
  }
}
