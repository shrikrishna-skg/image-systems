import { MAX_WORKSPACE_ASSETS, WORKSPACE_UI_SHOW_SLASH_TOTAL } from "../../lib/workspaceLimits";

interface Props {
  used: number;
  /** Larger layout for the empty-state hero */
  variant?: "compact" | "hero";
}

export default function WorkspaceCapacityMeter({ used, variant = "compact" }: Props) {
  const max = MAX_WORKSPACE_ASSETS;
  const full = used >= max;
  const hero = variant === "hero";
  const showProportionalFill = WORKSPACE_UI_SHOW_SLASH_TOTAL || full;
  const pct = showProportionalFill ? Math.min(100, (used / max) * 100) : 0;

  const countLabel = WORKSPACE_UI_SHOW_SLASH_TOTAL ? `${used}/${max}` : `${used.toLocaleString()} images`;
  const ariaLabel = WORKSPACE_UI_SHOW_SLASH_TOTAL
    ? `Workspace batch capacity ${used} of ${max} assets`
    : `Workspace has ${used.toLocaleString()} images; configured maximum ${max.toLocaleString()}`;

  return (
    <div
      className={hero ? "w-full max-w-md mx-auto mt-6" : "min-w-[9rem] flex-1 max-w-xs"}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div
        className={`flex items-center justify-between gap-2 ${hero ? "text-xs" : "text-[10px]"} font-semibold uppercase tracking-wider text-neutral-500`}
      >
        <span>
          {hero
            ? WORKSPACE_UI_SHOW_SLASH_TOTAL
              ? "Batch capacity (this workspace)"
              : "Workspace size"
            : WORKSPACE_UI_SHOW_SLASH_TOTAL
              ? "Batch cap"
              : "In workspace"}
        </span>
        <span className={`font-data tabular-nums ${full ? "text-amber-700" : "text-neutral-800"}`}>
          {countLabel}
        </span>
      </div>
      <div
        className={`mt-2 rounded-full overflow-hidden ${full ? "bg-amber-100" : "bg-neutral-200"} ${hero ? "h-2" : "h-1.5"}`}
      >
        <div
          className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out ${
            full ? "bg-amber-500" : showProportionalFill ? "bg-black" : "bg-transparent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {full && (
        <p
          className={`mt-2 text-neutral-600 leading-snug ${hero ? "text-sm" : "text-[10px]"}`}
        >
          {hero
            ? "You’ve reached the per-workspace limit. Run the batch or clear the console, then import the next set."
            : "Workspace full — process or remove assets to add more."}
        </p>
      )}
    </div>
  );
}
