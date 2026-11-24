import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    paypalOrderId: { type: String, required: true, unique: true },
    captureId: { type: String },
    status: {
      type: String,
      required: true,
      enum: ["CREATED", "CAPTURE_PENDING", "CAPTURED", "FAILED"],
    },
    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, enum: ["USD"], default: "USD" },
    paypalStatus: { type: String, default: "" },
    capturedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

paymentSchema.index({ captureId: 1 }, { unique: true, sparse: true });

export const Payment = mongoose.model("Payment", paymentSchema);
