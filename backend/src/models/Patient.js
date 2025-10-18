import mongoose from "mongoose";

const patientSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  otp: { type: String },
  otpExpiry: { type: Date },
});

export default mongoose.model("patient", patientSchema);
