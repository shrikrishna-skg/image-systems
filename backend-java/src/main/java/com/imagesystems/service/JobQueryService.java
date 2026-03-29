package com.imagesystems.service;

import com.imagesystems.persistence.JobEntity;
import com.imagesystems.persistence.JobRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class JobQueryService {

    private static final int MAX_LIMIT = 100;
    private static final int MAX_SKIP = 50_000;

    private final JobRepository jobs;

    public JobQueryService(JobRepository jobs) {
        this.jobs = jobs;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getJob(String userId, String jobId) {
        JobEntity j =
                jobs.findByIdAndUserId(jobId, userId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return toMap(j);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listJobs(String userId, int skip, int limit) {
        int s = Math.min(Math.max(0, skip), MAX_SKIP);
        int l = Math.min(Math.max(1, limit), MAX_LIMIT);
        return jobs.findByUserIdOrderByCreatedAtDesc(userId, s, l).stream()
                .map(this::toMap)
                .collect(Collectors.toList());
    }

    private Map<String, Object> toMap(JobEntity j) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", j.getId());
        m.put("user_id", j.getUserId());
        m.put("image_id", j.getImageId());
        m.put("job_type", j.getJobType());
        m.put("status", j.getStatus());
        m.put("progress_pct", j.getProgressPct());
        m.put("error_message", j.getErrorMessage());
        m.put("params_json", j.getParamsJson());
        m.put("result_version_id", j.getResultVersionId());
        m.put("started_at", j.getStartedAt() != null ? j.getStartedAt().toString() : null);
        m.put("completed_at", j.getCompletedAt() != null ? j.getCompletedAt().toString() : null);
        m.put("created_at", j.getCreatedAt().toString());
        return m;
    }
}
