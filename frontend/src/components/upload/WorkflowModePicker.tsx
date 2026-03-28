import { ImageIcon, Layers } from "lucide-react";
import { useImageStore } from "../../stores/imageStore";

interface Props {
  variant?: "cards" | "compact";
}

export default function WorkflowModePicker({ variant = "cards" }: Props) {
  const workspaceMode = useImageStore((s) => s.workspaceMode);
  const setWorkspaceMode = useImageStore((s) => s.setWorkspaceMode);

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-2 justify-between rounded-xl border border-neutral-200 bg-neutral-50/80 p-1.5 sm:justify-start">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 px-2 hidden sm:inline">
          Flow
        </span>
        <div className="flex flex-1 min-w-0 gap-1">
          <button
            type="button"
            onClick={() => setWorkspaceMode(false)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              !workspaceMode ? "bg-white text-black border border-neutral-200 ring-1 ring-black/[0.06]" : "text-neutral-600 hover:text-black"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Standard
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceMode(true)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              workspaceMode ? "bg-white text-black border border-neutral-200 ring-1 ring-black/[0.06]" : "text-neutral-600 hover:text-black"
            }`}
          >
            <Layers className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Workspace batch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 grid gap-3 sm:grid-cols-2 max-w-2xl mx-auto">
      <button
        type="button"
        onClick={() => setWorkspaceMode(false)}
        className={`text-left rounded-2xl border-2 p-4 transition-all ${
          !workspaceMode
            ? "border-black bg-neutral-50 ring-1 ring-black/[0.06]"
            : "border-neutral-200 bg-white hover:border-neutral-400"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              !workspaceMode ? "bg-black text-white border-black" : "bg-neutral-100 text-neutral-600 border-neutral-200"
            }`}
          >
            <ImageIcon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-black">Standard</p>
            <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
              One photo at a time — import, enhance, export. No batch queue until you need it.
            </p>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={() => setWorkspaceMode(true)}
        className={`text-left rounded-2xl border-2 p-4 transition-all ${
          workspaceMode
            ? "border-black bg-neutral-50 ring-1 ring-black/[0.06]"
            : "border-neutral-200 bg-white hover:border-neutral-400"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              workspaceMode ? "bg-black text-white border-black" : "bg-neutral-100 text-neutral-600 border-neutral-200"
            }`}
          >
            <Layers className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-black">Workspace batch</p>
            <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
              Queue many images, bulk import, batch run, and session tools.
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}
