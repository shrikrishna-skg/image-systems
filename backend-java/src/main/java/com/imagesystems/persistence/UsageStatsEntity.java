package com.imagesystems.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "usage_stats")
public class UsageStatsEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "images_uploaded")
    private Integer imagesUploaded;

    @Column(name = "images_enhanced")
    private Integer imagesEnhanced;

    @Column(name = "images_upscaled")
    private Integer imagesUpscaled;

    @Column(name = "total_cost_usd", precision = 10, scale = 6)
    private BigDecimal totalCostUsd;

    @Column(name = "api_calls_openai")
    private Integer apiCallsOpenai;

    @Column(name = "api_calls_gemini")
    private Integer apiCallsGemini;

    @Column(name = "api_calls_replicate")
    private Integer apiCallsReplicate;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public Integer getImagesUploaded() {
        return imagesUploaded;
    }

    public void setImagesUploaded(Integer imagesUploaded) {
        this.imagesUploaded = imagesUploaded;
    }

    public Integer getImagesEnhanced() {
        return imagesEnhanced;
    }

    public void setImagesEnhanced(Integer imagesEnhanced) {
        this.imagesEnhanced = imagesEnhanced;
    }

    public Integer getImagesUpscaled() {
        return imagesUpscaled;
    }

    public void setImagesUpscaled(Integer imagesUpscaled) {
        this.imagesUpscaled = imagesUpscaled;
    }

    public BigDecimal getTotalCostUsd() {
        return totalCostUsd;
    }

    public void setTotalCostUsd(BigDecimal totalCostUsd) {
        this.totalCostUsd = totalCostUsd;
    }

    public Integer getApiCallsOpenai() {
        return apiCallsOpenai;
    }

    public void setApiCallsOpenai(Integer apiCallsOpenai) {
        this.apiCallsOpenai = apiCallsOpenai;
    }

    public Integer getApiCallsGemini() {
        return apiCallsGemini;
    }

    public void setApiCallsGemini(Integer apiCallsGemini) {
        this.apiCallsGemini = apiCallsGemini;
    }

    public Integer getApiCallsReplicate() {
        return apiCallsReplicate;
    }

    public void setApiCallsReplicate(Integer apiCallsReplicate) {
        this.apiCallsReplicate = apiCallsReplicate;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
