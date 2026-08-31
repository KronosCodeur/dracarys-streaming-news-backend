import { Router, type Request, type Response } from "express";
import { logger } from "../../../core/logger";
import { isCronAuthorized } from "../../../core/cron-auth";
import { syncAllProviders } from "../services/title-sync.service";

export const cronRouter = Router();

cronRouter.get("/sync", async (req: Request, res: Response) => {
  if (!isCronAuthorized(req)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const result = await syncAllProviders();
    logger.info("Cron-triggered sync finished", result);
    res.json(result);
  } catch (error) {
    logger.error("Cron-triggered sync failed", { error: (error as Error).message });
    res.status(502).json({ message: "TMDB sync failed" });
  }
});
