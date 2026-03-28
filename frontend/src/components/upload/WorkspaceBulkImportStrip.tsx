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
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5">
        <WorkspaceCapacityMeter used={sessionCount} />
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`rounded-xl border border-dashed px-3 py-2.5 flex flex-row flex-wrap items-center gap-2.5 sm:gap-3 cursor-pointer transition-colors ${
        isDragActive
          ? "border-black bg-neutral-100"
          : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50/80"
      } ${disabled || uploading ? "opacity-50 pointer-events-none cursor-not-allowed" : ""}`}
    >
      <input {...getInputProps({ accept: "image/*,.svg,.heic,.heif,.avif,.jxl" })} />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-black">
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FolderPlus className="h-4 w-4" strokeWidth={2} />
        )}
      </span>
      <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
        <p className="text-[13px] font-semibold text-black leading-snug">
          {isDragActive ? "Drop to add to batch" : "Add more photos"}
        </p>
        <p className="text-[11px] text-neutral-600 mt-0.5 leading-snug">
          Multi-drop · up to <strong className="text-black font-semibold">{slots}</strong> slots · {sessionCount} in
          workspace
        </p>
      </div>
      <div className="shrink-0 ml-auto sm:ml-0">
        <WorkspaceCapacityMeter used={sessionCount} />
      </div>
    </div>
  );
}
