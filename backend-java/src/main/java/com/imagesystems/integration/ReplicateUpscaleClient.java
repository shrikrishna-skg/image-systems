package com.imagesystems.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.util.Base64;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class ReplicateUpscaleClient {

    private static final String VERSION =
            "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa";

    private final RestClient client;
    private final ObjectMapper mapper;

    public ReplicateUpscaleClient(ObjectMapper mapper, @Qualifier("replicate") RestClient client) {
        this.mapper = mapper;
        this.client = client;
    }

    public byte[] upscaleMultiPass(String apiKey, java.nio.file.Path imagePath, int totalScale) throws IOException {
        byte[] raw = java.nio.file.Files.readAllBytes(imagePath);
        if (totalScale <= 2) {
            return runOnce(apiKey, raw, 2);
        }
        if (totalScale <= 4) {
            return runOnce(apiKey, raw, 4);
        }
        byte[] first = runOnce(apiKey, raw, 4);
        return runOnce(apiKey, first, 2);
    }

    private byte[] runOnce(String apiKey, byte[] imageBytes, int scale) throws IOException {
        String dataUri =
                "data:image/png;base64," + Base64.getEncoder().encodeToString(imageBytes);
        String body =
                """
                {"version":"%s","input":{"image":%s,"scale":%d,"face_enhance":false}}
                """
                        .formatted(VERSION, mapper.writeValueAsString(dataUri), Math.min(scale, 4));

        String createResp =
                client.post()
                        .uri("/predictions")
                        .header("Authorization", "Bearer " + apiKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(String.class);

        JsonNode pred = mapper.readTree(createResp);
        String getUrl = pred.path("urls").path("get").asText();
        String id = pred.path("id").asText();
        if (getUrl.isEmpty()) {
            throw new IOException("Replicate: no prediction URL");
        }

        for (int i = 0; i < 600; i++) {
            try {
                Thread.sleep(1000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new IOException("Interrupted", ie);
            }
            String statusJson =
                    RestClient.create()
                            .get()
                            .uri(URI.create(getUrl))
                            .header("Authorization", "Bearer " + apiKey)
                            .retrieve()
                            .body(String.class);
            JsonNode st = mapper.readTree(statusJson);
            String status = st.path("status").asText("");
            if ("succeeded".equals(status)) {
                JsonNode out = st.path("output");
                if (out.isTextual()) {
                    return RestClient.create()
                            .get()
                            .uri(URI.create(out.asText()))
                            .retrieve()
                            .body(byte[].class);
                }
                if (out.isArray() && out.size() > 0 && out.get(0).isTextual()) {
                    return RestClient.create()
                            .get()
                            .uri(URI.create(out.get(0).asText()))
                            .retrieve()
                            .body(byte[].class);
                }
                throw new IOException("Unexpected Replicate output shape");
            }
            if ("failed".equals(status) || "canceled".equals(status)) {
                throw new IOException(
                        "Replicate failed: " + st.path("error").asText("unknown") + " id=" + id);
            }
        }
        throw new IOException("Replicate prediction timeout");
    }
}
