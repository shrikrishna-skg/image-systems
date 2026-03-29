package com.imagesystems.api;

import com.imagesystems.config.AppProperties;
import com.imagesystems.persistence.ApiKeyEntity;
import com.imagesystems.persistence.ApiKeyRepository;
import com.imagesystems.persistence.ImageEntity;
import com.imagesystems.persistence.ImageRepository;
import com.imagesystems.service.EncryptionService;
import com.imagesystems.service.ImageProbeService;
import com.imagesystems.service.StorageService;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/scrape")
public class ScrapeController {

    private final AppProperties props;
    private final ApiKeyRepository keys;
    private final EncryptionService encryption;
    private final StorageService storage;
    private final ImageProbeService probe;
    private final ImageRepository images;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

    public ScrapeController(
            AppProperties props,
            ApiKeyRepository keys,
            EncryptionService encryption,
            StorageService storage,
            ImageProbeService probe,
            ImageRepository images) {
        this.props = props;
        this.keys = keys;
        this.encryption = encryption;
        this.storage = storage;
        this.probe = probe;
        this.images = images;
    }

    @PostMapping("/embed-check")
    public Map<String, Object> embedCheck(@RequestBody Map<String, String> body) {
        String url = body.getOrDefault("url", "").strip();
        if (url.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "url required");
        }
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url)).method("HEAD", HttpRequest.BodyPublishers.noBody()).timeout(Duration.ofSeconds(20)).build();
            HttpResponse<Void> resp = http.send(req, HttpResponse.BodyHandlers.discarding());
            return Map.of("final_url", url, "embed_allowed", resp.statusCode() < 400, "detail", "");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not inspect URL");
        }
    }

    @PostMapping("/page")
    public Map<String, Object> page(@RequestBody Map<String, Object> body) throws Exception {
        var p = CurrentUser.require();
        String url = String.valueOf(body.getOrDefault("url", "")).strip();
        if (url.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "url required");
        }
        Optional<String> zyteKey =
                keys.findByUserIdAndProvider(p.id(), "zyte")
                        .map(
                                k -> {
                                    try {
                                        return encryption.decrypt(k.getEncryptedKey()).strip();
                                    } catch (Exception e) {
                                        return null;
                                    }
                                });

        String html;
        String finalUrl = url;
        if (zyteKey.isPresent() && !zyteKey.get().isBlank()) {
            String auth =
                    java.util.Base64.getEncoder()
                            .encodeToString((zyteKey.get() + ":").getBytes(java.nio.charset.StandardCharsets.UTF_8));
            String payload =
                    "{\"url\":"
                            + new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(url)
                            + ",\"httpResponseBody\":true}";
            HttpRequest zreq =
                    HttpRequest.newBuilder(URI.create(props.zyteExtractUrl()))
                            .header("Authorization", "Basic " + auth)
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString(payload))
                            .timeout(Duration.ofSeconds(60))
                            .build();
            HttpResponse<String> zresp = http.send(zreq, HttpResponse.BodyHandlers.ofString());
            if (zresp.statusCode() != 200) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Zyte failed");
            }
            var om = new com.fasterxml.jackson.databind.ObjectMapper();
            var root = om.readTree(zresp.body());
            byte[] raw = java.util.Base64.getDecoder().decode(root.path("httpResponseBody").asText(""));
            html = new String(raw, java.nio.charset.StandardCharsets.UTF_8);
            finalUrl = root.path("url").asText(url);
        } else {
            HttpRequest req =
                    HttpRequest.newBuilder(URI.create(url))
                            .GET()
                            .timeout(Duration.ofSeconds(45))
                            .header(
                                    "User-Agent",
                                    "Mozilla/5.0 (compatible; Imagesystems/2.0; +https://localhost)")
                            .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            html = resp.body();
            if (resp.headers().firstValue("location").isPresent()) {
                finalUrl = resp.headers().firstValue("location").orElse(url);
            }
        }

        Document doc = Jsoup.parse(html, finalUrl);
        int cap = props.scrapeMaxImageUrls();
        Set<String> seen = new HashSet<>();
        List<Map<String, Object>> imgs = new ArrayList<>();
        for (Element el : doc.select("img[src]")) {
            String src = el.absUrl("src");
            if (src.isBlank() || !seen.add(src)) {
                continue;
            }
            imgs.add(
                    Map.of(
                            "url",
                            src,
                            "alt",
                            Optional.ofNullable(el.attr("alt")).orElse(""),
                            "source",
                            "img"));
            if (imgs.size() >= cap) {
                break;
            }
        }
        Map<String, Object> out = new HashMap<>();
        out.put("page_url", url);
        out.put("final_url", finalUrl);
        out.put("images", imgs);
        out.put("truncated", imgs.size() >= cap);
        out.put("scrape_image_cap", cap);
        return out;
    }

    @PostMapping("/import-urls")
    public List<Map<String, Object>> importUrls(@RequestBody Map<String, Object> body) throws Exception {
        var p = CurrentUser.require();
        @SuppressWarnings("unchecked")
        List<String> urls = (List<String>) body.get("urls");
        if (urls == null) {
            urls = List.of();
        }
        int cap = props.maxFilesPerUploadBatch();
        if (urls.size() > cap) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At most " + cap + " URLs");
        }
        long maxBytes = (long) props.maxUploadSizeMb() * 1024 * 1024;
        List<Map<String, Object>> out = new ArrayList<>();
        for (String raw : urls.subList(0, Math.min(urls.size(), cap))) {
            String u = raw.strip();
            HttpRequest req = HttpRequest.newBuilder(URI.create(u)).GET().timeout(Duration.ofSeconds(60)).build();
            HttpResponse<byte[]> resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() >= 400 || resp.body().length > maxBytes) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not download: " + u);
            }
            String fname = "import_" + UUID.randomUUID().toString().substring(0, 8) + ".img";
            String path = storage.saveBytes(resp.body(), p.id(), fname);
            ImageProbeService.DimensionsMime dm;
            try {
                dm = probe.probeStoredImage(path);
            } catch (Exception e) {
                storage.deleteFile(path);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not a decodable image: " + u);
            }
            ImageEntity img = new ImageEntity();
            img.setId(UUID.randomUUID().toString());
            img.setUserId(p.id());
            img.setOriginalFilename(fname);
            img.setStoragePath(path);
            img.setWidth(dm.width());
            img.setHeight(dm.height());
            img.setFileSizeBytes((long) resp.body().length);
            img.setMimeType(dm.mimeType());
            img.setCreatedAt(Instant.now());
            images.save(img);
            out.add(
                    Map.of(
                            "id",
                            img.getId(),
                            "original_filename",
                            img.getOriginalFilename(),
                            "width",
                            img.getWidth(),
                            "height",
                            img.getHeight(),
                            "file_size_bytes",
                            img.getFileSizeBytes(),
                            "mime_type",
                            img.getMimeType(),
                            "created_at",
                            img.getCreatedAt().toString(),
                            "versions",
                            List.of()));
        }
        return out;
    }
}
