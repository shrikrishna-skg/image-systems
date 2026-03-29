function buildKnowledgeScenarioListParams(params) {
  const out = {};
  const {
    vertical,
    room_type_hint,
    category,
    rule_ref,
    scenario_id,
    id_prefix,
    q,
    min_depth,
    limit,
    offset
  } = params;
  if (vertical?.trim()) out.vertical = vertical.trim();
  if (room_type_hint?.trim()) out.room_type_hint = room_type_hint.trim();
  if (category?.trim()) out.category = category.trim();
  if (rule_ref?.trim()) out.rule_ref = rule_ref.trim();
  if (scenario_id?.trim()) out.scenario_id = scenario_id.trim();
  if (id_prefix?.trim()) out.id_prefix = id_prefix.trim();
  if (q?.trim()) out.q = q.trim();
  if (typeof min_depth === "number" && Number.isFinite(min_depth) && min_depth >= 0) {
    out.min_depth = min_depth;
  }
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    out.limit = limit;
  }
  if (typeof offset === "number" && Number.isFinite(offset) && offset >= 0) {
    out.offset = offset;
  }
  return out;
}
export {
  buildKnowledgeScenarioListParams
};
