import cron from "node-cron";
import { env } from "../config/env";
import { logger } from "../core/logger";
import { syncAllProviders } from "../features/titles/services/title-sync.service";

export function scheduleTmdbSync(): void {
  cron.schedule(env.syncCronSchedule, () => {
    logger.info("Scheduled TMDB sync starting");
    syncAllProviders()
      .then((result) => logger.info("Scheduled TMDB sync finished", result))
      .catch((error) => logger.error("Scheduled TMDB sync failed", { error: (error as Error).message }));
  });

  logger.info("TMDB sync scheduled", { cron: env.syncCronSchedule });
}
