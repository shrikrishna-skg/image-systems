package com.imagesystems.security;

import com.imagesystems.config.AppProperties;
import java.util.ArrayList;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter) throws Exception {
        http.cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        auth -> auth.requestMatchers("/api/health", "/api/health/**")
                                .permitAll()
                                .requestMatchers(HttpMethod.GET, "/api/images/presets")
                                .permitAll()
                                .requestMatchers(HttpMethod.GET, "/api/knowledge/**")
                                .permitAll()
                                .requestMatchers(HttpMethod.POST, "/api/auth/local/session")
                                .permitAll()
                                .requestMatchers("/uploads/**")
                                .permitAll()
                                .anyRequest()
                                .authenticated())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration cfg = new CorsConfiguration();
        List<String> origins = new ArrayList<>(props.corsOrigins());
        String extra = System.getenv("CORS_ORIGINS");
        if (extra != null && !extra.isBlank()) {
            for (String part : extra.split(",")) {
                String t = part.strip();
                if (!t.isEmpty() && !origins.contains(t)) {
                    origins.add(t);
                }
            }
        }
        cfg.setAllowedOrigins(origins);
        cfg.setAllowedMethods(java.util.List.of("*"));
        cfg.setAllowedHeaders(java.util.List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
