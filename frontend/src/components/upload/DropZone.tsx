import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, ImagePlus } from "lucide-react";
import { uploadImages } from "../../api/images";
import { useImageStore } from "../../stores/imageStore";
import toast from "react-hot-toast";

export default function DropZone() {
  const [uploading, setUploading] = useState(false);
  const { setCurrentImage } = useImageStore();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setUploading(true);
      try {
        const results = await uploadImages(acceptedFiles);
        if (results.length > 0) {
          setCurrentImage(results[0]);
          toast.success("Image uploaded successfully!");
        }
      } catch (err: any) {
        toast.error(err.response?.data?.detail || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [setCurrentImage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/tiff": [".tiff", ".tif"],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
        isDragActive
          ? "border-indigo-500 bg-indigo-50"
          : "border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50"
      } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-lg font-medium text-gray-700">Uploading...</p>
        </div>
      ) : isDragActive ? (
        <div className="flex flex-col items-center">
          <ImagePlus className="w-12 h-12 text-indigo-600 mb-4" />
          <p className="text-lg font-medium text-indigo-700">Drop your image here</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <Upload className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drag & drop your hotel or real estate photo
          </p>
          <p className="text-sm text-gray-500 mb-4">or click to browse</p>
          <p className="text-xs text-gray-400">
            Supports JPG, PNG, WebP, TIFF · Max 50MB
          </p>
        </div>
      )}
    </div>
  );
}
