import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  phone: { type: String, required: true },
  tokenTime: { type: Date, default: Date.now },
  status: { type: String, default: "pending" }, // pending, done, waitlist
 tokenNumber: { type: Number }, // new field for SL number
  // 🩺 Added fields for Doctor use
  diagnosis: { type: String, default: "" },
  medicine: { type: String, default: "" },
  nextVisit: { type: Date },
});

// Auto-assign tokenNumber (SL) for new tokens
tokenSchema.pre("save", async function(next) {
  if (this.isNew && !this.tokenNumber) {
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    const Token = mongoose.model("Token", tokenSchema);
    const count = await Token.countDocuments({
      tokenTime: { $gte: start, $lte: end }
    });
    this.tokenNumber = count + 1; // SL starts at 1 each day
  }
  next();
});

export default mongoose.model("Token", tokenSchema);
