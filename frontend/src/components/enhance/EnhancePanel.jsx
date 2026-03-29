import { jsx, jsxs } from "react/jsx-runtime";
import { useImageStore } from "../../stores/imageStore";
import { ENHANCE_IMAGE_MODEL_LABELS, PROVIDERS_ENHANCE } from "../../lib/providerIntegrationMeta";
import { Sun, Sparkles, Move, MessageSquare } from "lucide-react";
import { PERSPECTIVE_OPTIONS, PERSPECTIVE_SECTION_LABELS, ROOM_TYPES } from "./enhancePanelCatalog";
const LIGHTING_OPTIONS = [
  { value: "bright", label: "Bright & Airy", emoji: "\u2600\uFE0F" },
  { value: "warm", label: "Warm & Inviting", emoji: "\u{1F305}" },
  { value: "natural", label: "Natural Light", emoji: "\u{1F33F}" },
  { value: "hdr", label: "HDR Pro", emoji: "\u{1F4F8}" },
  { value: "evening", label: "Evening Mood", emoji: "\u{1F319}" }
];
const QUALITY_OPTIONS = [
  { value: "full_enhance", label: "Full Enhancement" },
  { value: "sharpen", label: "Sharpen Details" },
  { value: "denoise", label: "Remove Noise" },
  { value: "color_correct", label: "Color Correction" }
];
function EnhancePanel() {
  const store = useImageStore();
  const currentProvider = PROVIDERS_ENHANCE.find((p) => p.value === store.provider);
  return /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-xl border border-gray-200 p-6", children: [
    /* @__PURE__ */ jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(Sparkles, { className: "w-5 h-5 text-black" }),
      "Enhancement Settings"
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Enhancement engine" }),
      /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: PROVIDERS_ENHANCE.map((p) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => store.setProvider(p.value),
          className: `min-w-[5.5rem] flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${store.provider === p.value ? "bg-neutral-200 text-black border-2 border-black" : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"}`,
          children: p.label
        },
        p.value
      )) }),
      store.provider === "improve" && /* @__PURE__ */ jsxs("p", { className: "mt-2 text-xs text-gray-500 leading-relaxed", children: [
        "Runs in your browser with the options below \u2014 no API key. Tuned for",
        " ",
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "texture and edge clarity" }),
        " (lighting + quality presets + a clarity pass). Upscale uses canvas resize with a light detail hint (not Real-ESRGAN)."
      ] }),
      (store.provider === "openai" || store.provider === "gemini") && /* @__PURE__ */ jsxs("p", { className: "mt-2 text-xs text-gray-500 leading-relaxed", children: [
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "Improve always runs first" }),
        " in your browser with the settings below. ",
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "OpenAI and Gemini" }),
        " only receive the",
        " ",
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "saved Improve image" }),
        " (same pipeline step for both): the raw upload is never sent to the cloud model."
      ] })
    ] }),
    store.provider !== "improve" && /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Model" }),
      /* @__PURE__ */ jsx(
        "select",
        {
          value: store.model,
          onChange: (e) => store.setModel(e.target.value),
          className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 outline-none",
          children: currentProvider?.models.map((m) => /* @__PURE__ */ jsx("option", { value: m, children: ENHANCE_IMAGE_MODEL_LABELS[m] ?? m }, m))
        }
      ),
      store.provider === "openai" && /* @__PURE__ */ jsxs("p", { className: "mt-1.5 text-[11px] text-gray-500 leading-relaxed", children: [
        "Uses OpenAI's ",
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "GPT Image" }),
        " models (",
        /* @__PURE__ */ jsx("code", { className: "text-[10px]", children: "images.edit" }),
        "), not chat models like ",
        /* @__PURE__ */ jsx("code", { className: "text-[10px]", children: "gpt-4o" }),
        ".",
        " ",
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "Mini" }),
        " is the budget tier."
      ] }),
      store.provider === "gemini" && /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[11px] text-gray-500 leading-relaxed", children: "Strongest option first; the 2.0 experimental image model is typically the lower-cost choice." })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1", children: [
        /* @__PURE__ */ jsx(Sun, { className: "w-4 h-4" }),
        " Lighting"
      ] }),
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-2", children: LIGHTING_OPTIONS.map((opt) => /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => store.setLighting(store.lighting === opt.value ? null : opt.value),
          className: `py-2 px-3 rounded-lg text-sm font-medium transition-colors text-left ${store.lighting === opt.value ? "bg-neutral-200 text-black border-2 border-black" : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"}`,
          children: [
            opt.emoji,
            " ",
            opt.label
          ]
        },
        opt.value
      )) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Quality Enhancement" }),
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-2", children: QUALITY_OPTIONS.map((opt) => /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => store.setQualityPreset(store.qualityPreset === opt.value ? null : opt.value),
          className: `py-2 px-3 rounded-lg text-sm font-medium transition-colors ${store.qualityPreset === opt.value ? "bg-neutral-200 text-black border-2 border-black" : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"}`,
          children: opt.label
        },
        opt.value
      )) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1", children: [
        /* @__PURE__ */ jsx(Move, { className: "w-4 h-4" }),
        " Perspective Correction"
      ] }),
      ["geometry", "listing", "lens"].map((sectionId) => {
        const meta = PERSPECTIVE_SECTION_LABELS[sectionId];
        const opts = PERSPECTIVE_OPTIONS.filter((o) => o.section === sectionId);
        const sectionDomId = `perspective-section-${sectionId}`;
        return /* @__PURE__ */ jsxs("div", { className: "mb-3 last:mb-0", children: [
          /* @__PURE__ */ jsxs(
            "div",
            {
              id: sectionDomId,
              className: "mb-1.5 flex flex-col gap-0.5 border-l-2 border-neutral-200 pl-2.5",
              children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500", children: meta.title }),
                /* @__PURE__ */ jsx("span", { className: "text-[10px] text-neutral-400 leading-snug", children: meta.description })
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "grid grid-cols-2 sm:grid-cols-3 gap-2",
              role: "group",
              "aria-labelledby": sectionDomId,
              children: opts.map((opt) => /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => store.setPerspective(opt.value),
                  className: `py-2 px-2 rounded-lg text-left transition-colors ${store.perspective === opt.value ? "bg-neutral-200 text-black border-2 border-black" : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"}`,
                  children: [
                    /* @__PURE__ */ jsx("span", { className: "block text-xs sm:text-sm font-medium leading-snug", children: opt.label }),
                    opt.hint ? /* @__PURE__ */ jsx("span", { className: "mt-1 block text-[10px] sm:text-[11px] font-normal text-gray-500 leading-snug", children: opt.hint }) : null
                  ]
                },
                opt.value || "none"
              ))
            }
          )
        ] }, sectionId);
      }),
      store.provider === "improve" && /* @__PURE__ */ jsxs("p", { className: "mt-3 text-[11px] text-gray-500 leading-relaxed border-t border-neutral-100 pt-3", children: [
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "Improve (browser):" }),
        " Geometry uses Sobel-based roll; listing modes nudge hero mass toward **~50%** width. ",
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "Side" }),
        " pairs that with prompts for a **lengthwise** shot from one **narrow** end (bed run may sit **left or right** in frame). Cloud reframes for straight-on vs that story. Straighten / Fix Distortion use fixed transforms + center crop/stretch."
      ] }),
      store.provider !== "improve" && /* @__PURE__ */ jsxs("p", { className: "mt-3 text-[11px] text-gray-500 leading-relaxed border-t border-neutral-100 pt-3", children: [
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "OpenAI / Gemini:" }),
        " Browser plate + outpaint when applicable.",
        " ",
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "Front" }),
        " = straight-on wall. ",
        /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "Side" }),
        " =",
        " ",
        "**down-the-room** end vantage (depth to far wall, plumb verticals; hero wall left or right per photo). Align / Level / Straighten / Fix follow the geometry and lens groups above."
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Room Type" }),
      /* @__PURE__ */ jsx(
        "select",
        {
          value: store.roomType,
          onChange: (e) => store.setRoomType(e.target.value),
          className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 outline-none capitalize",
          children: ROOM_TYPES.map((rt) => /* @__PURE__ */ jsx("option", { value: rt, children: rt.replace("_", " ") }, rt))
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1", children: [
        /* @__PURE__ */ jsx(MessageSquare, { className: "w-4 h-4" }),
        " Custom Instructions (Optional)"
      ] }),
      store.provider === "improve" && /* @__PURE__ */ jsx("p", { className: "mb-2 text-xs text-amber-800/90 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5", children: "Custom text applies to OpenAI / Gemini only; Improve uses lighting, quality, perspective, and room type above." }),
      /* @__PURE__ */ jsx(
        "textarea",
        {
          value: store.customPrompt || "",
          onChange: (e) => store.setCustomPrompt(e.target.value || null),
          placeholder: "Add specific instructions... e.g., 'Make the pool water more vibrant blue'",
          className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 outline-none resize-none",
          rows: 3
        }
      )
    ] })
  ] });
}
export {
  EnhancePanel as default
};
