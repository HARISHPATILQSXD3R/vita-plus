// backend/src/models/Token.js
import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  phone: { type: String, required: true },

  tokenTime: { type: Date, default: Date.now },

  // Today's YYYY-MM-DD
  tokenDate: { type: String, required: true },

  status: {
    type: String,
    enum: ["pending", "manual", "waiting", "active", "done", "missed", "left"],
    default: "pending",
  },

  tokenNumber: { type: Number },

  waitingAt: { type: Date, default: null },
  arrivedAt: { type: Date, default: null },

  // Doctor fields
  diagnosis: { type: String, default: "" },
  medicine: { type: String, default: "" },
  nextVisit: { type: Date, default: null },

  updatedAt: { type: Date, default: Date.now },

  // ⭐ NEW FIELDS FOR ETA SYSTEM ⭐
  startedAt: { type: Date, default: null },     // when doctor starts consultation
  doneAt: { type: Date, default: null },        // when doctor finishes
  actualDuration: { type: Number, default: null }, // duration in ms
  doctorId: { type: String, default: "global" },   // future multi-doctor support
  leftAt: { type: Date, default: null }, // when marked left/no-show

  // persisted absolute ETA timestamp (ISO) for stable countdown
  estimatedAt: { type: Date, default: null },
});

// Auto-assign SL tokenNumber if missing (fallback). Primary atomic assignment should be via Counter model for staff add-manual.
tokenSchema.pre("save", async function (next) {
  try {
    if (!this.tokenDate) {
      this.tokenDate = new Date(this.tokenTime || Date.now()).toISOString().split("T")[0];
    }

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
