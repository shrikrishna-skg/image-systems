import client from "./client";
import type { ImageInfo, JobInfo, FullPipelineRequest, CostEstimate, Presets } from "../types";

export const uploadImages = async (files: File[]) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await client.post<ImageInfo[]>("/images/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const processImage = async (imageId: string, params: FullPipelineRequest) => {
  const res = await client.post<JobInfo>(`/images/${imageId}/process`, params);
  return res.data;
};

export const enhanceImage = async (imageId: string, params: any) => {
  const res = await client.post<JobInfo>(`/images/${imageId}/enhance`, params);
  return res.data;
};

export const upscaleImage = async (imageId: string, params: any) => {
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

export const getDownloadUrl = (imageId: string, versionId?: string) => {
  const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
  const token = localStorage.getItem("access_token");
  let url = `${base}/images/${imageId}/download`;
  if (versionId) url += `?version=${versionId}`;
  return url;
};
