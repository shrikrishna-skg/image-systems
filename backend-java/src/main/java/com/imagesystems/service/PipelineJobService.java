package com.imagesystems.service;

import com.imagesystems.config.AppProperties;
import com.imagesystems.integration.CloudImageModels;
import com.imagesystems.integration.GeminiImageClient;
import com.imagesystems.integration.ImageMathUtils;
import com.imagesystems.integration.OpenAiImageClient;
import com.imagesystems.integration.ReplicateUpscaleClient;
import com.imagesystems.persistence.ApiKeyEntity;
import com.imagesystems.persistence.ApiKeyRepository;
import com.imagesystems.persistence.ImageEntity;
import com.imagesystems.persistence.ImageRepository;
import com.imagesystems.persistence.ImageVersionEntity;
import com.imagesystems.persistence.ImageVersionRepository;
import com.imagesystems.persistence.JobEntity;
import com.imagesystems.persistence.JobRepository;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class PipelineJobService {

    private static final Logger log = LoggerFactory.getLogger(PipelineJobService.class);
    private static final Executor EXEC = Executors.newVirtualThreadPerTaskExecutor();

    private final TransactionTemplate tx;
    private final JobRepository jobs;
    private final ImageRepository images;
    private final ImageVersionRepository versions;
    private final ApiKeyRepository apiKeys;
    private final EncryptionService encryption;
    private final StorageService storage;
    private final ImageProbeService imageProbe;
    private final OpenAiImageClient openAi;
    private final GeminiImageClient gemini;
    private final ReplicateUpscaleClient replicate;
    private final HistoryService history;
    private final AppProperties props;

    public PipelineJobService(
            TransactionTemplate tx,
            JobRepository jobs,
            ImageRepository images,
            ImageVersionRepository versions,
            ApiKeyRepository apiKeys,
            EncryptionService encryption,
            StorageService storage,
            ImageProbeService imageProbe,
            OpenAiImageClient openAi,
            GeminiImageClient gemini,
            ReplicateUpscaleClient replicate,
            HistoryService history,
            AppProperties props) {
        this.tx = tx;
        this.jobs = jobs;
        this.images = images;
        this.versions = versions;
        this.apiKeys = apiKeys;
        this.encryption = encryption;
        this.storage = storage;
        this.imageProbe = imageProbe;
        this.openAi = openAi;
        this.gemini = gemini;
        this.replicate = replicate;
        this.history = history;
        this.props = props;
    }

    public void startEnhanceJob(String jobId) {
        EXEC.execute(() -> runEnhanceJob(jobId));
    }

    public void startUpscaleJob(String jobId) {
        EXEC.execute(() -> runUpscaleJob(jobId));
    }

    public void startFullPipelineJob(String jobId) {
        EXEC.execute(() -> runFullPipelineJob(jobId));
    }

    private void runEnhanceJob(String jobId) {
        Map<String, Object> params = new HashMap<>();
        try {
            JobEntity job =
                    tx.execute(
                            s -> jobs.findById(jobId).orElseThrow(() -> new IllegalStateException("job missing")));
            params.putAll(job.getParamsJson() != null ? job.getParamsJson() : Map.of());
            tx.executeWithoutResult(
                    s -> {
                        JobEntity j = jobs.findById(jobId).orElseThrow();
                        j.setStatus("processing");
                        j.setStartedAt(Instant.now());
                        j.setProgressPct(10);
                        jobs.save(j);
                    });

            ImageEntity image =
                    tx.execute(
                            s ->
                                    images.findById(job.getImageId()).orElseThrow(() -> new IllegalStateException(
                                            "image missing")));
            if (!image.getUserId().equals(job.getUserId())) {
                throw new IllegalStateException("ownership");
            }

            String provider = str(params, "provider");
            String sourcePath;
            if ("openai".equals(provider) || "gemini".equals(provider)) {
                String improveId = str(params, "improve_input_version_id");
                if (improveId == null || improveId.isBlank()) {
                    throw new IllegalStateException("improve_input_version_id required");
                }
                sourcePath =
                        tx.execute(
                                s -> {
                                    ImageVersionEntity v =
                                            versions.findByIdAndImageId(improveId, image.getId()).orElseThrow();
                                    if (!"improve".equalsIgnoreCase(v.getProvider() == null ? "" : v.getProvider())) {
                                        throw new IllegalStateException("not improve version");
                                    }
                                    String p = v.getStoragePath();
                                    if (p == null || p.isBlank()) {
                                        throw new IllegalStateException("no file");
                                    }
                                    return p;
                                });
            } else {
                sourcePath = image.getStoragePath();
            }

            String apiKey = decryptKey(str(params, "api_key_id"), job.getUserId());
            tx.executeWithoutResult(
                    s -> {
                        JobEntity j = jobs.findById(jobId).orElseThrow();
                        j.setProgressPct(20);
                        jobs.save(j);
                    });

            long t0 = System.currentTimeMillis();
            byte[] enhanced =
                    runCloudEnhance(provider, apiKey, Path.of(sourcePath), params, str(params, "perspective"));
            double duration = (System.currentTimeMillis() - t0) / 1000.0;

            String outFmt = str(params, "output_format");
            String ext =
                    outFmt != null && (outFmt.equalsIgnoreCase("jpg") || outFmt.equalsIgnoreCase("jpeg"))
                            ? "jpg"
                            : outFmt != null && outFmt.equalsIgnoreCase("webp")
                                    ? "webp"
                                    : "png";
            String filename = "enhanced_" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;
            String outputPath = storage.saveBytes(enhanced, job.getUserId(), filename);

            int[] wh = safeDims(outputPath);
            BigDecimal cost = estimateEnhanceCost(provider, str(params, "model"), str(params, "quality"));

            tx.executeWithoutResult(
                    s -> {
                        ImageVersionEntity v = new ImageVersionEntity();
                        v.setId(UUID.randomUUID().toString());
                        v.setImageId(image.getId());
                        v.setVersionType("enhanced");
                        v.setStoragePath(outputPath);
                        v.setWidth(wh[0] > 0 ? wh[0] : null);
                        v.setHeight(wh[1] > 0 ? wh[1] : null);
                        v.setFileSizeBytes((long) enhanced.length);
                        v.setProvider(provider);
                        v.setModel(str(params, "model"));
                        v.setPromptUsed(str(params, "prompt"));
                        v.setProcessingCostUsd(cost);
                        v.setCreatedAt(Instant.now());
                        versions.save(v);

                        JobEntity j = jobs.findById(jobId).orElseThrow();
                        j.setStatus("completed");
                        j.setProgressPct(100);
                        j.setCompletedAt(Instant.now());
                        j.setResultVersionId(v.getId());
                        jobs.save(j);

                        history.logProcessing(
                                job.getUserId(),
                                "enhance",
                                image.getId(),
                                jobId,
                                provider,
                                str(params, "model"),
                                str(params, "prompt"),
                                image.getWidth(),
                                image.getHeight(),
                                wh[0] > 0 ? wh[0] : null,
                                wh[1] > 0 ? wh[1] : null,
                                str(params, "quality"),
                                cost,
                                duration,
                                "completed",
                                null,
                                null);
                    });
            log.info("Enhance job completed {}", jobId);
        } catch (Exception e) {
            log.error("Enhance job failed {}", jobId, e);
            failJob(jobId, e.getMessage());
            try {
                JobEntity j = jobs.findById(jobId).orElse(null);
                if (j != null) {
                    history.logProcessing(
                            j.getUserId(),
                            "enhance",
                            j.getImageId(),
                            jobId,
                            str(params, "provider"),
                            str(params, "model"),
                            null,
                            null,
                            null,
                            null,
                            null,
                            str(params, "quality"),
                            null,
                            null,
                            "failed",
                            e.getMessage(),
                            null);
                }
            } catch (Exception ignored) {
            }
        }
    }

    private void runUpscaleJob(String jobId) {
        try {
            JobEntity job = jobs.findById(jobId).orElseThrow();
            Map<String, Object> params = job.getParamsJson() != null ? job.getParamsJson() : Map.of();
            tx.executeWithoutResult(
                    s -> {
                        JobEntity j = jobs.findById(jobId).orElseThrow();
                        j.setStatus("processing");
                        j.setStartedAt(Instant.now());
                        j.setProgressPct(10);
                        jobs.save(j);
                    });

            ImageEntity image = images.findById(job.getImageId()).orElseThrow();
            String sourcePath =
                    tx.execute(
                            s -> {
                                List<ImageVersionEntity> latest =
                                        versions.findTop1ByImageIdOrderByCreatedAtDesc(image.getId());
                                if (!latest.isEmpty()) {
                                    return latest.get(0).getStoragePath();
                                }
                                return image.getStoragePath();
                            });

            String apiKey = decryptKey(str(params, "api_key_id"), job.getUserId());
            double scaleFactor = dbl(params, "scale_factor", 2);
            int[] dims = safeDims(sourcePath);
            int[] plan =
                    ImageMathUtils.planReplicateUpscaleTotal(
                            dims[0], dims[1], str(params, "target_resolution"), scaleFactor);
            int repScale = plan[0];

            byte[] upscaled = replicate.upscaleMultiPass(apiKey, Path.of(sourcePath), repScale);

            String outFmt = str(params, "output_format");
            if (outFmt == null) {
                outFmt = "png";
            }
            int[] exact =
                    ImageMathUtils.desiredFinalPixelSize(
                            dims[0], dims[1], str(params, "target_resolution"), scaleFactor);
            if (exact != null && exact[0] > 0 && exact[1] > 0) {
                upscaled =
                        imageProbe.resizeRasterBytesToSize(
                                upscaled, exact[0], exact[1], outFmt, 92);
            }
            final byte[] upscaledFinal = upscaled;

            String filename = "upscaled_" + repScale + "x_" + UUID.randomUUID().toString().substring(0, 8) + "." + outFmt;
            String outPath = storage.saveBytes(upscaledFinal, job.getUserId(), filename);
            int[] owh = safeDims(outPath);
            int passes = repScale <= 4 ? 1 : 2;
            BigDecimal upscaleCost = BigDecimal.valueOf(0.04 * passes);

            tx.executeWithoutResult(
                    s -> {
                        ImageVersionEntity v = new ImageVersionEntity();
                        v.setId(UUID.randomUUID().toString());
                        v.setImageId(image.getId());
                        v.setVersionType("upscaled");
                        v.setStoragePath(outPath);
                        v.setWidth(owh[0] > 0 ? owh[0] : null);
                        v.setHeight(owh[1] > 0 ? owh[1] : null);
                        v.setFileSizeBytes((long) upscaledFinal.length);
                        v.setProvider("replicate");
                        v.setModel("real-esrgan");
                        v.setScaleFactor((double) repScale);
                        v.setProcessingCostUsd(upscaleCost);
                        v.setCreatedAt(Instant.now());
                        versions.save(v);

                        JobEntity j = jobs.findById(jobId).orElseThrow();
                        j.setStatus("completed");
                        j.setProgressPct(100);
                        j.setCompletedAt(Instant.now());
                        j.setResultVersionId(v.getId());
                        jobs.save(j);
                    });
            log.info("Upscale job completed {}", jobId);
        } catch (Exception e) {
            log.error("Upscale failed {}", jobId, e);
            failJob(jobId, e.getMessage());
        }
    }

    private void runFullPipelineJob(String jobId) {
        Map<String, Object> params = new HashMap<>();
        try {
            JobEntity job = jobs.findById(jobId).orElseThrow();
            params.putAll(job.getParamsJson() != null ? job.getParamsJson() : Map.of());
            tx.executeWithoutResult(
                    s -> {
                        JobEntity j = jobs.findById(jobId).orElseThrow();
                        j.setStatus("processing");
                        j.setStartedAt(Instant.now());
                        j.setProgressPct(5);
                        jobs.save(j);
                    });

            ImageEntity image = images.findById(job.getImageId()).orElseThrow();
            String provider = str(params, "provider");
            String enhanceKey = decryptKey(str(params, "enhance_api_key_id"), job.getUserId());

            String improveId = str(params, "improve_input_version_id");
            if (improveId == null || improveId.isBlank()) {
                throw new IllegalStateException("improve_input_version_id required");
            }
            String sourcePath =
                    tx.execute(
                            s ->
                                    versions.findByIdAndImageId(improveId, image.getId())
                                            .orElseThrow()
                                            .getStoragePath());

            byte[] enhanced =
                    runCloudEnhance(provider, enhanceKey, Path.of(sourcePath), params, str(params, "perspective"));

            String outFmt = str(params, "output_format");
            String ext =
                    outFmt != null && (outFmt.equalsIgnoreCase("jpg") || outFmt.equalsIgnoreCase("jpeg"))
                            ? "jpg"
                            : outFmt != null && outFmt.equalsIgnoreCase("webp")
                                    ? "webp"
                                    : "png";
            String enhName = "enhanced_" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;
            String enhancedPath = storage.saveBytes(enhanced, job.getUserId(), enhName);
            int[] ewEh = safeDims(enhancedPath);
            BigDecimal enhanceCost = estimateEnhanceCost(provider, str(params, "model"), str(params, "quality"));

            ImageVersionEntity enhancedVer =
                    tx.execute(
                            s -> {
                                ImageVersionEntity v = new ImageVersionEntity();
                                v.setId(UUID.randomUUID().toString());
                                v.setImageId(image.getId());
                                v.setVersionType("enhanced");
                                v.setStoragePath(enhancedPath);
                                v.setWidth(ewEh[0] > 0 ? ewEh[0] : null);
                                v.setHeight(ewEh[1] > 0 ? ewEh[1] : null);
                                v.setFileSizeBytes((long) enhanced.length);
                                v.setProvider(provider);
                                v.setModel(str(params, "model"));
                                v.setPromptUsed(str(params, "prompt"));
                                v.setProcessingCostUsd(enhanceCost);
                                v.setCreatedAt(Instant.now());
                                return versions.save(v);
                            });

            double scaleFactor = dbl(params, "scale_factor", 2);
            int ew = ewEh[0] > 0 ? ewEh[0] : 0;
            int eh = ewEh[1] > 0 ? ewEh[1] : 0;
            int[] plan = ImageMathUtils.planReplicateUpscaleTotal(ew, eh, str(params, "target_resolution"), scaleFactor);
            int repScale = plan[0];

            if (props.localDevMode() && props.localDevSkipUpscale()) {
                finishEnhancedOnly(jobId, job, image, enhancedVer, ew, eh, enhanceCost, provider, params, scaleFactor);
                return;
            }

            String repKeyId = str(params, "replicate_api_key_id");
            if (repKeyId == null || repKeyId.isBlank()) {
                throw new IllegalStateException("replicate key missing");
            }
            String repKey = decryptKey(repKeyId, job.getUserId());

            byte[] upscaled;
            try {
                upscaled = replicate.upscaleMultiPass(repKey, Path.of(enhancedPath), repScale);
            } catch (Exception up) {
                if (props.localDevMode()
                        && props.localDevUpscaleFallbackOnCreditError()
                        && isReplicateCreditError(up)) {
                    finishEnhancedOnly(
                            jobId,
                            job,
                            image,
                            enhancedVer,
                            ew,
                            eh,
                            enhanceCost,
                            provider,
                            params,
                            scaleFactor);
                    return;
                }
                throw up;
            }

            String fmt = str(params, "output_format");
            if (fmt == null) {
                fmt = "png";
            }
            int[] exact = ImageMathUtils.desiredFinalPixelSize(ew, eh, str(params, "target_resolution"), scaleFactor);
            if (exact != null) {
                upscaled = imageProbe.resizeRasterBytesToSize(upscaled, exact[0], exact[1], fmt, 92);
            }
            final byte[] upscaledFinal = upscaled;

            String finalName = "final_" + repScale + "x_" + UUID.randomUUID().toString().substring(0, 8) + "." + fmt;
            String finalPath = storage.saveBytes(upscaledFinal, job.getUserId(), finalName);
            int[] fwh = safeDims(finalPath);
            int passes = repScale <= 4 ? 1 : 2;
            BigDecimal upCost = BigDecimal.valueOf(0.04 * passes);

            tx.executeWithoutResult(
                    s -> {
                        ImageVersionEntity fv = new ImageVersionEntity();
                        fv.setId(UUID.randomUUID().toString());
                        fv.setImageId(image.getId());
                        fv.setVersionType("final");
                        fv.setStoragePath(finalPath);
                        fv.setWidth(fwh[0] > 0 ? fwh[0] : null);
                        fv.setHeight(fwh[1] > 0 ? fwh[1] : null);
                        fv.setFileSizeBytes((long) upscaledFinal.length);
                        fv.setProvider("replicate");
                        fv.setModel("real-esrgan");
                        fv.setScaleFactor((double) repScale);
                        fv.setProcessingCostUsd(upCost);
                        fv.setCreatedAt(Instant.now());
                        versions.save(fv);

                        JobEntity j = jobs.findById(jobId).orElseThrow();
                        j.setStatus("completed");
                        j.setProgressPct(100);
                        j.setCompletedAt(Instant.now());
                        j.setResultVersionId(fv.getId());
                        jobs.save(j);

                        history.logProcessing(
                                job.getUserId(),
                                "enhance",
                                image.getId(),
                                jobId,
                                provider,
                                str(params, "model"),
                                str(params, "prompt"),
                                image.getWidth(),
                                image.getHeight(),
                                ewEh[0] > 0 ? ewEh[0] : null,
                                ewEh[1] > 0 ? ewEh[1] : null,
                                str(params, "quality"),
                                enhanceCost,
                                null,
                                "completed",
                                null,
                                null);
                        history.logProcessing(
                                job.getUserId(),
                                "upscale",
                                image.getId(),
                                jobId,
                                "replicate",
                                "real-esrgan",
                                null,
                                ew,
                                eh,
                                fwh[0] > 0 ? fwh[0] : null,
                                fwh[1] > 0 ? fwh[1] : null,
                                null,
                                upCost,
                                null,
                                "completed",
                                null,
                                Map.of("scale_factor", repScale));
                    });
            log.info("Full pipeline completed {}", jobId);
        } catch (Exception e) {
            log.error("Full pipeline failed {}", jobId, e);
            failJob(jobId, e.getMessage());
        }
    }

    private void finishEnhancedOnly(
            String jobId,
            JobEntity job,
            ImageEntity image,
            ImageVersionEntity enhancedVersion,
            int ew,
            int eh,
            BigDecimal enhanceCost,
            String provider,
            Map<String, Object> params,
            double scaleFactor)
            throws IOException {
        String outFmt = str(params, "output_format");
        if (outFmt == null) {
            outFmt = "png";
        }
        String ext =
                outFmt.equalsIgnoreCase("jpg") || outFmt.equalsIgnoreCase("jpeg")
                        ? "jpg"
                        : outFmt.equalsIgnoreCase("webp")
                                ? "webp"
                                : "png";
        byte[] data = java.nio.file.Files.readAllBytes(Path.of(enhancedVersion.getStoragePath()));
        int[] exact =
                ImageMathUtils.desiredFinalPixelSize(
                        Math.max(ew, 1), Math.max(eh, 1), str(params, "target_resolution"), scaleFactor);
        ImageVersionEntity result = enhancedVersion;
        if (exact != null && ew > 0 && eh > 0 && (exact[0] != ew || exact[1] != eh)) {
            data = imageProbe.resizeRasterBytesToSize(data, exact[0], exact[1], outFmt, 92);
            String fn = "final_" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;
            String p = storage.saveBytes(data, job.getUserId(), fn);
            int[] wh = safeDims(p);
            ImageVersionEntity fv = new ImageVersionEntity();
            fv.setId(UUID.randomUUID().toString());
            fv.setImageId(image.getId());
            fv.setVersionType("final");
            fv.setStoragePath(p);
            fv.setWidth(wh[0] > 0 ? wh[0] : exact[0]);
            fv.setHeight(wh[1] > 0 ? wh[1] : exact[1]);
            fv.setFileSizeBytes((long) data.length);
            fv.setProvider(provider);
            fv.setModel(str(params, "model"));
            fv.setPromptUsed(enhancedVersion.getPromptUsed());
            fv.setScaleFactor(scaleFactor);
            fv.setProcessingCostUsd(BigDecimal.ZERO);
            fv.setCreatedAt(Instant.now());
            result =
                    tx.execute(
                            s -> {
                                versions.save(fv);
                                return fv;
                            });
        }

        ImageVersionEntity finalResult = result;
        tx.executeWithoutResult(
                s -> {
                    JobEntity j = jobs.findById(jobId).orElseThrow();
                    j.setStatus("completed");
                    j.setProgressPct(100);
                    j.setCompletedAt(Instant.now());
                    j.setResultVersionId(finalResult.getId());
                    jobs.save(j);
                });
        history.logProcessing(
                job.getUserId(),
                "enhance",
                image.getId(),
                jobId,
                provider,
                str(params, "model"),
                str(params, "prompt"),
                image.getWidth(),
                image.getHeight(),
                ew > 0 ? ew : null,
                eh > 0 ? eh : null,
                str(params, "quality"),
                enhanceCost,
                null,
                "completed",
                null,
                null);
        history.logProcessing(
                job.getUserId(),
                "upscale",
                image.getId(),
                jobId,
                "replicate",
                "real-esrgan",
                null,
                ew,
                eh,
                finalResult.getWidth(),
                finalResult.getHeight(),
                null,
                BigDecimal.ZERO,
                null,
                "skipped",
                "LOCAL_DEV_SKIP_UPSCALE or credit fallback",
                null);
    }

    private boolean isReplicateCreditError(Throwable e) {
        String s = String.valueOf(e.getMessage()).toLowerCase();
        return s.contains("402") || s.contains("credit") || s.contains("billing");
    }

    private byte[] runCloudEnhance(
            String provider, String apiKey, Path imagePath, Map<String, Object> params, String perspective)
            throws IOException {
        String prompt = str(params, "prompt");
        String model =
                str(params, "model") != null
                        ? str(params, "model")
                        : "openai".equals(provider) ? "gpt-image-1" : "gemini-2.0-flash-exp-image-generation";
        String quality = str(params, "quality");
        String outFmt = str(params, "output_format");
        if ("openai".equals(provider)) {
            boolean omit = CloudImageModels.listingCompositionRelaxPerspective(perspective);
            return openAi.enhanceImage(apiKey, imagePath, prompt, model, quality, outFmt, omit);
        }
        if ("gemini".equals(provider)) {
            boolean listingAngle = CloudImageModels.listingCameraAngleGemini(perspective);
            return gemini.enhanceImage(apiKey, imagePath, prompt, model, quality, outFmt, listingAngle);
        }
        throw new IllegalStateException("Unknown provider " + provider);
    }

    private String decryptKey(String apiKeyId, String userId) {
        return tx.execute(
                s -> {
                    ApiKeyEntity k =
                            apiKeys.findById(apiKeyId).orElseThrow(() -> new IllegalStateException("key missing"));
                    if (!k.getUserId().equals(userId)) {
                        throw new IllegalStateException("key ownership");
                    }
                    return encryption.decrypt(k.getEncryptedKey());
                });
    }

    private void failJob(String jobId, String msg) {
        tx.executeWithoutResult(
                s -> {
                    JobEntity j = jobs.findById(jobId).orElse(null);
                    if (j != null) {
                        j.setStatus("failed");
                        j.setErrorMessage(msg);
                        j.setProgressPct(0);
                        jobs.save(j);
                    }
                });
    }

    private int[] safeDims(String path) {
        try {
            return imageProbe.dimensions(path);
        } catch (Exception e) {
            return new int[] {0, 0};
        }
    }

    private static String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? null : String.valueOf(v);
    }

    private static double dbl(Map<String, Object> m, String k, double def) {
        Object v = m.get(k);
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        if (v instanceof String s) {
            try {
                return Double.parseDouble(s);
            } catch (NumberFormatException e) {
                return def;
            }
        }
        return def;
    }

    private static BigDecimal estimateEnhanceCost(String provider, String model, String quality) {
        if ("gemini".equals(provider)) {
            return BigDecimal.ZERO;
        }
        String m = model == null ? "" : model;
        String q = quality == null ? "high" : quality.toLowerCase();
        String k = m + "|" + q;
        return switch (k) {
            case "gpt-image-1.5|high" -> new BigDecimal("0.20");
            case "gpt-image-1.5|medium" -> new BigDecimal("0.05");
            case "gpt-image-1.5|low" -> new BigDecimal("0.013");
            case "gpt-image-1|high" -> new BigDecimal("0.25");
            case "gpt-image-1|medium" -> new BigDecimal("0.063");
            case "gpt-image-1|low" -> new BigDecimal("0.016");
            default -> new BigDecimal("0.20");
        };
    }
}
