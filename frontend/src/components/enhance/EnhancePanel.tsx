import { useImageStore } from "../../stores/imageStore";
import { Sun, Sparkles, Move, MessageSquare } from "lucide-react";

const LIGHTING_OPTIONS = [
  { value: "bright", label: "Bright & Airy", emoji: "☀️" },
  { value: "warm", label: "Warm & Inviting", emoji: "🌅" },
  { value: "natural", label: "Natural Light", emoji: "🌿" },
  { value: "hdr", label: "HDR Pro", emoji: "📸" },
  { value: "evening", label: "Evening Mood", emoji: "🌙" },
];

const QUALITY_OPTIONS = [
  { value: "full_enhance", label: "Full Enhancement" },
  { value: "sharpen", label: "Sharpen Details" },
  { value: "denoise", label: "Remove Noise" },
  { value: "color_correct", label: "Color Correction" },
];

const PERSPECTIVE_OPTIONS = [
  { value: null, label: "None" },
  { value: "straighten", label: "Straighten Lines" },
  { value: "correct_distortion", label: "Fix Distortion" },
];

const ROOM_TYPES = [
  "general", "bedroom", "bathroom", "lobby",
  "restaurant", "exterior", "pool", "living_room", "kitchen",
];

const PROVIDERS = [
  { value: "openai", label: "OpenAI", models: ["gpt-image-1", "gpt-image-1.5", "gpt-image-1-mini"] },
  { value: "gemini", label: "Google Gemini", models: ["gemini-2.0-flash-exp-image-generation"] },
];

export default function EnhancePanel() {
  const store = useImageStore();
  const currentProvider = PROVIDERS.find((p) => p.value === store.provider);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        Enhancement Settings
      </h3>

      {/* Provider */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
        <div className="flex gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              onClick={() => store.setProvider(p.value)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                store.provider === p.value
                  ? "bg-indigo-100 text-indigo-700 border-2 border-indigo-300"
                  : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Model */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
        <select
          value={store.model}
          onChange={(e) => store.setModel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          {currentProvider?.models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Quality Tier (OpenAI only) */}
      {store.provider === "openai" && (
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Quality Tier</label>
          <div className="flex gap-2">
            {["low", "medium", "high"].map((q) => (
              <button
                key={q}
                onClick={() => store.setQuality(q)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                  store.quality === q
                    ? "bg-indigo-100 text-indigo-700 border-2 border-indigo-300"
                    : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lighting */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
          <Sun className="w-4 h-4" /> Lighting
        </label>
        <div className="grid grid-cols-2 gap-2">
          {LIGHTING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => store.setLighting(store.lighting === opt.value ? null : opt.value)}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors text-left ${
                store.lighting === opt.value
                  ? "bg-amber-50 text-amber-700 border-2 border-amber-300"
                  : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quality Preset */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Quality Enhancement</label>
        <div className="grid grid-cols-2 gap-2">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                store.setQualityPreset(store.qualityPreset === opt.value ? null : opt.value)
              }
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                store.qualityPreset === opt.value
                  ? "bg-green-50 text-green-700 border-2 border-green-300"
                  : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Perspective */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
          <Move className="w-4 h-4" /> Perspective Correction
        </label>
        <div className="flex gap-2">
          {PERSPECTIVE_OPTIONS.map((opt) => (
            <button
              key={opt.value || "none"}
              onClick={() => store.setPerspective(opt.value)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                store.perspective === opt.value
                  ? "bg-blue-50 text-blue-700 border-2 border-blue-300"
                  : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Room Type */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
        <select
          value={store.roomType}
          onChange={(e) => store.setRoomType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none capitalize"
        >
          {ROOM_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {rt.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
          <MessageSquare className="w-4 h-4" /> Custom Instructions (Optional)
        </label>
        <textarea
          value={store.customPrompt || ""}
          onChange={(e) => store.setCustomPrompt(e.target.value || null)}
          placeholder="Add specific instructions... e.g., 'Make the pool water more vibrant blue'"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}
