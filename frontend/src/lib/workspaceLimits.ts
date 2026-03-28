/**
 * Workspace batch queue size. Default is very high so photographers can import whole shoots and
 * use batch selection / Run batch without hitting a small artificial cap.
 *
 * Optional: set `VITE_MAX_WORKSPACE_ASSETS` (integer 1–50000) to hard-limit for weak devices or policy.
 */
const DEFAULT_MAX = 9999;
const ABSOLUTE_MAX = 50_000;

function readConfiguredMax(): number {
  try {
    const raw = import.meta.env.VITE_MAX_WORKSPACE_ASSETS;
    if (raw === undefined || String(raw).trim() === "") return DEFAULT_MAX;
    const n = Math.floor(Number(String(raw).trim()));
    if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX;
    return Math.min(n, ABSOLUTE_MAX);
  } catch {
    return DEFAULT_MAX;
  }
}

export const MAX_WORKSPACE_ASSETS = readConfiguredMax();

/** Below this, show "12/200" style labels; above, show "12 assets" to avoid noisy "12/9999" copy. */
export const WORKSPACE_UI_SHOW_SLASH_TOTAL = MAX_WORKSPACE_ASSETS <= 200;

export function remainingWorkspaceSlots(sessionCount: number): number {
  return Math.max(0, MAX_WORKSPACE_ASSETS - Math.max(0, sessionCount));
}

export function isWorkspaceFull(sessionCount: number): boolean {
  return sessionCount >= MAX_WORKSPACE_ASSETS;
}

/** Queue header / meters: compact count vs current/max. */
export function workspaceQueueCountLabel(current: number): string {
  if (WORKSPACE_UI_SHOW_SLASH_TOTAL) {
    return `${current}/${MAX_WORKSPACE_ASSETS}`;
  }
  return `${current}`;
}
