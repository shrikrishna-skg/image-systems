package com.imagesystems.service;

import com.imagesystems.api.ImageDetailMapper;
import com.imagesystems.config.AppProperties;
import com.imagesystems.integration.CloudImageModels;
import com.imagesystems.integration.ImageMathUtils;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ImageWorkspaceService {

    private static final Logger log = LoggerFactory.getLogger(ImageWorkspaceService.class);
    private static final int MAX_LIST_LIMIT = 100;
    private static final int MAX_LIST_SKIP = 50_000;

    private final AppProperties props;
    private final ImageRepository images;
    private final ImageVersionRepository versions;
    private final JobRepository jobs;
    private final ApiKeyRepository apiKeys;
    private final StorageService storage;
    private final ImageProbeService imageProbe;
    private final EnhancementPromptService prompts;
    private final PipelineJobService pipeline;
    private final ImageDetailMapper detailMapper;

    public ImageWorkspaceService(
            AppProperties props,
            ImageRepository images,
            ImageVersionRepository versions,
            JobRepository jobs,
            ApiKeyRepository apiKeys,
            StorageService storage,
            ImageProbeService imageProbe,
            EnhancementPromptService prompts,
            PipelineJobService pipeline,
            ImageDetailMapper detailMapper) {
        this.props = props;
        this.images = images;
        this.versions = versions;
        this.jobs = jobs;
        this.apiKeys = apiKeys;
        this.storage = storage;
        this.imageProbe = imageProbe;
        this.prompts = prompts;
        this.pipeline = pipeline;
        this.detailMapper = detailMapper;
    }

    @Transactional
    public List<Map<String, Object>> upload(String userId, List<MultipartFile> files) throws IOException {
        int cap = props.maxFilesPerUploadBatch();
        if (files.size() > cap) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many files");
        }
        log.info("Image upload user={} files={}", userId, files.size());
        List<Map<String, Object>> out = new ArrayList<>();
        for (MultipartFile file : files) {
            String path = storage.saveUpload(file, userId);
            ImageProbeService.DimensionsMime dm = imageProbe.probeStoredImage(path);
            ImageEntity img = new ImageEntity();
            img.setId(UUID.randomUUID().toString());
            img.setUserId(userId);
            img.setOriginalFilename(file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload");
            img.setStoragePath(path);
            img.setWidth(dm.width());
            img.setHeight(dm.height());
            img.setFileSizeBytes(file.getSize());
            img.setMimeType(dm.mimeType());
            img.setCreatedAt(Instant.now());
            images.save(img);
            out.add(uploadMap(img));
        }
        return out;
    }

    @Transactional
    public Map<String, Object> enhance(String userId, String imageId, Map<String, Object> body) {
        ImageEntity image = loadOwned(imageId, userId);
        String provider = str(body, "provider");
        CloudImageModels.validateCloudModel(provider, str(body, "model"));
        if ("openai".equals(provider) || "gemini".equals(provider)) {
            if (blank(str(body, "improve_input_version_id"))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "improve_input_version_id is required");
            }
            validateImproveVersion(imageId, str(body, "improve_input_version_id"));
        }
        ApiKeyEntity key =
                apiKeys.findByUserIdAndProvider(userId, provider)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No API key"));
        String prompt =
                prompts.buildEnhancementPrompt(
                        str(body, "lighting"),
                        str(body, "quality_preset"),
                        str(body, "perspective"),
                        str(body, "room_type") != null ? str(body, "room_type") : "general",
                        str(body, "custom_prompt"),
                        false);
        Map<String, Object> params = new HashMap<>(body);
        params.put("prompt", prompt);
        params.put("perspective_plate", false);
        params.put("api_key_id", key.getId());
        return startJob(userId, image, "enhance", params);
    }

    @Transactional
    public Map<String, Object> upscale(String userId, String imageId, Map<String, Object> body) {
        ImageEntity image = loadOwned(imageId, userId);
        ApiKeyEntity key =
                apiKeys.findByUserIdAndProvider(userId, "replicate")
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No Replicate key"));
        Map<String, Object> params = new HashMap<>(body);
        params.put("api_key_id", key.getId());
        return startJob(userId, image, "upscale", params);
    }

    @Transactional
    public Map<String, Object> processFullPipeline(String userId, String imageId, Map<String, Object> body) {
        ImageEntity image = loadOwned(imageId, userId);
        String provider = str(body, "provider");
        CloudImageModels.validateCloudModel(provider, str(body, "model"));
        if ("openai".equals(provider) || "gemini".equals(provider)) {
            if (blank(str(body, "improve_input_version_id"))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "improve_input_version_id is required");
            }
            validateImproveVersion(imageId, str(body, "improve_input_version_id"));
        }
        ApiKeyEntity enhanceKey =
                apiKeys.findByUserIdAndProvider(userId, provider)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No enhance key"));
        boolean skipRep = props.localDevMode() && props.localDevSkipUpscale();
        ApiKeyEntity repKey = apiKeys.findByUserIdAndProvider(userId, "replicate").orElse(null);
        if (!skipRep && repKey == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No Replicate API key");
        }
        boolean usePlate = bool(body, "perspective_corner_outpaint", false);
        if ("openai".equals(provider) || "gemini".equals(provider)) {
            usePlate = false;
        }
        String prompt =
                prompts.buildEnhancementPrompt(
                        str(body, "lighting"),
                        str(body, "quality_preset"),
                        str(body, "perspective"),
                        str(body, "room_type") != null ? str(body, "room_type") : "general",
                        str(body, "custom_prompt"),
                        usePlate);
        Map<String, Object> params = new HashMap<>(body);
        params.put("prompt", prompt);
        params.put("enhance_api_key_id", enhanceKey.getId());
        params.put("replicate_api_key_id", repKey != null ? repKey.getId() : null);
        params.put("perspective_plate", usePlate);
        return startJob(userId, image, "full_pipeline", params);
    }

    @Transactional
    public Map<String, Object> localImprove(String userId, String imageId, MultipartFile file) throws IOException {
        ImageEntity image = loadOwnedWithVersions(imageId, userId);
        byte[] data = file.getBytes();
        long maxB = (long) props.maxUploadSizeMb() * 1024 * 1024;
        if (data.length > maxB) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File too large");
        }
        String suffix = ".png";
        String fn = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (fn.endsWith(".jpg") || fn.endsWith(".jpeg")) {
            suffix = ".jpg";
        } else if (fn.endsWith(".webp")) {
            suffix = ".webp";
        }
        String name = "improve_" + UUID.randomUUID().toString().substring(0, 12) + suffix;
        String path = storage.saveBytes(data, userId, name);
        ImageProbeService.DimensionsMime dm;
        try {
            dm = imageProbe.probeStoredImage(path);
        } catch (Exception e) {
            storage.deleteFile(path);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read as an image");
        }
        ImageVersionEntity v = new ImageVersionEntity();
        v.setId(UUID.randomUUID().toString());
        v.setImageId(image.getId());
        v.setVersionType("final");
        v.setStoragePath(path);
        v.setWidth(dm.width());
        v.setHeight(dm.height());
        v.setFileSizeBytes((long) data.length);
        v.setProvider("improve");
        v.setModel("browser");
        v.setProcessingCostUsd(BigDecimal.ZERO);
        v.setCreatedAt(Instant.now());
        versions.save(v);
        image.getVersions().add(v);
        log.info("Local improve stored user={} image={} version={}", userId, imageId, v.getId());
        return detailMapper.toDetail(userId, images.findByIdAndUserId(imageId, userId).orElseThrow());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDetail(String userId, String imageId) {
        ImageEntity img =
                images.findByIdAndUserId(imageId, userId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return detailMapper.toDetail(userId, img);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Resource> download(String userId, String imageId, String version) {
        ImageEntity img =
                images.findByIdAndUserId(imageId, userId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String filePath;
        String filename;
        if (version != null && !version.isBlank()) {
            ImageVersionEntity v =
                    img.getVersions().stream()
                            .filter(x -> x.getId().equals(version))
                            .findFirst()
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            filePath = v.getStoragePath();
            filename = "enhanced_" + img.getOriginalFilename();
        } else {
            filePath = img.getStoragePath();
            filename = img.getOriginalFilename();
        }
        if (blank(filePath) || !storage.fileExists(filePath)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        }
        Resource res = new FileSystemResource(Path.of(filePath));
        return ResponseEntity.ok()
                .header(
                        org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(imageProbe.mimeForPath(filePath)))
                .body(res);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> suggestFilename(String userId, String imageId) {
        ImageEntity img =
                images.findByIdAndUserId(imageId, userId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String stem = img.getOriginalFilename().replaceAll("\\.[^.]+$", "");
        log.debug("Suggest filename stub for image {}", imageId);
        return Map.of(
                "basename",
                stem.isBlank() ? "image" : stem,
                "model",
                "stub",
                "prompt_tokens",
                0,
                "output_tokens",
                0,
                "estimated_cost_usd",
                0.0,
                "cost_note",
                "Server-side vision naming is not implemented; basename derived from original filename.");
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(String userId, int skip, int limit) {
        int s = Math.min(Math.max(0, skip), MAX_LIST_SKIP);
        int l = Math.min(Math.max(1, limit), MAX_LIST_LIMIT);
        List<ImageEntity> chunk = images.findByUserIdOrderByCreatedAtDesc(userId, s, l);
        return chunk.stream().map(i -> detailMapper.toDetail(userId, i)).toList();
    }

    @Transactional
    public Map<String, String> delete(String userId, String imageId) {
        ImageEntity img =
                images.findByIdAndUserId(imageId, userId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        storage.deleteFile(img.getStoragePath());
        for (ImageVersionEntity v : img.getVersions()) {
            storage.deleteFile(v.getStoragePath());
        }
        images.delete(img);
        log.info("Image deleted user={} id={}", userId, imageId);
        return Map.of("message", "Image deleted");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> estimateCost(Map<String, Object> body) {
        String provider = str(body, "provider");
        if ("improve".equals(provider)) {
            return Map.of(
                    "enhancement_cost",
                    0.0,
                    "upscale_cost",
                    0.0,
                    "total_cost",
                    0.0,
                    "provider",
                    "improve",
                    "model",
                    "browser",
                    "details",
                    "Improve runs in your browser — no API usage.");
        }
        double enhance = 0;
        if ("openai".equals(provider) || "gemini".equals(provider)) {
            enhance =
                    "gemini".equals(provider)
                            ? 0
                            : estimateOpenAi(str(body, "model"), str(body, "quality"));
        }
        double scale = dbl(body, "scale_factor", 2);
        String tr = str(body, "target_resolution");
        int passes =
                ImageMathUtils.planReplicateUpscaleTotal(1536, 1024, tr, scale)[0] <= 4 ? 1 : 2;
        double upscale = 0.04 * passes;
        if (props.localDevMode() && props.localDevSkipUpscale()) {
            upscale = 0;
        }
        double total = enhance + upscale;
        String details =
                props.localDevMode() && props.localDevSkipUpscale()
                        ? "Enhancement: $" + enhance + " — local dev: Replicate upscale skipped."
                        : "Enhancement: $" + enhance + " + Upscale: $" + upscale + " (" + passes + " pass)";
        return Map.of(
                "enhancement_cost",
                round4(enhance),
                "upscale_cost",
                round4(upscale),
                "total_cost",
                round4(total),
                "provider",
                provider,
                "model",
                str(body, "model"),
                "details",
                details);
    }

    private ImageEntity loadOwned(String id, String userId) {
        return images.findByIdAndUserId(id, userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private ImageEntity loadOwnedWithVersions(String id, String userId) {
        return loadOwned(id, userId);
    }

    private void validateImproveVersion(String imageId, String versionId) {
        ImageVersionEntity v =
                versions.findByIdAndImageId(versionId, imageId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST));
        if (!"improve".equalsIgnoreCase(v.getProvider() == null ? "" : v.getProvider())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "improve_input_version_id must be improve");
        }
        if (blank(v.getStoragePath())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Improve version has no file");
        }
    }

    private Map<String, Object> startJob(String userId, ImageEntity image, String type, Map<String, Object> params) {
        JobEntity j = new JobEntity();
        j.setId(UUID.randomUUID().toString());
        j.setUserId(userId);
        j.setImageId(image.getId());
        j.setJobType(type);
        j.setStatus("pending");
        j.setProgressPct(0);
        j.setParamsJson(params);
        j.setCreatedAt(Instant.now());
        jobs.save(j);
        log.info("Job queued user={} type={} jobId={}", userId, type, j.getId());
        if ("enhance".equals(type)) {
            pipeline.startEnhanceJob(j.getId());
        } else if ("upscale".equals(type)) {
            pipeline.startUpscaleJob(j.getId());
        } else {
            pipeline.startFullPipelineJob(j.getId());
        }
        return jobMap(j);
    }

    private static Map<String, Object> jobMap(JobEntity j) {
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

    private static Map<String, Object> uploadMap(ImageEntity img) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", img.getId());
        m.put("original_filename", img.getOriginalFilename());
        m.put("width", img.getWidth());
        m.put("height", img.getHeight());
        m.put("file_size_bytes", img.getFileSizeBytes());
        m.put("mime_type", img.getMimeType());
        m.put("created_at", img.getCreatedAt().toString());
        m.put("versions", List.of());
        return m;
    }

    private static String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? null : String.valueOf(v);
    }

    private static boolean bool(Map<String, Object> m, String k, boolean def) {
        Object v = m.get(k);
        if (v instanceof Boolean b) {
            return b;
        }
        return def;
    }

    private static double dbl(Map<String, Object> m, String k, double def) {
        Object v = m.get(k);
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        return def;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static double round4(double x) {
        return Math.round(x * 10000) / 10000.0;
    }

    private static double estimateOpenAi(String model, String quality) {
        String m = model == null ? "" : model;
        String q = quality == null ? "high" : quality.toLowerCase();
        String k = m + "|" + q;
        return switch (k) {
            case "gpt-image-1.5|high" -> 0.20;
            case "gpt-image-1.5|medium" -> 0.05;
            case "gpt-image-1.5|low" -> 0.013;
            case "gpt-image-1|high" -> 0.25;
            case "gpt-image-1|medium" -> 0.063;
            case "gpt-image-1|low" -> 0.016;
            default -> 0.20;
        };
    }
}
