import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  Loader2,
  ImagePlus,
  Camera,
  SlidersHorizontal,
  Download,
  Link2,
  Sparkles,
  FolderOpen
} from "lucide-react";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import { MAX_WORKSPACE_ASSETS, WORKSPACE_UI_SHOW_SLASH_TOTAL } from "../../lib/workspaceLimits";
import { useWorkspaceFileImport } from "../../hooks/useWorkspaceFileImport";
import { useImageStore } from "../../stores/imageStore";
import WorkspaceCapacityMeter from "./WorkspaceCapacityMeter";
import WorkflowModePicker from "./WorkflowModePicker";
import {
  IMAGE_MAX_BYTES,
  toastWorkspaceDropRejected,
  validateWorkspaceDropFile
} from "../../lib/imageDropzone";
const IMPORT_FLOW_STEPS = [
  {
    step: "1",
    title: "Upload photos",
    body: "Drop files here, or use Import from URL / Generate with AI in the tabs above.",
    icon: Camera
  },
  {
    step: "2",
    title: "Enhance",
    body: "Pick lighting and upscale on Operations \u2014 the same settings apply to your whole batch in workspace mode.",
    icon: SlidersHorizontal
  },
  {
    step: "3",
    title: "Export",
    body: "Compare before and after, download, or open Deliverables for everything you\u2019ve saved.",
    icon: Download
  }
];
const DISMISS_IMPORT_STEPS_KEY = "imagesystems.dismissImportFlowSteps";
const DEMO_LISTING_URL = "https://www.example.com/";
function ImportFlowSteps({ onDismiss }) {
  return /* @__PURE__ */ jsxs("div", { className: "mt-6", children: [
    /* @__PURE__ */ jsx("ol", { className: "grid gap-3 sm:grid-cols-3", children: IMPORT_FLOW_STEPS.map(({ step, title, body, icon: Icon }) => /* @__PURE__ */ jsxs("li", { className: "flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 border border-neutral-200", children: /* @__PURE__ */ jsx(Icon, { className: "w-5 h-5", strokeWidth: 1.75 }) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("p", { className: "text-xs font-semibold text-neutral-500", children: [
          "Step ",
          step
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-black", children: title }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-500 mt-1 leading-snug", children: body })
      ] })
    ] }, step)) }),
    /* @__PURE__ */ jsx("p", { className: "mt-3 text-center", children: /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: onDismiss,
        className: "text-[11px] font-medium text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-black hover:decoration-black",
        children: "Hide guide"
      }
    ) })
  ] });
}
function InputMethodTabs({
  active,
  onChange
}) {
  const tabs = [
    { id: "upload", label: "Upload file", icon: Upload },
    { id: "url", label: "Import from URL", icon: Link2 },
    { id: "generate", label: "Generate with AI", icon: Sparkles }
  ];
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center rounded-2xl border border-neutral-200 bg-neutral-50/60 p-1.5",
      role: "tablist",
      "aria-label": "How to add images",
      children: tabs.map(({ id, label, icon: Icon }) => {
        const isOn = active === id;
        return /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": isOn,
            onClick: () => onChange(id),
            className: `flex min-h-[44px] flex-1 min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-all sm:min-w-[9rem] ${isOn ? "bg-black text-white shadow-sm" : "text-neutral-600 hover:bg-white hover:text-black border border-transparent"}`,
            children: [
              /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4 shrink-0", strokeWidth: 2, "aria-hidden": true }),
              /* @__PURE__ */ jsx("span", { className: "text-center leading-tight", children: label })
            ]
          },
          id
        );
      })
    }
  );
}
function UrlImportPanel() {
  return /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-white p-6 text-center max-w-lg mx-auto", children: [
    /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-black", children: "Pull images from any website" }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-neutral-600 leading-relaxed", children: "Paste a property listing, hotel page, or portfolio URL. We scan the page for image URLs you can import into your queue." }),
    /* @__PURE__ */ jsx(
      Link,
      {
        to: `/import-url?url=${encodeURIComponent(DEMO_LISTING_URL)}`,
        className: "mt-4 inline-block text-xs text-neutral-500 hover:text-black underline-offset-2 hover:underline",
        children: "Try a sample URL (replace with your own on the next screen)"
      }
    ),
    /* @__PURE__ */ jsx(
      Link,
      {
        to: "/import-url",
        className: "mt-6 inline-flex w-full min-h-[44px] items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors",
        children: "Open Import URL"
      }
    )
  ] });
}
function GeneratePanel() {
  return /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-white p-6 text-center max-w-lg mx-auto", children: [
    /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-black", children: "Type a prompt, get a photo" }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-neutral-600 leading-relaxed", children: "Describe a scene in plain English \u2014 interiors, exteriors, lifestyle \u2014 and the model creates a new image you can open on Operations like any upload." }),
    /* @__PURE__ */ jsx(
      Link,
      {
        to: "/image-generation",
        className: "mt-6 inline-flex w-full min-h-[44px] items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors",
        children: "Open Image Generation"
      }
    )
  ] });
}
function DropZone() {
  const { importFiles, uploading, slots, sessionCount, isFull } = useWorkspaceFileImport();
  const workspaceMode = useImageStore((s) => s.workspaceMode);
  const [importStepsDismissed, setImportStepsDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_IMPORT_STEPS_KEY) === "1"
  );
  const [inputTab, setInputTab] = useState("upload");
  const dismissImportSteps = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_IMPORT_STEPS_KEY, "1");
    } catch {
    }
    setImportStepsDismissed(true);
  }, []);
  const showImportSteps = !isFull && sessionCount === 0 && !importStepsDismissed;
  const storageOnly = isStorageOnlyMode();
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
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    validator: validateWorkspaceDropFile,
    maxSize: IMAGE_MAX_BYTES,
    maxFiles: 0,
    disabled: uploading || isFull,
    noClick: true,
    noKeyboard: true
  });
  const pasteImportEnabled = storageOnly || inputTab === "upload";
  useEffect(() => {
    if (!pasteImportEnabled || uploading || isFull) return;
    const onPaste = (e) => {
      const target = e.target;
      if (target instanceof Element && target.closest("input, textarea, [contenteditable='true']")) {
        return;
      }
      const cd = e.clipboardData;
      if (!cd?.items?.length) return;
      const files = [];
      for (let i = 0; i < cd.items.length; i++) {
        const item = cd.items[i];
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      const rejections = [];
      const accepted = [];
      for (const f of files) {
        const err = validateWorkspaceDropFile(f);
        if (err) {
          rejections.push({ file: f, errors: [{ code: err.code, message: err.message }] });
        } else {
          accepted.push(f);
        }
      }
      if (rejections.length > 0) {
        toastWorkspaceDropRejected(rejections);
      }
      if (accepted.length > 0) {
        void importFiles(accepted);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteImportEnabled, uploading, isFull, importFiles]);
  const dropAreaClass = `relative overflow-hidden border-2 border-dashed rounded-2xl p-6 sm:p-10 md:p-14 text-center transition-all duration-200 outline-none focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2 focus-within:ring-offset-white ${isDragActive ? "border-black bg-neutral-100 ring-1 ring-black/10" : "border-neutral-300 bg-white hover:border-black hover:bg-neutral-50"} ${uploading ? "opacity-50 pointer-events-none" : ""}`;
  const fullZoneInner = /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("input", { ...getInputProps({ accept: "image/*,.svg,.heic,.heif,.avif,.jxl" }) }),
    uploading ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
      /* @__PURE__ */ jsx(Loader2, { className: "w-12 h-12 text-black animate-spin mb-4", "aria-hidden": true }),
      /* @__PURE__ */ jsx("p", { className: "text-lg font-medium text-black", children: storageOnly ? "Importing to this browser\u2026" : workspaceMode ? "Uploading to your workspace\u2026" : "Uploading\u2026" })
    ] }) : isDragActive ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
      /* @__PURE__ */ jsx(ImagePlus, { className: "w-12 h-12 text-black mb-4", strokeWidth: 1.75, "aria-hidden": true }),
      /* @__PURE__ */ jsx("p", { className: "text-lg font-semibold text-black", children: workspaceMode ? "Release to add to the workspace" : "Release to import" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-600 mt-2 max-w-sm", children: workspaceMode ? WORKSPACE_UI_SHOW_SLASH_TOTAL ? `Drop as many as you need \u2014 we'll take up to ${slots} that fit this workspace (${MAX_WORKSPACE_ASSETS} max).` : `Drop as many as you need \u2014 we'll import up to ${slots.toLocaleString()} that fit this workspace.` : "Release to import your photo (single mode keeps one working file)." })
    ] }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center max-w-lg mx-auto", children: [
      /* @__PURE__ */ jsx("span", { className: "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600 border border-neutral-200", children: /* @__PURE__ */ jsx(Upload, { className: "w-7 h-7", strokeWidth: 1.75, "aria-hidden": true }) }),
      /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 mb-2", children: workspaceMode ? "Bulk import \xB7 listing photos" : "Single photo import" }),
      /* @__PURE__ */ jsx("p", { className: "text-lg font-semibold text-black mb-4", children: workspaceMode ? "Drag files here or browse" : "Drag a photo here or browse" }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => open(),
          disabled: uploading || isFull,
          className: "inline-flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none",
          children: [
            /* @__PURE__ */ jsx(FolderOpen, { className: "h-4 w-4", strokeWidth: 2, "aria-hidden": true }),
            "Browse files"
          ]
        }
      ),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-600 mt-4 leading-relaxed", children: workspaceMode ? /* @__PURE__ */ jsxs(Fragment, { children: [
        storageOnly ? "Files stay on this device (IndexedDB)." : "Uploads go to your account for AI enhancement and version history.",
        " ",
        /* @__PURE__ */ jsx("span", { className: "text-neutral-500", children: WORKSPACE_UI_SHOW_SLASH_TOTAL ? `Up to ${MAX_WORKSPACE_ASSETS} photos per batch queue.` : "Import large shoots; work batch-wise on Operations." })
      ] }) : /* @__PURE__ */ jsx(Fragment, { children: storageOnly ? "One image at a time \u2014 switch to bulk mode above when you need a queue." : "One photo at a time in single mode. Switch to bulk mode above to queue many files." }) }),
      workspaceMode && /* @__PURE__ */ jsx(WorkspaceCapacityMeter, { used: sessionCount, variant: "hero" }),
      pasteImportEnabled ? /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-500 mt-3 leading-snug", children: [
        /* @__PURE__ */ jsx("span", { className: "font-medium text-neutral-700", children: "Tip:" }),
        " paste a screenshot or copied image anywhere on this screen (upload tab) \u2014 it imports like a drop."
      ] }) : null,
      /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-400 mt-4", children: [
        "JPEG, PNG, WebP, TIFF, GIF, HEIC/AVIF, SVG, ICO, BMP, PSD, many RAW\u2026 \xB7",
        " ",
        workspaceMode ? "multi-file \xB7 " : "single file \xB7 ",
        "50MB each"
      ] })
    ] })
  ] });
  const core = /* @__PURE__ */ jsxs(Fragment, { children: [
    !storageOnly ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(WorkflowModePicker, { variant: "segmented" }),
      /* @__PURE__ */ jsx(InputMethodTabs, { active: inputTab, onChange: setInputTab })
    ] }) : null,
    !storageOnly && inputTab === "url" ? /* @__PURE__ */ jsx(UrlImportPanel, {}) : !storageOnly && inputTab === "generate" ? /* @__PURE__ */ jsx(GeneratePanel, {}) : /* @__PURE__ */ jsxs(Fragment, { children: [
      storageOnly ? /* @__PURE__ */ jsx(WorkflowModePicker, { variant: "segmented" }) : null,
      isFull ? /* @__PURE__ */ jsxs("div", { className: "relative overflow-hidden border-2 border-dashed border-amber-300 rounded-2xl p-10 md:p-12 text-center bg-amber-50/50 mt-4", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-amber-900", children: "Bulk queue is full" }),
        /* @__PURE__ */ jsxs("p", { className: "text-sm text-amber-800/90 mt-2 max-w-md mx-auto leading-relaxed", children: [
          "This session already holds ",
          MAX_WORKSPACE_ASSETS,
          " assets. Remove assets from the queue, clear the console, or switch to ",
          /* @__PURE__ */ jsx("strong", { className: "text-amber-950", children: "Single photo" }),
          " for one file at a time."
        ] }),
        /* @__PURE__ */ jsx(WorkspaceCapacityMeter, { used: sessionCount, variant: "hero" })
      ] }) : /* @__PURE__ */ jsx("div", { ...getRootProps({ className: dropAreaClass }), children: fullZoneInner })
    ] }),
    showImportSteps ? /* @__PURE__ */ jsx(ImportFlowSteps, { onDismiss: dismissImportSteps }) : null
  ] });
  return /* @__PURE__ */ jsx("div", { id: "operations-input", className: "w-full max-w-3xl mx-auto scroll-mt-24", children: core });
}
export {
  DropZone as default
};
