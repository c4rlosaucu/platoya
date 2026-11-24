import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ["customer", "cook"] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const User = mongoose.model("User", userSchema);
