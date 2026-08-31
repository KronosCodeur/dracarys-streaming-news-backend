import { config } from "dotenv";

config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env["PORT"] ?? 4000),
  mongodbUri: requireEnv("MONGODB_URI"),
  tmdbAccessToken: requireEnv("TMDB_ACCESS_TOKEN"),
  tmdbApiBase: process.env["TMDB_API_BASE"] ?? "https://api.themoviedb.org/3",
  tmdbImageBase: process.env["TMDB_IMAGE_BASE"] ?? "https://image.tmdb.org/t/p",
  watchRegion: process.env["WATCH_REGION"] ?? "FR",
  tmdbLanguage: process.env["TMDB_LANGUAGE"] ?? "fr-FR",
  syncCronSchedule: process.env["SYNC_CRON_SCHEDULE"] ?? "0 3 * * *",
  syncPagesPerQuery: Number(process.env["SYNC_PAGES_PER_QUERY"] ?? 15),
  syncLookbackMonths: Number(process.env["SYNC_LOOKBACK_MONTHS"] ?? 1),
  corsOrigin: process.env["CORS_ORIGIN"] ?? "http://localhost:4200",
};
