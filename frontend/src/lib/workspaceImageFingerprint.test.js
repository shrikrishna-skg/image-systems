import { describe, expect, it } from "vitest";
import { workspaceImageSyncFingerprint } from "./workspaceImageFingerprint";
const v = (partial) => ({
  width: null,
  height: null,
  file_size_bytes: null,
  provider: null,
  model: null,
  scale_factor: null,
  processing_cost_usd: null,
  created_at: "",
  ...partial
});
describe("workspaceImageSyncFingerprint", () => {
  it("changes when latest version id changes", () => {
    const base = {
      id: "a",
      original_filename: "x.jpg",
      width: 100,
      height: 100,
      file_size_bytes: 1e3,
      mime_type: "image/jpeg",
      created_at: "",
      versions: [v({ id: "v1", version_type: "original", width: 100, height: 100 })]
    };
    const updated = {
      ...base,
      versions: [...base.versions, v({ id: "v2", version_type: "enhanced", width: 200, height: 200 })]
    };
    expect(workspaceImageSyncFingerprint(base)).not.toBe(workspaceImageSyncFingerprint(updated));
  });
});
