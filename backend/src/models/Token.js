// backend/src/models/Token.js
import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  phone: { type: String, required: true },
  tokenTime: { type: Date, default: Date.now },
  // tokenDate is the local day (YYYY-MM-DD) for easier daily queries
  tokenDate: { type: String, required: true },
  // statuses: pending (created), manual (staff-created), waiting (staff reserved), active (patient arrived), done, missed
  status: {
    type: String,
    enum: ["pending", "manual", "waiting", "active", "done", "missed"],
    default: "pending",
  },
  tokenNumber: { type: Number }, // SL number for the day
  // timestamps for staff actions
  waitingAt: { type: Date, default: null },
  arrivedAt: { type: Date, default: null },
  // Doctor fields
  diagnosis: { type: String, default: "" },
  medicine: { type: String, default: "" },
  nextVisit: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
});

// Auto-assign tokenNumber per day and set tokenDate if missing
tokenSchema.pre("save", async function (next) {
  try {
    // set tokenDate from tokenTime if not set
    if (!this.tokenDate) {
      this.tokenDate = new Date(this.tokenTime || Date.now()).toISOString().split("T")[0];
    }

    // If new and tokenNumber missing, compute next tokenNumber for that tokenDate
    if (this.isNew && !this.tokenNumber) {
      // Avoid model re-registration
      const TokenModel = mongoose.models.Token || mongoose.model("Token", tokenSchema);

      const count = await TokenModel.countDocuments({ tokenDate: this.tokenDate });
      this.tokenNumber = count + 1;
    }

    this.updatedAt = new Date();
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.models.Token || mongoose.model("Token", tokenSchema);
