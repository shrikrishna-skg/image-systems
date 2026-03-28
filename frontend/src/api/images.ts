import client from "./client";
import { mapPool } from "../lib/asyncPool";
import { NETWORK_CHUNK_FILES, NETWORK_UPLOAD_CONCURRENCY } from "../lib/ingestConfig";
import type {
  ImageInfo,
  JobInfo,
  FullPipelineRequest,
  CostEstimate,
  Presets,
  EnhancementRequest,
  UpscaleRequest,
} from "../types";

async function uploadImagesMultipart(files: File[]): Promise<ImageInfo[]> {
  if (files.length === 0) return [];
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await client.post<ImageInfo[]>("/images/upload", formData, {
    timeout: 600_000,
  });
  return res.data;
}

/**
 * Multipart batches with bounded concurrent requests — better throughput on high-latency links than one huge body.
 */
export async function uploadImages(files: File[]): Promise<ImageInfo[]> {
  if (files.length === 0) return [];
  if (files.length <= NETWORK_CHUNK_FILES) {
    return uploadImagesMultipart(files);
  }

  const chunks: File[][] = [];
  for (let i = 0; i < files.length; i += NETWORK_CHUNK_FILES) {
    chunks.push(files.slice(i, i + NETWORK_CHUNK_FILES));
  }

  const indexed = chunks.map((chunk, i) => ({ i, chunk }));
  const results = await mapPool(indexed, NETWORK_UPLOAD_CONCURRENCY, async ({ i, chunk }) => {
    const data = await uploadImagesMultipart(chunk);
    return { i, data };
  });
  results.sort((a, b) => a.i - b.i);
  return results.flatMap((r) => r.data);
}

export const processImage = async (imageId: string, params: FullPipelineRequest) => {
  const res = await client.post<JobInfo>(`/images/${imageId}/process`, params);
  return res.data;
};

/** Save browser-based Improve result as a new version (no API keys). */
export const postLocalImprove = async (imageId: string, blob: Blob) => {
  const form = new FormData();
  form.append("file", blob, "improve.png");
  const res = await client.post<ImageInfo>(`/images/${imageId}/local-improve`, form, {
    timeout: 120_000,
  });
  return res.data;
};

export const enhanceImage = async (imageId: string, params: EnhancementRequest) => {
  const res = await client.post<JobInfo>(`/images/${imageId}/enhance`, params);
  return res.data;
};

export const upscaleImage = async (imageId: string, params: UpscaleRequest) => {
  const res = await client.post<JobInfo>(`/images/${imageId}/upscale`, params);
  return res.data;
};

export const getImage = async (imageId: string) => {
  const res = await client.get<ImageInfo>(`/images/${imageId}`);
  return res.data;
};

export const listImages = async (skip = 0, limit = 20) => {
  const res = await client.get<ImageInfo[]>(`/images?skip=${skip}&limit=${limit}`);
  return res.data;
};

export const deleteImage = async (imageId: string) => {
  await client.delete(`/images/${imageId}`);
};

export const estimateCost = async (params: FullPipelineRequest) => {
  const res = await client.post<CostEstimate>("/images/estimate-cost", params);
  return res.data;
};

export const getPresets = async () => {
  const res = await client.get<Presets>("/images/presets");
  return res.data;
};

export interface SuggestFilenameResult {
  basename: string;
  model?: string | null;
  prompt_tokens?: number | null;
  output_tokens?: number | null;
  estimated_cost_usd?: number | null;
  cost_note?: string | null;
}

export async function suggestFilename(
  imageId: string,
  params: { version?: string | null; provider?: string }
): Promise<SuggestFilenameResult> {
  const res = await client.post<SuggestFilenameResult>(`/images/${imageId}/suggest-filename`, {
    version: params.version ?? null,
    provider: params.provider ?? "gemini",
  });
  return res.data;
}

export const getDownloadUrl = (imageId: string, versionId?: string) => {
  const base =
    (typeof import.meta.env.VITE_API_BASE_URL === "string"
      ? import.meta.env.VITE_API_BASE_URL.trim()
      : "") || "/api";
  let url = `${base}/images/${imageId}/download`;
  if (versionId) url += `?version=${versionId}`;
  return url;
};
