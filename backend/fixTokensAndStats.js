// backend/scripts/fixTokens.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Loose schemas so we don't need imports
const TokenSchema = new mongoose.Schema({}, { strict: false, collection: "tokens" });
const StatSchema = new mongoose.Schema({}, { strict: false, collection: "servicestats" });

const Token = mongoose.model("Token", TokenSchema);
const ServiceStat = mongoose.model("ServiceStat", StatSchema);

async function runFix() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI missing in .env");
    process.exit(1);
  }

  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("✅ Connected\n");

  // -----------------------------
  // 1) FIX avgMs to correct 10 mins
  // -----------------------------
  const DEFAULT_MS = 10 * 60 * 1000; // 10 minutes
  const result1 = await ServiceStat.updateMany({}, { $set: { avgMs: DEFAULT_MS } });
  console.log(`✔️ ServiceStat avgMs fixed for ${result1.modifiedCount} documents\n`);

  // -----------------------------
  // 2) FIX tokenNumber for every tokenDate
  // -----------------------------
  console.log("📅 Fetching all dates...");
  const dates = await Token.distinct("tokenDate");
  console.log(`Found ${dates.length} different dates\n`);

  for (const date of dates) {
    console.log(`➡️ Fixing tokenNumbers for date: ${date}`);
    const tokens = await Token.find({ tokenDate: date }).sort({ tokenTime: 1 }).lean();

    let seq = 1;
    const bulk = Token.collection.initializeUnorderedBulkOp();
    let needUpdate = false;

    for (const t of tokens) {
      if (!t.tokenNumber || t.tokenNumber <= 0) {
        bulk.find({ _id: t._id }).updateOne({ $set: { tokenNumber: seq } });
        needUpdate = true;
      }
      seq++;
    }

    if (needUpdate) {
      await bulk.execute();
      console.log(`   ✔ Updated tokenNumbers for ${date}`);
    } else {
      console.log(`   ✔ Already correct — no updates needed`);
    }
  }

  // -----------------------------
  // 3) REMOVE BROKEN estimatedAt
  // -----------------------------
  const removed = await Token.updateMany(
    { estimatedAt: { $exists: true, $ne: null } },
    { $set: { estimatedAt: null } }
  );
  console.log(`\n🧹 Cleared invalid estimatedAt from ${removed.modifiedCount} tokens`);

  await mongoose.disconnect();
  console.log("\n🎉 DONE — Database cleaned successfully!");
}

runFix().catch(err => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
