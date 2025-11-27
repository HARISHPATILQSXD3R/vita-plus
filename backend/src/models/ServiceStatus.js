// backend/src/models/ServiceStatus.js
import mongoose from "mongoose";

const serviceStatusSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: "global" }, // single doc _id = "global"
  running: { type: Boolean, default: false },
  startedAt: { type: Date, default: null },
  stoppedAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
});

// convenience getter
serviceStatusSchema.statics.get = async function (id = "global") {
  let s = await this.findById(id).lean();
  if (!s) {
    await this.create({ _id: id, running: false });
    s = await this.findById(id).lean();
  }
  return s;
};

export default mongoose.models.ServiceStatus || mongoose.model("ServiceStatus", serviceStatusSchema);
