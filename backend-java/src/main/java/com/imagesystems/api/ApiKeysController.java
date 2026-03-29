package com.imagesystems.api;

import com.imagesystems.persistence.ApiKeyEntity;
import com.imagesystems.persistence.ApiKeyRepository;
import com.imagesystems.service.EncryptionService;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/keys")
@Validated
public class ApiKeysController {

    private final ApiKeyRepository keys;
    private final EncryptionService encryption;
    private final ProviderKeyProbe probe;

    public ApiKeysController(ApiKeyRepository keys, EncryptionService encryption, ProviderKeyProbe probe) {
        this.keys = keys;
        this.encryption = encryption;
        this.probe = probe;
    }

    @GetMapping("")
    public List<Map<String, Object>> list() {
        var p = CurrentUser.require();
        return keys.findByUserId(p.id()).stream()
                .filter(k -> !"firecrawl".equals(k.getProvider()))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public record CreateKeyBody(
            @NotBlank
                    @Pattern(
                            regexp = "openai|gemini|replicate|zyte|groq",
                            message = "provider must be openai, gemini, replicate, zyte, or groq")
                    String provider,
            @NotBlank @Size(min = 8, max = 8192) String api_key,
            @Size(max = 200) String label,
            Boolean skip_connection_test) {}

    @PostMapping("")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@Valid @RequestBody CreateKeyBody body) {
        var p = CurrentUser.require();
        String prov = body.provider();
        String rawKey = body.api_key().strip();
        softValidateFormat(prov, rawKey);

        boolean isValid = false;
        if (!Boolean.TRUE.equals(body.skip_connection_test())) {
            ProviderKeyProbe.ProbeResult r = probe.probe(prov, rawKey);
            if (r.ok()) {
                isValid = true;
            } else if (r.httpStatus() == null) {
                throw new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "Could not reach provider (timeout or network). Check your connection, or enable "
                                + "'Save without verifying' to store the key for use when online.");
            } else if (r.httpStatus() == 401 || r.httpStatus() == 403) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid API key — provider rejected authentication (" + r.error() + ").");
            } else {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Could not verify key with provider (" + r.error() + ").");
            }
        }

        ApiKeyEntity row =
                keys.findByUserIdAndProvider(p.id(), prov)
                        .orElseGet(
                                () -> {
                                    ApiKeyEntity k = new ApiKeyEntity();
                                    k.setId(UUID.randomUUID().toString());
                                    k.setUserId(p.id());
                                    k.setProvider(prov);
                                    k.setCreatedAt(Instant.now());
                                    return k;
                                });
        row.setEncryptedKey(encryption.encrypt(rawKey));
        row.setLabel(body.label() != null ? body.label() : prov + " key");
        row.setValid(isValid);
        row = keys.save(row);
        return toResponseWithPlain(row, rawKey);
    }

    @DeleteMapping("/{keyId}")
    public Map<String, String> delete(@PathVariable String keyId) {
        var p = CurrentUser.require();
        ApiKeyEntity k =
                keys.findByIdAndUserId(keyId, p.id())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        keys.delete(k);
        return Map.of("message", "API key deleted");
    }

    public record ValidateBody(
            @NotBlank String provider, @NotBlank @Size(min = 8, max = 8192) String api_key) {}

    @PostMapping("/validate")
    public Map<String, Object> validateRaw(@Valid @RequestBody ValidateBody body) {
        CurrentUser.require();
        ProviderKeyProbe.ProbeResult r = probe.probe(body.provider(), body.api_key().strip());
        Map<String, Object> m = new HashMap<>();
        m.put("valid", r.ok());
        m.put("provider", body.provider());
        if (r.error() != null) {
            m.put("error", r.error());
        }
        return m;
    }

    public record ValidateSavedBody(@NotBlank String provider) {}

    @PostMapping("/validate-saved")
    public Map<String, Object> validateSaved(@Valid @RequestBody ValidateSavedBody body) {
        var p = CurrentUser.require();
        ApiKeyEntity row =
                keys.findByUserIdAndProvider(p.id(), body.provider())
                        .orElseThrow(
                                () ->
                                        new ResponseStatusException(
                                                HttpStatus.NOT_FOUND, "No saved key for " + body.provider()));
        String apiKey;
        try {
            apiKey = encryption.decrypt(row.getEncryptedKey());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Stored key could not be decrypted. Check API_KEY_ENCRYPTION_KEY matches the key used when saving.");
        }
        ProviderKeyProbe.ProbeResult r = probe.probe(body.provider(), apiKey);
        row.setValid(r.ok());
        keys.save(row);
        Map<String, Object> m = new HashMap<>();
        m.put("valid", r.ok());
        m.put("provider", body.provider());
        if (r.error() != null) {
            m.put("error", r.error());
        }
        return m;
    }

    private Map<String, Object> toResponse(ApiKeyEntity k) {
        String masked = "****";
        try {
            masked = encryption.maskKey(encryption.decrypt(k.getEncryptedKey()));
        } catch (Exception e) {
            k.setValid(false);
            keys.save(k);
        }
        Map<String, Object> m = new HashMap<>();
        m.put("id", k.getId());
        m.put("provider", k.getProvider());
        m.put("masked_key", masked);
        m.put("label", k.getLabel());
        m.put("is_valid", k.isValid());
        m.put("created_at", k.getCreatedAt().toString());
        return m;
    }

    private Map<String, Object> toResponseWithPlain(ApiKeyEntity k, String plain) {
        Map<String, Object> m = toResponse(k);
        m.put("masked_key", encryption.maskKey(plain));
        return m;
    }

    private static void softValidateFormat(String provider, String apiKey) {
        if (apiKey.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "API key is too short.");
        }
        if ("openai".equals(provider) && !apiKey.startsWith("sk-")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OpenAI secret keys usually start with sk-.");
        }
        if ("replicate".equals(provider) && !apiKey.startsWith("r8_")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Replicate API tokens usually start with r8_.");
        }
        if ("zyte".equals(provider) && apiKey.length() < 16) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Zyte API key looks too short.");
        }
        if ("groq".equals(provider) && !apiKey.startsWith("gsk_")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Groq API keys usually start with gsk_.");
        }
    }
}
