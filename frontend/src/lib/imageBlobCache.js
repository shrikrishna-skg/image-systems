import client from "../api/client";
import { getLocalBlob } from "./localImageStore";
import { isStorageOnlyMode } from "./storageOnlyMode";
const MAX_CACHED_BLOBS = 256;
const blobByKey = /* @__PURE__ */ new Map();
const lruOrder = [];
const inflight = /* @__PURE__ */ new Map();
function touchKey(key) {
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
function cacheKey(imageId, versionId) {
  const mode = isStorageOnlyMode() ? "L" : "R";
  return `${mode}:${imageId}:${versionId ?? ""}`;
}
async function fetchBlob(imageId, versionId) {
  if (isStorageOnlyMode()) {
    const blob = await getLocalBlob(imageId, versionId);
    if (!blob) throw new Error("Local image not found");
    return blob;
  }
  let url = `/images/${imageId}/download`;
  if (versionId) url += `?version=${versionId}`;
  const res = await client.get(url, { responseType: "blob" });
  return res.data;
}
async function getCachedImageBlob(imageId, versionId) {
  const key = cacheKey(imageId, versionId);
  const hit = blobByKey.get(key);
  if (hit) {
    touchKey(key);
    return hit;
  }
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchBlob(imageId, versionId).then((blob) => {
      blobByKey.set(key, blob);
      touchKey(key);
      evictIfNeeded();
      return blob;
    }).finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, pending);
  }
  return pending;
}
function clearImageBlobCache() {
  blobByKey.clear();
  lruOrder.length = 0;
  inflight.clear();
}
export {
  clearImageBlobCache,
  getCachedImageBlob
};
