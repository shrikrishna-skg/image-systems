package com.imagesystems.api;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/knowledge")
public class KnowledgeController {

    private final KnowledgeScenarioService scenarios;

    public KnowledgeController(KnowledgeScenarioService scenarios) {
        this.scenarios = scenarios;
    }

    @GetMapping("/scenarios/filters")
    public Map<String, Object> filters() {
        return scenarios.filters();
    }

    @GetMapping("/scenarios")
    public Map<String, Object> list(
            @RequestParam(required = false) String vertical,
            @RequestParam(required = false) String room_type_hint,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String rule_ref,
            @RequestParam(required = false) String scenario_id,
            @RequestParam(required = false) String id_prefix,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer min_depth,
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "0") int offset) {
        return scenarios.list(
                vertical, room_type_hint, category, rule_ref, scenario_id, id_prefix, q, min_depth, limit, offset);
    }

    @GetMapping("/scenarios/{scenarioId}")
    public Map<String, Object> one(@PathVariable String scenarioId) {
        return scenarios.one(scenarioId);
    }
}
