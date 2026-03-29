function labelJobType(t) {
  if (!t) return "\u2014";
  if (t === "full_pipeline") return "Full pipeline (enhance + upscale)";
  if (t === "enhance") return "Enhance only";
  if (t === "upscale") return "Upscale only";
  return t;
}
function isLocalImproveVersion(v) {
  return v.provider === "improve" || v.model === "browser";
}
function labelPerspectivePreset(v) {
  if (v === "center_angle") return "Center angle";
  if (v === "change_angle_front") return "Front angle (includes center angle)";
  if (v === "change_angle_side") return "Side angle (end-of-room vantage)";
  if (v === "center_angle_auto") return "Side angle (legacy, centered)";
  return v;
}
function buildGenerationRecipeRows(version) {
  const p = version.generation_params;
  const rows = [];
  if (version.source_job_type) {
    rows.push({ k: "Run type", v: labelJobType(version.source_job_type) });
  }
  if (p?.provider) rows.push({ k: "Provider", v: String(p.provider) });
  if (version.provider && !p?.provider) rows.push({ k: "Provider", v: String(version.provider) });
  if (p?.model) rows.push({ k: "Model", v: String(p.model) });
  if (version.model && !p?.model) rows.push({ k: "Model", v: String(version.model) });
  if (p?.quality) rows.push({ k: "Quality", v: String(p.quality) });
  if (p?.lighting != null && p.lighting !== "") rows.push({ k: "Lighting", v: String(p.lighting) });
  if (p?.quality_preset != null && p.quality_preset !== "")
    rows.push({ k: "Quality preset", v: String(p.quality_preset) });
  if (p?.perspective != null && p.perspective !== "")
    rows.push({ k: "Perspective", v: labelPerspectivePreset(String(p.perspective)) });
  if (p?.room_type) rows.push({ k: "Room / scene", v: String(p.room_type) });
  if (p?.scale_factor != null) rows.push({ k: "Upscale", v: `${String(p.scale_factor)}\xD7` });
  if (version.scale_factor != null && p?.scale_factor == null)
    rows.push({ k: "Upscale", v: `${version.scale_factor}\xD7` });
  if (p?.target_resolution) rows.push({ k: "Target resolution", v: String(p.target_resolution) });
  if (p?.output_format) rows.push({ k: "Output format", v: String(p.output_format) });
  if (p?.custom_prompt != null && String(p.custom_prompt).trim())
    rows.push({ k: "Custom prompt", v: String(p.custom_prompt) });
  return rows;
}
function promptTextForVersion(version) {
  const trimmed = version.prompt_used?.trim();
  if (trimmed) return trimmed;
  const p = version.generation_params;
  if (p != null && typeof p.prompt === "string" && p.prompt.trim().length > 0) return p.prompt.trim();
  return "";
}
function hasPromptForVersion(version) {
  return promptTextForVersion(version).length > 0;
}
export {
  buildGenerationRecipeRows,
  hasPromptForVersion,
  isLocalImproveVersion,
  labelJobType,
  promptTextForVersion
};
