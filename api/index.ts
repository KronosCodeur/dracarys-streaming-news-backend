import type { Request, Response } from "express";
import { createApp } from "../src/app";
import { connectDatabase } from "../src/config/database";
import { logger } from "../src/core/logger";

const app = createApp();
let dbReady: Promise<void> | null = null;

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    if (!dbReady) {
      dbReady = connectDatabase();
    }
    await dbReady;
  } catch (error) {
    dbReady = null;
    logger.error("Database connection failed", { error: (error as Error).message });
    res.status(503).json({ message: "Database unavailable" });
    return;
  }

  app(req, res);
}
