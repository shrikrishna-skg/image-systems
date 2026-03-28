import type { ImageInfo } from "../../types";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import { getLatestImageVersion } from "../../lib/imageVersions";
import { Loader2 } from "lucide-react";

function ResultThumbCell({
  image,
  versionId,
  selected,
  onActivate,
}: {
  image: ImageInfo;
  versionId: string;
  selected: boolean;
  onActivate: () => void;
}) {
  const { blobUrl, loading } = useAuthenticatedImage(image.id, versionId);

  return (
    <button
      type="button"
      onClick={onActivate}
      title={`Compare ${image.original_filename} below`}
      className={`group relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-200 text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
        selected
          ? "ring-2 ring-black ring-offset-2 ring-offset-white"
          : "ring-1 ring-emerald-200/80 hover:ring-emerald-400/90"
      }`}
    >
      {loading ? (
        <div className="flex h-full w-full items-center justify-center bg-neutral-100">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" aria-hidden />
        </div>
      ) : blobUrl ? (
        <img
          src={blobUrl}
          alt=""
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-100 px-1 text-center text-[10px] text-neutral-500">
          No preview
        </div>
      )}
      <span className="sr-only">{image.original_filename}</span>
    </button>
  );
}

interface Props {
  images: ImageInfo[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const WORKSPACE_COMPARE_ANCHOR = "workspace-compare-section";

/**
 * Grid of latest improved outputs — same density as originals grid; tap selects asset and scrolls to compare.
 */
export default function WorkspaceBulkResultsPreview({ images, selectedId, onSelect }: Props) {
  const withOutput = images.filter((img) => (img.versions?.length ?? 0) > 0);
  if (withOutput.length === 0) return null;

  const gridClass =
    "grid max-h-[min(48vh,480px)] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-2.5";

  return (
    <section
      className="border-t border-neutral-200 bg-gradient-to-b from-emerald-50/40 to-white px-2 py-3 sm:px-3 sm:py-4"
      aria-label="Improved workspace outputs"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-900/80">Improved outputs</h3>
      <p className="mt-1 text-sm text-neutral-700">
        Same thumbnail grid as originals — tap any improved photo to open{" "}
        <span className="font-medium text-black">side-by-side compare</span> below.
      </p>
      <div className={`mt-3 rounded-xl bg-neutral-100/80 p-2 sm:p-3 ${gridClass}`}>
        {withOutput.map((img) => {
          const latest = getLatestImageVersion(img.versions)!;
          return (
            <ResultThumbCell
              key={img.id}
              image={img}
              versionId={latest.id}
              selected={selectedId === img.id}
              onActivate={() => {
                onSelect(img.id);
                requestAnimationFrame(() => {
                  document
                    .getElementById(WORKSPACE_COMPARE_ANCHOR)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

export { WORKSPACE_COMPARE_ANCHOR };
