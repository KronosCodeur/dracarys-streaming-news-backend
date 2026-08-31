import { env } from "../../../config/env";
import { logger } from "../../../core/logger";
import type { MediaType, Provider } from "../models/title.model";

export const WATCH_PROVIDER_IDS: Record<Provider, number> = {
  netflix: 8,
  prime_video: 119,
};

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbGenreListResponse {
  genres: TmdbGenre[];
}

interface TmdbDiscoverResult {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  genre_ids: number[];
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number;
}

interface TmdbDiscoverResponse {
  page: number;
  total_pages: number;
  results: TmdbDiscoverResult[];
}

interface TmdbSeason {
  season_number: number;
  air_date: string | null;
}

interface TmdbTvDetail {
  last_air_date: string | null;
  seasons?: TmdbSeason[];
}

export interface NormalizedTitle {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  genres: string[];
  releaseDate: Date | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  popularity: number;
  seasonNumber: number | null;
  isNewSeason: boolean;
}

const genreCache = new Map<MediaType, Map<number, string>>();

async function tmdbFetch<T>(path: string, searchParams: Record<string, string>): Promise<T> {
  const url = new URL(`${env.tmdbApiBase}${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.tmdbAccessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TMDB request failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

async function loadGenreMap(mediaType: MediaType): Promise<Map<number, string>> {
  const cached = genreCache.get(mediaType);
  if (cached) {
    return cached;
  }

  const data = await tmdbFetch<TmdbGenreListResponse>(`/genre/${mediaType}/list`, {
    language: env.tmdbLanguage,
  });
  const map = new Map(data.genres.map((genre) => [genre.id, genre.name]));
  genreCache.set(mediaType, map);
  return map;
}

function buildImageUrl(path: string | null, size: string): string | null {
  return path ? `${env.tmdbImageBase}/${size}${path}` : null;
}

function normalizeResult(
  result: TmdbDiscoverResult,
  mediaType: MediaType,
  genreMap: Map<number, string>,
): NormalizedTitle {
  const rawDate = mediaType === "movie" ? result.release_date : result.first_air_date;
  return {
    tmdbId: result.id,
    mediaType,
    title: (mediaType === "movie" ? result.title : result.name) ?? "",
    overview: result.overview,
    genres: result.genre_ids.map((id) => genreMap.get(id)).filter((name): name is string => Boolean(name)),
    releaseDate: rawDate ? new Date(rawDate) : null,
    posterUrl: buildImageUrl(result.poster_path, "w500"),
    backdropUrl: buildImageUrl(result.backdrop_path, "w1280"),
    popularity: result.popularity,
    seasonNumber: null,
    isNewSeason: false,
  };
}

async function discoverPages(
  provider: Provider,
  mediaType: MediaType,
  maxPages: number,
  extraParams: Record<string, string>,
): Promise<NormalizedTitle[]> {
  const genreMap = await loadGenreMap(mediaType);
  const results: NormalizedTitle[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const data = await tmdbFetch<TmdbDiscoverResponse>(`/discover/${mediaType}`, {
      watch_region: env.watchRegion,
      with_watch_providers: String(WATCH_PROVIDER_IDS[provider]),
      include_adult: "false",
      language: env.tmdbLanguage,
      page: String(page),
      ...extraParams,
    });

    results.push(...data.results.map((result) => normalizeResult(result, mediaType, genreMap)));

    logger.info("TMDB page fetched", { provider, mediaType, page, totalPages: data.total_pages, ...extraParams });

    if (page >= data.total_pages) {
      break;
    }
  }

  return results;
}

const TV_DETAIL_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index] as T);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

interface LatestSeasonInfo {
  releaseDate: Date | null;
  seasonNumber: number | null;
}

async function fetchLatestSeasonInfo(tmdbId: number): Promise<LatestSeasonInfo> {
  try {
    const detail = await tmdbFetch<TmdbTvDetail>(`/tv/${tmdbId}`, { language: env.tmdbLanguage });
    let releaseDate: Date | null = null;
    let seasonNumber: number | null = null;

    for (const season of detail.seasons ?? []) {
      if (season.season_number > 0 && season.air_date) {
        const date = new Date(season.air_date);
        if (!releaseDate || date.getTime() > releaseDate.getTime()) {
          releaseDate = date;
          seasonNumber = season.season_number;
        }
      }
    }

    if (!releaseDate && detail.last_air_date) {
      releaseDate = new Date(detail.last_air_date);
    }

    return { releaseDate, seasonNumber };
  } catch (error) {
    logger.warn("TMDB tv detail fetch failed", { tmdbId, error: (error as Error).message });
    return { releaseDate: null, seasonNumber: null };
  }
}

async function withSeasonInfo(titles: NormalizedTitle[]): Promise<NormalizedTitle[]> {
  const seasonInfos = await mapWithConcurrency(titles, TV_DETAIL_CONCURRENCY, (title) =>
    fetchLatestSeasonInfo(title.tmdbId),
  );
  return titles.map((title, index) => {
    const info = seasonInfos[index] as LatestSeasonInfo;
    return {
      ...title,
      releaseDate: info.releaseDate ?? title.releaseDate,
      seasonNumber: info.seasonNumber,
      isNewSeason: info.seasonNumber !== null && info.seasonNumber > 1,
    };
  });
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthsAgo(months: number): Date {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
}

export async function discoverTitlesByProvider(
  provider: Provider,
  mediaType: MediaType,
  maxPages: number,
  lookbackMonths: number,
): Promise<NormalizedTitle[]> {
  const since = formatDate(monthsAgo(lookbackMonths));
  const until = formatDate(new Date());

  if (mediaType === "movie") {
    return discoverPages(provider, mediaType, maxPages, {
      sort_by: "primary_release_date.desc",
      "primary_release_date.gte": since,
      "primary_release_date.lte": until,
    });
  }

  const titles = await discoverPages(provider, mediaType, maxPages, {
    sort_by: "popularity.desc",
    "air_date.gte": since,
    "air_date.lte": until,
  });
  return withSeasonInfo(titles);
}

export async function discoverUpcomingTitlesByProvider(
  provider: Provider,
  mediaType: MediaType,
  maxPages: number,
): Promise<NormalizedTitle[]> {
  const dateField = mediaType === "movie" ? "primary_release_date" : "first_air_date";
  const today = new Date().toISOString().slice(0, 10);
  return discoverPages(provider, mediaType, maxPages, {
    sort_by: `${dateField}.asc`,
    [`${dateField}.gte`]: today,
  });
}
