import { jsx, jsxs } from "react/jsx-runtime";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle2, Circle, Loader2, X } from "lucide-react";
import { computeQueueRowStatus } from "../../lib/workspaceQueueRowStatus";
function StatusDot({ status }) {
  if (status === "processing") {
    return /* @__PURE__ */ jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin text-black", "aria-hidden": true });
  }
  if (status === "complete") {
    return /* @__PURE__ */ jsx(CheckCircle2, { className: "h-3.5 w-3.5 text-black", "aria-hidden": true });
  }
  return /* @__PURE__ */ jsx(Circle, { className: "h-3.5 w-3.5 text-neutral-400", strokeDasharray: "2 3", "aria-hidden": true });
}
function SessionQueueVirtualizedList({
  assets,
  selectedId,
  processingAssetIds,
  jobActive,
  jobImageId,
  onSelect,
  onRemove,
  disabled,
  batchSelectedIds,
  onToggleBatchSelect,
  headerBatchRef,
  allSelectedForBatch,
  onHeaderBatchToggle
}) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: assets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 16
  });
  return /* @__PURE__ */ jsxs("div", { className: "flex max-h-[min(48vh,380px)] min-h-0 flex-col overflow-hidden", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center gap-0 border-b border-neutral-200 bg-white px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500", children: [
      /* @__PURE__ */ jsx("div", { className: "flex w-8 justify-center", children: /* @__PURE__ */ jsx(
        "input",
        {
          ref: headerBatchRef,
          type: "checkbox",
          disabled,
          checked: allSelectedForBatch,
          onChange: onHeaderBatchToggle,
          className: "h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400",
          "aria-label": "Select all assets for batch processing"
        }
      ) }),
      /* @__PURE__ */ jsx("div", { className: "w-7 shrink-0" }),
      /* @__PURE__ */ jsx("div", { className: "min-w-0 flex-1 px-1", children: "Asset" }),
      /* @__PURE__ */ jsx("div", { className: "hidden w-[4.5rem] shrink-0 px-1 text-right sm:block", children: "Size" }),
      /* @__PURE__ */ jsx("div", { className: "w-9 shrink-0" })
    ] }),
    /* @__PURE__ */ jsx("div", { ref: parentRef, className: "min-h-0 flex-1 overflow-y-auto overscroll-contain", children: /* @__PURE__ */ jsx("div", { className: "relative w-full", style: { height: `${virtualizer.getTotalSize()}px` }, children: virtualizer.getVirtualItems().map((vr) => {
      const img = assets[vr.index];
      const st = computeQueueRowStatus(img, processingAssetIds, jobActive, jobImageId);
      const isSel = selectedId === img.id;
      const inBatch = batchSelectedIds.has(img.id);
      return /* @__PURE__ */ jsx(
        "div",
        {
          "data-index": vr.index,
          ref: virtualizer.measureElement,
          className: `absolute left-0 top-0 w-full border-b border-neutral-100 transition-colors ${isSel ? "bg-neutral-100" : "hover:bg-neutral-50"}`,
          style: { transform: `translateY(${vr.start}px)` },
          children: /* @__PURE__ */ jsxs("div", { className: "flex min-h-[44px] items-center gap-0 px-1.5 py-1", children: [
            /* @__PURE__ */ jsx("div", { className: "flex w-8 shrink-0 justify-center", children: /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                disabled,
                checked: inBatch,
                onChange: () => onToggleBatchSelect(img.id),
                onClick: (e) => e.stopPropagation(),
                className: "h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400",
                "aria-label": `Include ${img.original_filename} in batch run`
              }
            ) }),
            /* @__PURE__ */ jsx("div", { className: "flex w-7 shrink-0 justify-center", children: /* @__PURE__ */ jsx(StatusDot, { status: st }) }),
            /* @__PURE__ */ jsx("div", { className: "min-w-0 flex-1 px-1", children: /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                disabled,
                onClick: () => onSelect(img.id),
                className: `w-full min-w-0 rounded-md px-1 py-0.5 text-left transition-colors ${isSel ? "text-black" : "text-neutral-700 hover:text-black"}`,
                children: [
                  /* @__PURE__ */ jsx("span", { className: "block truncate text-xs font-medium leading-tight", children: img.original_filename }),
                  st === "complete" && /* @__PURE__ */ jsxs("span", { className: "mt-0.5 block font-data text-[10px] text-neutral-500 tabular-nums", children: [
                    img.versions?.length ?? 0,
                    " output",
                    (img.versions?.length ?? 0) === 1 ? "" : "s"
                  ] })
                ]
              }
            ) }),
            /* @__PURE__ */ jsx("div", { className: "hidden w-[4.5rem] shrink-0 px-1 text-right font-data text-[11px] text-neutral-500 tabular-nums sm:block", children: img.width && img.height ? `${img.width}\xD7${img.height}` : "\u2014" }),
            /* @__PURE__ */ jsx("div", { className: "flex w-9 shrink-0 justify-end", children: /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                disabled,
                onClick: () => onRemove(img.id),
                className: "rounded-md p-1 text-neutral-400 transition-all hover:bg-neutral-200 hover:text-black focus:opacity-100",
                "aria-label": `Remove ${img.original_filename}`,
                children: /* @__PURE__ */ jsx(X, { className: "h-3.5 w-3.5" })
              }
            ) })
          ] })
        },
        img.id
      );
    }) }) })
  ] });
}
export {
  SessionQueueVirtualizedList as default
};
