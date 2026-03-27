import { useState, useEffect } from "react";
import { Loader2, Download, Trash2, Image as ImageIcon } from "lucide-react";
import { listImages, deleteImage, getDownloadUrl } from "../api/images";
import { listLocalImages, deleteLocalImage, getLocalBlob } from "../lib/localImageStore";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import type { ImageInfo } from "../types";
import { useImageStore } from "../stores/imageStore";
import { useNavigate } from "react-router-dom";
import { useAuthenticatedImage } from "../hooks/useAuthenticatedImage";
import FullscreenImageRegion from "../components/media/FullscreenImageRegion";
import OptimizedImage from "../components/media/OptimizedImage";
import { toast } from "sonner";

const storageOnly = isStorageOnlyMode();

function HistoryThumb({ imageId, versionId }: { imageId: string; versionId?: string | null }) {
  const { blobUrl, loading } = useAuthenticatedImage(imageId, versionId);
  if (loading && !blobUrl) {
    return <Loader2 className="w-8 h-8 animate-spin text-slate-400" />;
  }
  if (!blobUrl) {
    return <ImageIcon className="w-12 h-12 text-slate-300" />;
  }
  return <OptimizedImage lazy src={blobUrl} alt="" className="h-full w-full object-cover" />;
}

export default function HistoryPage() {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const replaceSessionWith = useImageStore((s) => s.replaceSessionWith);
  const navigate = useNavigate();

  useEffect(() => {
    void loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const data = storageOnly ? await listLocalImages() : await listImages(0, 50);
      setImages(data);
    } catch {
      toast.error("Failed to load images");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (storageOnly) {
        await deleteLocalImage(id);
      } else {
        await deleteImage(id);
      }
      setImages((prev) => prev.filter((img) => img.id !== id));
      toast.success("Image deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleReuse = (img: ImageInfo) => {
    replaceSessionWith([img]);
    navigate("/");
  };

  const downloadLocal = async (imageId: string, versionId?: string) => {
    try {
      const blob = await getLocalBlob(imageId, versionId);
      if (!blob) throw new Error("missing");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = versionId ? "enhanced.png" : "original";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto pb-16">
      <header className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black mb-2">
          Library
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Past runs &amp; exports</h1>
        <p className="mt-3 text-slate-600 max-w-2xl leading-relaxed">
          {storageOnly
            ? "Everything here lives in IndexedDB on this device—reopen a shot to keep editing, or download the latest version for mockups."
            : "Reopen any listing image to iterate on enhancement and upscale, or download versions you already shipped to OTAs or MLS."}
        </p>
      </header>

      {images.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-slate-200 bg-white/60">
          <ImageIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.25} />
          <p className="text-slate-600 text-lg font-medium">No images yet</p>
          <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
            Import a property photo from Enhance to see thumbnails and downloads here.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 text-black font-semibold hover:text-neutral-600 underline-offset-2 hover:underline"
          >
            Go to Enhance
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((img) => {
            const latestVersion = img.versions?.[img.versions.length - 1];
            const totalCost = img.versions?.reduce(
              (sum, v) => sum + (v.processing_cost_usd || 0),
              0
            );

            return (
              <div
                key={img.id}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden transition-colors hover:border-slate-300/90"
              >
                <div
                  className="h-48 bg-slate-100 cursor-pointer group/thumb relative"
                  onClick={() => handleReuse(img)}
                >
                  <FullscreenImageRegion
                    className="h-full w-full"
                    stopInteractionPropagation
                    alwaysShowTrigger
                  >
                    <HistoryThumb imageId={img.id} versionId={latestVersion?.id ?? null} />
                  </FullscreenImageRegion>
                </div>
                <div className="p-4">
                  <p className="font-medium text-slate-900 text-sm truncate">
                    {img.original_filename}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {img.width}x{img.height}
                    {img.versions?.length > 0 && ` · ${img.versions.length} version(s)`}
                    {totalCost > 0 && ` · $${totalCost.toFixed(4)}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(img.created_at).toLocaleDateString()}
                  </p>

                  <div className="flex gap-2 mt-3">
                    {latestVersion && (
                      <button
                        type="button"
                        onClick={() =>
                          storageOnly
                            ? void downloadLocal(img.id, latestVersion.id)
                            : window.open(getDownloadUrl(img.id, latestVersion.id), "_blank")
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-neutral-100 text-black rounded-xl hover:bg-neutral-200 border border-neutral-200 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(img.id)}
                      className="p-2 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded-xl transition-colors"
                      aria-label="Delete image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
