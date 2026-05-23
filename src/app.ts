import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { purchaseRouter } from "./routes/purchase.js";

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());

  app.use("/health", healthRouter);
  app.use("/events", purchaseRouter);
  app.use(errorHandler);

  return app;
}
