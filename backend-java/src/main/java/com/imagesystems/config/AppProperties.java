package com.imagesystems.config;

import java.nio.file.Path;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String appEnv,
        String appSecretKey,
        String apiKeyEncryptionKey,
        String supabaseJwtSecret,
        boolean localDevMode,
        String localDevLoginEmail,
        String localDevLoginPassword,
        boolean localDevSkipUpscale,
        boolean localDevUpscaleFallbackOnCreditError,
        Path uploadDir,
        int maxUploadSizeMb,
        int maxFilesPerUploadBatch,
        boolean persistImageFilesOnServer,
        int ephemeralImageGraceSeconds,
        List<String> corsOrigins,
        String zyteExtractUrl,
        int scrapeMaxImageUrls,
        boolean listingPromptBlocksEnabled) {

    public boolean jwtSecretConfigured() {
        String s = supabaseJwtSecret == null ? "" : supabaseJwtSecret.trim();
        return !s.isEmpty() && !"your-jwt-secret-from-supabase-dashboard".equals(s);
    }

    public boolean isProduction() {
        return "production".equalsIgnoreCase(appEnv == null ? "" : appEnv);
    }
}
