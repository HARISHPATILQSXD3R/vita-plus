// backend/src/models/ServiceControl.js
import mongoose from "mongoose";

const serviceControlSchema = new mongoose.Schema({
  _id: { type: String, default: "global" },
  running: { type: Boolean, default: false },
  startedAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
});

serviceControlSchema.statics.get = async function (id = "global") {
  const doc = await this.findById(id);
  if (!doc) {
    return await this.findByIdAndUpdate(id, { $setOnInsert: { running: false, startedAt: null, updatedAt: new Date() } }, { new: true, upsert: true });
  }
  return doc;
};

export default mongoose.models.ServiceControl || mongoose.model("ServiceControl", serviceControlSchema);
