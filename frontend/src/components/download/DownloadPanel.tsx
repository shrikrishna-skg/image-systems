import { Download, FileImage, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ImageVersion } from "../../types";
import client from "../../api/client";
import toast from "react-hot-toast";

interface Props {
  imageId: string;
  versions: ImageVersion[];
}

const VERSION_LABELS: Record<string, string> = {
  enhanced: "AI Enhanced",
  upscaled: "Upscaled",
  final: "Final (Enhanced + Upscaled)",
};

export default function DownloadPanel({ imageId, versions }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!versions?.length) return null;

  const handleDownload = async (versionId?: string, filename?: string) => {
    const key = versionId || "original";
    setDownloading(key);
    try {
      let url = `/images/${imageId}/download`;
      if (versionId) url += `?version=${versionId}`;

      const res = await client.get(url, { responseType: "blob" });

      // Create download link
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "image.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Failed to download image");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Download className="w-5 h-5 text-indigo-600" />
        Download Results
      </h3>

      <div className="space-y-3">
        {/* Original */}
        <button
          onClick={() => handleDownload(undefined, "original.png")}
          disabled={downloading === "original"}
          className="w-full flex items-center justify-between p-3.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <FileImage className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Original</p>
              <p className="text-xs text-gray-500">Unmodified upload</p>
            </div>
          </div>
          {downloading === "original" ? (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          ) : (
            <Download className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {/* Versions */}
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() =>
              handleDownload(v.id, `${v.version_type}_${v.width}x${v.height}.png`)
            }
            disabled={downloading === v.id}
            className="w-full flex items-center justify-between p-3.5 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FileImage className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-indigo-700">
                  {VERSION_LABELS[v.version_type] || v.version_type}
                </p>
                <p className="text-xs text-indigo-500">
                  {v.width && v.height ? `${v.width}×${v.height}` : ""}
                  {v.scale_factor ? ` · ${v.scale_factor}x upscaled` : ""}
                  {v.file_size_bytes
                    ? ` · ${(v.file_size_bytes / 1024 / 1024).toFixed(1)} MB`
                    : ""}
                  {v.processing_cost_usd ? ` · $${v.processing_cost_usd.toFixed(4)}` : ""}
                </p>
              </div>
            </div>
            {downloading === v.id ? (
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-indigo-600" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
