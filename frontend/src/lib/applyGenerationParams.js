import { useImageStore } from "../stores/imageStore";
function str(v) {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return String(v);
}
function applyGenerationParamsToStore(params) {
  if (!params || typeof params !== "object") return;
  const s = useImageStore.getState();
  const provider = str(params.provider);
  if (provider) s.setProvider(provider);
  const model = str(params.model);
  if (model) s.setModel(model);
  if ("lighting" in params) s.setLighting(str(params.lighting));
  if ("quality_preset" in params) s.setQualityPreset(str(params.quality_preset));
  if ("perspective" in params) {
    let p = str(params.perspective);
    if (p === "center_angle_auto") p = "change_angle_side";
    s.setPerspective(p);
  }
  const room = str(params.room_type);
  if (room) s.setRoomType(room);
  if ("custom_prompt" in params) s.setCustomPrompt(str(params.custom_prompt));
  s.setQuality("high");
  if (params.scale_factor != null) {
    const n = Number(params.scale_factor);
    if (n === 2 || n === 4) s.setScaleFactor(n);
  }
  const target = str(params.target_resolution);
  if (target) s.setTargetResolution(target);
  const fmt = str(params.output_format);
  if (fmt) s.setOutputFormat(fmt);
}
function applyVersionRecipeToStore(version) {
  const p = version.generation_params;
  if (p && typeof p === "object" && Object.keys(p).length > 0) {
    applyGenerationParamsToStore(p);
  }
}
export {
  applyGenerationParamsToStore,
  applyVersionRecipeToStore
};
