import { estimateAutoRotationRad } from "./perspectiveAuto";

/**
 * Roll (radians) for cloud jobs so the server can build the same perspective “plate” as Improve
 * (white corners) and attach CORNER_OUTPAINT instructions for OpenAI / Gemini.
 */
export async function computeAutoRotationRadForCloud(
  blob: Blob,
  perspective: string | null
): Promise<number | null> {
  if (perspective === "align_verticals_auto") {
    const bmp = await createImageBitmap(blob);
    try {
      return estimateAutoRotationRad(bmp, "verticals");
    } finally {
      bmp.close();
    }
  }
  if (perspective === "level_horizon_auto") {
    const bmp = await createImageBitmap(blob);
    try {
      return estimateAutoRotationRad(bmp, "horizon");
    } finally {
      bmp.close();
    }
  }
  return null;
}
