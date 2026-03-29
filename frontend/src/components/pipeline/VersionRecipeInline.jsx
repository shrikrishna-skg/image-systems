import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ChevronDown, ChevronUp, PencilLine, Sparkles } from "lucide-react";
import { applyVersionRecipeToStore } from "../../lib/applyGenerationParams";
import {
  buildGenerationRecipeRows,
  hasPromptForVersion,
  isLocalImproveVersion,
  promptTextForVersion
} from "../../lib/versionGenerationRecipe";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
function VersionRecipeInline({ version, onEditSettings }) {
  const [promptOpen, setPromptOpen] = useState(false);
  const storageOnly = isStorageOnlyMode();
  const localImprove = isLocalImproveVersion(version);
  const p = version.generation_params;
  const hasJobParams = p && Object.keys(p).length > 0;
  const showPrompt = hasPromptForVersion(version);
  const rows = buildGenerationRecipeRows(version);
  const canEditCloud = !storageOnly && !localImprove && (hasJobParams || showPrompt);
  const hasAnyRecipe = rows.length > 0 || showPrompt || localImprove;
  return /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-neutral-200/90 bg-white/90 px-3 py-2.5 text-left", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
      /* @__PURE__ */ jsx(Sparkles, { className: "w-3.5 h-3.5 text-black shrink-0", strokeWidth: 2 }),
      /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wide text-neutral-600", children: "How this result was produced" })
    ] }),
    !hasAnyRecipe && /* @__PURE__ */ jsx("p", { className: "text-[11px] text-neutral-500 leading-snug", children: "No stored recipe for this version (e.g. older run or upload-only)." }),
    localImprove && /* @__PURE__ */ jsx("p", { className: "text-[11px] text-neutral-600 leading-snug mb-2", children: "In-browser Improve engine (no cloud job)." }),
    rows.length > 0 && /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]", children: rows.map((r, i) => /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex flex-col sm:flex-row sm:gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: "text-neutral-500 font-semibold uppercase tracking-wide shrink-0", children: r.k }),
      /* @__PURE__ */ jsx("span", { className: "text-black font-data break-words", children: r.v })
    ] }, `${r.k}-${i}`)) }),
    showPrompt && /* @__PURE__ */ jsxs("div", { className: "mt-2 pt-2 border-t border-neutral-100", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: (e) => {
            e.stopPropagation();
            setPromptOpen((o) => !o);
          },
          className: "flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold text-black hover:text-neutral-700",
          children: [
            /* @__PURE__ */ jsx("span", { children: "Full prompt" }),
            promptOpen ? /* @__PURE__ */ jsx(ChevronUp, { className: "w-3.5 h-3.5 shrink-0" }) : /* @__PURE__ */ jsx(ChevronDown, { className: "w-3.5 h-3.5 shrink-0" })
          ]
        }
      ),
      promptOpen && /* @__PURE__ */ jsx("pre", { className: "mt-1.5 max-h-28 overflow-auto rounded-md bg-neutral-900/[0.04] p-2 text-[10px] leading-relaxed text-neutral-800 font-data whitespace-pre-wrap break-words", children: promptTextForVersion(version) })
    ] }),
    onEditSettings && (canEditCloud || localImprove) && /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap gap-2", children: [
      canEditCloud && /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: (e) => {
            e.stopPropagation();
            applyVersionRecipeToStore(version);
            onEditSettings();
          },
          className: "inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black hover:bg-neutral-50",
          children: [
            /* @__PURE__ */ jsx(PencilLine, { className: "w-3.5 h-3.5", strokeWidth: 2 }),
            "Edit & re-run"
          ]
        }
      ),
      localImprove && /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: (e) => {
            e.stopPropagation();
            onEditSettings();
          },
          className: "inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black hover:bg-neutral-50",
          children: [
            /* @__PURE__ */ jsx(PencilLine, { className: "w-3.5 h-3.5", strokeWidth: 2 }),
            "Adjust & run again"
          ]
        }
      )
    ] }),
    storageOnly && !localImprove && onEditSettings && rows.length > 0 && /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] text-neutral-500 leading-snug", children: "Connect the full stack to replay cloud settings from this row." })
  ] });
}
export {
  VersionRecipeInline as default
};
