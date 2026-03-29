import { getLatestImageVersion } from "./imageVersions";
function workspaceImageSyncFingerprint(img) {
  const latest = getLatestImageVersion(img.versions);
  return [
    img.id,
    img.original_filename,
    String(img.width ?? ""),
    String(img.height ?? ""),
    String(img.file_size_bytes ?? ""),
    String(img.versions?.length ?? 0),
    latest?.id ?? "",
    latest?.version_type ?? "",
    String(latest?.width ?? ""),
    String(latest?.height ?? "")
  ].join("");
}
export {
  workspaceImageSyncFingerprint
};
