import mongoose from "mongoose";

const staffSchema = new mongoose.Schema({
  staffId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  phone: { type: String },
});

export default mongoose.model("Staff", staffSchema);
