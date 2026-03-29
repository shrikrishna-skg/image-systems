package com.imagesystems.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.util.Base64;
import java.util.Locale;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

@Component
public class OpenAiImageClient {

    private final RestClient client;
    private final ObjectMapper mapper;

    public OpenAiImageClient(ObjectMapper mapper, @Qualifier("openAi") RestClient client) {
        this.mapper = mapper;
        this.client = client;
    }

    public byte[] enhanceImage(
            String apiKey,
            java.nio.file.Path imagePath,
            String prompt,
            String model,
            String quality,
            String outputFormat,
            boolean listingCompositionOmitInputFidelity)
            throws IOException {
        String outFmt = normOut(outputFormat);
        String q = quality == null ? "high" : quality.toLowerCase(Locale.ROOT);

        try {
            if (listingCompositionOmitInputFidelity) {
                return decodeFirstImage(postEdit(apiKey, buildEditForm(imagePath, prompt, model, q, outFmt, false)));
            }
            try {
                return decodeFirstImage(postEdit(apiKey, buildEditForm(imagePath, prompt, model, q, outFmt, true)));
            } catch (HttpClientErrorException.BadRequest e) {
                return decodeFirstImage(postEdit(apiKey, buildEditForm(imagePath, prompt, model, q, outFmt, false)));
            }
        } catch (Exception e) {
            String genPrompt = "Based on a hotel/real estate photo: " + prompt;
            String genBody =
                    """
                    {"model":%s,"prompt":%s,"n":1,"size":"1536x1024","quality":%s,"output_format":%s}
                    """
                            .formatted(
                                    mapper.writeValueAsString(model),
                                    mapper.writeValueAsString(genPrompt),
                                    mapper.writeValueAsString(q),
                                    mapper.writeValueAsString(outFmt));
            String json =
                    client.post()
                            .uri("/images/generations")
                            .header("Authorization", "Bearer " + apiKey)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(genBody)
                            .retrieve()
                            .body(String.class);
            return decodeFirstImage(json);
        }
    }

    private MultiValueMap<String, Object> buildEditForm(
            java.nio.file.Path imagePath,
            String prompt,
            String model,
            String quality,
            String outFmt,
            boolean inputFidelityHigh) {
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("model", model);
        form.add("prompt", prompt);
        form.add("n", "1");
        form.add("size", "1536x1024");
        form.add("quality", quality);
        form.add("output_format", outFmt);
        form.add("image", new FileSystemResource(imagePath.toFile()));
        if (inputFidelityHigh) {
            form.add("input_fidelity", "high");
        }
        return form;
    }

    private String postEdit(String apiKey, MultiValueMap<String, Object> form) {
        return client.post()
                .uri("/images/edits")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(form)
                .retrieve()
                .body(String.class);
    }

    public byte[] generateImage(String apiKey, String prompt, String model, String quality, String outputFormat)
            throws IOException {
        String outFmt = normOut(outputFormat);
        String q = quality == null ? "high" : quality.toLowerCase(Locale.ROOT);
        String p = prompt.strip();
        p = p.substring(0, Math.min(4000, p.length()));
        String body =
                """
                {"model":%s,"prompt":%s,"n":1,"size":"1536x1024","quality":%s,"output_format":%s}
                """
                        .formatted(
                                mapper.writeValueAsString(model),
                                mapper.writeValueAsString(p),
                                mapper.writeValueAsString(q),
                                mapper.writeValueAsString(outFmt));
        String json =
                client.post()
                        .uri("/images/generations")
                        .header("Authorization", "Bearer " + apiKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(String.class);
        return decodeFirstImage(json);
    }

    private static String normOut(String fmt) {
        String f = (fmt == null ? "png" : fmt).toLowerCase(Locale.ROOT);
        if (f.equals("jpg") || f.equals("jpeg")) {
            return "jpeg";
        }
        if (f.equals("webp")) {
            return "webp";
        }
        return "png";
    }

    private byte[] decodeFirstImage(String json) throws IOException {
        JsonNode root = mapper.readTree(json);
        JsonNode data = root.path("data");
        if (!data.isArray() || data.isEmpty()) {
            throw new IOException("OpenAI returned no image entries");
        }
        JsonNode first = data.get(0);
        if (first.has("b64_json")) {
            return Base64.getDecoder().decode(first.path("b64_json").asText());
        }
        if (first.has("url")) {
            String url = first.path("url").asText();
            return RestClient.create().get().uri(URI.create(url)).retrieve().body(byte[].class);
        }
        throw new IOException("OpenAI returned neither b64_json nor url");
    }
}
