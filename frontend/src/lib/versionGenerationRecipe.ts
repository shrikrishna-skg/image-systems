import type { ImageVersion } from "../types";

export function labelJobType(t: string | null | undefined): string {
  if (!t) return "—";
  if (t === "full_pipeline") return "Full pipeline (enhance + upscale)";
  if (t === "enhance") return "Enhance only";
  if (t === "upscale") return "Upscale only";
  return t;
}

export function isLocalImproveVersion(v: ImageVersion): boolean {
  return v.provider === "improve" || v.model === "browser";
}

/** Key/value rows for “How this result was produced” (same data as the full card). */
export function buildGenerationRecipeRows(version: ImageVersion): { k: string; v: string }[] {
  const p = version.generation_params;
  const rows: { k: string; v: string }[] = [];

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
    rows.push({ k: "Perspective", v: String(p.perspective) });
  if (p?.room_type) rows.push({ k: "Room / scene", v: String(p.room_type) });
  if (p?.scale_factor != null) rows.push({ k: "Upscale", v: `${String(p.scale_factor)}×` });
  if (version.scale_factor != null && p?.scale_factor == null)
    rows.push({ k: "Upscale", v: `${version.scale_factor}×` });
  if (p?.target_resolution) rows.push({ k: "Target resolution", v: String(p.target_resolution) });
  if (p?.output_format) rows.push({ k: "Output format", v: String(p.output_format) });
  if (p?.custom_prompt != null && String(p.custom_prompt).trim())
    rows.push({ k: "Custom prompt", v: String(p.custom_prompt) });

  return rows;
}

export function promptTextForVersion(version: ImageVersion): string {
  const trimmed = version.prompt_used?.trim();
  if (trimmed) return trimmed;
  const p = version.generation_params;
  if (p != null && typeof p.prompt === "string" && p.prompt.trim().length > 0) return p.prompt.trim();
  return "";
}

export function hasPromptForVersion(version: ImageVersion): boolean {
  return promptTextForVersion(version).length > 0;
}
