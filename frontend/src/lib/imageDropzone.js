import { toast } from "sonner";
import { IMAGE_MAX_BYTES } from "./ingestConfig";
function validateWorkspaceDropFile(file) {
  if (file.size > IMAGE_MAX_BYTES) {
    return { code: "file-too-large", message: "Larger than 50 MB" };
  }
  return null;
}
function formatRejectionSummary(fileRejections) {
  const lines = fileRejections.slice(0, 4).map((r) => {
    const reasons = r.errors.map((e) => e.message).join(" \xB7 ");
    return `${r.file.name}: ${reasons}`;
  });
  const extra = fileRejections.length > 4 ? `
\u2026 and ${fileRejections.length - 4} more` : "";
  return lines.join("\n") + extra;
}
function toastWorkspaceDropRejected(fileRejections) {
  if (fileRejections.length === 0) return;
  const isTooMany = fileRejections.every(
    (r) => r.errors.some((e) => e.code === "too-many-files")
  );
  if (isTooMany) {
    toast.error("Too many files in one drop", {
      description: "Add files in smaller groups, or we\u2019ll only take the first batch that fits your workspace."
    });
    return;
  }
  toast.error("Some files weren\u2019t added", {
    description: formatRejectionSummary(fileRejections)
  });
}
export {
  IMAGE_MAX_BYTES,
  toastWorkspaceDropRejected,
  validateWorkspaceDropFile
};
