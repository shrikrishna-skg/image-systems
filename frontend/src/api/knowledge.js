import client from "./client";
import { buildKnowledgeScenarioListParams } from "../lib/knowledgeApiParams";
async function fetchKnowledgeScenarioFilters() {
  const res = await client.get("/knowledge/scenarios/filters");
  return res.data;
}
async function fetchKnowledgeScenarios(params) {
  const query = params ? buildKnowledgeScenarioListParams(params) : void 0;
  const res = await client.get("/knowledge/scenarios", {
    params: query && Object.keys(query).length > 0 ? query : void 0
  });
  return res.data;
}
async function fetchKnowledgeScenarioById(scenarioId) {
  const res = await client.get(`/knowledge/scenarios/${encodeURIComponent(scenarioId)}`);
  return res.data;
}
export {
  fetchKnowledgeScenarioById,
  fetchKnowledgeScenarioFilters,
  fetchKnowledgeScenarios
};
