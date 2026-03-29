import { beforeEach, describe, expect, it, vi } from "vitest";
import client from "./client";
import { fetchKnowledgeScenarioFilters, fetchKnowledgeScenarios } from "./knowledge";
vi.mock("./client", () => ({
  default: {
    get: vi.fn()
  }
}));
describe("knowledge API client", () => {
  beforeEach(() => {
    vi.mocked(client.get).mockReset();
  });
  it("fetchKnowledgeScenarioFilters GETs filters endpoint", async () => {
    vi.mocked(client.get).mockResolvedValue({
      data: {
        verticals: ["hotels"],
        room_type_hints: ["bedroom"],
        risk_categories: ["lighting_inventory"],
        rule_refs: ["spatial_fidelity"]
      }
    });
    const data = await fetchKnowledgeScenarioFilters();
    expect(client.get).toHaveBeenCalledWith("/knowledge/scenarios/filters");
    expect(data.verticals).toContain("hotels");
  });
  it("fetchKnowledgeScenarios omits empty filters in query", async () => {
    vi.mocked(client.get).mockResolvedValue({
      data: {
        catalog_version: 3,
        catalog_description: null,
        total: 50,
        filtered: 2,
        offset: 0,
        limit: 24,
        items: []
      }
    });
    await fetchKnowledgeScenarios({
      vertical: "hotels",
      category: "",
      q: "   ",
      limit: 24,
      offset: 0
    });
    expect(client.get).toHaveBeenCalledWith("/knowledge/scenarios", {
      params: { vertical: "hotels", limit: 24, offset: 0 }
    });
  });
  it("fetchKnowledgeScenarios passes undefined params when no args", async () => {
    vi.mocked(client.get).mockResolvedValue({
      data: {
        catalog_version: 3,
        catalog_description: null,
        total: 50,
        filtered: 50,
        offset: 0,
        limit: null,
        items: []
      }
    });
    await fetchKnowledgeScenarios();
    expect(client.get).toHaveBeenCalledWith("/knowledge/scenarios", { params: void 0 });
  });
});
