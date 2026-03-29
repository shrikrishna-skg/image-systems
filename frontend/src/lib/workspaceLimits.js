import {
  isWorkspaceFullForMax,
  remainingWorkspaceSlotsForMax,
  workspaceQueueCountLabelFor
} from "./workspaceLimitsMath";
const DEFAULT_MAX = 9999;
const ABSOLUTE_MAX = 5e4;
function readConfiguredMax() {
  try {
    const raw = import.meta.env.VITE_MAX_WORKSPACE_ASSETS;
    if (raw === void 0 || String(raw).trim() === "") return DEFAULT_MAX;
    const n = Math.floor(Number(String(raw).trim()));
    if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX;
    return Math.min(n, ABSOLUTE_MAX);
  } catch {
    return DEFAULT_MAX;
  }
}
const MAX_WORKSPACE_ASSETS = readConfiguredMax();
const WORKSPACE_UI_SHOW_SLASH_TOTAL = MAX_WORKSPACE_ASSETS <= 200;
function remainingWorkspaceSlots(sessionCount) {
  return remainingWorkspaceSlotsForMax(MAX_WORKSPACE_ASSETS, sessionCount);
}
function isWorkspaceFull(sessionCount) {
  return isWorkspaceFullForMax(MAX_WORKSPACE_ASSETS, sessionCount);
}
function workspaceQueueCountLabel(current) {
  return workspaceQueueCountLabelFor(MAX_WORKSPACE_ASSETS, current, WORKSPACE_UI_SHOW_SLASH_TOTAL);
}
export {
  MAX_WORKSPACE_ASSETS,
  WORKSPACE_UI_SHOW_SLASH_TOTAL,
  isWorkspaceFull,
  remainingWorkspaceSlots,
  workspaceQueueCountLabel
};
