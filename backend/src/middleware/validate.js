import { HttpError } from "./errorHandler.js";

// Wraps a route handler with zod-schema validation of req.body. On success,
// req.body is replaced with the parsed (and type-coerced) value.
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return next(new HttpError(400, "invalid_request", message));
    }
    req.body = result.data;
    next();
  };
}
