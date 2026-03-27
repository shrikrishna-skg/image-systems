import client from "../api/client";
import { getLocalBlob } from "./localImageStore";
import { isStorageOnlyMode } from "./storageOnlyMode";

/** Keep recent blobs in RAM so revisiting dashboard/history doesn’t re-hit the network/IDB. */
const MAX_CACHED_BLOBS = 64;

const blobByKey = new Map<string, Blob>();
const lruOrder: string[] = [];
const inflight = new Map<string, Promise<Blob>>();

function touchKey(key: string) {
  const i = lruOrder.indexOf(key);
  if (i >= 0) lruOrder.splice(i, 1);
  lruOrder.push(key);
}

function evictIfNeeded() {
  while (lruOrder.length > MAX_CACHED_BLOBS) {
    const k = lruOrder.shift();
    if (k) blobByKey.delete(k);
  }
}

function cacheKey(imageId: string, versionId?: string | null): string {
  const mode = isStorageOnlyMode() ? "L" : "R";
  return `${mode}:${imageId}:${versionId ?? ""}`;
}

async function fetchBlob(imageId: string, versionId?: string | null): Promise<Blob> {
  if (isStorageOnlyMode()) {
    const blob = await getLocalBlob(imageId, versionId);
    if (!blob) throw new Error("Local image not found");
    return blob;
  }
  let url = `/images/${imageId}/download`;
  if (versionId) url += `?version=${versionId}`;
  const res = await client.get(url, { responseType: "blob" });
  return res.data as Blob;
}

/**
 * Single network/IDB read per key (in-flight dedupe) + LRU RAM cache across the whole app.
 */
export async function getCachedImageBlob(imageId: string, versionId?: string | null): Promise<Blob> {
  const key = cacheKey(imageId, versionId);
  const hit = blobByKey.get(key);
  if (hit) {
    touchKey(key);
    return hit;
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchBlob(imageId, versionId)
      .then((blob) => {
        blobByKey.set(key, blob);
        touchKey(key);
        evictIfNeeded();
        return blob;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, pending);
  }

  return pending;
}

/** Optional: drop cache (e.g. after logout) */
export function clearImageBlobCache() {
  blobByKey.clear();
  lruOrder.length = 0;
  inflight.clear();
}
