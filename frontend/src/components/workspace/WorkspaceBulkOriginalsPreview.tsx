import type { ImageInfo } from "../../types";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import { getLatestImageVersion } from "../../lib/imageVersions";
import { Loader2, ArrowLeft } from "lucide-react";

function ThumbCell({
  image,
  selected,
  isFs,
  onActivate,
}: {
  image: ImageInfo;
  selected: boolean;
  isFs: boolean;
  onActivate: () => void;
}) {
  const latest = getLatestImageVersion(image.versions);
  const { blobUrl, loading } = useAuthenticatedImage(image.id, latest?.id ?? null);
  const selectedRing = isFs
    ? "ring-2 ring-white ring-offset-2 ring-offset-black"
    : "ring-2 ring-black ring-offset-2 ring-offset-white";
  const idleRing = isFs ? "ring-1 ring-white/25 hover:ring-white/45" : "ring-1 ring-neutral-200 hover:ring-neutral-400";

  return (
    <button
      type="button"
      onClick={onActivate}
      title={`Open ${image.original_filename} full screen`}
      className={`group relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-200 text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
        selected ? selectedRing : idleRing
      } ${isFs ? "focus-visible:ring-white focus-visible:ring-offset-black" : ""}`}
    >
      {loading ? (
        <div className="flex h-full w-full items-center justify-center bg-neutral-100">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" aria-hidden />
        </div>
      ) : blobUrl ? (
        <>
          <img
            src={blobUrl}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            loading="lazy"
          />
          {latest && (
            <span
              className={`pointer-events-none absolute bottom-1 right-1 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                isFs ? "bg-white/90 text-black" : "bg-emerald-600/90 text-white"
              }`}
            >
              Output
            </span>
          )}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-100 px-1 text-center text-[10px] text-neutral-500">
          No preview
        </div>
      )}
      <span className="sr-only">{image.original_filename}</span>
    </button>
  );
}

function SingleOriginalView({
  image,
  onBackToGrid,
}: {
  image: ImageInfo;
  onBackToGrid: () => void;
}) {
  const latest = getLatestImageVersion(image.versions);
  const { blobUrl, loading } = useAuthenticatedImage(image.id, latest?.id ?? null);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black text-white">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-2 py-2 sm:px-3">
        <button
          type="button"
          onClick={onBackToGrid}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          All photos
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-xs font-medium text-white/90 sm:text-sm">
          {image.original_filename}
          {latest ? (
            <span className="ml-1.5 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
              Output
            </span>
          ) : null}
        </span>
        <span className="w-16 shrink-0 sm:w-24" aria-hidden />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4">
        {loading ? (
          <Loader2 className="h-10 w-10 animate-spin text-white/50" aria-hidden />
        ) : blobUrl ? (
          <img
            src={blobUrl}
            alt={image.original_filename}
            className="max-h-[calc(100dvh-5rem)] max-w-full object-contain"
          />
        ) : (
          <p className="text-sm text-white/60">Preview unavailable</p>
        )}
      </div>
    </div>
  );
}

export interface WorkspaceBulkOriginalsPreviewProps {
  images: ImageInfo[];
  selectedId: string;
  isFullscreen: boolean;
  layout: "grid" | "single";
  focusImageId: string | null;
  onThumbnailActivate: (id: string) => void;
  onBackToFullscreenGrid: () => void;
}

/**
 * Small grid of workspace originals; fullscreen shows all thumbs or one image after a click.
 */
export default function WorkspaceBulkOriginalsPreview({
  images,
  selectedId,
  isFullscreen,
  layout,
  focusImageId,
  onThumbnailActivate,
  onBackToFullscreenGrid,
}: WorkspaceBulkOriginalsPreviewProps) {
  const singleMeta = focusImageId ? images.find((i) => i.id === focusImageId) : null;

  if (isFullscreen && layout === "single" && focusImageId && singleMeta) {
    return (
      <SingleOriginalView image={singleMeta} onBackToGrid={onBackToFullscreenGrid} />
    );
  }

  const gridClass = isFullscreen
    ? "grid flex-1 auto-rows-fr grid-cols-3 gap-3 overflow-y-auto p-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 content-start sm:gap-4"
    : "grid max-h-[min(52vh,520px)] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-2.5";

  return (
    <div
      className={isFullscreen ? "flex min-h-0 flex-1 flex-col bg-black" : "rounded-xl bg-neutral-100/80 p-2 sm:p-3"}
      aria-label="Workspace photo grid"
    >
      {isFullscreen && (
        <p className="shrink-0 px-3 pt-2 text-center text-xs text-white/70">
          Tap any photo to view it full screen
        </p>
      )}
      <div className={gridClass}>
        {images.map((img) => (
          <ThumbCell
            key={img.id}
            image={img}
            selected={selectedId === img.id}
            isFs={isFullscreen}
            onActivate={() => onThumbnailActivate(img.id)}
          />
        ))}
      </div>
    </div>
  );
}
