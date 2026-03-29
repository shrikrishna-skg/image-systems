import { jsx, jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { Archive, ImageIcon, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import { useImageStore } from "../../stores/imageStore";
import { toast } from "sonner";
import { MAX_WORKSPACE_ASSETS } from "../../lib/workspaceLimits";
import FullscreenImageRegion from "../media/FullscreenImageRegion";
import OptimizedImage from "../media/OptimizedImage";
function ArchiveThumb({ image }) {
  const latest = image.versions?.[image.versions.length - 1];
  const { blobUrl, loading } = useAuthenticatedImage(image.id, latest?.id ?? null);
  if (loading && !blobUrl) {
    return /* @__PURE__ */ jsx(Loader2, { className: "w-6 h-6 animate-spin text-neutral-400" });
  }
  if (!blobUrl) {
    return /* @__PURE__ */ jsx(ImageIcon, { className: "w-10 h-10 text-neutral-300", strokeWidth: 1.25 });
  }
  return /* @__PURE__ */ jsx(OptimizedImage, { lazy: true, src: blobUrl, alt: "", className: "h-full w-full object-cover" });
}
function WorkspaceArchivePanel() {
  const archived = useImageStore((s) => s.archivedWorkspaceImages);
  const removeArchivedWorkspaceImage = useImageStore((s) => s.removeArchivedWorkspaceImage);
  const restoreArchivedWorkspaceImage = useImageStore((s) => s.restoreArchivedWorkspaceImage);
  const clearWorkspaceArchive = useImageStore((s) => s.clearWorkspaceArchive);
  if (archived.length === 0) return null;
  return /* @__PURE__ */ jsxs("section", { className: "mt-8 rounded-2xl border border-neutral-200/90 bg-white p-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3 mb-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 min-w-0", children: [
        /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200", children: /* @__PURE__ */ jsx(Archive, { className: "h-5 w-5 text-black", strokeWidth: 2 }) }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold text-black", children: "Workspace archive" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-600 mt-1 leading-relaxed max-w-xl", children: "Snapshots from when you cleared the console. Thumbnails load from your library (cloud or this device)\u2014open one to keep editing, or remove it from this list only." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [
        /* @__PURE__ */ jsx(
          Link,
          {
            to: "/history",
            className: "text-xs font-semibold text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black",
            children: "Full library"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => {
              if (archived.length === 0) return;
              if (!confirm("Remove all workspace archive entries? Your files stay in History.")) return;
              clearWorkspaceArchive();
            },
            className: "text-xs font-medium text-neutral-500 hover:text-black px-2 py-1 rounded-lg hover:bg-neutral-100 transition-colors",
            children: "Clear list"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory", children: archived.map((entry) => {
      const v = entry.image.versions?.length ?? 0;
      return /* @__PURE__ */ jsxs(
        "article",
        {
          className: "snap-start shrink-0 w-[9.5rem] rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden flex flex-col",
          children: [
            /* @__PURE__ */ jsx("div", { className: "aspect-square bg-neutral-100 relative", children: /* @__PURE__ */ jsx(FullscreenImageRegion, { className: "absolute inset-0 h-full w-full", alwaysShowTrigger: true, children: /* @__PURE__ */ jsx(ArchiveThumb, { image: entry.image }) }) }),
            /* @__PURE__ */ jsxs("div", { className: "p-2 flex flex-col gap-1.5 flex-1", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-medium text-black truncate", title: entry.image.original_filename, children: entry.image.original_filename }),
              /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-neutral-500 font-data", children: [
                new Date(entry.archivedAt).toLocaleString(void 0, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                }),
                v > 0 ? ` \xB7 ${v} ver.` : ""
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex gap-1 mt-auto pt-1", children: [
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      const ok = restoreArchivedWorkspaceImage(entry.key);
                      if (!ok) {
                        toast.error("Workspace full", {
                          description: `Remove an asset or clear the console (${MAX_WORKSPACE_ASSETS} max), then open from archive.`
                        });
                      }
                    },
                    className: "flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-black text-white text-[10px] font-semibold hover:bg-neutral-800 transition-colors",
                    title: "Open in workspace",
                    children: [
                      /* @__PURE__ */ jsx(RotateCcw, { className: "w-3 h-3" }),
                      "Open"
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => removeArchivedWorkspaceImage(entry.key),
                    className: "p-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:text-black hover:bg-white transition-colors",
                    "aria-label": "Remove from archive",
                    children: /* @__PURE__ */ jsx(Trash2, { className: "w-3.5 h-3.5" })
                  }
                )
              ] })
            ] })
          ]
        },
        entry.key
      );
    }) })
  ] });
}
export {
  WorkspaceArchivePanel as default
};
