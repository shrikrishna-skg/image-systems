import client from "./client";
import { SCRAPE_IMPORT_URLS_CHUNK } from "../lib/ingestConfig";
async function scrapePageForImages(url, opts) {
  const res = await client.post("/scrape/page", {
    url,
    use_rendered_scrape: opts?.useRenderedScrape !== false
  });
  return res.data;
}
function mapUploadRows(data) {
  return data.map((row) => ({
    ...row,
    versions: row.versions ?? []
  }));
}
async function postScrapeImportUrlsBatch(urls, opts) {
  if (urls.length === 0) return [];
  const body = { urls };
  if (opts?.useGroqNaming) {
    body.use_groq_naming = true;
    if (opts.pageUrl?.trim()) body.page_url = opts.pageUrl.trim();
    if (opts.imageHints && opts.imageHints.length === urls.length) {
      body.image_hints = opts.imageHints.map((h) => ({
        alt: h.alt,
        source: h.source
      }));
    }
  }
  const res = await client.post("/scrape/import-urls", body);
  return mapUploadRows(res.data);
}
async function importImageUrlsFromScrape(urls, opts) {
  const out = [];
  const total = urls.length;
  const hints = opts?.imageHints;
  for (let i = 0; i < urls.length; i += SCRAPE_IMPORT_URLS_CHUNK) {
    const batch = urls.slice(i, i + SCRAPE_IMPORT_URLS_CHUNK);
    const hintBatch = hints && hints.length === urls.length ? hints.slice(i, i + SCRAPE_IMPORT_URLS_CHUNK) : void 0;
    const rows = await postScrapeImportUrlsBatch(batch, {
      useGroqNaming: opts?.useGroqNaming,
      pageUrl: opts?.pageUrl,
      imageHints: hintBatch
    });
    out.push(...rows);
    opts?.onProgress?.(Math.min(i + batch.length, total), total);
  }
  return out;
}
async function checkPageEmbed(url) {
  const res = await client.post("/scrape/embed-check", { url });
  return res.data;
}
export {
  SCRAPE_IMPORT_URLS_CHUNK,
  checkPageEmbed,
  importImageUrlsFromScrape,
  postScrapeImportUrlsBatch,
  scrapePageForImages
};
