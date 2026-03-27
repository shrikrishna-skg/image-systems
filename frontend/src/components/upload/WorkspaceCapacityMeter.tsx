import { MAX_WORKSPACE_ASSETS } from "../../lib/workspaceLimits";

interface Props {
  used: number;
  /** Larger layout for the empty-state hero */
  variant?: "compact" | "hero";
}

export default function WorkspaceCapacityMeter({ used, variant = "compact" }: Props) {
  const max = MAX_WORKSPACE_ASSETS;
  const pct = Math.min(100, (used / max) * 100);
  const full = used >= max;
  const hero = variant === "hero";

  return (
    <div
      className={hero ? "w-full max-w-md mx-auto mt-6" : "min-w-[9rem] flex-1 max-w-xs"}
      role="status"
      aria-live="polite"
      aria-label={`Workspace batch capacity ${used} of ${max} assets`}
    >
      <div
        className={`flex items-center justify-between gap-2 ${hero ? "text-xs" : "text-[10px]"} font-semibold uppercase tracking-wider text-neutral-500`}
      >
        <span>{hero ? "Batch capacity (this workspace)" : "Batch cap"}</span>
        <span className={`font-data tabular-nums ${full ? "text-amber-700" : "text-neutral-800"}`}>
          {used}/{max}
        </span>
      </div>
      <div
        className={`mt-2 rounded-full overflow-hidden ${full ? "bg-amber-100" : "bg-neutral-200"} ${hero ? "h-2" : "h-1.5"}`}
      >
        <div
          className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out ${
            full ? "bg-amber-500" : "bg-black"
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
