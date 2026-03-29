import client from "./client";
async function composeImagePrompt(params) {
  const res = await client.post("/image-generation/compose", params, {
    timeout: 12e4
  });
  return res.data;
}
async function generateImageFromDescription(params) {
  const { signal, ...body } = params;
  const res = await client.post("/image-generation/generate", body, {
    timeout: 9e5,
    signal
  });
  return res.data;
}
function uploadLikeToImageInfo(r) {
  return {
    id: r.id,
    original_filename: r.original_filename,
    width: r.width,
    height: r.height,
    file_size_bytes: r.file_size_bytes,
    mime_type: r.mime_type,
    created_at: r.created_at,
    versions: r.versions ?? []
  };
}
export {
  composeImagePrompt,
  generateImageFromDescription,
  uploadLikeToImageInfo
};
