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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] gap-x-3 gap-y-1 text-sm border-b border-neutral-100 py-2 last:border-0">
      <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wide pt-0.5">{k}</span>
      <span className="text-black font-data text-xs break-words whitespace-pre-wrap">{v}</span>
    </div>
  );
}

interface Props {
  version: ImageVersion;
  onEditSettings: () => void;
}

export default function GenerationRecipePanel({ version, onEditSettings }: Props) {
  const [promptOpen, setPromptOpen] = useState(false);
  const storageOnly = isStorageOnlyMode();
  const localImprove = isLocalImproveVersion(version);

  const p = version.generation_params;
  const hasJobParams = p && Object.keys(p).length > 0;
  const showPrompt = hasPromptForVersion(version);
  const canEditAndRerun = !storageOnly && !localImprove && (hasJobParams || showPrompt);
  const rows = buildGenerationRecipeRows(version);

  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-neutral-200 bg-neutral-50/80">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-white">
          <Sparkles className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-black">How this result was produced</h3>
          <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
            {localImprove
              ? "This version was created with the in-browser Improve engine (no cloud job)."
              : hasJobParams
                ? "Settings from the completed job. Use Edit to load them into the panels and run again."
                : showPrompt
                  ? "Prompt is stored on this version; full job settings may be unavailable for older runs."
                  : "No detailed recipe is stored for this version."}
          </p>
        </div>
      </div>

      <div className="px-5 py-3">
        {rows.length > 0 && (
          <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 px-3">
            {rows.map((r, i) => (
              <Row key={`${r.k}-${i}`} k={r.k} v={r.v} />
            ))}
          </div>
        )}

        {showPrompt && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setPromptOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-black hover:bg-neutral-50 transition-colors"
            >
              <span>Full prompt sent to the model</span>
              {promptOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            </button>
            {promptOpen && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-neutral-200 bg-neutral-900/[0.03] p-3 text-[11px] leading-relaxed text-neutral-800 font-data whitespace-pre-wrap break-words">
                {promptTextForVersion(version)}
              </pre>
            )}
          </div>
        )}
      </div>

      <div className="px-5 pb-5 flex flex-wrap gap-2">
        {canEditAndRerun && (
          <button
            type="button"
            onClick={() => {
              applyVersionRecipeToStore(version);
              onEditSettings();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            <PencilLine className="w-4 h-4" strokeWidth={2} />
            Edit settings &amp; re-run
          </button>
        )}
        {storageOnly && !localImprove && (
          <p className="text-xs text-neutral-500 w-full">
            Connect the full stack to replay cloud job settings. In local mode, adjust panels below before
            processing.
          </p>
        )}
        {localImprove && (
          <button
            type="button"
            onClick={onEditSettings}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-50 transition-colors"
          >
            <PencilLine className="w-4 h-4" strokeWidth={2} />
            Adjust &amp; run again
          </button>
        )}
      </div>
    </div>
  );
}
