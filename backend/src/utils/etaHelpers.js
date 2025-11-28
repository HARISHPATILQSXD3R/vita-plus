
import Token from "../models/Token.js";
import ServiceStat from "../models/ServiceStat.js";

/**
 * computeAvgMs(doctorId)
 * - FORCED to return a fixed 10 minutes (600000 ms).
 * - Keeps async signature to be drop-in compatible with existing callers.
 */
export async function computeAvgMs(doctorId = "global") {
  try {
    // Fixed average: 10 minutes per patient
    return 10 * 60 * 1000;
  } catch (err) {
    console.error("computeAvgMs error (forced):", err);
    return 10 * 60 * 1000;
  }
}

/**
 * recomputeEstimatedAtForToday(doctorId)
 * - Uses computeAvgMs(), which now returns the fixed 10 minutes.
 * - Logic left unchanged.
 */
export async function recomputeEstimatedAtForToday(doctorId = "global") {
  try {
    const today = new Date().toISOString().split("T")[0];
    const avgMs = await computeAvgMs(doctorId);

    // fetch today's tokens in order
    const tokens = await Token.find({ tokenDate: today }).sort({ tokenNumber: 1 });

    // pick anchor:
    // if there's an active token, compute remaining for that token and anchor future after remaining
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
      // if no active, use now as anchor (doctor will start next)
      running = Date.now();
    }

    const updatedTokens = [];

    for (const t of tokens) {
      // skip done tokens -- clear estimatedAt for done
      if (t.status === "done") {
        if (t.estimatedAt) {
          t.estimatedAt = null;
          await t.save();
          updatedTokens.push(t);
        }
        continue;
      }

      // desired ETA for this token (absolute)
      const desiredEstMs = running;
      const desiredEstDate = new Date(desiredEstMs);

      // existing ETA logic: preserve if remaining > avgMs/2
      if (t.estimatedAt) {
        const prevMs = new Date(t.estimatedAt).getTime();
        const remainingMs = prevMs - Date.now();

        if (remainingMs > Math.floor(avgMs / 2)) {
          // preserve existing ETA and advance running by avgMs from that saved ETA
          running = prevMs + avgMs;
          continue; // no save needed
        }
      }

      // otherwise update to desiredEstDate
      t.estimatedAt = desiredEstDate;
      await t.save();
      updatedTokens.push(t);

      // advance running for next token
      running = desiredEstMs + avgMs;
    }

    return { updatedTokens, avgMs };
  } catch (err) {
    console.error("recomputeEstimatedAtForToday error:", err);
    return { updatedTokens: [], avgMs: 10 * 60 * 1000 };
  }
}