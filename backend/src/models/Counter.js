// backend/src/models/Counter.js
import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "tokens:2025-11-25"
  seq: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

counterSchema.statics.next = async function (key) {
  const ret = await this.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 }, $set: { updatedAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return ret.seq;
};

export default mongoose.models.Counter || mongoose.model("Counter", counterSchema);
