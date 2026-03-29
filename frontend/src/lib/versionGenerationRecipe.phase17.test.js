import { describe, expect, it } from "vitest";
import { buildGenerationRecipeRows } from "./versionGenerationRecipe";
describe("Phase 17 \u2014 generation recipe / upscale label consistency", () => {
  it("prefers generation_params.scale_factor for Upscale row when both are set", () => {
    const v = {
      id: "v1",
      image_id: "i1",
      version_type: "final",
      storage_path: "/x",
      width: 2e3,
      height: 1500,
      file_size_bytes: 100,
      provider: "replicate",
      model: "esrgan",
      prompt_used: null,
      processing_cost_usd: 0,
      scale_factor: 4,
      source_job_type: "full_pipeline",
      generation_params: {
        scale_factor: 2,
        provider: "openai"
      },
      created_at: "2026-01-01T00:00:00"
    };
    const rows = buildGenerationRecipeRows(v);
    const up = rows.find((r) => r.k === "Upscale");
    expect(up?.v).toBe("2\xD7");
  });
  it("falls back to version.scale_factor when params omit scale", () => {
    const v = {
      id: "v2",
      image_id: "i1",
      version_type: "final",
      storage_path: "/x",
      width: 1e3,
      height: 800,
      file_size_bytes: 50,
      provider: "replicate",
      model: "esrgan",
      prompt_used: null,
      processing_cost_usd: 0,
      scale_factor: 3,
      source_job_type: "upscale",
      generation_params: { provider: "openai" },
      created_at: "2026-01-01T00:00:00"
    };
    const rows = buildGenerationRecipeRows(v);
    const up = rows.find((r) => r.k === "Upscale");
    expect(up?.v).toBe("3\xD7");
  });
});
