package com.imagesystems.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class IntentComposeService {

    private final RestClient http = RestClient.create();
    private final ObjectMapper mapper;

    public IntentComposeService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public record InterpretResult(String imagePrompt, String shortTitle) {}

    public InterpretResult interpret(String userRequest, String provider, String apiKey) throws Exception {
        String text =
                switch (provider) {
                    case "openai" -> openAiJson(userRequest, apiKey);
                    case "gemini" -> geminiJson(userRequest, apiKey);
                    default -> throw new IllegalArgumentException("provider");
                };
        return parseIntentJson(text);
    }

    private String openAiJson(String userRequest, String apiKey) throws Exception {
        String sys =
                "You turn user requests into one detailed English image-generation prompt for photorealistic "
                        + "marketing visuals. Output ONLY valid JSON with keys: image_prompt (string), short_title (string, max 8 words).";
        String body =
                mapper.writeValueAsString(
                        Map.of(
                                "model",
                                "gpt-4o-mini",
                                "response_format",
                                Map.of("type", "json_object"),
                                "max_tokens",
                                1200,
                                "messages",
                                java.util.List.of(
                                        Map.of("role", "system", "content", sys),
                                        Map.of(
                                                "role",
                                                "user",
                                                "content",
                                                userRequest.strip().substring(0, Math.min(8000, userRequest.length()))))));
        String resp =
                http.post()
                        .uri("https://api.openai.com/v1/chat/completions")
                        .header("Authorization", "Bearer " + apiKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(String.class);
        JsonNode root = mapper.readTree(resp);
        return root.path("choices").path(0).path("message").path("content").asText("");
    }

    private String geminiJson(String userRequest, String apiKey) throws Exception {
        String url =
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key="
                        + java.net.URLEncoder.encode(apiKey, java.nio.charset.StandardCharsets.UTF_8);
        String sys =
                "Output ONLY valid JSON with keys image_prompt and short_title (max 8 words). "
                        + userRequest.strip().substring(0, Math.min(8000, userRequest.length()));
        String body =
                """
                {"contents":[{"parts":[{"text":%s}]}]}
                """
                        .formatted(mapper.writeValueAsString(sys));
        String resp =
                http.post()
                        .uri(url)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(String.class);
        JsonNode root = mapper.readTree(resp);
        JsonNode parts = root.path("candidates").path(0).path("content").path("parts");
        StringBuilder sb = new StringBuilder();
        if (parts.isArray()) {
            for (JsonNode p : parts) {
                sb.append(p.path("text").asText(""));
            }
        }
        return sb.toString();
    }

    private InterpretResult parseIntentJson(String raw) throws Exception {
        String t = raw.strip();
        if (t.contains("```")) {
            int a = t.indexOf("```");
            int b = t.indexOf("```", a + 3);
            if (b > a) {
                t = t.substring(a + 3, b).replaceFirst("(?i)^json\\s*", "").strip();
            }
        }
        JsonNode n = mapper.readTree(t);
        String ip = n.path("image_prompt").asText("");
        String st = n.path("short_title").asText("AI generated");
        if (ip.isBlank()) {
            throw new IllegalArgumentException("missing image_prompt");
        }
        return new InterpretResult(ip.substring(0, Math.min(6000, ip.length())), st.substring(0, Math.min(200, st.length())));
    }
}
