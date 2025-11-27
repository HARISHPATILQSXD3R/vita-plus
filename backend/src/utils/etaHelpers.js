// backend/src/utils/etaHelpers.js
import Token from "../models/Token.js";
import ServiceStat from "../models/ServiceStat.js";
import ServiceControl from "../models/ServiceControl.js";

/**
 * computeAvgMs(doctorId)
 * - Prefer ServiceStat
 * - Fallback: recent done tokens
 * - Final fallback: 10 minutes
 */
export async function computeAvgMs(doctorId = "global") {
  try {
    const stat = await ServiceStat.findOne({ doctorId });
    if (stat && stat.avgMs) return stat.avgMs;

    const recent = await Token.find({ status: "done" }).sort({ updatedAt: -1 }).limit(20).lean();
    if (recent.length) {
      const diffs = recent
        .map((t) => {
          const start = t.arrivedAt || t.waitingAt || t.tokenTime;
          const end = t.updatedAt || t.doneAt || null;
          if (!start || !end) return null;
          const d = new Date(end).getTime() - new Date(start).getTime();
          return Number.isFinite(d) && d > 0 ? d : null;
        })
        .filter(Boolean);
      if (diffs.length) {
        const sum = diffs.reduce((s, v) => s + v, 0);
        return Math.round(sum / diffs.length);
      }
    }
  } catch (err) {
    console.error("computeAvgMs error:", err);
  }
  return 10 * 60 * 1000; // 10 min default
}

/**
 * recomputeEstimatedAtForToday(doctorId)
 * Conservative update:
 *  - For each not-done token, compute desired ETA from running anchor
 *  - If token already has estimatedAt and remaining > avgMs/2 -> preserve existing ETA (do not reset)
 *  - Otherwise update estimatedAt to desired ETA and save token
 *
 * Now respects global ServiceControl: if service is stopped, do not assign estimatedAt (keep null).
 */
export async function recomputeEstimatedAtForToday(doctorId = "global") {
  try {
    const today = new Date().toISOString().split("T")[0];
    const avgMs = await computeAvgMs(doctorId);

    // check global service state (if stopped => do not start ETA)
    const ctrl = await ServiceControl.get("global");
    const serviceRunning = !!(ctrl && ctrl.running);

    // fetch today's tokens in order
    const tokens = await Token.find({ tokenDate: today }).sort({ tokenNumber: 1 });

    // if service not running, clear all estimatedAt (so clients don't countdown)
    if (!serviceRunning) {
      const cleared = [];
      for (const t of tokens) {
        if (t.estimatedAt) {
          t.estimatedAt = null;
          await t.save();
          cleared.push(t);
        }
      }
      return { updatedTokens: cleared, avgMs, serviceRunning: false };
    }

    // pick anchor based on active token
    const active = tokens.find((t) => t.status === "active");
    let running = Date.now();

    if (active) {
      const startMs = active.startedAt ? new Date(active.startedAt).getTime() :
                      active.arrivedAt ? new Date(active.arrivedAt).getTime() :
                      active.tokenTime ? new Date(active.tokenTime).getTime() :
                      Date.now();
      const elapsed = Math.max(0, Date.now() - startMs);
      const remaining = Math.max(0, avgMs - elapsed);
      running = Date.now() + remaining;
    } else {
      // no active — anchor to now (doctor ready)
      running = Date.now();
    }

    const updatedTokens = [];

    for (const t of tokens) {
      if (t.status === "done") {
        if (t.estimatedAt) {
          t.estimatedAt = null;
          await t.save();
          updatedTokens.push(t);
        }
        continue;
      }

      const desiredEstMs = running;
      const desiredEstDate = new Date(desiredEstMs);

      if (t.estimatedAt) {
        const prevMs = new Date(t.estimatedAt).getTime();
        const remainingMs = prevMs - Date.now();

        if (remainingMs > Math.floor(avgMs / 2)) {
          // preserve existing ETA and advance running by avgMs from the saved ETA
          running = prevMs + avgMs;
          continue;
        }
      }

      // update estimatedAt to desired
      t.estimatedAt = desiredEstDate;
      await t.save();
      updatedTokens.push(t);

      running = desiredEstMs + avgMs;
    }

    return { updatedTokens, avgMs, serviceRunning: true };
  } catch (err) {
    console.error("recomputeEstimatedAtForToday error:", err);
    return { updatedTokens: [], avgMs: 10 * 60 * 1000, serviceRunning: false };
  }
}
