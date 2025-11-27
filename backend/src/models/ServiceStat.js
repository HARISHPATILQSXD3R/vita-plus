// backend/src/models/ServiceStat.js
import mongoose from "mongoose";

const serviceStatSchema = new mongoose.Schema({
  doctorId: { type: String, default: "global", index: true },
  avgMs: { type: Number, default: 10 * 60 * 1000 }, // default 10 minutes
  alpha: { type: Number, default: 0.2 }, // EWMA factor
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.ServiceStat || mongoose.model("ServiceStat", serviceStatSchema);
