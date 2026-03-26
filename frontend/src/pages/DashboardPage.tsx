import { useState, useEffect } from "react";
import { Loader2, Wand2, AlertCircle, ImageIcon, X, CheckCircle2, Upload } from "lucide-react";
import DropZone from "../components/upload/DropZone";
import EnhancePanel from "../components/enhance/EnhancePanel";
import UpscalePanel from "../components/upscale/UpscalePanel";
import BeforeAfterSlider from "../components/comparison/BeforeAfterSlider";
import DownloadPanel from "../components/download/DownloadPanel";
import { useImageStore } from "../stores/imageStore";
import { useJobPolling } from "../hooks/useJobPolling";
import { useAuthenticatedImage } from "../hooks/useAuthenticatedImage";
import { processImage, estimateCost } from "../api/images";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const store = useImageStore();
  const { startPolling, stopPolling } = useJobPolling();
  const [processing, setProcessing] = useState(false);

  // Load original image via authenticated endpoint
  const { blobUrl: originalImageUrl, loading: imageLoading } = useAuthenticatedImage(
    store.currentImage?.id || null
  );

  // Estimate cost when settings change
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!store.currentImage) return;
      try {
        const cost = await estimateCost({
          provider: store.provider,
          model: store.model,
          lighting: store.lighting,
          quality_preset: store.qualityPreset,
          perspective: store.perspective,
          room_type: store.roomType,
          custom_prompt: store.customPrompt,
          quality: store.quality,
          scale_factor: store.scaleFactor,
          target_resolution: store.targetResolution,
          output_format: store.outputFormat,
        });
        store.setCostEstimate(cost);
      } catch {
        // Ignore cost estimation errors
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [
    store.currentImage,
    store.provider,
    store.model,
    store.quality,
    store.scaleFactor,
  ]);

  const handleProcess = async () => {
    if (!store.currentImage) return;

    setProcessing(true);
    try {
      const job = await processImage(store.currentImage.id, {
        provider: store.provider,
        model: store.model,
        lighting: store.lighting,
        quality_preset: store.qualityPreset,
        perspective: store.perspective,
        room_type: store.roomType,
        custom_prompt: store.customPrompt,
        quality: store.quality,
        scale_factor: store.scaleFactor,
        target_resolution: store.targetResolution,
        output_format: store.outputFormat,
      });
      store.setCurrentJob(job);
      startPolling(job.id);
      toast.success("Processing started!");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to start processing");
    } finally {
      setProcessing(false);
    }
  };

  const isJobActive =
    store.currentJob?.status === "pending" || store.currentJob?.status === "processing";
  const isJobCompleted = store.currentJob?.status === "completed";
  const isJobFailed = store.currentJob?.status === "failed";

  // Get the result version for before/after
  const resultVersion = store.currentImage?.versions?.find(
    (v) => v.id === store.currentJob?.result_version_id
  );

  // Progress bar label
  const getProgressLabel = (pct: number) => {
    if (pct < 15) return "Preparing image...";
    if (pct < 40) return "Enhancing with AI...";
    if (pct < 70) return "Upscaling to high resolution...";
    if (pct < 90) return "Saving result...";
    return "Finalizing...";
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Enhance Your Photos</h1>
        <p className="text-gray-500 mt-1">
          Upload a hotel or real estate photo, choose your enhancements, and let AI do the rest.
        </p>
      </div>

      {/* Upload Area */}
      {!store.currentImage && <DropZone />}

      {/* Current Image + Controls */}
      {store.currentImage && (
        <div className="space-y-6">
          {/* Image Preview Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">
                    {store.currentImage.original_filename}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {store.currentImage.width} x {store.currentImage.height}px
                    {store.currentImage.file_size_bytes &&
                      ` · ${(store.currentImage.file_size_bytes / 1024 / 1024).toFixed(1)} MB`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopPolling();
                  store.reset();
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
              >
                <Upload className="w-3.5 h-3.5" />
                New image
              </button>
            </div>

            {/* Image display */}
            <div className="p-4">
              {isJobCompleted && resultVersion ? (
                <BeforeAfterSlider
                  imageId={store.currentImage.id}
                  resultVersionId={resultVersion.id}
                />
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center min-h-[200px]">
                  {imageLoading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                      <p className="text-sm text-gray-400">Loading image...</p>
                    </div>
                  ) : originalImageUrl ? (
                    <img
                      src={originalImageUrl}
                      alt={store.currentImage.original_filename}
                      className="max-h-[450px] w-auto object-contain rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <ImageIcon className="w-12 h-12 text-gray-300" />
                      <p className="text-sm text-gray-400">Image preview unavailable</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Enhancement Controls */}
          {!isJobActive && !isJobCompleted && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EnhancePanel />
              <UpscalePanel />
            </div>
          )}

          {/* Cost Estimate + Process Button */}
          {!isJobActive && !isJobCompleted && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              {store.costEstimate && (
                <div className="mb-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-indigo-800 font-medium">Estimated cost</p>
                    <p className="text-lg font-bold text-indigo-700">
                      ${store.costEstimate.total_cost.toFixed(4)}
                    </p>
                  </div>
                  <p className="text-xs text-indigo-500 mt-1">{store.costEstimate.details}</p>
                </div>
              )}
              <button
                onClick={handleProcess}
                disabled={processing}
                className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-semibold text-base hover:bg-indigo-700 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 active:scale-[0.98]"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Enhance & Upscale
                  </>
                )}
              </button>
            </div>
          )}

          {/* Progress */}
          {isJobActive && store.currentJob && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Processing your image</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {getProgressLabel(store.currentJob.progress_pct)}
                  </p>
                </div>
                <span className="text-2xl font-bold text-indigo-600 tabular-nums">
                  {store.currentJob.progress_pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${store.currentJob.progress_pct}%`,
                    background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",
                  }}
                />
              </div>

              {/* Step indicators */}
              <div className="flex justify-between mt-3 text-xs text-gray-400">
                <span className={store.currentJob.progress_pct >= 10 ? "text-indigo-600 font-medium" : ""}>
                  Upload
                </span>
                <span className={store.currentJob.progress_pct >= 30 ? "text-indigo-600 font-medium" : ""}>
                  Enhance
                </span>
                <span className={store.currentJob.progress_pct >= 60 ? "text-indigo-600 font-medium" : ""}>
                  Upscale
                </span>
                <span className={store.currentJob.progress_pct >= 100 ? "text-indigo-600 font-medium" : ""}>
                  Done
                </span>
              </div>
            </div>
          )}

          {/* Completed */}
          {isJobCompleted && store.currentJob && !resultVersion && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-semibold text-green-900">Processing complete!</p>
                <p className="text-sm text-green-700 mt-0.5">Your enhanced image is ready.</p>
              </div>
            </div>
          )}

          {/* Error */}
          {isJobFailed && store.currentJob && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">Processing failed</p>
                <p className="text-sm text-red-700 mt-1">{store.currentJob.error_message}</p>
              </div>
              <button
                onClick={() => store.setCurrentJob(null)}
                className="text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Download Panel */}
          {isJobCompleted && store.currentImage && (
            <DownloadPanel
              imageId={store.currentImage.id}
              versions={store.currentImage.versions}
            />
          )}
        </div>
      )}
    </div>
  );
}
