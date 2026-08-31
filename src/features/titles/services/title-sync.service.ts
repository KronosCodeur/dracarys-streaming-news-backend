import { logger } from "../../../core/logger";
import { env } from "../../../config/env";
import { MEDIA_TYPES, PROVIDERS, TitleModel } from "../models/title.model";
import { discoverTitlesByProvider, discoverUpcomingTitlesByProvider } from "./tmdb.service";

function lookbackCutoff(): Date {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - env.syncLookbackMonths);
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff;
}

export async function syncAllProviders(): Promise<{ upserted: number; pruned: number }> {
  let upserted = 0;

  for (const provider of PROVIDERS) {
    for (const mediaType of MEDIA_TYPES) {
      const [latest, upcoming] = await Promise.all([
        discoverTitlesByProvider(provider, mediaType, env.syncPagesPerQuery, env.syncLookbackMonths),
        discoverUpcomingTitlesByProvider(provider, mediaType, env.syncPagesPerQuery),
      ]);

      const merged = new Map(latest.map((title) => [title.tmdbId, title]));
      for (const title of upcoming) {
        merged.set(title.tmdbId, title);
      }
      const titles = Array.from(merged.values());

      const operations = titles.map((normalized) => ({
        updateOne: {
          filter: { tmdbId: normalized.tmdbId, mediaType: normalized.mediaType, provider },
          update: { $set: { ...normalized, provider } },
          upsert: true,
        },
      }));

      if (operations.length === 0) {
        continue;
      }

      const result = await TitleModel.bulkWrite(operations);
      upserted += result.upsertedCount + result.modifiedCount;

      logger.info("Provider sync completed", {
        provider,
        mediaType,
        fetched: titles.length,
        upserted: result.upsertedCount,
        updated: result.modifiedCount,
      });
    }
  }

  const pruneResult = await TitleModel.deleteMany({ releaseDate: { $lt: lookbackCutoff() } });
  const pruned = pruneResult.deletedCount ?? 0;

  logger.info("Sync pruning completed", { pruned, cutoff: lookbackCutoff().toISOString() });

  return { upserted, pruned };
}
