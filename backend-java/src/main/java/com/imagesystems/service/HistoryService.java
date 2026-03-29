package com.imagesystems.service;

import com.imagesystems.persistence.ProcessingHistoryEntity;
import com.imagesystems.persistence.ProcessingHistoryRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HistoryService {

    private final ProcessingHistoryRepository repo;

    public HistoryService(ProcessingHistoryRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public void logProcessing(
            String userId,
            String action,
            String imageId,
            String jobId,
            String provider,
            String model,
            String prompt,
            Integer inW,
            Integer inH,
            Integer outW,
            Integer outH,
            String quality,
            BigDecimal costUsd,
            Double durationSeconds,
            String status,
            String errorMessage,
            Map<String, Object> metadata) {
        ProcessingHistoryEntity e = new ProcessingHistoryEntity();
        e.setId(UUID.randomUUID().toString());
        e.setUserId(userId);
        e.setImageId(imageId);
        e.setJobId(jobId);
        e.setAction(action);
        e.setProvider(provider);
        e.setModel(model);
        e.setPromptUsed(prompt);
        e.setInputWidth(inW);
        e.setInputHeight(inH);
        e.setOutputWidth(outW);
        e.setOutputHeight(outH);
        e.setQuality(quality);
        e.setCostUsd(costUsd != null ? costUsd : BigDecimal.ZERO);
        e.setDurationSeconds(durationSeconds);
        e.setStatus(status != null ? status : "completed");
        e.setErrorMessage(errorMessage);
        e.setMetadata(metadata != null ? metadata : new HashMap<>());
        e.setCreatedAt(Instant.now());
        repo.save(e);
    }
}
