import { useImageStore } from "../../stores/imageStore";
import { PROVIDERS_ENHANCE } from "../../lib/providerIntegrationMeta";
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
  { value: "align_verticals_auto", label: "Align verticals" },
  { value: "level_horizon_auto", label: "Level horizon" },
  { value: "straighten", label: "Straighten Lines" },
  { value: "correct_distortion", label: "Fix Distortion" },
];

const ROOM_TYPES = [
  "general", "bedroom", "bathroom", "lobby",
  "restaurant", "exterior", "pool", "living_room", "kitchen",
];

export default function EnhancePanel() {
  const store = useImageStore();
  const currentProvider = PROVIDERS_ENHANCE.find((p) => p.value === store.provider);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-black" />
        Enhancement Settings
      </h3>

      {/* Provider / engine */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Enhancement engine</label>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS_ENHANCE.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => store.setProvider(p.value)}
              className={`min-w-[5.5rem] flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
                store.provider === p.value
                  ? "bg-neutral-200 text-black border-2 border-black"
                  : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {store.provider === "improve" && (
          <p className="mt-2 text-xs text-gray-500 leading-relaxed">
            Runs in your browser with the options below — no API key. Tuned for{" "}
            <strong className="text-gray-700">texture and edge clarity</strong> (lighting + quality presets +
            a clarity pass). Upscale uses canvas resize with a light detail hint (not Real-ESRGAN).
          </p>
        )}
      </div>

      {/* Model */}
      {store.provider !== "improve" && (
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
          <select
            value={store.model}
            onChange={(e) => store.setModel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 outline-none"
          >
            {currentProvider?.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

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
                    ? "bg-neutral-200 text-black border-2 border-black"
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
                  ? "bg-neutral-200 text-black border-2 border-black"
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
                  ? "bg-neutral-200 text-black border-2 border-black"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PERSPECTIVE_OPTIONS.map((opt) => (
            <button
              key={opt.value || "none"}
              type="button"
              onClick={() => store.setPerspective(opt.value)}
              className={`py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                store.perspective === opt.value
                  ? "bg-neutral-200 text-black border-2 border-black"
                  : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {store.provider === "improve" && (
          <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
            <strong className="text-gray-700">Improve:</strong> Align verticals / level horizon / straighten rotate or
            shear in-canvas, then <strong className="text-gray-700">crop to the tight rectangle</strong> so corners are not
            empty. Fix Distortion uses center crop + stretch for wide-angle edge stretch.
          </p>
        )}
        {store.provider !== "improve" && (
          <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
            <strong className="text-gray-700">OpenAI / Gemini:</strong> For align verticals or level horizon we estimate
            roll in your browser and send a <strong className="text-gray-700">perspective plate</strong> (geometry + white
            corners) so the model can <strong className="text-gray-700">outpaint</strong> walls, floor, and ceiling into a
            full rectangle. Straighten Lines uses a fixed plate the same way. Fix Distortion stays prompt + original frame.
          </p>
        )}
      </div>

      {/* Room Type */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
        <select
          value={store.roomType}
          onChange={(e) => store.setRoomType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 outline-none capitalize"
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
        {store.provider === "improve" && (
          <p className="mb-2 text-xs text-amber-800/90 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5">
            Custom text applies to OpenAI / Gemini only; Improve uses lighting, quality, perspective, and room
            type above.
          </p>
        )}
        <textarea
          value={store.customPrompt || ""}
          onChange={(e) => store.setCustomPrompt(e.target.value || null)}
          placeholder="Add specific instructions... e.g., 'Make the pool water more vibrant blue'"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 outline-none resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}
