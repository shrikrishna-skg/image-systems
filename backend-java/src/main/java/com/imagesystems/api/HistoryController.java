package com.imagesystems.api;

import com.imagesystems.service.HistoryQueryService;
import java.util.List;
import java.util.Map;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/history")
@Validated
public class HistoryController {

    private final HistoryQueryService historyQuery;

    public HistoryController(HistoryQueryService historyQuery) {
        this.historyQuery = historyQuery;
    }

    @GetMapping("")
    public List<Map<String, Object>> list(
            @RequestParam(defaultValue = "0") @Min(0) @Max(50_000) int skip,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit,
            @RequestParam(required = false) String action) {
        return historyQuery.listEntries(CurrentUser.require().id(), skip, limit, action);
    }

    @GetMapping("/usage")
    public Map<String, Object> usageSummary(
            @RequestParam(defaultValue = "30") @Min(1) @Max(366) int days) {
        return historyQuery.usageSummary(CurrentUser.require().id(), days);
    }
}
