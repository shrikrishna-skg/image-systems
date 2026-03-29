import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Loader2, FolderPlus } from "lucide-react";
import { useWorkspaceFileImport } from "../../hooks/useWorkspaceFileImport";
import WorkspaceCapacityMeter from "./WorkspaceCapacityMeter";
import {
  IMAGE_MAX_BYTES,
  toastWorkspaceDropRejected,
  validateWorkspaceDropFile
} from "../../lib/imageDropzone";
function WorkspaceBulkImportStrip({ disabled }) {
  const { importFiles, uploading, slots, sessionCount, isFull } = useWorkspaceFileImport();
  const onDrop = useCallback(
    async (acceptedFiles, fileRejections) => {
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
    disabled: disabled || uploading || isFull
  });
  if (isFull) {
    return /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5", children: /* @__PURE__ */ jsx(WorkspaceCapacityMeter, { used: sessionCount }) });
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ...getRootProps(),
      className: `rounded-xl border border-dashed px-3 py-2.5 flex flex-row flex-wrap items-center gap-2.5 sm:gap-3 cursor-pointer transition-colors ${isDragActive ? "border-black bg-neutral-100" : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50/80"} ${disabled || uploading ? "opacity-50 pointer-events-none cursor-not-allowed" : ""}`,
      children: [
        /* @__PURE__ */ jsx("input", { ...getInputProps({ accept: "image/*,.svg,.heic,.heif,.avif,.jxl" }) }),
        /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-black", children: uploading ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx(FolderPlus, { className: "h-4 w-4", strokeWidth: 2 }) }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 basis-[min(100%,12rem)]", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[13px] font-semibold text-black leading-snug", children: isDragActive ? "Drop to add to batch" : "Add more photos" }),
          /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-neutral-600 mt-0.5 leading-snug", children: [
            "Multi-drop \xB7 up to ",
            /* @__PURE__ */ jsx("strong", { className: "text-black font-semibold", children: slots }),
            " slots \xB7 ",
            sessionCount,
            " in workspace"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "shrink-0 ml-auto sm:ml-0", children: /* @__PURE__ */ jsx(WorkspaceCapacityMeter, { used: sessionCount }) })
      ]
    }
  );
}
export {
  WorkspaceBulkImportStrip as default
};
