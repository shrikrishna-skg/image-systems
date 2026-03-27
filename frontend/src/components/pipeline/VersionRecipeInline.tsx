import { useState } from "react";
import { ChevronDown, ChevronUp, PencilLine, Sparkles } from "lucide-react";
import type { ImageVersion } from "../../types";
import { applyVersionRecipeToStore } from "../../lib/applyGenerationParams";
import {
  buildGenerationRecipeRows,
  hasPromptForVersion,
  isLocalImproveVersion,
  promptTextForVersion,
} from "../../lib/versionGenerationRecipe";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";

interface Props {
  version: ImageVersion;
  /** Opens pipeline settings with this version’s params when possible. */
  onEditSettings?: () => void;
}

export default function VersionRecipeInline({ version, onEditSettings }: Props) {
  const [promptOpen, setPromptOpen] = useState(false);
  const storageOnly = isStorageOnlyMode();
  const localImprove = isLocalImproveVersion(version);
  const p = version.generation_params;
  const hasJobParams = p && Object.keys(p).length > 0;
  const showPrompt = hasPromptForVersion(version);
  const rows = buildGenerationRecipeRows(version);
  const canEditCloud = !storageOnly && !localImprove && (hasJobParams || showPrompt);
  const hasAnyRecipe = rows.length > 0 || showPrompt || localImprove;

  return (
    <div className="rounded-lg border border-neutral-200/90 bg-white/90 px-3 py-2.5 text-left">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-black shrink-0" strokeWidth={2} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
          How this result was produced
        </span>
      </div>
      {!hasAnyRecipe && (
        <p className="text-[11px] text-neutral-500 leading-snug">
          No stored recipe for this version (e.g. older run or upload-only).
        </p>
      )}
      {localImprove && (
        <p className="text-[11px] text-neutral-600 leading-snug mb-2">
          In-browser Improve engine (no cloud job).
        </p>
      )}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          {rows.map((r, i) => (
            <div key={`${r.k}-${i}`} className="min-w-0 flex flex-col sm:flex-row sm:gap-2">
              <span className="text-neutral-500 font-semibold uppercase tracking-wide shrink-0">{r.k}</span>
              <span className="text-black font-data break-words">{r.v}</span>
            </div>
          ))}
        </div>
      )}
      {showPrompt && (
        <div className="mt-2 pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPromptOpen((o) => !o);
            }}
            className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold text-black hover:text-neutral-700"
          >
            <span>Full prompt</span>
            {promptOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
          </button>
          {promptOpen && (
            <pre className="mt-1.5 max-h-28 overflow-auto rounded-md bg-neutral-900/[0.04] p-2 text-[10px] leading-relaxed text-neutral-800 font-data whitespace-pre-wrap break-words">
              {promptTextForVersion(version)}
            </pre>
          )}
        </div>
      )}
      {onEditSettings && (canEditCloud || localImprove) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {canEditCloud && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                applyVersionRecipeToStore(version);
                onEditSettings();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black hover:bg-neutral-50"
            >
              <PencilLine className="w-3.5 h-3.5" strokeWidth={2} />
              Edit &amp; re-run
            </button>
          )}
          {localImprove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditSettings();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black hover:bg-neutral-50"
            >
              <PencilLine className="w-3.5 h-3.5" strokeWidth={2} />
              Adjust &amp; run again
            </button>
          )}
        </div>
      )}
      {storageOnly && !localImprove && onEditSettings && rows.length > 0 && (
        <p className="mt-2 text-[10px] text-neutral-500 leading-snug">
          Connect the full stack to replay cloud settings from this row.
        </p>
      )}
    </div>
  );
}
