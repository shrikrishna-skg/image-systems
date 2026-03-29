package com.imagesystems.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.concurrent.TimeUnit;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    CacheManager cacheManager() {
        CaffeineCacheManager mgr = new CaffeineCacheManager("presets", "knowledgeFilters");
        mgr.setCaffeine(
                Caffeine.newBuilder().maximumSize(500).expireAfterWrite(1, TimeUnit.HOURS).recordStats());
        return mgr;
    }
}
