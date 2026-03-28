/** Per-file upload ceiling (aligned with backend MAX_UPLOAD_SIZE_MB). */
export const IMAGE_MAX_BYTES = 50 * 1024 * 1024;

/** Bytes read from each file for binary signature detection (WebP/HEIC need ~12B+; BMFF benefits from more). */
export const IMAGE_SNIFF_BYTES = 4096;

/** Parallel metadata reads before network/local persistence (main-thread slice reads are cheap). */
export const SNIFF_CONCURRENCY = 8;

/** Parallel IndexedDB writes — avoids serializing large buffers on one task. */
export const LOCAL_PERSIST_CONCURRENCY = 4;

/** Parallel multipart upload requests; each request carries up to NETWORK_CHUNK_FILES files (≤ backend MAX_FILES_PER_UPLOAD_BATCH). */
export const NETWORK_CHUNK_FILES = 25;

/** URLs per POST /scrape/import-urls — must match backend MAX_FILES_PER_UPLOAD_BATCH. */
export const SCRAPE_IMPORT_URLS_CHUNK = 200;

/** Concurrent HTTP upload connections (HTTP/2 multiplex friendly). */
export const NETWORK_UPLOAD_CONCURRENCY = 4;
