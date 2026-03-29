package com.imagesystems.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.imagesystems.service.ImageProbeService;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Locale;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class GeminiImageClient {

    private final RestClient client;
    private final ObjectMapper mapper;
    private final ImageProbeService imageProbe;

    public GeminiImageClient(
            ObjectMapper mapper, ImageProbeService imageProbe, @Qualifier("integration") RestClient client) {
        this.mapper = mapper;
        this.client = client;
        this.imageProbe = imageProbe;
    }

    public byte[] enhanceImage(
            String apiKey,
            Path imagePath,
            String prompt,
            String model,
            String quality,
            String outputFormat,
            boolean listingCameraAngle)
            throws IOException {
        byte[] resized = imageProbe.resizeForApi(imagePath.toString(), 1536);
        String b64 = Base64.getEncoder().encodeToString(resized);
        String instruction =
                geminiParityBlock(quality, outputFormat, true, listingCameraAngle) + "\n\n" + prompt;
        return callGenerateContent(apiKey, model, instruction, "image/png", b64, outputFormat, quality);
    }

    public byte[] generateImageFromText(
            String apiKey, String prompt, String model, String quality, String outputFormat) throws IOException {
        String instruction = geminiParityBlock(quality, outputFormat, false, false) + "\n\n" + prompt;
        return callGenerateContent(apiKey, model, instruction, null, null, outputFormat, quality);
    }

    private byte[] callGenerateContent(
            String apiKey,
            String model,
            String text,
            String imageMime,
            String imageB64,
            String outputFormat,
            String quality)
            throws IOException {
        ObjectNode root = mapper.createObjectNode();
        ObjectNode content = mapper.createObjectNode();
        ArrayNode parts = mapper.createArrayNode();
        if (imageB64 != null) {
            ObjectNode inline = mapper.createObjectNode();
            inline.put("mimeType", imageMime);
            inline.put("data", imageB64);
            ObjectNode partImg = mapper.createObjectNode();
            partImg.set("inlineData", inline);
            parts.add(partImg);
        }
        ObjectNode partText = mapper.createObjectNode();
        partText.put("text", text);
        parts.add(partText);
        content.set("parts", parts);
        root.set("contents", mapper.createArrayNode().add(content));
        ObjectNode gen = mapper.createObjectNode();
        gen.set("responseModalities", mapper.createArrayNode().add("TEXT").add("IMAGE"));
        root.set("generationConfig", gen);

        String mid = model.contains("/") ? model.substring(model.lastIndexOf('/') + 1) : model;
        String url =
                "https://generativelanguage.googleapis.com/v1beta/models/"
                        + mid
                        + ":generateContent?key="
                        + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

        String resp =
                client.post()
                        .uri(URI.create(url))
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(mapper.writeValueAsString(root))
                        .retrieve()
                        .body(String.class);

        byte[] png = extractImagePng(resp);
        return finalizeFormat(png, outputFormat, quality);
    }

    private static String geminiParityBlock(
            String quality, String outputFormat, boolean isEdit, boolean listingCameraAngle) {
        String q = (quality == null ? "high" : quality).toLowerCase(Locale.ROOT);
        if (!q.equals("low") && !q.equals("medium") && !q.equals("high")) {
            q = "high";
        }
        String out = (outputFormat == null ? "png" : outputFormat).toLowerCase(Locale.ROOT);
        String outLine =
                switch (out) {
                    case "jpg", "jpeg" -> "Output intent: photorealistic JPEG-style result.";
                    case "webp" -> "Output intent: WebP-style photo.";
                    default -> "Output intent: PNG clarity full-bleed photograph.";
                };
        String qLine =
                switch (q) {
                    case "low" -> "Quality tier: LOW.";
                    case "medium" -> "Quality tier: MEDIUM.";
                    default -> "Quality tier: HIGH.";
                };
        String editLine = "";
        if (isEdit) {
            if (listingCameraAngle) {
                editLine =
                        "Editing: listing camera angle may reframe; preserve scene identity; do not add new lamps or fixtures.";
            } else {
                editLine =
                        "Editing: preserve composition unless prompt asks otherwise; high input fidelity; do not add lamps.";
            }
        }
        return String.join("\n", editLine, qLine, outLine).trim();
    }

    private byte[] extractImagePng(String json) throws IOException {
        JsonNode root = mapper.readTree(json);
        JsonNode cands = root.path("candidates");
        if (!cands.isArray()) {
            throw new IOException("No Gemini candidates");
        }
        for (JsonNode c : cands) {
            JsonNode content = c.path("content");
            JsonNode parts = content.path("parts");
            if (parts.isArray()) {
                for (JsonNode p : parts) {
                    JsonNode inline = p.path("inlineData");
                    if (inline.isMissingNode()) {
                        inline = p.path("inline_data");
                    }
                    if (!inline.isMissingNode()) {
                        String data = inline.path("data").asText("");
                        if (!data.isEmpty()) {
                            return Base64.getDecoder().decode(data);
                        }
                    }
                }
            }
        }
        throw new IOException("No image in Gemini response");
    }

    private byte[] finalizeFormat(byte[] raster, String outputFormat, String quality) throws IOException {
        String out = (outputFormat == null ? "png" : outputFormat).toLowerCase(Locale.ROOT);
        int jq =
                switch ((quality == null ? "high" : quality).toLowerCase(Locale.ROOT)) {
                    case "low" -> 80;
                    case "medium" -> 88;
                    default -> 92;
                };
        var img = ImageIO.read(new ByteArrayInputStream(raster));
        if (img == null) {
            throw new IOException("Gemini image not decodable");
        }
        int w = img.getWidth();
        int h = img.getHeight();
        if ("jpg".equals(out) || "jpeg".equals(out)) {
            return imageProbe.resizeRasterBytesToSize(raster, w, h, "jpeg", jq);
        }
        if ("webp".equals(out)) {
            return imageProbe.resizeRasterBytesToSize(raster, w, h, "webp", jq);
        }
        return imageProbe.resizeRasterBytesToSize(raster, w, h, "png", jq);
    }
}
