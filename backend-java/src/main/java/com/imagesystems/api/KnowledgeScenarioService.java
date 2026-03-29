package com.imagesystems.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class KnowledgeScenarioService {

    private final ObjectMapper mapper;
    private JsonNode scenariosArray;
    private int catalogVersion;
    private String catalogDescription;

    public KnowledgeScenarioService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @PostConstruct
    void load() {
        ClassPathResource res = new ClassPathResource("knowledge/scenarios.json");
        try (InputStream in = res.getInputStream()) {
            JsonNode root = mapper.readTree(in);
            catalogVersion = root.path("version").asInt(0);
            catalogDescription = root.path("description").asText(null);
            scenariosArray = root.path("scenarios");
        } catch (Exception e) {
            throw new IllegalStateException("knowledge/scenarios.json", e);
        }
    }

    @Cacheable(value = "knowledgeFilters", unless = "#result == null || #result.isEmpty()")
    public Map<String, Object> filters() {
        Set<String> verticals = new HashSet<>();
        Set<String> rooms = new HashSet<>();
        for (JsonNode row : iterable(scenariosArray)) {
            verticals.add(row.path("vertical").asText(""));
            rooms.add(row.path("room_type_hint").asText(""));
        }
        Map<String, Object> m = new HashMap<>();
        m.put("verticals", verticals.stream().sorted().toList());
        m.put("room_type_hints", rooms.stream().sorted().toList());
        m.put("risk_categories", List.of()); // optional facets from derive — omitted for brevity
        m.put("rule_refs", RuleRegistry.IDS.stream().sorted().toList());
        return m;
    }

    public Map<String, Object> list(
            String vertical,
            String roomTypeHint,
            String category,
            String ruleRef,
            String scenarioId,
            String idPrefix,
            String q,
            Integer minDepth,
            Integer limit,
            int offset) {
        List<JsonNode> rows = new ArrayList<>();
        for (JsonNode row : iterable(scenariosArray)) {
            rows.add(row);
        }
        int total = rows.size();
        String qq = q == null ? "" : q.strip().toLowerCase(Locale.ROOT);
        List<JsonNode> filtered =
                rows.stream()
                        .filter(r -> vertical == null || vertical.equals(r.path("vertical").asText()))
                        .filter(r -> roomTypeHint == null || roomTypeHint.equals(r.path("room_type_hint").asText()))
                        .filter(r -> scenarioId == null || scenarioId.equals(r.path("id").asText()))
                        .filter(
                                r ->
                                        idPrefix == null
                                                || r.path("id").asText("").startsWith(idPrefix))
                        .filter(
                                r ->
                                        ruleRef == null
                                                || containsRule(r.path("rule_refs"), ruleRef))
                        .filter(
                                r ->
                                        qq.isEmpty()
                                                || combinedText(r).contains(qq)
                                                || r.path("id").asText("").toLowerCase(Locale.ROOT).contains(qq)
                                                || r.path("vertical").asText("").toLowerCase(Locale.ROOT).contains(qq))
                        .filter(
                                r ->
                                        minDepth == null
                                                || depthScore(r) >= minDepth)
                        .sorted(Comparator.comparing(o -> o.path("id").asText("")))
                        .collect(Collectors.toList());
        int filteredCount = filtered.size();
        if (offset > 0 && offset < filtered.size()) {
            filtered = filtered.subList(offset, filtered.size());
        } else if (offset >= filtered.size()) {
            filtered = List.of();
        }
        if (limit != null && limit > 0 && filtered.size() > limit) {
            filtered = filtered.subList(0, limit);
        }
        List<Map<String, Object>> items = new ArrayList<>();
        for (JsonNode r : filtered) {
            items.add(enrich(r));
        }
        Map<String, Object> out = new HashMap<>();
        out.put("catalog_version", catalogVersion);
        out.put("catalog_description", catalogDescription);
        out.put("total", total);
        out.put("filtered", filteredCount);
        out.put("offset", offset);
        out.put("limit", limit);
        out.put("items", items);
        return out;
    }

    public Map<String, Object> one(String id) {
        for (JsonNode row : iterable(scenariosArray)) {
            if (id.equals(row.path("id").asText())) {
                return enrich(row);
            }
        }
        throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.NOT_FOUND, "Unknown scenario");
    }

    private static boolean containsRule(JsonNode refs, String ruleRef) {
        if (!refs.isArray()) {
            return false;
        }
        for (JsonNode x : refs) {
            if (ruleRef.equals(x.asText())) {
                return true;
            }
        }
        return false;
    }

    private static String combinedText(JsonNode row) {
        StringBuilder sb = new StringBuilder();
        sb.append(row.path("title").asText("")).append(' ');
        sb.append(row.path("setup").asText("")).append(' ');
        appendArr(sb, row.path("forbidden_model_behaviors"));
        appendArr(sb, row.path("allowed_model_behaviors"));
        return sb.toString().toLowerCase(Locale.ROOT);
    }

    private static void appendArr(StringBuilder sb, JsonNode arr) {
        if (arr.isArray()) {
            for (JsonNode x : arr) {
                sb.append(x.asText("")).append(' ');
            }
        }
    }

    private static int depthScore(JsonNode row) {
        int score = 0;
        JsonNode fb = row.path("forbidden_model_behaviors");
        JsonNode al = row.path("allowed_model_behaviors");
        if (fb.isArray()) {
            score += Math.min(fb.size(), 5);
        }
        if (al.isArray()) {
            score += Math.min(al.size(), 5);
        }
        String setup = row.path("setup").asText("");
        score += setup.split("\\s+").length >= 6 ? 1 : 0;
        JsonNode refs = row.path("rule_refs");
        score += refs.isArray() && refs.size() >= 3 ? 1 : 0;
        return score;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> enrich(JsonNode row) {
        Map<String, Object> m = mapper.convertValue(row, Map.class);
        m.put("risk_categories", List.of());
        m.put("depth_score", depthScore(row));
        Map<String, String> summaries = new HashMap<>();
        JsonNode refs = row.path("rule_refs");
        if (refs.isArray()) {
            for (JsonNode x : refs) {
                String id = x.asText();
                summaries.put(id, RuleRegistry.TEXT.getOrDefault(id, ""));
            }
        }
        m.put("rule_summaries", summaries);
        return m;
    }

    private static Iterable<JsonNode> iterable(JsonNode arr) {
        List<JsonNode> list = new ArrayList<>();
        if (arr != null && arr.isArray()) {
            for (JsonNode n : arr) {
                list.add(n);
            }
        }
        return list;
    }
}
