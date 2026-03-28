import type { ImageInfo } from "../../types";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import { getLatestImageVersion } from "../../lib/imageVersions";
import { Loader2 } from "lucide-react";

function OutputThumb({
  image,
  selected,
  onSelect,
}: {
  image: ImageInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  const latest = getLatestImageVersion(image.versions) ?? null;
  const { blobUrl, loading } = useAuthenticatedImage(image.id, latest?.id ?? null);
  if (!latest) return null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`shrink-0 w-[4.75rem] text-left rounded-xl transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
        selected ? "ring-2 ring-black ring-offset-2" : "ring-1 ring-neutral-200 hover:ring-neutral-400"
      }`}
    >
      <div className="aspect-square w-full overflow-hidden rounded-lg bg-neutral-100">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" aria-hidden />
          </div>
        ) : blobUrl ? (
          <img
            src={blobUrl}
            alt={image.original_filename}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400 px-1 text-center">
            No preview
          </div>
        )}
      </div>
      <p className="mt-1 px-0.5 text-[10px] font-medium text-neutral-700 truncate" title={image.original_filename}>
        {image.original_filename}
      </p>
    </button>
  );
}

interface Props {
  images: ImageInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Horizontal thumbnails so every workspace output can be opened in the main compare view before bulk download. */
export default function WorkspaceOutputPreviewStrip({ images, selectedId, onSelect }: Props) {
  if (images.length === 0) return null;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4" aria-label="Workspace output previews">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Review before download</h3>
      <p className="mt-1 text-sm text-neutral-700">
        Open each thumbnail to see the full before/after, then use bulk or per-file export below.
      </p>
      <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 scroll-smooth snap-x snap-mandatory">
        {images.map((img) => (
          <div key={img.id} className="snap-start">
            <OutputThumb image={img} selected={selectedId === img.id} onSelect={() => onSelect(img.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}
