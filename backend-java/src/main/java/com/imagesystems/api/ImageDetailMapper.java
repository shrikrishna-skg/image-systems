package com.imagesystems.api;

import com.imagesystems.persistence.ImageEntity;
import com.imagesystems.persistence.ImageVersionEntity;
import com.imagesystems.persistence.JobEntity;
import com.imagesystems.persistence.JobRepository;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class ImageDetailMapper {

    private static final Set<String> SECRET_PARAM_KEYS =
            Set.of("api_key_id", "enhance_api_key_id", "replicate_api_key_id");

    private final JobRepository jobs;

    public ImageDetailMapper(JobRepository jobs) {
        this.jobs = jobs;
    }

    public Map<String, Object> toDetail(String userId, ImageEntity image) {
        List<String> vids = image.getVersions().stream().map(ImageVersionEntity::getId).toList();
        Map<String, JobEntity> byVer = new HashMap<>();
        if (!vids.isEmpty()) {
            List<JobEntity> completed =
                    jobs.findCompletedByUserAndResultVersions(userId, vids);
            for (JobEntity j : completed) {
                if (j.getResultVersionId() != null && !byVer.containsKey(j.getResultVersionId())) {
                    byVer.put(j.getResultVersionId(), j);
                }
            }
        }
        Map<String, Object> out = new HashMap<>();
        out.put("id", image.getId());
        out.put("original_filename", image.getOriginalFilename());
        out.put("width", image.getWidth());
        out.put("height", image.getHeight());
        out.put("file_size_bytes", image.getFileSizeBytes());
        out.put("mime_type", image.getMimeType());
        out.put("created_at", image.getCreatedAt().toString());
        out.put(
                "versions",
                image.getVersions().stream()
                        .map(v -> versionToMap(v, byVer.get(v.getId())))
                        .collect(Collectors.toList()));
        return out;
    }

    private Map<String, Object> versionToMap(ImageVersionEntity v, JobEntity job) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", v.getId());
        m.put("version_type", v.getVersionType());
        m.put("width", v.getWidth());
        m.put("height", v.getHeight());
        m.put("file_size_bytes", v.getFileSizeBytes());
        m.put("provider", v.getProvider());
        m.put("model", v.getModel());
        m.put("scale_factor", v.getScaleFactor());
        m.put(
                "processing_cost_usd",
                v.getProcessingCostUsd() != null ? v.getProcessingCostUsd().doubleValue() : null);
        m.put("created_at", v.getCreatedAt().toString());
        m.put("prompt_used", v.getPromptUsed());
        m.put("source_job_type", job != null ? job.getJobType() : null);
        m.put("generation_params", sanitizeParams(job != null ? job.getParamsJson() : null));
        return m;
    }

    private static Map<String, Object> sanitizeParams(Map<String, Object> raw) {
        if (raw == null) {
            return null;
        }
        Map<String, Object> out = new HashMap<>();
        for (var e : raw.entrySet()) {
            if (!SECRET_PARAM_KEYS.contains(e.getKey())) {
                out.put(e.getKey(), e.getValue());
            }
        }
        return out.isEmpty() ? null : out;
    }
}
