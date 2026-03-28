import type { FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { IMAGE_MAX_BYTES } from "./ingestConfig";

export { IMAGE_MAX_BYTES };

/**
 * Dropzone gate: size only. Format is validated with magic-byte sniff + MIME heuristics in the ingest pipeline.
 */
export function validateWorkspaceDropFile(file: File): { message: string; code: string } | null {
  if (file.size > IMAGE_MAX_BYTES) {
    return { code: "file-too-large", message: "Larger than 50 MB" };
  }
  return null;
}

function formatRejectionSummary(fileRejections: FileRejection[]): string {
  const lines = fileRejections.slice(0, 4).map((r) => {
    const reasons = r.errors.map((e) => e.message).join(" · ");
    return `${r.file.name}: ${reasons}`;
  });
  const extra =
    fileRejections.length > 4 ? `\n… and ${fileRejections.length - 4} more` : "";
  return lines.join("\n") + extra;
}

export function toastWorkspaceDropRejected(fileRejections: FileRejection[]) {
  if (fileRejections.length === 0) return;
  const isTooMany = fileRejections.every((r) =>
    r.errors.some((e) => e.code === "too-many-files")
  );
  if (isTooMany) {
    toast.error("Too many files in one drop", {
      description: "Add files in smaller groups, or we’ll only take the first batch that fits your workspace.",
    });
    return;
  }
  toast.error("Some files weren’t added", {
    description: formatRejectionSummary(fileRejections),
  });
}
