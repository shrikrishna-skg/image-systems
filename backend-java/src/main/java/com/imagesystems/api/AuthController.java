package com.imagesystems.api;

import com.imagesystems.config.AppProperties;
import com.imagesystems.persistence.UserEntity;
import com.imagesystems.persistence.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.validation.constraints.NotBlank;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppProperties props;
    private final UserRepository users;

    public AuthController(AppProperties props, UserRepository users) {
        this.props = props;
        this.users = users;
    }

    public record LocalLoginBody(
            @NotBlank String email,
            @NotBlank String password,
            String full_name) {}

    @PostMapping("/local/session")
    public Map<String, Object> localSession(@RequestBody LocalLoginBody body) {
        if (!props.localDevMode()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found");
        }
        String emailRaw = body.email().strip();
        if (!emailRaw.contains("@")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        }
        if (body.password() == null || body.password().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter your password.");
        }
        String emailNorm = emailRaw.toLowerCase();
        String pwEnv = props.localDevLoginPassword() == null ? "" : props.localDevLoginPassword().strip();
        String emEnv = props.localDevLoginEmail() == null ? "" : props.localDevLoginEmail().strip();
        if (!pwEnv.isEmpty()) {
            if (!body.password().equals(pwEnv)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
            }
            if (!emEnv.isEmpty() && !emailNorm.equalsIgnoreCase(emEnv)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
            }
        } else if (!emEnv.isEmpty() && !emailNorm.equalsIgnoreCase(emEnv)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
        }

        UserEntity user =
                users.findByEmailIgnoreCase(emailNorm)
                        .orElseGet(
                                () -> {
                                    UserEntity u = new UserEntity();
                                    u.setId(UUID.randomUUID().toString());
                                    u.setEmail(emailNorm);
                                    u.setFullName(null);
                                    u.setActive(true);
                                    u.setImagesProcessed(0);
                                    Instant now = Instant.now();
                                    u.setCreatedAt(now);
                                    u.setUpdatedAt(now);
                                    return users.save(u);
                                });
        if (body.full_name() != null) {
            String fn = body.full_name().strip();
            user.setFullName(fn.isEmpty() ? null : fn);
            user.setUpdatedAt(Instant.now());
            user = users.save(user);
        }

        SecretKey key = Keys.hmacShaKeyFor(props.appSecretKey().getBytes(StandardCharsets.UTF_8));
        String token =
                Jwts.builder()
                        .subject(user.getId())
                        .claim("email", user.getEmail())
                        .expiration(Date.from(Instant.now().plus(30, ChronoUnit.DAYS)))
                        .signWith(key)
                        .compact();

        Map<String, Object> out = new HashMap<>();
        out.put("access_token", token);
        out.put("token_type", "bearer");
        out.put("user", userMap(user));
        return out;
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        var p = CurrentUser.require();
        UserEntity u =
                users.findById(p.id()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return userMap(u);
    }

    @PutMapping("/me")
    public Map<String, Object> updateMe(@RequestParam(value = "full_name", required = false) String fullName) {
        var p = CurrentUser.require();
        UserEntity u =
                users.findById(p.id()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (fullName != null) {
            String fn = fullName.strip();
            u.setFullName(fn.isEmpty() ? null : fn);
            u.setUpdatedAt(Instant.now());
            u = users.save(u);
        }
        return userMap(u);
    }

    private static Map<String, Object> userMap(UserEntity u) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", u.getId());
        m.put("email", u.getEmail());
        m.put("full_name", u.getFullName());
        m.put("images_processed", u.getImagesProcessed());
        m.put("created_at", u.getCreatedAt().toString());
        return m;
    }
}
