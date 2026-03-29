import { addLocalVersion, getLocalBlob } from "./localImageStore";
import { enhanceImageLocally, resizeRasterBlobToPixelSize, upscaleCanvasBlob } from "./localEnhance";
import { calculateTargetDimensions } from "./targetResolution";
async function runLocalImproveOnBlob(source, scaleFactor, onProgress, tuning, outputFormat = "png", opts) {
  onProgress(18);
  const enhanced = await enhanceImageLocally(source, tuning);
  onProgress(52);
  const scale = Math.min(4, Math.max(1, scaleFactor));
  let out = await upscaleCanvasBlob(enhanced, scale, { outputFormat });
  if (opts?.targetResolution?.trim()) {
    const bmp = await createImageBitmap(out);
    try {
      const td = calculateTargetDimensions(bmp.width, bmp.height, opts.targetResolution);
      if (td && (td.width !== bmp.width || td.height !== bmp.height)) {
        out = await resizeRasterBlobToPixelSize(out, td.width, td.height, outputFormat);
      }
    } finally {
      bmp.close();
    }
  }
  onProgress(88);
  return out;
}
async function runLocalEnhancePipeline(imageId, scaleFactor, onProgress, tuning, outputFormat = "png", opts) {
  onProgress(5);
  const original = await getLocalBlob(imageId);
  if (!original) throw new Error("Image not found in local storage");
  const finalBlob = await runLocalImproveOnBlob(
    original,
    scaleFactor,
    onProgress,
    tuning,
    outputFormat,
    opts
  );
  onProgress(94);
  const info = await addLocalVersion(imageId, finalBlob, "final");
  onProgress(100);
  return info;
}
export {
  runLocalEnhancePipeline,
  runLocalImproveOnBlob
};
