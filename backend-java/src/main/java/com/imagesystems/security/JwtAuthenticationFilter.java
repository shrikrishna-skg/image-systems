package com.imagesystems.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.imagesystems.config.AppProperties;
import com.imagesystems.persistence.UserEntity;
import com.imagesystems.persistence.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final AppProperties props;
    private final UserRepository users;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(AppProperties props, UserRepository users, ObjectMapper objectMapper) {
        this.props = props;
        this.users = users;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        String auth = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (auth == null || !auth.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        String token = auth.substring(7).trim();
        try {
            Claims claims = parseClaims(token);
            String sub = claims.getSubject();
            if (sub == null || sub.isBlank()) {
                filterChain.doFilter(request, response);
                return;
            }
            Optional<UserEntity> userOpt = users.findById(sub);
            UserEntity user;
            if (userOpt.isEmpty()) {
                if (props.localDevMode()) {
                    filterChain.doFilter(request, response);
                    return;
                }
                user = provisionSupabaseUser(claims, sub);
            } else {
                user = userOpt.get();
            }
            if (!user.isActive()) {
                filterChain.doFilter(request, response);
                return;
            }
            if (props.localDevMode()) {
                Object emailClaim = claims.get("email");
                if (emailClaim != null
                        && !user.getEmail().equalsIgnoreCase(String.valueOf(emailClaim).trim())) {
                    filterChain.doFilter(request, response);
                    return;
                }
            }
            var principal = new UserPrincipal(user.getId(), user.getEmail());
            var authToken = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
        } catch (Exception ignored) {
            SecurityContextHolder.clearContext();
        }
        filterChain.doFilter(request, response);
    }

    private Claims parseClaims(String token) {
        if (props.localDevMode()) {
            SecretKey key = Keys.hmacShaKeyFor(props.appSecretKey().getBytes(StandardCharsets.UTF_8));
            return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        }
        if (props.jwtSecretConfigured()) {
            SecretKey key = Keys.hmacShaKeyFor(props.supabaseJwtSecret().trim().getBytes(StandardCharsets.UTF_8));
            return Jwts.parser()
                    .verifyWith(key)
                    .requireAudience("authenticated")
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        }
        if (props.isProduction()) {
            throw new IllegalStateException("SUPABASE_JWT_SECRET not configured");
        }
        return parseUnverifiedPayload(token);
    }

    private Claims parseUnverifiedPayload(String token) {
        String[] parts = token.split("\\.");
        if (parts.length < 2) {
            throw new IllegalArgumentException("Invalid JWT");
        }
        byte[] payload = Decoders.BASE64URL.decode(parts[1]);
        try {
            Map<String, Object> map =
                    objectMapper.readValue(payload, new TypeReference<Map<String, Object>>() {});
            return Jwts.claims(map);
        } catch (IOException e) {
            throw new IllegalArgumentException("Invalid JWT payload", e);
        }
    }

    private UserEntity provisionSupabaseUser(Claims claims, String sub) {
        String email = claims.get("email", String.class);
        if (email == null) {
            email = "";
        }
        String fullName = "";
        Object meta = claims.get("user_metadata");
        if (meta instanceof Map<?, ?> m) {
            Object fn = m.get("full_name");
            if (fn != null) {
                fullName = fn.toString();
            }
        }
        Instant now = Instant.now();
        UserEntity u = new UserEntity();
        u.setId(sub);
        u.setEmail(email);
        u.setFullName(fullName.isBlank() ? null : fullName);
        u.setActive(true);
        u.setImagesProcessed(0);
        u.setCreatedAt(now);
        u.setUpdatedAt(now);
        return users.save(u);
    }
}
