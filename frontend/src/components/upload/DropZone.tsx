import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, Loader2, ImagePlus } from "lucide-react";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import { MAX_WORKSPACE_ASSETS } from "../../lib/workspaceLimits";
import { useWorkspaceFileImport } from "../../hooks/useWorkspaceFileImport";
import { useImageStore } from "../../stores/imageStore";
import WorkspaceCapacityMeter from "./WorkspaceCapacityMeter";
import WorkflowModePicker from "./WorkflowModePicker";
import {
  IMAGE_MAX_BYTES,
  toastWorkspaceDropRejected,
  validateWorkspaceDropFile,
} from "../../lib/imageDropzone";

export default function DropZone() {
  const { importFiles, uploading, slots, sessionCount, isFull } = useWorkspaceFileImport();
  const workspaceMode = useImageStore((s) => s.workspaceMode);

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
    /** 0 = no per-drop file count limit; workspace cap is enforced in import (avoids rejecting entire multi-file drops). */
    maxFiles: 0,
    disabled: uploading || isFull,
  });

  const storageOnly = isStorageOnlyMode();

  if (isFull) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <WorkflowModePicker variant="cards" />
        <div className="relative overflow-hidden border-2 border-dashed border-amber-300 rounded-2xl p-10 md:p-12 text-center bg-amber-50/50">
          <p className="text-sm font-semibold text-amber-900">Workspace batch is full</p>
          <p className="text-sm text-amber-800/90 mt-2 max-w-md mx-auto leading-relaxed">
            This session already holds {MAX_WORKSPACE_ASSETS} assets. Remove assets from the queue, clear the
            console, or switch to <strong className="text-amber-950">Standard</strong> for one photo at a time.
          </p>
          <WorkspaceCapacityMeter used={sessionCount} variant="hero" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <WorkflowModePicker variant="cards" />
      <div
      {...getRootProps()}
      className={`relative overflow-hidden border-2 border-dashed rounded-2xl p-14 md:p-16 text-center cursor-pointer transition-all duration-200 ${
        isDragActive
          ? "border-black bg-neutral-100 ring-1 ring-black/10"
          : "border-neutral-300 bg-white hover:border-black hover:bg-neutral-50"
      } ${uploading ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
    >
      <input {...getInputProps({ accept: "image/*,.svg,.heic,.heif,.avif,.jxl" })} />

      {uploading ? (
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-black animate-spin mb-4" />
          <p className="text-lg font-medium text-black">
            {storageOnly
              ? "Importing to this browser…"
              : workspaceMode
                ? "Uploading to your workspace…"
                : "Uploading…"}
          </p>
        </div>
      ) : isDragActive ? (
        <div className="flex flex-col items-center">
          <ImagePlus className="w-12 h-12 text-black mb-4" strokeWidth={1.75} />
          <p className="text-lg font-semibold text-black">
            {workspaceMode ? "Release to add to the workspace" : "Release to import"}
          </p>
          <p className="text-sm text-neutral-600 mt-2 max-w-sm">
            {workspaceMode
              ? `Drop as many as you need — we'll take up to ${slots} that fit this workspace (${MAX_WORKSPACE_ASSETS} max).`
              : "Release to replace your working photo (standard mode uses one file)."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center max-w-lg mx-auto">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600 border border-neutral-200">
            <Upload className="w-7 h-7" strokeWidth={1.75} />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 mb-2">
            {workspaceMode ? "Workspace import · listing photos" : "Standard import · single photo"}
          </p>
          <p className="text-lg font-semibold text-black mb-2">
            {workspaceMode ? "Drop a shoot or browse files" : "Drop a photo or browse"}
          </p>
          <p className="text-sm text-neutral-600 mb-4 leading-relaxed">
            {workspaceMode ? (
              <>
                {storageOnly
                  ? "Files stay on this device (IndexedDB). Perfect for comps and offline demos."
                  : "Uploads go to your account for AI enhancement and version history."}{" "}
                <span className="text-neutral-500">Up to {MAX_WORKSPACE_ASSETS} assets per workspace.</span>
              </>
            ) : (
              <>
                {storageOnly
                  ? "One image at a time in this browser — no queue until you switch to workspace batch above."
                  : "One image at a time. Switch to workspace batch when you need a multi-asset queue."}
              </>
            )}
          </p>
          {workspaceMode && <WorkspaceCapacityMeter used={sessionCount} variant="hero" />}
          <p className="text-xs text-neutral-400 mt-4">
            JPEG, PNG, WebP, TIFF, GIF, HEIC/AVIF, SVG, ICO, BMP, PSD, many RAW… ·{" "}
            {workspaceMode ? "multi-file · " : "single file · "}
            50MB each
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
