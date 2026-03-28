import { getImage, postLocalImprove } from "../api/images";
import { getCachedImageBlob } from "./imageBlobCache";
import { runLocalImproveOnBlob, type LocalEnhanceTuning } from "./localPipeline";
import type { ImageInfo } from "../types";

function latestImproveVersion(versions: ImageInfo["versions"] | undefined): string | null {
  if (!versions?.length) return null;
  const improve = versions
    .filter((v) => (v.provider || "").toLowerCase() === "improve")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return improve[0]?.id ?? null;
}

/**
 * Runs the in-browser Improve engine, persists via local-improve, and returns the new version id
 * to use as the raster input for OpenAI / Gemini (always Improve → AI).
 */
export async function commitBrowserImproveBeforeCloud(
  imageId: string,
  scaleFactor: number,
  tuning: LocalEnhanceTuning,
  onProgress: (pct: number) => void
): Promise<{ image: ImageInfo; improveVersionId: string }> {
  const blob = await getCachedImageBlob(imageId, null);
  const finalBlob = await runLocalImproveOnBlob(blob, scaleFactor, onProgress, tuning);
  const updated = await postLocalImprove(imageId, finalBlob);
  let merged = updated;
  try {
    merged = await getImage(imageId);
  } catch {
    /* use POST body if GET fails */
  }
  const improveVersionId = latestImproveVersion(merged.versions);
  if (!improveVersionId) {
    throw new Error("Browser Improve did not produce a saved version for this image.");
  }
  return { image: merged, improveVersionId };
}
