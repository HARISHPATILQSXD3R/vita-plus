// backend/src/cron/dailyMissed.js
import cron from "node-cron";
import Token from "../models/Token.js";

const markMissed = async () => {
  try {
    const today = new Date().toISOString().split("T")[0];
    // Mark waiting or pending tokens not from today as missed (safety)
    await Token.updateMany(
      { status: { $in: ["pending", "waiting"] }, tokenDate: { $ne: today } },
      { $set: { status: "missed", updatedAt: new Date() } }
    );
    console.log("Daily missed job: marked old pending/waiting as missed.");
  } catch (err) {
    console.error("Error in daily missed job:", err);
  }
};

// run at 23:59 server time (adjust as needed)
cron.schedule("59 23 * * *", markMissed);

// Also optionally run once on server start (safe)
markMissed();

export default markMissed;
