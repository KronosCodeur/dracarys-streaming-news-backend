import { connectDatabase, disconnectDatabase } from "../config/database";
import { logger } from "../core/logger";
import { syncAllProviders } from "../features/titles/services/title-sync.service";

async function main(): Promise<void> {
  await connectDatabase();
  const result = await syncAllProviders();
  logger.info("Manual sync finished", result);
  await disconnectDatabase();
}

main().catch((error) => {
  logger.error("Manual sync failed", { error: (error as Error).message });
  process.exitCode = 1;
});
