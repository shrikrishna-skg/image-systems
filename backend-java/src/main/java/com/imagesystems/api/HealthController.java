package com.imagesystems.api;

import com.imagesystems.config.AppProperties;
import java.util.HashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final AppProperties props;
    private final JdbcTemplate jdbc;

    public HealthController(AppProperties props, JdbcTemplate jdbc) {
        this.props = props;
        this.jdbc = jdbc;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> m = new HashMap<>();
        m.put("status", "healthy");
        m.put("version", "2.0.0");
        m.put("auth", props.localDevMode() ? "local" : "supabase");
        m.put("persist_image_files_on_server", props.persistImageFilesOnServer());
        m.put("ephemeral_image_grace_seconds", props.ephemeralImageGraceSeconds());
        m.put("local_dev_skip_upscale", props.localDevMode() && props.localDevSkipUpscale());
        m.put(
                "local_dev_upscale_fallback_on_credit_error",
                props.localDevMode() && props.localDevUpscaleFallbackOnCreditError());
        m.put("listing_prompt_blocks_enabled", props.listingPromptBlocksEnabled());
        m.put("metrics", Map.of());
        return m;
    }

    @GetMapping("/health/ready")
    public Map<String, String> ready() {
        jdbc.queryForObject("SELECT 1", Integer.class);
        return Map.of("status", "ready");
    }
}
