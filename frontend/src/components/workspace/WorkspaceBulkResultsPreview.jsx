import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback } from "react";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import { getLatestImageVersion } from "../../lib/imageVersions";
import { WORKSPACE_GRID_VIRTUAL_THRESHOLD } from "../../lib/workspaceGridVirtual";
import VirtualizedWorkspaceThumbGrid from "./VirtualizedWorkspaceThumbGrid";
import { Loader2 } from "lucide-react";
function ResultThumbCell({
  image,
  versionId,
  selected,
  onActivate
}) {
  const { blobUrl, loading } = useAuthenticatedImage(image.id, versionId);
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      onClick: onActivate,
      title: `Select ${image.original_filename} \u2014 compare updates at the top`,
      className: `group relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-200 text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${selected ? "ring-2 ring-black ring-offset-2 ring-offset-white" : "ring-1 ring-emerald-200/80 hover:ring-emerald-400/90"}`,
      children: [
        loading ? /* @__PURE__ */ jsx("div", { className: "flex h-full w-full items-center justify-center bg-neutral-100", children: /* @__PURE__ */ jsx(Loader2, { className: "h-6 w-6 animate-spin text-neutral-400", "aria-hidden": true }) }) : blobUrl ? /* @__PURE__ */ jsx(
          "img",
          {
            src: blobUrl,
            alt: "",
            className: "h-full w-full object-cover transition-transform group-hover:scale-[1.02]",
            loading: "lazy"
          }
        ) : /* @__PURE__ */ jsx("div", { className: "flex h-full w-full items-center justify-center bg-neutral-100 px-1 text-center text-[10px] text-neutral-500", children: "No preview" }),
        /* @__PURE__ */ jsx("span", { className: "sr-only", children: image.original_filename })
      ]
    }
  );
}
const WORKSPACE_COMPARE_ANCHOR = "workspace-compare-section";
function WorkspaceBulkResultsPreview({ images, selectedId, onSelect }) {
  const withOutput = images.filter((img) => (img.versions?.length ?? 0) > 0);
  const gridClass = "grid max-h-[min(48vh,480px)] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-2.5";
  const renderResult = useCallback(
    (img) => {
      const latest = getLatestImageVersion(img.versions);
      return /* @__PURE__ */ jsx(
        ResultThumbCell,
        {
          image: img,
          versionId: latest.id,
          selected: selectedId === img.id,
          onActivate: () => {
            onSelect(img.id);
            requestAnimationFrame(() => {
              document.getElementById(WORKSPACE_COMPARE_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }
        }
      );
    },
    [selectedId, onSelect]
  );
  if (withOutput.length === 0) return null;
  const useVirtual = withOutput.length >= WORKSPACE_GRID_VIRTUAL_THRESHOLD;
  return /* @__PURE__ */ jsxs(
    "section",
    {
      className: "border-t border-neutral-200 bg-gradient-to-b from-emerald-50/40 to-white px-2 py-3 sm:px-3 sm:py-4",
      "aria-label": "Improved workspace outputs",
      children: [
        /* @__PURE__ */ jsx("h3", { className: "text-xs font-semibold uppercase tracking-wider text-emerald-900/80", children: "Improved outputs" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-neutral-700", children: [
          "Same idea as single mode \u2014 tap an improved photo to select it; the",
          " ",
          /* @__PURE__ */ jsx("span", { className: "font-medium text-black", children: "compare" }),
          " (side by side / slider) updates at the top of this card."
        ] }),
        /* @__PURE__ */ jsx("div", { className: `mt-3 rounded-xl bg-neutral-100/80 p-2 sm:p-3 ${useVirtual ? "" : gridClass}`, children: useVirtual ? /* @__PURE__ */ jsx(
          VirtualizedWorkspaceThumbGrid,
          {
            items: withOutput,
            getId: (i) => i.id,
            isFullscreen: false,
            scrollClassName: "max-h-[min(48vh,480px)] min-h-0 w-full overflow-y-auto",
            renderCell: renderResult
          }
        ) : withOutput.map((img) => {
          const latest = getLatestImageVersion(img.versions);
          return /* @__PURE__ */ jsx(
            ResultThumbCell,
            {
              image: img,
              versionId: latest.id,
              selected: selectedId === img.id,
              onActivate: () => {
                onSelect(img.id);
                requestAnimationFrame(() => {
                  document.getElementById(WORKSPACE_COMPARE_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }
            },
            img.id
          );
        }) })
      ]
    }
  );
}
export {
  WORKSPACE_COMPARE_ANCHOR,
  WorkspaceBulkResultsPreview as default
};
