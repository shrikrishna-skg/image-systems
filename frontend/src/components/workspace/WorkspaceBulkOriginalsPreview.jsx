import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { memo, useCallback } from "react";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import { getLatestImageVersion } from "../../lib/imageVersions";
import { workspaceImageSyncFingerprint } from "../../lib/workspaceImageFingerprint";
import { WORKSPACE_GRID_VIRTUAL_THRESHOLD } from "../../lib/workspaceGridVirtual";
import VirtualizedWorkspaceThumbGrid from "./VirtualizedWorkspaceThumbGrid";
import { Loader2, ArrowLeft, X } from "lucide-react";
function areThumbCellPropsEqual(a, b) {
  return a.image.id === b.image.id && a.selected === b.selected && a.isFs === b.isFs && a.removeDisabled === b.removeDisabled && workspaceImageSyncFingerprint(a.image) === workspaceImageSyncFingerprint(b.image) && a.onActivate === b.onActivate && a.onRemove === b.onRemove;
}
const ThumbCell = memo(function ThumbCell2({
  image,
  selected,
  isFs,
  onActivate,
  onRemove,
  removeDisabled
}) {
  const latest = getLatestImageVersion(image.versions);
  const { blobUrl, loading } = useAuthenticatedImage(image.id, latest?.id ?? null);
  const selectedRing = isFs ? "ring-2 ring-white ring-offset-2 ring-offset-black" : "ring-2 ring-black ring-offset-2 ring-offset-white";
  const idleRing = isFs ? "ring-1 ring-white/25 hover:ring-white/45" : "ring-1 ring-neutral-200 hover:ring-neutral-400";
  const showRemove = Boolean(onRemove) && !removeDisabled;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `group relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-200 outline-none transition-shadow focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2 ${selected ? selectedRing : idleRing} ${isFs ? "focus-within:ring-white focus-within:ring-offset-black" : "focus-within:ring-offset-white"}`,
      children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => onActivate(image.id),
            title: `Open ${image.original_filename} full screen`,
            className: "relative block h-full w-full text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black motion-reduce:transition-none",
            children: [
              loading ? /* @__PURE__ */ jsx("div", { className: "flex h-full w-full items-center justify-center bg-neutral-100", children: /* @__PURE__ */ jsx(Loader2, { className: "h-6 w-6 animate-spin text-neutral-400", "aria-hidden": true }) }) : blobUrl ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx(
                  "img",
                  {
                    src: blobUrl,
                    alt: "",
                    className: "h-full w-full object-cover transition-transform group-hover:scale-[1.02] motion-reduce:group-hover:scale-100",
                    loading: "lazy"
                  }
                ),
                latest && /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: `pointer-events-none absolute bottom-1 right-1 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${isFs ? "bg-white/90 text-black" : "bg-emerald-600/90 text-white"}`,
                    children: "Output"
                  }
                )
              ] }) : /* @__PURE__ */ jsx("div", { className: "flex h-full w-full items-center justify-center bg-neutral-100 px-1 text-center text-[10px] text-neutral-500", children: "No preview" }),
              /* @__PURE__ */ jsx("span", { className: "sr-only", children: image.original_filename })
            ]
          }
        ),
        showRemove ? /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: (e) => {
              e.stopPropagation();
              onRemove(image.id);
            },
            className: `absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-md border text-white shadow-md backdrop-blur-sm transition-opacity motion-reduce:transition-none max-sm:opacity-100 max-sm:hover:bg-black/85 ${isFs ? "border-white/30 bg-black/55 sm:opacity-0 sm:hover:bg-black/75 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" : "border-black/10 bg-neutral-900/75 sm:opacity-0 sm:hover:bg-neutral-900 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"}`,
            title: `Remove ${image.original_filename} from workspace`,
            "aria-label": `Remove ${image.original_filename} from workspace`,
            children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4", strokeWidth: 2.5, "aria-hidden": true })
          }
        ) : null
      ]
    }
  );
}, areThumbCellPropsEqual);
function SingleOriginalView({
  image,
  onBackToGrid
}) {
  const latest = getLatestImageVersion(image.versions);
  const { blobUrl, loading } = useAuthenticatedImage(image.id, latest?.id ?? null);
  return /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 flex-1 flex-col bg-black text-white", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center gap-2 border-b border-white/10 px-2 py-2 sm:px-3", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: onBackToGrid,
          className: "inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-3.5 w-3.5", strokeWidth: 2 }),
            "All photos"
          ]
        }
      ),
      /* @__PURE__ */ jsxs("span", { className: "min-w-0 flex-1 truncate text-center text-xs font-medium text-white/90 sm:text-sm", children: [
        image.original_filename,
        latest ? /* @__PURE__ */ jsx("span", { className: "ml-1.5 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90", children: "Output" }) : null
      ] }),
      /* @__PURE__ */ jsx("span", { className: "w-16 shrink-0 sm:w-24", "aria-hidden": true })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4", children: loading ? /* @__PURE__ */ jsx(Loader2, { className: "h-10 w-10 animate-spin text-white/50", "aria-hidden": true }) : blobUrl ? /* @__PURE__ */ jsx(
      "img",
      {
        src: blobUrl,
        alt: image.original_filename,
        className: "max-h-[calc(100dvh-5rem)] max-w-full object-contain"
      }
    ) : /* @__PURE__ */ jsx("p", { className: "text-sm text-white/60", children: "Preview unavailable" }) })
  ] });
}
function WorkspaceBulkOriginalsPreview({
  images,
  selectedId,
  isFullscreen,
  layout,
  focusImageId,
  onThumbnailActivate,
  onBackToFullscreenGrid,
  onRemoveFromWorkspace,
  removeDisabled
}) {
  const singleMeta = focusImageId ? images.find((i) => i.id === focusImageId) : null;
  const gridClass = isFullscreen ? "grid flex-1 auto-rows-fr grid-cols-3 gap-3 overflow-y-auto p-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 content-start sm:gap-4" : "grid max-h-[min(52vh,520px)] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-2.5";
  const renderThumb = useCallback(
    (img) => /* @__PURE__ */ jsx(
      ThumbCell,
      {
        image: img,
        selected: selectedId === img.id,
        isFs: isFullscreen,
        onActivate: onThumbnailActivate,
        onRemove: onRemoveFromWorkspace,
        removeDisabled
      }
    ),
    [selectedId, isFullscreen, onThumbnailActivate, onRemoveFromWorkspace, removeDisabled]
  );
  if (isFullscreen && layout === "single" && focusImageId && singleMeta) {
    return /* @__PURE__ */ jsx(SingleOriginalView, { image: singleMeta, onBackToGrid: onBackToFullscreenGrid });
  }
  const useVirtual = images.length >= WORKSPACE_GRID_VIRTUAL_THRESHOLD;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: isFullscreen ? "flex min-h-0 flex-1 flex-col bg-black" : "rounded-xl bg-neutral-100/80 p-2 sm:p-3",
      "aria-label": "Workspace photo grid",
      children: [
        isFullscreen && /* @__PURE__ */ jsx("p", { className: "shrink-0 px-3 pt-2 text-center text-xs text-white/70", children: "Tap any photo to view it full screen" }),
        useVirtual ? /* @__PURE__ */ jsx(
          VirtualizedWorkspaceThumbGrid,
          {
            items: images,
            getId: (i) => i.id,
            isFullscreen,
            scrollClassName: isFullscreen ? "flex-1 min-h-0 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4" : "max-h-[min(52vh,520px)] min-h-0 w-full overflow-y-auto",
            renderCell: renderThumb
          }
        ) : /* @__PURE__ */ jsx("div", { className: gridClass, children: images.map((img) => /* @__PURE__ */ jsx(
          ThumbCell,
          {
            image: img,
            selected: selectedId === img.id,
            isFs: isFullscreen,
            onActivate: onThumbnailActivate,
            onRemove: onRemoveFromWorkspace,
            removeDisabled
          },
          img.id
        )) })
      ]
    }
  );
}
export {
  WorkspaceBulkOriginalsPreview as default
};
