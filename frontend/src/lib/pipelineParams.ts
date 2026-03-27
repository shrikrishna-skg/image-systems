import type { FullPipelineRequest } from "../types";
import { computeAutoRotationRadForCloud } from "./cloudPerspectiveMeta";

export type PipelineStoreSnapshot = {
  provider: string;
  model: string;
  lighting: string | null;
  qualityPreset: string | null;
  perspective: string | null;
  roomType: string;
  customPrompt: string | null;
  quality: string;
  scaleFactor: number;
  targetResolution: string;
  outputFormat: string;
};

/** Snapshot shape from image store for pipeline POST bodies (no blob — omit auto roll). */
export function buildFullPipelineRequest(s: PipelineStoreSnapshot): FullPipelineRequest {
  return {
    provider: s.provider,
    model: s.model,
    lighting: s.lighting,
    quality_preset: s.qualityPreset,
    perspective: s.perspective,
    room_type: s.roomType,
    custom_prompt: s.customPrompt,
    quality: s.quality,
    scale_factor: s.scaleFactor,
    target_resolution: s.targetResolution,
    output_format: s.outputFormat,
  };
}

/** Cloud pipeline: attaches auto_rotation_rad when perspective uses browser Sobel alignment. */
export async function buildFullPipelineRequestWithBlob(
  s: PipelineStoreSnapshot,
  sourceBlob: Blob
): Promise<FullPipelineRequest> {
  const base = buildFullPipelineRequest(s);
  if (s.provider === "improve") return base;
  const rad = await computeAutoRotationRadForCloud(sourceBlob, s.perspective);
  if (rad == null) return base;
  return { ...base, auto_rotation_rad: rad };
}
