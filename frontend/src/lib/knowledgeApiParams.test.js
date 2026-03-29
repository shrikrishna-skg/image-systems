import { describe, expect, it } from "vitest";
import { buildKnowledgeScenarioListParams } from "./knowledgeApiParams";
describe("buildKnowledgeScenarioListParams", () => {
  it("drops empty strings and undefined fields", () => {
    expect(
      buildKnowledgeScenarioListParams({
        vertical: "",
        room_type_hint: "  ",
        category: "lighting_inventory",
        q: "",
        limit: 12,
        offset: 0
      })
    ).toEqual({ category: "lighting_inventory", limit: 12, offset: 0 });
  });
  it("trims textual filters", () => {
    expect(
      buildKnowledgeScenarioListParams({
        vertical: "  hotels  ",
        q: "  lamp  ",
        limit: 24,
        offset: 48
      })
    ).toEqual({ vertical: "hotels", q: "lamp", limit: 24, offset: 48 });
  });
  it("includes min_depth when valid", () => {
    expect(buildKnowledgeScenarioListParams({ min_depth: 3, limit: 10 })).toEqual({
      min_depth: 3,
      limit: 10
    });
  });
  it("ignores invalid min_depth", () => {
    expect(buildKnowledgeScenarioListParams({ min_depth: -1, limit: 5 })).toEqual({ limit: 5 });
    expect(buildKnowledgeScenarioListParams({ min_depth: NaN, limit: 5 })).toEqual({
      limit: 5
    });
  });
});
