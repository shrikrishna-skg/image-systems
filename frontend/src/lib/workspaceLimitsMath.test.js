import { describe, expect, it } from "vitest";
import {
  isWorkspaceFullForMax,
  remainingWorkspaceSlotsForMax,
  workspaceQueueCountLabelFor
} from "./workspaceLimitsMath";
import {
  MAX_WORKSPACE_ASSETS,
  WORKSPACE_UI_SHOW_SLASH_TOTAL,
  remainingWorkspaceSlots,
  workspaceQueueCountLabel
} from "./workspaceLimits";
describe("Phase 12 \u2014 workspace limits math", () => {
  it("remainingWorkspaceSlotsForMax never negative", () => {
    expect(remainingWorkspaceSlotsForMax(100, 0)).toBe(100);
    expect(remainingWorkspaceSlotsForMax(100, 100)).toBe(0);
    expect(remainingWorkspaceSlotsForMax(100, 150)).toBe(0);
  });
  it("isWorkspaceFullForMax at boundary", () => {
    expect(isWorkspaceFullForMax(5, 4)).toBe(false);
    expect(isWorkspaceFullForMax(5, 5)).toBe(true);
    expect(isWorkspaceFullForMax(5, 6)).toBe(true);
  });
  it("workspaceQueueCountLabelFor slash vs plain", () => {
    expect(workspaceQueueCountLabelFor(200, 12, true)).toBe("12/200");
    expect(workspaceQueueCountLabelFor(9999, 12, false)).toBe("12");
  });
  it("facade matches pure helpers for configured MAX", () => {
    expect(remainingWorkspaceSlots(0)).toBe(remainingWorkspaceSlotsForMax(MAX_WORKSPACE_ASSETS, 0));
    expect(workspaceQueueCountLabel(3)).toBe(
      workspaceQueueCountLabelFor(MAX_WORKSPACE_ASSETS, 3, WORKSPACE_UI_SHOW_SLASH_TOTAL)
    );
  });
});
