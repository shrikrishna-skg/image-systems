import { describe, expect, it } from "vitest";
import { computeQueueRowStatus } from "./workspaceQueueRowStatus";
describe("Phase 12 \u2014 workspace queue row status", () => {
  const proc = /* @__PURE__ */ new Set(["p1"]);
  it("processing wins when id in processingAssetIds", () => {
    expect(
      computeQueueRowStatus({ id: "p1", versions: [{ x: 1 }] }, proc, false, null)
    ).toBe("processing");
  });
  it("active job on same image is processing", () => {
    expect(
      computeQueueRowStatus({ id: "j1", versions: [] }, /* @__PURE__ */ new Set(), true, "j1")
    ).toBe("processing");
  });
  it("versions present => complete", () => {
    expect(computeQueueRowStatus({ id: "a", versions: [{}] }, /* @__PURE__ */ new Set(), false, null)).toBe("complete");
  });
  it("no versions and not processing => idle", () => {
    expect(computeQueueRowStatus({ id: "a", versions: [] }, /* @__PURE__ */ new Set(), false, null)).toBe("idle");
    expect(computeQueueRowStatus({ id: "a" }, /* @__PURE__ */ new Set(), false, null)).toBe("idle");
  });
  it("processing set beats complete versions", () => {
    expect(
      computeQueueRowStatus({ id: "x", versions: [1, 2] }, /* @__PURE__ */ new Set(["x"]), false, null)
    ).toBe("processing");
  });
});
