import express, { type Express } from "express";
import cors from "cors";
import { env } from "./config/env";
import { titleRouter } from "./features/titles/routes/title.routes";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/titles", titleRouter);

  return app;
}
