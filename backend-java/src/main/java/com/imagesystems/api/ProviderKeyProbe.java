package com.imagesystems.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.imagesystems.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class ProviderKeyProbe {

    private final RestClient http;
    private final ObjectMapper mapper;
    private final AppProperties props;

    public ProviderKeyProbe(
            ObjectMapper mapper, AppProperties props, @Qualifier("integration") RestClient http) {
        this.mapper = mapper;
        this.props = props;
        this.http = http;
    }

    public record ProbeResult(boolean ok, String error, Integer httpStatus) {}

    public ProbeResult probe(String provider, String apiKey) {
        return switch (provider) {
            case "openai" -> getOk(
                    "https://api.openai.com/v1/models",
                    Map.of("Authorization", "Bearer " + apiKey));
            case "gemini" -> geminiProbe(apiKey);
            case "replicate" -> getOk(
                    "https://api.replicate.com/v1/account",
                    Map.of("Authorization", "Bearer " + apiKey));
            case "groq" -> getOk(
                    "https://api.groq.com/openai/v1/models",
                    Map.of("Authorization", "Bearer " + apiKey));
            case "zyte" -> zyteProbe(apiKey);
            default -> new ProbeResult(false, "Unknown provider", 400);
        };
    }

    private ProbeResult getOk(String url, Map<String, String> headers) {
        try {
            org.springframework.web.client.RestClient.RequestHeadersSpec<?> spec = http.get().uri(url);
            for (var e : headers.entrySet()) {
                spec = spec.header(e.getKey(), e.getValue());
            }
            spec.retrieve().toBodilessEntity();
            return new ProbeResult(true, null, 200);
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            return new ProbeResult(false, "HTTP " + e.getStatusCode().value(), e.getStatusCode().value());
        } catch (Exception e) {
            return new ProbeResult(false, e.getMessage(), null);
        }
    }

    private ProbeResult geminiProbe(String apiKey) {
        try {
            var resp =
                    http.get()
                            .uri("https://generativelanguage.googleapis.com/v1beta/models")
                            .header("x-goog-api-key", apiKey)
                            .retrieve()
                            .toEntity(String.class);
            if (resp.getStatusCode().is2xxSuccessful()) {
                return new ProbeResult(true, null, 200);
            }
            return new ProbeResult(false, "HTTP " + resp.getStatusCode().value(), resp.getStatusCode().value());
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            String detail = "";
            try {
                JsonNode n = mapper.readTree(e.getResponseBodyAsString());
                JsonNode err = n.path("error");
                detail = err.path("message").asText("") + " — " + err.path("status").asText("");
            } catch (Exception ignored) {
            }
            return new ProbeResult(
                    false,
                    "HTTP " + e.getStatusCode().value() + (detail.isBlank() ? "" : ": " + detail),
                    e.getStatusCode().value());
        } catch (Exception e) {
            return new ProbeResult(false, e.getMessage(), null);
        }
    }

    private ProbeResult zyteProbe(String apiKey) {
        String auth = Base64.getEncoder().encodeToString((apiKey + ":").getBytes(StandardCharsets.UTF_8));
        String url = props.zyteExtractUrl() == null ? "https://api.zyte.com/v1/extract" : props.zyteExtractUrl();
        String body = "{\"url\":\"https://example.com\",\"httpResponseBody\":true}";
        try {
            String resp =
                    http.post()
                            .uri(url)
                            .header("Authorization", "Basic " + auth)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(body)
                            .retrieve()
                            .body(String.class);
            JsonNode n = mapper.readTree(resp);
            if (n.path("httpResponseBody").asBoolean(false)) {
                return new ProbeResult(true, null, 200);
            }
            return new ProbeResult(false, Optional.ofNullable(n.path("detail").asText(null)).orElse("Zyte error"), 400);
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            return new ProbeResult(false, "HTTP " + e.getStatusCode().value(), e.getStatusCode().value());
        } catch (Exception e) {
            return new ProbeResult(false, e.getMessage(), null);
        }
    }
}
