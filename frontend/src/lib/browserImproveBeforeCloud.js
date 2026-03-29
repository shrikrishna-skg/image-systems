import { getImage, postLocalImprove } from "../api/images";
import { getCachedImageBlob } from "./imageBlobCache";
import { runLocalImproveOnBlob } from "./localPipeline";
import { getLatestImproveVersion } from "./imageVersions";
async function commitBrowserImproveBeforeCloud(imageId, scaleFactor, tuning, onProgress) {
  const blob = await getCachedImageBlob(imageId, null);
  const finalBlob = await runLocalImproveOnBlob(blob, scaleFactor, onProgress, tuning, "png");
  const updated = await postLocalImprove(imageId, finalBlob, "png");
  let merged = updated;
  try {
    merged = await getImage(imageId);
  } catch {
  }
  const improveVersionId = getLatestImproveVersion(merged.versions)?.id ?? null;
  if (!improveVersionId) {
    throw new Error("Browser Improve did not produce a saved version for this image.");
  }
  return { image: merged, improveVersionId };
}
export {
  commitBrowserImproveBeforeCloud
};
