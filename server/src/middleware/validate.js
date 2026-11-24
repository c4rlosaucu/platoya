import { httpError } from "../httpError.js";

export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(httpError(400, "VALIDATION_ERROR", parsed.error.issues[0].message));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
