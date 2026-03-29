import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { CheckCircle2, Circle, Loader2, X, Layers, ChevronDown } from "lucide-react";
import { workspaceQueueCountLabel } from "../../lib/workspaceLimits";
import { WORKSPACE_QUEUE_VIRTUAL_THRESHOLD } from "../../lib/workspaceGridVirtual";
import { computeQueueRowStatus } from "../../lib/workspaceQueueRowStatus";
import { useRef, useEffect } from "react";
import SessionQueueVirtualizedList from "./SessionQueueVirtualizedList";
function StatusDot({ status }) {
  if (status === "processing") {
    return /* @__PURE__ */ jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin text-black", "aria-hidden": true });
  }
  if (status === "complete") {
    return /* @__PURE__ */ jsx(CheckCircle2, { className: "h-3.5 w-3.5 text-black", "aria-hidden": true });
  }
  return /* @__PURE__ */ jsx(Circle, { className: "h-3.5 w-3.5 text-neutral-400", strokeDasharray: "2 3", "aria-hidden": true });
}
function SessionQueuePanel({
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
  onBatchSelectAll,
  onBatchSelectPendingOnly,
  onBatchClearSelection,
  variant = "default"
}) {
  const headerBatchRef = useRef(null);
  const pending = assets.filter((a) => !a.versions?.length).length;
  const done = assets.length - pending;
  const selectedForBatchCount = assets.filter((a) => batchSelectedIds.has(a.id)).length;
  const allSelectedForBatch = assets.length > 0 && selectedForBatchCount === assets.length;
  const someSelectedForBatch = selectedForBatchCount > 0 && !allSelectedForBatch;
  useEffect(() => {
    const el = headerBatchRef.current;
    if (el) el.indeterminate = someSelectedForBatch;
  }, [someSelectedForBatch, allSelectedForBatch, assets.length]);
  if (assets.length === 0) return null;
  const shell = variant === "embedded" ? "bg-white overflow-hidden" : "rounded-2xl border border-neutral-200/90 bg-white overflow-hidden";
  return /* @__PURE__ */ jsxs("section", { className: shell, children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: `border-b border-neutral-200 px-3 py-2 sm:px-4 flex flex-col gap-2 bg-neutral-50 ${variant === "embedded" ? "pt-2.5" : ""}`,
        children: [
          variant === "default" && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [
            /* @__PURE__ */ jsx("span", { className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-black", children: /* @__PURE__ */ jsx(Layers, { className: "h-3.5 w-3.5", strokeWidth: 2 }) }),
            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("h2", { className: "text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500", children: "Asset queue" }),
              /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-neutral-600 font-data mt-0.5 tabular-nums leading-snug", children: [
                /* @__PURE__ */ jsx("span", { className: "text-black font-medium", children: workspaceQueueCountLabel(assets.length) }),
                " ",
                "\xB7 ",
                /* @__PURE__ */ jsxs("span", { className: "text-black font-medium", children: [
                  pending,
                  " pending"
                ] }),
                done > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
                  " ",
                  "\xB7 ",
                  /* @__PURE__ */ jsxs("span", { className: "text-neutral-700", children: [
                    done,
                    " done"
                  ] })
                ] }),
                selectedForBatchCount > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
                  " ",
                  "\xB7 ",
                  /* @__PURE__ */ jsx("span", { className: "text-black font-medium", children: selectedForBatchCount }),
                  " selected"
                ] })
              ] })
            ] })
          ] }),
          variant === "embedded" && /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-neutral-600 font-data tabular-nums px-0.5", children: [
            /* @__PURE__ */ jsx("span", { className: "text-black font-medium", children: workspaceQueueCountLabel(assets.length) }),
            " \xB7",
            " ",
            /* @__PURE__ */ jsxs("span", { className: "text-black font-medium", children: [
              pending,
              " pending"
            ] }),
            done > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
              " ",
              "\xB7 ",
              /* @__PURE__ */ jsxs("span", { className: "text-neutral-700", children: [
                done,
                " done"
              ] })
            ] }),
            selectedForBatchCount > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
              " ",
              "\xB7 ",
              /* @__PURE__ */ jsx("span", { className: "text-black font-medium", children: selectedForBatchCount }),
              " selected"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("details", { className: "group rounded-lg border border-neutral-200/80 bg-white px-2 py-1.5", children: [
            /* @__PURE__ */ jsxs("summary", { className: "flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-semibold text-neutral-700 marker:hidden [&::-webkit-details-marker]:hidden", children: [
              /* @__PURE__ */ jsx("span", { children: "Selection shortcuts" }),
              /* @__PURE__ */ jsx(
                ChevronDown,
                {
                  className: "h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform group-open:rotate-180",
                  "aria-hidden": true
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-2", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  disabled: disabled || pending === 0,
                  onClick: onBatchSelectPendingOnly,
                  className: "rounded-md border border-neutral-200 bg-neutral-50/80 px-2 py-1 text-[10px] font-semibold text-neutral-800 hover:border-neutral-300 hover:bg-white disabled:opacity-40",
                  children: "Pending"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  disabled,
                  onClick: onBatchSelectAll,
                  className: "rounded-md border border-neutral-200 bg-neutral-50/80 px-2 py-1 text-[10px] font-semibold text-neutral-800 hover:border-neutral-300 hover:bg-white disabled:opacity-40",
                  children: "All"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  disabled: disabled || selectedForBatchCount === 0,
                  onClick: onBatchClearSelection,
                  className: "rounded-md border border-transparent px-2 py-1 text-[10px] font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-black disabled:opacity-40",
                  children: "Clear"
                }
              )
            ] })
          ] })
        ]
      }
    ),
    assets.length >= WORKSPACE_QUEUE_VIRTUAL_THRESHOLD ? /* @__PURE__ */ jsx(
      SessionQueueVirtualizedList,
      {
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
        onHeaderBatchToggle: () => {
          if (allSelectedForBatch) onBatchClearSelection();
          else onBatchSelectAll();
        }
      }
    ) : /* @__PURE__ */ jsx("div", { className: "max-h-[min(48vh,380px)] overflow-y-auto overscroll-contain", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-xs", children: [
      /* @__PURE__ */ jsx("thead", { className: "sticky top-0 z-[1] bg-white border-b border-neutral-200", children: /* @__PURE__ */ jsxs("tr", { className: "text-[10px] uppercase tracking-wider text-neutral-500 font-semibold", children: [
        /* @__PURE__ */ jsxs("th", { className: "w-8 px-1.5 py-1.5 font-medium text-center", scope: "col", children: [
          /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Include in batch" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              ref: headerBatchRef,
              type: "checkbox",
              disabled,
              checked: allSelectedForBatch,
              onChange: () => {
                if (allSelectedForBatch) onBatchClearSelection();
                else onBatchSelectAll();
              },
              className: "h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400",
              "aria-label": "Select all assets for batch processing"
            }
          )
        ] }),
        /* @__PURE__ */ jsx("th", { className: "px-1.5 py-1.5 font-medium w-7" }),
        /* @__PURE__ */ jsx("th", { className: "px-2 py-1.5 font-medium", children: "Asset" }),
        /* @__PURE__ */ jsx("th", { className: "px-2 py-1.5 font-medium text-right hidden sm:table-cell", children: "Size" }),
        /* @__PURE__ */ jsx("th", { className: "w-9 px-1 py-1.5" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-neutral-100", children: assets.map((img) => {
        const st = computeQueueRowStatus(img, processingAssetIds, jobActive, jobImageId);
        const isSel = selectedId === img.id;
        const inBatch = batchSelectedIds.has(img.id);
        return /* @__PURE__ */ jsxs(
          "tr",
          {
            className: `group transition-colors ${isSel ? "bg-neutral-100" : "hover:bg-neutral-50"}`,
            children: [
              /* @__PURE__ */ jsx("td", { className: "px-1.5 py-1.5 align-middle text-center", children: /* @__PURE__ */ jsx(
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
              /* @__PURE__ */ jsx("td", { className: "px-1.5 py-1.5 align-middle", children: /* @__PURE__ */ jsx(StatusDot, { status: st }) }),
              /* @__PURE__ */ jsx("td", { className: "px-2 py-1.5 align-middle min-w-0", children: /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  disabled,
                  onClick: () => onSelect(img.id),
                  className: `text-left w-full min-w-0 rounded-md px-1 -mx-1 py-0.5 transition-colors ${isSel ? "text-black" : "text-neutral-700 hover:text-black"}`,
                  children: [
                    /* @__PURE__ */ jsx("span", { className: "block truncate font-medium leading-tight", children: img.original_filename }),
                    st === "complete" && /* @__PURE__ */ jsxs("span", { className: "block font-data text-[10px] text-neutral-500 tabular-nums mt-0.5", children: [
                      img.versions?.length ?? 0,
                      " output",
                      (img.versions?.length ?? 0) === 1 ? "" : "s"
                    ] })
                  ]
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "px-2 py-1.5 align-middle text-right font-data text-neutral-500 tabular-nums text-[11px] hidden sm:table-cell", children: img.width && img.height ? `${img.width}\xD7${img.height}` : "\u2014" }),
              /* @__PURE__ */ jsx("td", { className: "px-1 py-1.5 align-middle", children: /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  disabled,
                  onClick: () => onRemove(img.id),
                  className: "opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md text-neutral-400 hover:text-black hover:bg-neutral-200 transition-all",
                  "aria-label": `Remove ${img.original_filename}`,
                  children: /* @__PURE__ */ jsx(X, { className: "h-3.5 w-3.5" })
                }
              ) })
            ]
          },
          img.id
        );
      }) })
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "border-t border-neutral-200 px-3 py-2 sm:px-4 bg-neutral-50", children: /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-neutral-500 leading-snug", children: [
      "Click a row to preview. Checked rows run with ",
      /* @__PURE__ */ jsx("strong", { className: "text-neutral-700", children: "Run batch on selected" }),
      " ",
      "(queue order)."
    ] }) })
  ] });
}
export {
  SessionQueuePanel as default
};
