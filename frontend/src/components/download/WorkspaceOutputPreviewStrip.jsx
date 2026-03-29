import { jsx, jsxs } from "react/jsx-runtime";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import { getLatestImageVersion } from "../../lib/imageVersions";
import { Loader2 } from "lucide-react";
function OutputThumb({
  image,
  selected,
  onSelect
}) {
  const latest = getLatestImageVersion(image.versions) ?? null;
  const { blobUrl, loading } = useAuthenticatedImage(image.id, latest?.id ?? null);
  if (!latest) return null;
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      onClick: onSelect,
      className: `shrink-0 w-[4.75rem] text-left rounded-xl transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${selected ? "ring-2 ring-black ring-offset-2" : "ring-1 ring-neutral-200 hover:ring-neutral-400"}`,
      children: [
        /* @__PURE__ */ jsx("div", { className: "aspect-square w-full overflow-hidden rounded-lg bg-neutral-100", children: loading ? /* @__PURE__ */ jsx("div", { className: "flex h-full w-full items-center justify-center", children: /* @__PURE__ */ jsx(Loader2, { className: "h-5 w-5 animate-spin text-neutral-400", "aria-hidden": true }) }) : blobUrl ? /* @__PURE__ */ jsx(
          "img",
          {
            src: blobUrl,
            alt: image.original_filename,
            className: "h-full w-full object-cover",
            loading: "lazy"
          }
        ) : /* @__PURE__ */ jsx("div", { className: "flex h-full w-full items-center justify-center text-[10px] text-neutral-400 px-1 text-center", children: "No preview" }) }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 px-0.5 text-[10px] font-medium text-neutral-700 truncate", title: image.original_filename, children: image.original_filename })
      ]
    }
  );
}
function WorkspaceOutputPreviewStrip({ images, selectedId, onSelect }) {
  if (images.length === 0) return null;
  return /* @__PURE__ */ jsxs("section", { className: "rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4", "aria-label": "Workspace output previews", children: [
    /* @__PURE__ */ jsx("h3", { className: "text-xs font-semibold uppercase tracking-wider text-neutral-500", children: "Review before download" }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-neutral-700", children: "Open each thumbnail to see the full before/after, then use bulk or per-file export below." }),
    /* @__PURE__ */ jsx("div", { className: "mt-3 flex gap-2.5 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory", children: images.map((img) => /* @__PURE__ */ jsx("div", { className: "snap-start", children: /* @__PURE__ */ jsx(OutputThumb, { image: img, selected: selectedId === img.id, onSelect: () => onSelect(img.id) }) }, img.id)) })
  ] });
}
export {
  WorkspaceOutputPreviewStrip as default
};
