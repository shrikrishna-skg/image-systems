import { computeAutoRotationRadForCloud } from "./cloudPerspectiveMeta";
function buildFullPipelineRequest(s) {
  return {
    provider: s.provider,
    model: s.model,
    lighting: s.lighting,
    quality_preset: s.qualityPreset,
    perspective: s.perspective,
    room_type: s.roomType,
    custom_prompt: s.customPrompt,
    quality: "high",
    scale_factor: s.scaleFactor,
    target_resolution: s.targetResolution,
    output_format: s.outputFormat
  };
}
async function buildFullPipelineRequestWithBlob(s, sourceBlob) {
  const base = buildFullPipelineRequest(s);
  if (s.provider === "improve") return base;
  const rad = await computeAutoRotationRadForCloud(sourceBlob, s.perspective);
  if (rad == null) return base;
  return { ...base, auto_rotation_rad: rad };
}
export {
  buildFullPipelineRequest,
  buildFullPipelineRequestWithBlob
};
