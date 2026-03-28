import client from "./client";
import type { ImageInfo, ImageVersion } from "../types";

export type ImageGenProvider = "openai" | "gemini";

export interface ImageGenerationComposeResponse {
  interpreted_prompt: string;
  short_title: string;
}

export interface ImageGenerationGenerateResponse extends ImageInfo {
  resolved_prompt: string;
  used_interpretation: boolean;
}

export async function composeImagePrompt(params: {
  user_request: string;
  provider: ImageGenProvider;
}): Promise<ImageGenerationComposeResponse> {
  const res = await client.post<ImageGenerationComposeResponse>("/image-generation/compose", params, {
    timeout: 120_000,
  });
  return res.data;
}

export async function generateImageFromDescription(params: {
  description: string;
  provider: ImageGenProvider;
  interpret: boolean;
  model: string;
  quality: string;
  output_format: "png" | "jpeg" | "webp";
  run_enhancement_pipeline?: boolean;
}): Promise<ImageGenerationGenerateResponse> {
  const res = await client.post<ImageGenerationGenerateResponse>("/image-generation/generate", params, {
    timeout: 900_000,
  });
  return res.data;
}

/** Normalize API image payload to store ImageInfo (versions may be empty). */
export function uploadLikeToImageInfo(r: {
  id: string;
  original_filename: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
  versions?: ImageVersion[];
}): ImageInfo {
  return {
    id: r.id,
    original_filename: r.original_filename,
    width: r.width,
    height: r.height,
    file_size_bytes: r.file_size_bytes,
    mime_type: r.mime_type,
    created_at: r.created_at,
    versions: r.versions ?? [],
  };
}
