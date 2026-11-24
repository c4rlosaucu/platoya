import mongoose from "mongoose";

const dishSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 400 },
    category: { type: String, required: true, trim: true, maxlength: 40 },
    priceCents: { type: Number, required: true, min: 1 },
    available: { type: Boolean, required: true, default: true },
    imageUrl: { type: String, required: true, trim: true, maxlength: 400 },
  },
  { timestamps: false },
);

export const Dish = mongoose.model("Dish", dishSchema);
