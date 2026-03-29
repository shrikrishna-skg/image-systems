package com.imagesystems.api;

import com.imagesystems.integration.CloudImageModels;
import com.imagesystems.integration.GeminiImageClient;
import com.imagesystems.integration.OpenAiImageClient;
import com.imagesystems.persistence.ApiKeyEntity;
import com.imagesystems.persistence.ApiKeyRepository;
import com.imagesystems.persistence.ImageEntity;
import com.imagesystems.persistence.ImageRepository;
import com.imagesystems.service.EncryptionService;
import com.imagesystems.service.ImageProbeService;
import com.imagesystems.service.StorageService;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/image-generation")
public class ImageGenerationController {

    private final ApiKeyRepository keys;
    private final EncryptionService encryption;
    private final IntentComposeService intent;
    private final OpenAiImageClient openAi;
    private final GeminiImageClient gemini;
    private final StorageService storage;
    private final ImageProbeService probe;
    private final ImageRepository images;

    public ImageGenerationController(
            ApiKeyRepository keys,
            EncryptionService encryption,
            IntentComposeService intent,
            OpenAiImageClient openAi,
            GeminiImageClient gemini,
            StorageService storage,
            ImageProbeService probe,
            ImageRepository images) {
        this.keys = keys;
        this.encryption = encryption;
        this.intent = intent;
        this.openAi = openAi;
        this.gemini = gemini;
        this.storage = storage;
        this.probe = probe;
        this.images = images;
    }

    @PostMapping("/compose")
    public Map<String, Object> compose(@RequestBody Map<String, Object> body) throws Exception {
        var p = CurrentUser.require();
        String provider = str(body, "provider");
        String apiKey = decryptProviderKey(p.id(), provider);
        IntentComposeService.InterpretResult r =
                intent.interpret(str(body, "user_request"), provider, apiKey);
        return Map.of("interpreted_prompt", r.imagePrompt(), "short_title", r.shortTitle());
    }

    @PostMapping("/generate")
    public Map<String, Object> generate(@RequestBody Map<String, Object> body) throws Exception {
        if (Boolean.TRUE.equals(body.get("run_enhancement_pipeline"))) {
            throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Phase 2 not implemented");
        }
        var p = CurrentUser.require();
        String provider = str(body, "provider");
        CloudImageModels.validateCloudModel(provider, str(body, "model"));
        String apiKey = decryptProviderKey(p.id(), provider);
        boolean interpret = Boolean.TRUE.equals(body.get("interpret"));
        String resolved;
        String shortTitle = "ai-generated";
        if (interpret) {
            try {
                IntentComposeService.InterpretResult ir =
                        intent.interpret(str(body, "description"), provider, apiKey);
                resolved = ir.imagePrompt();
                shortTitle = ir.shortTitle();
            } catch (Exception e) {
                resolved = str(body, "description").strip().substring(0, Math.min(6000, str(body, "description").length()));
            }
        } else {
            resolved = str(body, "description").strip();
        }
        if (resolved.length() < 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Prompt too short");
        }
        String q = str(body, "quality");
        if (q == null) {
            q = "high";
        }
        String outFmt = normFmt(str(body, "output_format"));
        byte[] bytes;
        if ("openai".equals(provider)) {
            bytes = openAi.generateImage(apiKey, resolved, str(body, "model").strip(), q, outFmt);
        } else {
            bytes = gemini.generateImageFromText(apiKey, resolved, str(body, "model").strip(), q, outFmt);
        }
        String ext = ".png";
        if ("jpeg".equals(outFmt)) {
            ext = ".jpg";
        } else if ("webp".equals(outFmt)) {
            ext = ".webp";
        }
        String stem = shortTitle.replaceAll("[^a-zA-Z0-9\\-]+", "-").replaceAll("^-|-$", "");
        stem = stem.substring(0, Math.min(48, stem.length()));
        String fname = "gen_" + stem + "_" + UUID.randomUUID().toString().substring(0, 8) + ext;
        String path = storage.saveBytes(bytes, p.id(), fname);
        ImageProbeService.DimensionsMime dm = probe.probeStoredImage(path);
        ImageEntity img = new ImageEntity();
        img.setId(UUID.randomUUID().toString());
        img.setUserId(p.id());
        img.setOriginalFilename(fname);
        img.setStoragePath(path);
        img.setWidth(dm.width());
        img.setHeight(dm.height());
        img.setFileSizeBytes((long) bytes.length);
        img.setMimeType(dm.mimeType());
        img.setCreatedAt(Instant.now());
        images.save(img);
        Map<String, Object> m = new HashMap<>();
        m.put("id", img.getId());
        m.put("original_filename", img.getOriginalFilename());
        m.put("width", img.getWidth());
        m.put("height", img.getHeight());
        m.put("file_size_bytes", img.getFileSizeBytes());
        m.put("mime_type", img.getMimeType());
        m.put("created_at", img.getCreatedAt().toString());
        m.put("versions", java.util.List.of());
        m.put("resolved_prompt", resolved);
        m.put("used_interpretation", interpret);
        return m;
    }

    private String decryptProviderKey(String userId, String provider) {
        ApiKeyEntity row =
                keys.findByUserIdAndProvider(userId, provider)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No API key"));
        try {
            return encryption.decrypt(row.getEncryptedKey()).strip();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not read key");
        }
    }

    private static String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? null : String.valueOf(v);
    }

    private static String normFmt(String f) {
        if (f == null) {
            return "png";
        }
        String x = f.toLowerCase();
        if (x.equals("jpg") || x.equals("jpeg")) {
            return "jpeg";
        }
        if (x.equals("webp")) {
            return "webp";
        }
        return "png";
    }
}
