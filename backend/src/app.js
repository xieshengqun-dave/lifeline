// Builds the Express app (routes + middleware) without binding a port, so
// tests can drive it in-process via supertest. server.js wraps this in an
// http.Server, attaches Socket.IO, and actually listens.
import "./lib/env.js"; // must load before anything else touches process.env
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import operatorRoutes from "./routes/operator.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => res.json({ service: "lifeline-api", ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/operator", operatorRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
