import { Router } from "express";
import mongoose from "mongoose";
import { httpError } from "../httpError.js";
import { Dish } from "../models/Dish.js";
import { serializeDish } from "../serializers.js";

export const dishesRouter = Router();

dishesRouter.get("/", async (req, res, next) => {
  try {
    const dishes = await Dish.find({ available: true }).sort({ category: 1, name: 1 });
    res.json({ dishes: dishes.map(serializeDish) });
  } catch (error) {
    next(error);
  }
});

dishesRouter.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw httpError(404, "NOT_FOUND", "Plato no encontrado");
    }
    const dish = await Dish.findOne({ _id: req.params.id, available: true });
    if (!dish) throw httpError(404, "NOT_FOUND", "Plato no encontrado");
    res.json({ dish: serializeDish(dish) });
  } catch (error) {
    next(error);
  }
});
