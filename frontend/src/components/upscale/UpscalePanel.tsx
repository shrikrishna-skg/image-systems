import { useImageStore } from "../../stores/imageStore";
import { Maximize2 } from "lucide-react";

const SCALE_OPTIONS = [
  { value: 2, label: "2x", description: "Good quality, fast" },
  { value: 4, label: "4x", description: "High quality (4K)" },
];

const RESOLUTION_OPTIONS = [
  { value: "1080p", label: "1080p", pixels: "1920×1080" },
  { value: "2k", label: "2K", pixels: "2560×1440" },
  { value: "4k", label: "4K", pixels: "3840×2160" },
  { value: "8k", label: "8K", pixels: "7680×4320" },
];

const FORMAT_OPTIONS = [
  { value: "png", label: "PNG", description: "Lossless, larger file" },
  { value: "jpeg", label: "JPEG", description: "Smaller file, slight compression" },
  { value: "webp", label: "WebP", description: "Modern, balanced" },
];

export default function UpscalePanel() {
  const store = useImageStore();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Maximize2 className="w-5 h-5 text-indigo-600" />
        Upscale Settings
      </h3>

      {/* Scale Factor */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Scale Factor</label>
        <div className="flex gap-3">
          {SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => store.setScaleFactor(opt.value)}
              className={`flex-1 py-3 px-4 rounded-lg text-center transition-colors ${
                store.scaleFactor === opt.value
                  ? "bg-indigo-100 text-indigo-700 border-2 border-indigo-300"
                  : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
              }`}
            >
              <p className="text-2xl font-bold">{opt.label}</p>
              <p className="text-xs mt-1">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Target Resolution */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Target Resolution</label>
        <div className="grid grid-cols-4 gap-2">
          {RESOLUTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => store.setTargetResolution(opt.value)}
              className={`py-2 px-3 rounded-lg text-center transition-colors ${
                store.targetResolution === opt.value
                  ? "bg-indigo-100 text-indigo-700 border-2 border-indigo-300"
                  : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
              }`}
            >
              <p className="text-sm font-bold">{opt.label}</p>
              <p className="text-xs text-gray-500">{opt.pixels}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Output dimensions preview */}
      {store.currentImage?.width && store.currentImage?.height && (
        <div className="mb-5 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Original:</strong> {store.currentImage.width} × {store.currentImage.height}px
          </p>
          <p className="text-sm text-indigo-700 font-medium">
            <strong>Output:</strong> ~{store.currentImage.width * store.scaleFactor} ×{" "}
            {store.currentImage.height * store.scaleFactor}px
          </p>
        </div>
      )}

      {/* Output Format */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Output Format</label>
        <div className="flex gap-2">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => store.setOutputFormat(opt.value)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                store.outputFormat === opt.value
                  ? "bg-indigo-100 text-indigo-700 border-2 border-indigo-300"
                  : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
              }`}
            >
              <p className="font-bold">{opt.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
