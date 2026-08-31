import { Router, type Request, type Response } from "express";
import { MEDIA_TYPES, PROVIDERS, TitleModel, type MediaType, type Provider } from "../models/title.model";
import { syncAllProviders } from "../services/title-sync.service";
import { logger } from "../../../core/logger";
import { isCronAuthorized } from "../../../core/cron-auth";

export const titleRouter = Router();

const DEFAULT_PAGE_SIZE = 20;

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

function isMediaType(value: unknown): value is MediaType {
  return typeof value === "string" && (MEDIA_TYPES as readonly string[]).includes(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

titleRouter.get("/", async (req: Request, res: Response) => {
  const { provider, type, upcoming, sort, q, genre, page = "1", limit = String(DEFAULT_PAGE_SIZE) } = req.query;

  const filter: Record<string, unknown> = {};
  if (isProvider(provider)) {
    filter["provider"] = provider;
  }
  if (isMediaType(type)) {
    filter["mediaType"] = type;
  }
  if (upcoming === "true") {
    filter["releaseDate"] = { $gte: new Date() };
  } else if (upcoming === "false") {
    filter["releaseDate"] = { $lt: new Date() };
  }
  if (typeof q === "string" && q.trim().length > 0) {
    filter["title"] = { $regex: escapeRegex(q.trim()), $options: "i" };
  }
  if (typeof genre === "string" && genre.trim().length > 0) {
    filter["genres"] = genre.trim();
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE));

  const sortOrder: Record<string, 1 | -1> =
    sort === "popularity" ? { popularity: -1 } : { releaseDate: upcoming === "true" ? 1 : -1 };

  const [items, total] = await Promise.all([
    TitleModel.find(filter)
      .sort(sortOrder)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    TitleModel.countDocuments(filter),
  ]);

  res.json({ items, total, page: pageNumber, pageSize });
});

titleRouter.get("/genres", async (_req: Request, res: Response) => {
  const genres = await TitleModel.distinct("genres");
  res.json({ genres: (genres as string[]).sort((a, b) => a.localeCompare(b, "fr")) });
});

titleRouter.get("/:id", async (req: Request, res: Response) => {
  const item = await TitleModel.findById(req.params["id"]).lean();
  if (!item) {
    res.status(404).json({ message: "Title not found" });
    return;
  }
  res.json(item);
});

titleRouter.post("/sync", async (req: Request, res: Response) => {
  if (!isCronAuthorized(req)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const result = await syncAllProviders();
    res.json(result);
  } catch (error) {
    logger.error("Manual sync failed", { error: (error as Error).message });
    res.status(502).json({ message: "TMDB sync failed" });
  }
});
