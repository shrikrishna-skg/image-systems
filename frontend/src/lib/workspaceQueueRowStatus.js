function computeQueueRowStatus(img, processingAssetIds, jobActive, jobImageId) {
  if (processingAssetIds.has(img.id)) return "processing";
  if (jobActive && jobImageId === img.id) return "processing";
  if (img.versions && img.versions.length > 0) return "complete";
  return "idle";
}
export {
  computeQueueRowStatus
};
