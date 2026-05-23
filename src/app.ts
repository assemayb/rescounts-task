import express from "express";

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "rescounts-task",
    });
  });

  return app;
}
