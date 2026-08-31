import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { logger } from "./core/logger";
import { scheduleTmdbSync } from "./jobs/sync-tmdb.job";

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  app.listen(env.port, () => {
    logger.info("Server started", { port: env.port });
  });

  scheduleTmdbSync();
}

bootstrap().catch((error) => {
  logger.error("Server failed to start", { error: (error as Error).message });
  process.exit(1);
});
