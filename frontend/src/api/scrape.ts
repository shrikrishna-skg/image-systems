import client from "./client";
import type { ImageInfo } from "../types";
import { SCRAPE_IMPORT_URLS_CHUNK } from "../lib/ingestConfig";

export interface ScrapedImageRef {
  url: string;
  alt: string | null;
  source: string;
}

export interface ScrapePageResult {
  page_url: string;
  final_url: string;
  images: ScrapedImageRef[];
  truncated: boolean;
  scrape_image_cap: number;
}

export async function scrapePageForImages(
  url: string,
  opts?: { useRenderedScrape?: boolean },
): Promise<ScrapePageResult> {
  const res = await client.post<ScrapePageResult>("/scrape/page", {
    url,
    use_rendered_scrape: opts?.useRenderedScrape !== false,
  });
  return res.data;
}

function mapUploadRows(data: ImageInfo[]): ImageInfo[] {
  return data.map((row) => ({
    ...row,
    versions: row.versions ?? [],
  }));
}

/** One POST /scrape/import-urls (≤ SCRAPE_IMPORT_URLS_CHUNK URLs). */
export async function postScrapeImportUrlsBatch(urls: string[]): Promise<ImageInfo[]> {
  if (urls.length === 0) return [];
  const res = await client.post<ImageInfo[]>("/scrape/import-urls", { urls });
  return mapUploadRows(res.data);
}

export { SCRAPE_IMPORT_URLS_CHUNK };

/**
 * Download many URL imports in server-sized chunks (same persistence as file upload).
 * Does not update the workspace — callers add rows to the session if needed.
 */
export async function importImageUrlsFromScrape(
  urls: string[],
  opts?: { onProgress?: (done: number, total: number) => void },
): Promise<ImageInfo[]> {
  const out: ImageInfo[] = [];
  const total = urls.length;
  for (let i = 0; i < urls.length; i += SCRAPE_IMPORT_URLS_CHUNK) {
    const batch = urls.slice(i, i + SCRAPE_IMPORT_URLS_CHUNK);
    const rows = await postScrapeImportUrlsBatch(batch);
    out.push(...rows);
    opts?.onProgress?.(Math.min(i + batch.length, total), total);
  }
  return out;
}

export interface EmbedCheckResult {
  final_url: string;
  embed_allowed: boolean;
  detail: string;
}

/** Server inspects X-Frame-Options / CSP so we know if the iframe will stay blank. */
export async function checkPageEmbed(url: string): Promise<EmbedCheckResult> {
  const res = await client.post<EmbedCheckResult>("/scrape/embed-check", { url });
  return res.data;
}
