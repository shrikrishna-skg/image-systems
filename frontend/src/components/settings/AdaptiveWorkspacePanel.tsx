import { Link } from "react-router-dom";
import {
  useAdaptiveExperienceStore,
} from "../../stores/adaptiveExperienceStore";
import {
  calibrationReadinessPercent,
  CALIBRATION_TARGET_UNITS,
} from "../../lib/adaptiveCalibration";
import { Brain, Pin, RotateCcw, Sparkles } from "lucide-react";

export default function AdaptiveWorkspacePanel() {
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

  return (
    <section className="rounded-2xl border border-neutral-200/90 bg-white p-6 mb-8">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
          <Brain className="h-5 w-5 text-black" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-black">Adaptive workspace</h2>
          <p className="text-sm text-neutral-600 mt-1 leading-relaxed">
            The workspace <strong className="text-black">learns from evidence</strong>: each finished job adds a{" "}
            <strong className="text-black">weighted signal</strong>—full cloud pipelines count more than a single
            enhance or upscale step, and local Improve runs sit in between—so readiness reflects how deeply you&apos;ve
            exercised the stack, not just click count. At 100% you may adopt tier 2 presets. Nothing here trains
            foundation models; you keep GitHub-style <strong className="text-black">pin and rollback</strong>.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 mb-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Calibration confidence
          </span>
          <span className="text-sm font-data font-semibold text-black tabular-nums">{readiness}%</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-black transition-all duration-500"
            style={{ width: `${readiness}%` }}
          />
        </div>
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
          <strong className="text-black tabular-nums">{calibrationMass.toFixed(2)}</strong> /{" "}
          <strong className="text-black">{CALIBRATION_TARGET_UNITS}</strong> weighted calibration units from{" "}
          <strong className="text-black">{observedCompletionCount}</strong> deduped completion(s). Stored only on
          this device.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-black">
          <Sparkles className="h-3.5 w-3.5" />
          Experience tier {experienceTier}
          {experienceTier === 2 ? " · Adaptive defaults" : " · Classic defaults"}
        </span>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl border border-neutral-200 mb-5">
        <Pin className="h-5 w-5 text-black shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={pinToClassicExperience}
              onChange={(e) => setPinToClassicExperience(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400"
            />
            <span>
              <span className="font-medium text-black block">Pin classic experience</span>
              <span className="text-sm text-neutral-600">
                Like pinning a dependency on GitHub—stay on tier 1 defaults even after calibration reaches
                100%. Turn off to see upgrade offers.
              </span>
            </span>
          </label>
        </div>
      </div>

      {offerUpgrade && (
        <div className="rounded-xl border-2 border-black bg-white p-5 mb-4">
          <p className="font-semibold text-black mb-1">Upgrade ready — 100% calibration confidence</p>
          <p className="text-sm text-neutral-600 mb-4">
            Tier 2 applies natural lighting, <strong className="text-black">auto-align verticals</strong> (smart
            perspective), 3× default upscale, and 4K output—tuned for listing packs. You can roll back anytime.
          </p>
          <button
            type="button"
            onClick={() => applyAdaptiveUpgrade()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
          >
            Apply adaptive upgrade
          </button>
        </div>
      )}

      {experienceTier === 2 && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-start gap-3">
            <RotateCcw className="h-5 w-5 text-black shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-black">Roll back to classic</p>
              <p className="text-sm text-neutral-600 mt-1 mb-3">
                Restores tier 1 defaults and enables &quot;pin classic&quot; so behavior stays predictable.
              </p>
              <button
                type="button"
                onClick={() => rollbackToClassicExperience()}
                className="px-4 py-2 rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-black hover:bg-neutral-100 transition-colors"
              >
                Roll back
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-neutral-500 mt-4 leading-relaxed">
        Calibration uses job type (full pipeline vs enhance vs upscale) and engine (cloud vs Improve) to weight
        each completion. Server-side hooks can extend the same signals later.{" "}
        <Link to="/" className="text-black font-medium underline underline-offset-2">
          Run pipelines on Operations
        </Link>{" "}
        to advance calibration.
      </p>
    </section>
  );
}
