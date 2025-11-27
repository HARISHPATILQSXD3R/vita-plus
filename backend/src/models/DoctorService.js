import mongoose from "mongoose";

const doctorServiceSchema = new mongoose.Schema({
  running: { type: Boolean, default: false },
  startedAt: { type: Date, default: null }
});

export default mongoose.models.DoctorService ||
  mongoose.model("DoctorService", doctorServiceSchema);
