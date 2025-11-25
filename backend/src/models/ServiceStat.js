// backend/src/models/ServiceStat.js
import mongoose from "mongoose";

const ServiceStatSchema = new mongoose.Schema({
  doctorId: { type: String, default: "global" }, // "global" used when no per-doctor stats
  avgMs: { type: Number, default: 10 * 60 * 1000 }, // default 10 minutes
  alpha: { type: Number, default: 0.2 }, // EWMA weight
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("ServiceStat", ServiceStatSchema);
