package com.imagesystems.service;

import com.imagesystems.persistence.ProcessingHistoryEntity;
import com.imagesystems.persistence.ProcessingHistoryRepository;
import com.imagesystems.persistence.UsageStatsEntity;
import com.imagesystems.persistence.UsageStatsRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HistoryQueryService {

    private static final int MAX_LIMIT = 200;
    private static final int MAX_SKIP = 50_000;
    private static final int MAX_USAGE_DAYS = 366;

    private final ProcessingHistoryRepository history;
    private final UsageStatsRepository usage;

    public HistoryQueryService(ProcessingHistoryRepository history, UsageStatsRepository usage) {
        this.history = history;
        this.usage = usage;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listEntries(String userId, int skip, int limit, String action) {
        int s = Math.min(Math.max(0, skip), MAX_SKIP);
        int l = Math.min(Math.max(1, limit), MAX_LIMIT);
        List<ProcessingHistoryEntity> chunk =
                action != null && !action.isBlank()
                        ? history.findByUserIdAndActionOrderByCreatedAtDesc(userId, action, s, l)
                        : history.findByUserIdOrderByCreatedAtDesc(userId, s, l);
        return chunk.stream().map(this::entry).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> usageSummary(String userId, int days) {
        int d = Math.min(Math.max(1, days), MAX_USAGE_DAYS);
        LocalDate start = LocalDate.now().minusDays(d);
        List<UsageStatsEntity> stats = usage.findByUserIdAndDateGreaterThanEqualOrderByDateDesc(userId, start);
        int totalImages = stats.stream().mapToInt(s -> nz(s.getImagesUploaded())).sum();
        int totalEnhanced = stats.stream().mapToInt(s -> nz(s.getImagesEnhanced())).sum();
        int totalUpscaled = stats.stream().mapToInt(s -> nz(s.getImagesUpscaled())).sum();
        double totalCost =
                stats.stream()
                        .mapToDouble(s -> s.getTotalCostUsd() != null ? s.getTotalCostUsd().doubleValue() : 0)
                        .sum();
        List<Map<String, Object>> daily =
                stats.stream()
                        .map(
                                s -> {
                                    Map<String, Object> m = new HashMap<>();
                                    m.put("date", s.getDate().toString());
                                    m.put("images_uploaded", nz(s.getImagesUploaded()));
                                    m.put("images_enhanced", nz(s.getImagesEnhanced()));
                                    m.put("images_upscaled", nz(s.getImagesUpscaled()));
                                    m.put(
                                            "total_cost_usd",
                                            s.getTotalCostUsd() != null ? s.getTotalCostUsd().doubleValue() : 0);
                                    m.put("api_calls_openai", nz(s.getApiCallsOpenai()));
                                    m.put("api_calls_gemini", nz(s.getApiCallsGemini()));
                                    m.put("api_calls_replicate", nz(s.getApiCallsReplicate()));
                                    return m;
                                })
                        .collect(Collectors.toList());
        Map<String, Object> out = new HashMap<>();
        out.put("total_images", totalImages);
        out.put("total_enhanced", totalEnhanced);
        out.put("total_upscaled", totalUpscaled);
        out.put("total_cost", totalCost);
        out.put("daily_stats", daily);
        return out;
    }

    private static int nz(Integer x) {
        return x == null ? 0 : x;
    }

    private Map<String, Object> entry(ProcessingHistoryEntity e) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", e.getId());
        m.put("action", e.getAction());
        m.put("provider", e.getProvider());
        m.put("model", e.getModel());
        m.put("input_width", e.getInputWidth());
        m.put("input_height", e.getInputHeight());
        m.put("output_width", e.getOutputWidth());
        m.put("output_height", e.getOutputHeight());
        m.put("scale_factor", e.getScaleFactor());
        m.put("quality", e.getQuality());
        m.put("cost_usd", e.getCostUsd() != null ? e.getCostUsd().doubleValue() : null);
        m.put("duration_seconds", e.getDurationSeconds());
        m.put("status", e.getStatus());
        m.put("error_message", e.getErrorMessage());
        m.put("created_at", e.getCreatedAt().toString());
        return m;
    }
}
