import { describe, expect, it } from "vitest";
import { workspaceThumbColumnCount, WORKSPACE_GRID_VIRTUAL_THRESHOLD } from "./workspaceGridVirtual";
describe("workspaceGridVirtual", () => {
  it("column count tracks breakpoints (non-fullscreen)", () => {
    expect(workspaceThumbColumnCount(400, false)).toBe(3);
    expect(workspaceThumbColumnCount(700, false)).toBe(4);
    expect(workspaceThumbColumnCount(900, false)).toBe(5);
    expect(workspaceThumbColumnCount(1100, false)).toBe(6);
  });
  it("fullscreen adds 7th column at xl width", () => {
    expect(workspaceThumbColumnCount(1100, true)).toBe(6);
    expect(workspaceThumbColumnCount(1300, true)).toBe(7);
  });
  it("threshold is positive", () => {
    expect(WORKSPACE_GRID_VIRTUAL_THRESHOLD).toBeGreaterThan(10);
  });
});
