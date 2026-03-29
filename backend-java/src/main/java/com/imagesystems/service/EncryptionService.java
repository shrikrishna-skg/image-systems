package com.imagesystems.service;

import com.imagesystems.config.AppProperties;
import com.macasaet.fernet.Key;
import com.macasaet.fernet.StringValidator;
import com.macasaet.fernet.Token;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.time.temporal.TemporalAmount;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class EncryptionService {

    private static final Logger log = LoggerFactory.getLogger(EncryptionService.class);

    private final AppProperties props;
    private Key fernetKey;

    private final StringValidator stringValidator = new StringValidator() {
        @Override
        public TemporalAmount getTimeToLive() {
            return Duration.ofDays(36500);
        }
    };

    public EncryptionService(AppProperties props) {
        this.props = props;
    }

    @PostConstruct
    void init() {
        String raw = props.apiKeyEncryptionKey() == null ? "" : props.apiKeyEncryptionKey().trim();
        boolean prod = props.isProduction() && !props.localDevMode();
        if (prod) {
            if (raw.isEmpty()) {
                throw new IllegalStateException(
                        "API_KEY_ENCRYPTION_KEY must be set in production. Generate a Fernet key compatible with Python cryptography.fernet.");
            }
            this.fernetKey = new Key(raw);
            return;
        }
        if (!raw.isEmpty()) {
            try {
                this.fernetKey = new Key(raw);
                return;
            } catch (Exception e) {
                log.warn("API_KEY_ENCRYPTION_KEY invalid; using ephemeral Fernet key (dev only).");
            }
        }
        this.fernetKey = Key.generateKey();
        log.warn("No valid API_KEY_ENCRYPTION_KEY — using ephemeral Fernet (dev). Keys won't survive restart.");
    }

    public String encrypt(String plaintext) {
        return Token.generate(fernetKey, plaintext).serialise();
    }

    public String decrypt(String ciphertext) {
        return Token.fromString(ciphertext).validateAndDecrypt(fernetKey, stringValidator);
    }

    public String maskKey(String plaintext) {
        if (plaintext == null || plaintext.length() <= 8) {
            return "****";
        }
        return plaintext.substring(0, 4) + "..." + plaintext.substring(plaintext.length() - 4);
    }
}
