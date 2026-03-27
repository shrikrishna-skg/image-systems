import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Loader2, FolderPlus } from "lucide-react";
import { useWorkspaceFileImport } from "../../hooks/useWorkspaceFileImport";
import WorkspaceCapacityMeter from "./WorkspaceCapacityMeter";
import {
  IMAGE_MAX_BYTES,
  toastWorkspaceDropRejected,
  validateWorkspaceDropFile,
} from "../../lib/imageDropzone";

interface Props {
  disabled?: boolean;
}

export default function WorkspaceBulkImportStrip({ disabled }: Props) {
  const { importFiles, uploading, slots, sessionCount, isFull } = useWorkspaceFileImport();

  const onDrop = useCallback(
    async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        toastWorkspaceDropRejected(fileRejections);
      }
      if (acceptedFiles.length > 0) {
        await importFiles(acceptedFiles);
      }
    },
    [importFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    validator: validateWorkspaceDropFile,
    maxSize: IMAGE_MAX_BYTES,
    maxFiles: 0,
    disabled: disabled || uploading || isFull,
  });

  if (isFull) {
    return (
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3">
        <WorkspaceCapacityMeter used={sessionCount} />
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`rounded-2xl border border-dashed px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer transition-colors ${
        isDragActive
          ? "border-black bg-neutral-100"
          : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50/80"
      } ${disabled || uploading ? "opacity-50 pointer-events-none cursor-not-allowed" : ""}`}
    >
      <input {...getInputProps({ accept: "image/*,.svg,.heic,.heif,.avif,.jxl" })} />
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-black">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <FolderPlus className="h-5 w-5" strokeWidth={2} />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-black">
            {isDragActive ? "Drop to add to this batch" : "Add more listing photos"}
          </p>
          <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
            Multi-file drop OK — up to <strong className="text-black font-semibold">{slots}</strong> will fit (
            {sessionCount} already in workspace).
          </p>
        </div>
      </div>
      <WorkspaceCapacityMeter used={sessionCount} />
    </div>
  );
}
