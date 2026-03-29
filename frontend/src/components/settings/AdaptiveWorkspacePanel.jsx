import { jsx, jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import {
  useAdaptiveExperienceStore
} from "../../stores/adaptiveExperienceStore";
import {
  calibrationReadinessPercent,
  CALIBRATION_TARGET_UNITS
} from "../../lib/adaptiveCalibration";
import { Brain, Pin, RotateCcw, Sparkles } from "lucide-react";
function AdaptiveWorkspacePanel() {
  const calibrationMass = useAdaptiveExperienceStore((s) => s.calibrationMass);
  const observedCompletionCount = useAdaptiveExperienceStore((s) => s.observedCompletionCount);
  const pinToClassicExperience = useAdaptiveExperienceStore((s) => s.pinToClassicExperience);
  const experienceTier = useAdaptiveExperienceStore((s) => s.experienceTier);
  const setPinToClassicExperience = useAdaptiveExperienceStore((s) => s.setPinToClassicExperience);
  const applyAdaptiveUpgrade = useAdaptiveExperienceStore((s) => s.applyAdaptiveUpgrade);
  const rollbackToClassicExperience = useAdaptiveExperienceStore((s) => s.rollbackToClassicExperience);
  const getShouldOfferUpgrade = useAdaptiveExperienceStore((s) => s.getShouldOfferUpgrade);
  const readiness = calibrationReadinessPercent(calibrationMass);
  const offerUpgrade = getShouldOfferUpgrade();
  return /* @__PURE__ */ jsxs("section", { className: "rounded-2xl border border-neutral-200/90 bg-white p-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 mb-4", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50", children: /* @__PURE__ */ jsx(Brain, { className: "h-5 w-5 text-black", strokeWidth: 2 }) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-black", children: "Adaptive workspace" }),
        /* @__PURE__ */ jsxs("p", { className: "text-sm text-neutral-600 mt-1 leading-relaxed", children: [
          "The more you run real jobs on this device, the better we understand your typical workflow. That feeds a simple ",
          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "readiness meter" }),
          " \u2014 when it's full, you can opt into richer default settings (lighting, perspective, upscale). Nothing here trains external AI models; you can always",
          " ",
          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "pin classic behavior" }),
          " or roll back if you prefer the old defaults."
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-neutral-200 bg-neutral-50 p-4 mb-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3 mb-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-neutral-500", children: "Calibration confidence" }),
        /* @__PURE__ */ jsxs("span", { className: "text-sm font-data font-semibold text-black tabular-nums", children: [
          readiness,
          "%"
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "h-2 rounded-full bg-neutral-200 overflow-hidden", children: /* @__PURE__ */ jsx(
        "div",
        {
          className: "h-full rounded-full bg-black transition-all duration-500",
          style: { width: `${readiness}%` }
        }
      ) }),
      /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-500 mt-2 leading-relaxed", children: [
        "Based on ",
        /* @__PURE__ */ jsx("strong", { className: "text-black", children: observedCompletionCount }),
        " completed job",
        observedCompletionCount === 1 ? "" : "s",
        " on this device. Technical score:",
        " ",
        /* @__PURE__ */ jsx("strong", { className: "text-black tabular-nums", children: calibrationMass.toFixed(1) }),
        " /",
        " ",
        /* @__PURE__ */ jsx("strong", { className: "text-black", children: CALIBRATION_TARGET_UNITS }),
        "."
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex flex-wrap items-center gap-2 mb-5", children: /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-black", children: [
      /* @__PURE__ */ jsx(Sparkles, { className: "h-3.5 w-3.5" }),
      "Experience tier ",
      experienceTier,
      experienceTier === 2 ? " \xB7 Adaptive defaults" : " \xB7 Classic defaults"
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 p-4 rounded-xl border border-neutral-200 mb-5", children: [
      /* @__PURE__ */ jsx(Pin, { className: "h-5 w-5 text-black shrink-0 mt-0.5" }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 min-w-0", children: /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-3 cursor-pointer", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: pinToClassicExperience,
            onChange: (e) => setPinToClassicExperience(e.target.checked),
            className: "h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400"
          }
        ),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("span", { className: "font-medium text-black block", children: "Keep classic defaults" }),
          /* @__PURE__ */ jsx("span", { className: "text-sm text-neutral-600", children: "Stay on the original preset style even after the meter reaches 100%. Turn off to see offers for the richer default pack." })
        ] })
      ] }) })
    ] }),
    offerUpgrade && /* @__PURE__ */ jsxs("div", { className: "rounded-xl border-2 border-black bg-white p-5 mb-4", children: [
      /* @__PURE__ */ jsx("p", { className: "font-semibold text-black mb-1", children: "Upgrade ready \u2014 100% calibration confidence" }),
      /* @__PURE__ */ jsxs("p", { className: "text-sm text-neutral-600 mb-4", children: [
        "Tier 2 applies natural lighting, ",
        /* @__PURE__ */ jsx("strong", { className: "text-black", children: "auto-align verticals" }),
        " (smart perspective), 3\xD7 default upscale, and 4K output\u2014tuned for listing packs. You can roll back anytime."
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => applyAdaptiveUpgrade(),
          className: "w-full sm:w-auto px-5 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-colors",
          children: "Apply adaptive upgrade"
        }
      )
    ] }),
    experienceTier === 2 && /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-neutral-200 bg-neutral-50 p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
      /* @__PURE__ */ jsx(RotateCcw, { className: "h-5 w-5 text-black shrink-0 mt-0.5" }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "font-medium text-black", children: "Roll back to classic" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-600 mt-1 mb-3", children: 'Restores tier 1 defaults and enables "pin classic" so behavior stays predictable.' }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => rollbackToClassicExperience(),
            className: "px-4 py-2 rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-black hover:bg-neutral-100 transition-colors",
            children: "Roll back"
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-neutral-500 mt-4 leading-relaxed", children: [
      "Calibration uses job type (full pipeline vs enhance vs upscale) and engine (cloud vs Improve) to weight each completion. Server-side hooks can extend the same signals later.",
      " ",
      /* @__PURE__ */ jsx(Link, { to: "/", className: "text-black font-medium underline underline-offset-2", children: "Run pipelines on Operations" }),
      " ",
      "to advance calibration."
    ] })
  ] });
}
export {
  AdaptiveWorkspacePanel as default
};
