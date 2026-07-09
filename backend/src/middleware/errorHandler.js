// Thrown by routes/services for expected, structured failures — anything
// else (a bug) falls through to a generic 500 with no leaked stack trace.
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  console.error(err);
  res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: "not_found", message: "No such route" } });
}

// Express 4 doesn't catch rejected promises from async route handlers on its
// own — wrap every async handler with this so thrown/rejected errors reach
// errorHandler instead of hanging the request.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
