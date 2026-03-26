import { useState, useEffect } from "react";
import { Loader2, Download, Trash2, Image as ImageIcon } from "lucide-react";
import { listImages, deleteImage, getDownloadUrl } from "../api/images";
import type { ImageInfo } from "../types";
import { useImageStore } from "../stores/imageStore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function HistoryPage() {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { setCurrentImage, setCurrentJob } = useImageStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const data = await listImages(0, 50);
      setImages(data);
    } catch {
      toast.error("Failed to load images");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      toast.success("Image deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleReuse = (img: ImageInfo) => {
    setCurrentImage(img);
    setCurrentJob(null);
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing History</h1>
      <p className="text-gray-600 mb-8">Your previously enhanced images</p>

      {images.length === 0 ? (
        <div className="text-center py-20">
          <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No images processed yet</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 text-indigo-600 font-medium hover:text-indigo-500"
          >
            Upload your first image
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
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div
                  className="h-48 bg-gray-100 flex items-center justify-center cursor-pointer"
                  onClick={() => handleReuse(img)}
                >
                  <img
                    src={`http://localhost:8000/api/images/${img.id}/download`}
                    alt={img.original_filename}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="p-4">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {img.original_filename}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {img.width}x{img.height}
                    {img.versions?.length > 0 && ` · ${img.versions.length} version(s)`}
                    {totalCost > 0 && ` · $${totalCost.toFixed(4)}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(img.created_at).toLocaleDateString()}
                  </p>

                  <div className="flex gap-2 mt-3">
                    {latestVersion && (
                      <a
                        href={getDownloadUrl(img.id, latestVersion.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(img.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
