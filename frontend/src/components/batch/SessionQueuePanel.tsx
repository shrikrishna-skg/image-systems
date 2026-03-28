import type { ImageInfo } from "../../types";
import { CheckCircle2, Circle, Loader2, X, Layers, ChevronDown } from "lucide-react";
import { workspaceQueueCountLabel } from "../../lib/workspaceLimits";
import { useRef, useEffect } from "react";

export type QueueRowStatus = "idle" | "processing" | "complete";

function rowStatus(
  img: ImageInfo,
  processingAssetIds: ReadonlySet<string>,
  jobActive: boolean,
  jobImageId: string | null
): QueueRowStatus {
  if (processingAssetIds.has(img.id)) return "processing";
  if (jobActive && jobImageId === img.id) return "processing";
  if (img.versions && img.versions.length > 0) return "complete";
  return "idle";
}

function StatusDot({ status }: { status: QueueRowStatus }) {
  if (status === "processing") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-black" aria-hidden />;
  }
  if (status === "complete") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-black" aria-hidden />;
  }
  return <Circle className="h-3.5 w-3.5 text-neutral-400" strokeDasharray="2 3" aria-hidden />;
}

interface Props {
  assets: ImageInfo[];
  selectedId: string | null;
  /** Workspace batch in-flight rows (supports concurrent API jobs). */
  processingAssetIds: ReadonlySet<string>;
  jobActive: boolean;
  jobImageId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  /** IDs chosen for the next batch run (subset of workspace). */
  batchSelectedIds: Set<string>;
  onToggleBatchSelect: (id: string) => void;
  onBatchSelectAll: () => void;
  onBatchSelectPendingOnly: () => void;
  onBatchClearSelection: () => void;
  /** Nested under a parent shell (e.g. mobile details drawer); drops outer card chrome. */
  variant?: "default" | "embedded";
}

