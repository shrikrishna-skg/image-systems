package com.imagesystems.api;

import com.imagesystems.service.JobQueryService;
import java.util.List;
import java.util.Map;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/jobs")
@Validated
public class JobsController {

    private final JobQueryService jobQuery;

    public JobsController(JobQueryService jobQuery) {
        this.jobQuery = jobQuery;
    }

    @GetMapping("/{jobId}")
    public Map<String, Object> get(@PathVariable String jobId) {
        return jobQuery.getJob(CurrentUser.require().id(), jobId);
    }

    @GetMapping("")
    public List<Map<String, Object>> list(
            @RequestParam(defaultValue = "0") @Min(0) @Max(50_000) int skip,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return jobQuery.listJobs(CurrentUser.require().id(), skip, limit);
    }
}
