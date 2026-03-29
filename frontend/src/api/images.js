import client from "./client";
import { mapPool } from "../lib/asyncPool";
import { NETWORK_CHUNK_FILES, NETWORK_UPLOAD_CONCURRENCY } from "../lib/ingestConfig";
async function uploadImagesMultipart(files) {
  if (files.length === 0) return [];
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await client.post("/images/upload", formData, {
    timeout: 6e5
  });
  return res.data;
}
async function uploadImages(files) {
  if (files.length === 0) return [];
  if (files.length <= NETWORK_CHUNK_FILES) {
    return uploadImagesMultipart(files);
  }
  const chunks = [];
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
const processImage = async (imageId, params) => {
  const res = await client.post(`/images/${imageId}/process`, params);
  return res.data;
};
const IMPROVE_UPLOAD_EXT = {
  png: "png",
  jpeg: "jpg",
  webp: "webp"
};
const postLocalImprove = async (imageId, blob, outputFormat = "png") => {
  const form = new FormData();
  const ext = IMPROVE_UPLOAD_EXT[outputFormat];
  form.append("file", blob, `improve.${ext}`);
  const res = await client.post(`/images/${imageId}/local-improve`, form, {
    timeout: 12e4
  });
  return res.data;
};
const enhanceImage = async (imageId, params) => {
  const res = await client.post(`/images/${imageId}/enhance`, params);
  return res.data;
};
const upscaleImage = async (imageId, params) => {
  const res = await client.post(`/images/${imageId}/upscale`, params);
  return res.data;
};
const getImage = async (imageId) => {
  const res = await client.get(`/images/${imageId}`);
  return res.data;
};
const listImages = async (skip = 0, limit = 20) => {
  const res = await client.get(`/images?skip=${skip}&limit=${limit}`);
  return res.data;
};
const deleteImage = async (imageId) => {
  await client.delete(`/images/${imageId}`);
};
const estimateCost = async (params) => {
  const res = await client.post("/images/estimate-cost", params);
  return res.data;
};
const getPresets = async () => {
  const res = await client.get("/images/presets");
  return res.data;
};
async function suggestFilename(imageId, params) {
  const res = await client.post(
    `/images/${imageId}/suggest-filename`,
    {
      version: params.version ?? null,
      provider: params.provider ?? "gemini"
    },
    { timeout: 12e4 }
  );
  return res.data;
}
const getDownloadUrl = (imageId, versionId) => {
  const base = (typeof import.meta.env.VITE_API_BASE_URL === "string" ? import.meta.env.VITE_API_BASE_URL.trim() : "") || "/api";
  let url = `${base}/images/${imageId}/download`;
  if (versionId) url += `?version=${versionId}`;
  return url;
};
export {
  deleteImage,
  enhanceImage,
  estimateCost,
  getDownloadUrl,
  getImage,
  getPresets,
  listImages,
  postLocalImprove,
  processImage,
  suggestFilename,
  uploadImages,
  upscaleImage
};