export default function SessionQueuePanel({
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
  variant = "default",
}: Props) {
  const headerBatchRef = useRef<HTMLInputElement>(null);
  if (assets.length === 0) return null;

  const pending = assets.filter((a) => !a.versions?.length).length;
  const done = assets.length - pending;
  const selectedForBatchCount = assets.filter((a) => batchSelectedIds.has(a.id)).length;
  const allSelectedForBatch = assets.length > 0 && selectedForBatchCount === assets.length;
  const someSelectedForBatch = selectedForBatchCount > 0 && !allSelectedForBatch;

  useEffect(() => {
    const el = headerBatchRef.current;
    if (el) el.indeterminate = someSelectedForBatch;
  }, [someSelectedForBatch, allSelectedForBatch, assets.length]);

  const shell =
    variant === "embedded"
      ? "bg-white overflow-hidden"
      : "rounded-2xl border border-neutral-200/90 bg-white overflow-hidden";

  return (
    <section className={shell}>
      <div
        className={`border-b border-neutral-200 px-3 py-2 sm:px-4 flex flex-col gap-2 bg-neutral-50 ${variant === "embedded" ? "pt-2.5" : ""}`}
      >
        {variant === "default" && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-black">
              <Layers className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Asset queue</h2>
              <p className="text-[10px] text-neutral-600 font-data mt-0.5 tabular-nums leading-snug">
                <span className="text-black font-medium">{workspaceQueueCountLabel(assets.length)}</span>{" "}
                · <span className="text-black font-medium">{pending} pending</span>
                {done > 0 && (
                  <>
                    {" "}
                    · <span className="text-neutral-700">{done} done</span>
                  </>
                )}
                {selectedForBatchCount > 0 && (
                  <>
                    {" "}
                    · <span className="text-black font-medium">{selectedForBatchCount}</span> selected
                  </>
                )}
              </p>
            </div>
          </div>
        )}
        {variant === "embedded" && (
          <p className="text-[10px] text-neutral-600 font-data tabular-nums px-0.5">
            <span className="text-black font-medium">{workspaceQueueCountLabel(assets.length)}</span> ·{" "}
            <span className="text-black font-medium">{pending} pending</span>
            {done > 0 && (
              <>
                {" "}
                · <span className="text-neutral-700">{done} done</span>
              </>
            )}
            {selectedForBatchCount > 0 && (
              <>
                {" "}
                · <span className="text-black font-medium">{selectedForBatchCount}</span> selected
              </>
            )}
          </p>
        )}
        <details className="group rounded-lg border border-neutral-200/80 bg-white px-2 py-1.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-semibold text-neutral-700 marker:hidden [&::-webkit-details-marker]:hidden">
            <span>Selection shortcuts</span>
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-2">
            <button
              type="button"
              disabled={disabled || pending === 0}
              onClick={onBatchSelectPendingOnly}
              className="rounded-md border border-neutral-200 bg-neutral-50/80 px-2 py-1 text-[10px] font-semibold text-neutral-800 hover:border-neutral-300 hover:bg-white disabled:opacity-40"
            >
              Pending
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onBatchSelectAll}
              className="rounded-md border border-neutral-200 bg-neutral-50/80 px-2 py-1 text-[10px] font-semibold text-neutral-800 hover:border-neutral-300 hover:bg-white disabled:opacity-40"
            >
              All
            </button>
            <button
              type="button"
              disabled={disabled || selectedForBatchCount === 0}
              onClick={onBatchClearSelection}
              className="rounded-md border border-transparent px-2 py-1 text-[10px] font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-black disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </details>
      </div>

      <div className="max-h-[min(48vh,380px)] overflow-y-auto overscroll-contain">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-[1] bg-white border-b border-neutral-200">
            <tr className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
              <th className="w-8 px-1.5 py-1.5 font-medium text-center" scope="col">
                <span className="sr-only">Include in batch</span>
                <input
                  ref={headerBatchRef}
                  type="checkbox"
                  disabled={disabled}
                  checked={allSelectedForBatch}
                  onChange={() => {
                    if (allSelectedForBatch) onBatchClearSelection();
                    else onBatchSelectAll();
                  }}
                  className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400"
                  aria-label="Select all assets for batch processing"
                />
              </th>
              <th className="px-1.5 py-1.5 font-medium w-7" />
              <th className="px-2 py-1.5 font-medium">Asset</th>
              <th className="px-2 py-1.5 font-medium text-right hidden sm:table-cell">Size</th>
              <th className="w-9 px-1 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {assets.map((img) => {
              const st = rowStatus(img, processingAssetIds, jobActive, jobImageId);
              const isSel = selectedId === img.id;
              const inBatch = batchSelectedIds.has(img.id);
              return (
                <tr
                  key={img.id}
                  className={`group transition-colors ${
                    isSel ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                >
                  <td className="px-1.5 py-1.5 align-middle text-center">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={inBatch}
                      onChange={() => onToggleBatchSelect(img.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400"
                      aria-label={`Include ${img.original_filename} in batch run`}
                    />
                  </td>
                  <td className="px-1.5 py-1.5 align-middle">
                    <StatusDot status={st} />
                  </td>
                  <td className="px-2 py-1.5 align-middle min-w-0">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onSelect(img.id)}
                      className={`text-left w-full min-w-0 rounded-md px-1 -mx-1 py-0.5 transition-colors ${
                        isSel ? "text-black" : "text-neutral-700 hover:text-black"
                      }`}
                    >
                      <span className="block truncate font-medium leading-tight">{img.original_filename}</span>
                      {st === "complete" && (
                        <span className="block font-data text-[10px] text-neutral-500 tabular-nums mt-0.5">
                          {img.versions?.length ?? 0} output{(img.versions?.length ?? 0) === 1 ? "" : "s"}
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 align-middle text-right font-data text-neutral-500 tabular-nums text-[11px] hidden sm:table-cell">
                    {img.width && img.height ? `${img.width}×${img.height}` : "—"}
                  </td>
                  <td className="px-1 py-1.5 align-middle">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onRemove(img.id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md text-neutral-400 hover:text-black hover:bg-neutral-200 transition-all"
                      aria-label={`Remove ${img.original_filename}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-neutral-200 px-3 py-2 sm:px-4 bg-neutral-50">
        <p className="text-[10px] text-neutral-500 leading-snug">
          Click a row to preview. Checked rows run with <strong className="text-neutral-700">Run batch on selected</strong>{" "}
          (queue order).
        </p>
      </div>
    </section>
  );
}
