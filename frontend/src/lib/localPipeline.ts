import type { ImageInfo } from "../types";
import type { LocalEnhanceTuning } from "./localEnhance";
import { addLocalVersion, getLocalBlob } from "./localImageStore";
import { enhanceImageLocally, upscaleCanvasBlob } from "./localEnhance";

export type { LocalEnhanceTuning };

export async function runLocalImproveOnBlob(
  source: Blob,
  scaleFactor: number,
  onProgress: (pct: number) => void,
  tuning: LocalEnhanceTuning
): Promise<Blob> {
  onProgress(18);
  const enhanced = await enhanceImageLocally(source, tuning);
  onProgress(52);
  const scale = Math.min(4, Math.max(1, scaleFactor));
  const finalBlob = await upscaleCanvasBlob(enhanced, scale);
  onProgress(88);
  return finalBlob;
}

export async function runLocalEnhancePipeline(
  imageId: string,
  scaleFactor: number,
  onProgress: (pct: number) => void,
  tuning: LocalEnhanceTuning
): Promise<ImageInfo> {
  onProgress(5);
  const original = await getLocalBlob(imageId);
  if (!original) throw new Error("Image not found in local storage");

  const finalBlob = await runLocalImproveOnBlob(original, scaleFactor, onProgress, tuning);

  onProgress(94);
  const info = await addLocalVersion(imageId, finalBlob, "final");
  onProgress(100);
  return info;
}
