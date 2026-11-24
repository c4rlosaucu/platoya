import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    dishId: { type: mongoose.Schema.Types.ObjectId, ref: "Dish", required: true },
    name: { type: String, required: true },
    unitPriceCents: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 20 },
    lineTotalCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const historySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ["PENDING_PAYMENT", "PAID", "PREPARING", "READY", "DELIVERED"],
    },
    at: { type: Date, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, required: true, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    reference: { type: String, trim: true, maxlength: 160, default: "" },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [itemSchema], required: true },
    address: { type: addressSchema, required: true },
    totalCents: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, enum: ["USD"], default: "USD" },
    status: {
      type: String,
      required: true,
      enum: ["PENDING_PAYMENT", "PAID", "PREPARING", "READY", "DELIVERED"],
      default: "PENDING_PAYMENT",
    },
    statusHistory: { type: [historySchema], required: true },
    paypalOrderId: { type: String },
    idempotencyKey: { type: String, required: true },
    paidAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ paypalOrderId: 1 }, { unique: true, sparse: true });
orderSchema.index({ userId: 1, createdAt: -1 });

export const Order = mongoose.model("Order", orderSchema);
