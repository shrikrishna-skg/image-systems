import { jsx, jsxs } from "react/jsx-runtime";
import { useImageStore } from "../../stores/imageStore";
import { Maximize2 } from "lucide-react";
import { expectedImproveDeliveredSize, expectedUpscaleOutputSize } from "../../lib/targetResolution";
const SCALE_OPTIONS = [
  { value: 2, label: "2x", description: "Good quality, fast" },
  { value: 4, label: "4x", description: "High quality (4K)" }
];
const RESOLUTION_OPTIONS = [
  { value: "1080p", label: "1080p", pixels: "1920\xD71080" },
  { value: "2k", label: "2K", pixels: "2560\xD71440" },
  { value: "4k", label: "4K", pixels: "3840\xD72160" },
  { value: "8k", label: "8K", pixels: "7680\xD74320" }
];
const FORMAT_OPTIONS = [
  { value: "png", label: "PNG", description: "Lossless, larger file" },
  { value: "jpeg", label: "JPEG", description: "Smaller file, slight compression" },
  { value: "webp", label: "WebP", description: "Modern, balanced" }
];
function UpscalePanel() {
  const store = useImageStore();
  return /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-xl border border-gray-200 p-6", children: [
    /* @__PURE__ */ jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(Maximize2, { className: "w-5 h-5 text-black" }),
      "Upscale Settings"
    ] }),
    store.provider === "improve" && /* @__PURE__ */ jsxs("p", { className: "mb-4 text-xs text-gray-500 leading-relaxed", children: [
      "With ",
      /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "Improve" }),
      ", ",
      /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "scale factor" }),
      " ",
      "runs first, then we match your ",
      /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "target resolution" }),
      " long edge when you pick 1080p\u20138K. ",
      /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "Output format" }),
      " is the file type we save. For OpenAI / Gemini + Replicate, the server applies the same sizing rules after cloud enhance."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Scale Factor" }),
      /* @__PURE__ */ jsx("div", { className: "flex gap-3", children: SCALE_OPTIONS.map((opt) => /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => store.setScaleFactor(opt.value),
          className: `flex-1 py-3 px-4 rounded-lg text-center transition-colors ${store.scaleFactor === opt.value ? "bg-neutral-200 text-black border-2 border-black" : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"}`,
          children: [
            /* @__PURE__ */ jsx("p", { className: "text-2xl font-bold", children: opt.label }),
            /* @__PURE__ */ jsx("p", { className: "text-xs mt-1", children: opt.description })
          ]
        },
        opt.value
      )) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Target Resolution" }),
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-4 gap-2", children: RESOLUTION_OPTIONS.map((opt) => /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => store.setTargetResolution(opt.value),
          className: `py-2 px-3 rounded-lg text-center transition-colors ${store.targetResolution === opt.value ? "bg-neutral-200 text-black border-2 border-black" : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"}`,
          children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-bold", children: opt.label }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500", children: opt.pixels })
          ]
        },
        opt.value
      )) })
    ] }),
    store.currentImage?.width && store.currentImage?.height && (() => {
      const { width: ow, height: oh } = store.currentImage;
      if (store.provider === "improve") {
        const br = expectedImproveDeliveredSize(ow, oh, store.scaleFactor, store.targetResolution);
        return /* @__PURE__ */ jsxs("div", { className: "mb-5 p-3 bg-gray-50 rounded-lg space-y-1", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-sm text-gray-600", children: [
            /* @__PURE__ */ jsx("strong", { children: "Original:" }),
            " ",
            ow,
            " \xD7 ",
            oh,
            "px"
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "text-sm text-black font-medium", children: [
            /* @__PURE__ */ jsx("strong", { children: "Output:" }),
            " ~",
            br.width,
            " \xD7 ",
            br.height,
            "px"
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-500 leading-relaxed", children: [
            "From ",
            /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "scale factor" }),
            " then your",
            " ",
            /* @__PURE__ */ jsx("strong", { className: "text-gray-700", children: "target preset" }),
            " (long edge), within browser canvas limits. Perspective crop can shift pixels slightly vs this estimate."
          ] })
        ] });
      }
      const out = expectedUpscaleOutputSize(ow, oh, store.targetResolution, store.scaleFactor);
      return /* @__PURE__ */ jsxs("div", { className: "mb-5 p-3 bg-gray-50 rounded-lg space-y-1", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-sm text-gray-600", children: [
          /* @__PURE__ */ jsx("strong", { children: "Original:" }),
          " ",
          ow,
          " \xD7 ",
          oh,
          "px"
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "text-sm text-black font-medium", children: [
          /* @__PURE__ */ jsx("strong", { children: "Output:" }),
          " ~",
          out.width,
          " \xD7 ",
          out.height,
          "px"
        ] }),
        out.mode === "target" ? /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500 leading-relaxed", children: "Matches your target preset (long edge). With OpenAI or Gemini, the server upscales after enhance and resizes to this size if needed." }) : /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500 leading-relaxed", children: "From scale factor only. Choose a target resolution above to cap the long edge (cloud + Replicate)." })
      ] });
    })(),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Output Format" }),
      /* @__PURE__ */ jsx("div", { className: "flex gap-2", children: FORMAT_OPTIONS.map((opt) => /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => store.setOutputFormat(opt.value),
          className: `flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${store.outputFormat === opt.value ? "bg-neutral-200 text-black border-2 border-black" : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"}`,
          children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold", children: opt.label }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: opt.description })
          ]
        },
        opt.value
      )) })
    ] })
  ] });
}
export {
  UpscalePanel as default
};
