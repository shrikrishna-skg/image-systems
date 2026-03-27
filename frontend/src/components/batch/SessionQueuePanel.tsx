import type { ImageInfo } from "../../types";
import { CheckCircle2, Circle, Loader2, X, Layers } from "lucide-react";
import { MAX_WORKSPACE_ASSETS } from "../../lib/workspaceLimits";

export type QueueRowStatus = "idle" | "processing" | "complete";

function rowStatus(
  img: ImageInfo,
  processingId: string | null,
  jobActive: boolean,
  jobImageId: string | null
): QueueRowStatus {
  if (processingId === img.id) return "processing";
  if (jobActive && !processingId && jobImageId === img.id) return "processing";
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
  processingAssetId: string | null;
  jobActive: boolean;
  jobImageId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export default function SessionQueuePanel({
  assets,
  selectedId,
  processingAssetId,
  jobActive,
  jobImageId,
  onSelect,
  onRemove,
  disabled,
}: Props) {
  if (assets.length === 0) return null;

  const pending = assets.filter((a) => !a.versions?.length).length;
  const done = assets.length - pending;

  return (
    <section className="rounded-2xl border border-neutral-200/90 bg-white overflow-hidden">
      <div className="border-b border-neutral-200 px-4 py-3 flex items-center justify-between gap-2 bg-neutral-50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-black">
            <Layers className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Asset queue</h2>
            <p className="text-[11px] text-neutral-600 font-data mt-0.5 tabular-nums">
              <span className="text-black font-medium">
                {assets.length}/{MAX_WORKSPACE_ASSETS}
              </span>{" "}
              batch · <span className="text-black font-medium">{pending} pending</span>
              {done > 0 && (
                <>
                  {" "}
                  · <span className="text-neutral-700">{done} complete</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-[1] bg-white border-b border-neutral-200">
            <tr className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
              <th className="px-3 py-2 font-medium w-8" />
              <th className="px-2 py-2 font-medium">Asset</th>
              <th className="px-2 py-2 font-medium text-right hidden sm:table-cell">Size</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {assets.map((img) => {
              const st = rowStatus(img, processingAssetId, jobActive, jobImageId);
              const isSel = selectedId === img.id;
              return (
                <tr
                  key={img.id}
                  className={`group transition-colors ${
                    isSel ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                >
                  <td className="px-3 py-2 align-middle">
                    <StatusDot status={st} />
                  </td>
                  <td className="px-2 py-2 align-middle min-w-0">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onSelect(img.id)}
                      className={`text-left w-full min-w-0 rounded-md px-1 -mx-1 py-0.5 transition-colors ${
                        isSel ? "text-black" : "text-neutral-700 hover:text-black"
                      }`}
                    >
                      <span className="block truncate font-medium">{img.original_filename}</span>
                      <span className="block font-data text-[10px] text-neutral-500 tabular-nums mt-0.5">
                        {st === "complete"
                          ? `${img.versions?.length ?? 0} output(s)`
                          : "Awaiting pipeline"}
                      </span>
                    </button>
                  </td>
                  <td className="px-2 py-2 align-middle text-right font-data text-neutral-500 tabular-nums hidden sm:table-cell">
                    {img.width && img.height ? `${img.width}×${img.height}` : "—"}
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onRemove(img.id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-200 transition-all"
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

      <div className="border-t border-neutral-200 px-4 py-2.5 bg-neutral-50">
        <p className="text-[10px] text-neutral-500 leading-relaxed">
          Select a row to inspect. Batch actions run the same enhancement profile on every target asset
          sequentially—ideal for property drops and campaign packs.
        </p>
      </div>
    </section>
  );
}
