import { Link } from "react-router-dom";
import { Archive, ImageIcon, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import { useImageStore } from "../../stores/imageStore";
import type { ImageInfo } from "../../types";
import { toast } from "sonner";
import { MAX_WORKSPACE_ASSETS } from "../../lib/workspaceLimits";
import FullscreenImageRegion from "../media/FullscreenImageRegion";
import OptimizedImage from "../media/OptimizedImage";

function ArchiveThumb({ image }: { image: ImageInfo }) {
  const latest = image.versions?.[image.versions.length - 1];
  const { blobUrl, loading } = useAuthenticatedImage(image.id, latest?.id ?? null);
  if (loading && !blobUrl) {
    return <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />;
  }
  if (!blobUrl) {
    return <ImageIcon className="w-10 h-10 text-neutral-300" strokeWidth={1.25} />;
  }
  return <OptimizedImage lazy src={blobUrl} alt="" className="h-full w-full object-cover" />;
}

export default function WorkspaceArchivePanel() {
  const archived = useImageStore((s) => s.archivedWorkspaceImages);
  const removeArchivedWorkspaceImage = useImageStore((s) => s.removeArchivedWorkspaceImage);
  const restoreArchivedWorkspaceImage = useImageStore((s) => s.restoreArchivedWorkspaceImage);
  const clearWorkspaceArchive = useImageStore((s) => s.clearWorkspaceArchive);

  if (archived.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-neutral-200/90 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 border border-neutral-200">
            <Archive className="h-5 w-5 text-black" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-black">Workspace archive</h2>
            <p className="text-xs text-neutral-600 mt-1 leading-relaxed max-w-xl">
              Snapshots from when you cleared the console. Thumbnails load from your library (cloud or this
              device)—open one to keep editing, or remove it from this list only.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/history"
            className="text-xs font-semibold text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black"
          >
            Full library
          </Link>
          <button
            type="button"
            onClick={() => {
              if (archived.length === 0) return;
              if (!confirm("Remove all workspace archive entries? Your files stay in History.")) return;
              clearWorkspaceArchive();
            }}
            className="text-xs font-medium text-neutral-500 hover:text-black px-2 py-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            Clear list
          </button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {archived.map((entry) => {
          const v = entry.image.versions?.length ?? 0;
          return (
            <article
              key={entry.key}
              className="snap-start shrink-0 w-[9.5rem] rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden flex flex-col"
            >
              <div className="aspect-square bg-neutral-100 relative">
                <FullscreenImageRegion className="absolute inset-0 h-full w-full" alwaysShowTrigger>
                  <ArchiveThumb image={entry.image} />
                </FullscreenImageRegion>
              </div>
              <div className="p-2 flex flex-col gap-1.5 flex-1">
                <p className="text-[11px] font-medium text-black truncate" title={entry.image.original_filename}>
                  {entry.image.original_filename}
                </p>
                <p className="text-[10px] text-neutral-500 font-data">
                  {new Date(entry.archivedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {v > 0 ? ` · ${v} ver.` : ""}
                </p>
                <div className="flex gap-1 mt-auto pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const ok = restoreArchivedWorkspaceImage(entry.key);
                      if (!ok) {
                        toast.error("Workspace full", {
                          description: `Remove an asset or clear the console (${MAX_WORKSPACE_ASSETS} max), then open from archive.`,
                        });
                      }
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-black text-white text-[10px] font-semibold hover:bg-neutral-800 transition-colors"
                    title="Open in workspace"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => removeArchivedWorkspaceImage(entry.key)}
                    className="p-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:text-black hover:bg-white transition-colors"
                    aria-label="Remove from archive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
