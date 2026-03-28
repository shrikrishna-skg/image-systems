import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, Loader2, ImagePlus, Camera, SlidersHorizontal, Download } from "lucide-react";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import { MAX_WORKSPACE_ASSETS, WORKSPACE_UI_SHOW_SLASH_TOTAL } from "../../lib/workspaceLimits";
import { useWorkspaceFileImport } from "../../hooks/useWorkspaceFileImport";
import { useImageStore } from "../../stores/imageStore";
import WorkspaceCapacityMeter from "./WorkspaceCapacityMeter";
import WorkflowModePicker from "./WorkflowModePicker";
import {
  IMAGE_MAX_BYTES,
  toastWorkspaceDropRejected,
  validateWorkspaceDropFile,
} from "../../lib/imageDropzone";

const IMPORT_FLOW_STEPS = [
  {
    step: "1",
    title: "Choose flow",
    body: "Standard: one photo. Workspace batch: queue many on the home screen before you import.",
    icon: Camera,
  },
  {
    step: "2",
    title: "Tune",
    body: "Pick lighting, provider, and upscale — one profile applies to your run (or whole batch).",
    icon: SlidersHorizontal,
  },
  {
    step: "3",
    title: "Deliver",
    body: "Compare before/after, download versions, or hand off to your DAM.",
    icon: Download,
  },
] as const;

const DISMISS_IMPORT_STEPS_KEY = "imagesystems.dismissImportFlowSteps";

function ImportFlowSteps({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mt-6">
      <ol className="grid gap-3 sm:grid-cols-3">
        {IMPORT_FLOW_STEPS.map(({ step, title, body, icon: Icon }) => (
          <li key={step} className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 border border-neutral-200">
              <Icon className="w-5 h-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-xs font-semibold text-neutral-500">Step {step}</p>
              <p className="text-sm font-semibold text-black">{title}</p>
              <p className="text-xs text-neutral-500 mt-1 leading-snug">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-center">
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] font-medium text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-black hover:decoration-black"
        >
          Hide these steps
        </button>
      </p>
    </div>
  );
}

function CloudQuickLinks() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
      <Link
        to="/import-url"
        className="font-semibold text-[#3B82F6] decoration-[#93C5FD] underline-offset-2 hover:underline"
      >
        Import from URL
      </Link>
      <span className="text-neutral-300 hidden sm:inline" aria-hidden>
        ·
      </span>
      <Link
        to="/image-generation"
        className="font-semibold text-[#3B82F6] decoration-[#93C5FD] underline-offset-2 hover:underline"
      >
        Image generation
      </Link>
    </div>
  );
}

export default function DropZone() {
  const { importFiles, uploading, slots, sessionCount, isFull } = useWorkspaceFileImport();
  const workspaceMode = useImageStore((s) => s.workspaceMode);
  const [importStepsDismissed, setImportStepsDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_IMPORT_STEPS_KEY) === "1"
  );

  const dismissImportSteps = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_IMPORT_STEPS_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
    setImportStepsDismissed(true);
  }, []);

  const showImportSteps = !isFull && sessionCount === 0 && !importStepsDismissed;
  const storageOnly = isStorageOnlyMode();

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

  const dropAreaClass = `relative overflow-hidden border-2 border-dashed rounded-2xl p-14 md:p-16 text-center cursor-pointer transition-all duration-200 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
    isDragActive
      ? "border-black bg-neutral-100 ring-1 ring-black/10"
      : "border-neutral-300 bg-white hover:border-black hover:bg-neutral-50"
  } ${uploading ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`;

  if (isFull) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <WorkflowModePicker variant="cards" />
        {!storageOnly ? <CloudQuickLinks /> : null}
        <div className="relative overflow-hidden border-2 border-dashed border-amber-300 rounded-2xl p-10 md:p-12 text-center bg-amber-50/50 mt-4">
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
      {!storageOnly ? <CloudQuickLinks /> : null}
      <div
        {...getRootProps({
          className: dropAreaClass,
          "aria-label": workspaceMode
            ? "Drop images here or press Enter or Space to choose files for workspace import"
            : "Drop one image here or press Enter or Space to choose a file",
        })}
      >
        <input {...getInputProps({ accept: "image/*,.svg,.heic,.heif,.avif,.jxl" })} />

        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-black animate-spin mb-4" aria-hidden />
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
            <ImagePlus className="w-12 h-12 text-black mb-4" strokeWidth={1.75} aria-hidden />
            <p className="text-lg font-semibold text-black">
              {workspaceMode ? "Release to add to the workspace" : "Release to import"}
            </p>
            <p className="text-sm text-neutral-600 mt-2 max-w-sm">
              {workspaceMode
                ? WORKSPACE_UI_SHOW_SLASH_TOTAL
                  ? `Drop as many as you need — we'll take up to ${slots} that fit this workspace (${MAX_WORKSPACE_ASSETS} max).`
                  : `Drop as many as you need — we'll import up to ${slots.toLocaleString()} that fit this workspace.`
                : "Release to import your photo (standard mode keeps one working file)."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center max-w-lg mx-auto">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600 border border-neutral-200">
              <Upload className="w-7 h-7" strokeWidth={1.75} aria-hidden />
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
                  <span className="text-neutral-500">
                    {WORKSPACE_UI_SHOW_SLASH_TOTAL
                      ? `Up to ${MAX_WORKSPACE_ASSETS} assets per workspace.`
                      : "Import large shoots; work batch-wise on Operations."}
                  </span>
                </>
              ) : (
                <>
                  {storageOnly
                    ? "One image at a time in this browser — switch to workspace batch above when you need a queue."
                    : "One image at a time in standard mode. Switch to workspace batch above to import many files at once."}
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
      {showImportSteps ? <ImportFlowSteps onDismiss={dismissImportSteps} /> : null}
    </div>
  );
}
