package com.imagesystems.config;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class HttpClientConfig {

    private static final Duration CONNECT = Duration.ofSeconds(20);
    private static final Duration READ = Duration.ofMinutes(10);

    @Bean
    JdkClientHttpRequestFactory integrationRequestFactory() {
        HttpClient http =
                HttpClient.newBuilder().connectTimeout(CONNECT).followRedirects(HttpClient.Redirect.NORMAL).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(READ);
        return factory;
    }

    @Bean
    @Qualifier("openAi")
    RestClient openAiRestClient(JdkClientHttpRequestFactory integrationRequestFactory) {
        return RestClient.builder()
                .baseUrl("https://api.openai.com/v1")
                .requestFactory(integrationRequestFactory)
                .build();
    }

    @Bean
    @Qualifier("replicate")
    RestClient replicateRestClient(JdkClientHttpRequestFactory integrationRequestFactory) {
        return RestClient.builder()
                .baseUrl("https://api.replicate.com/v1")
                .requestFactory(integrationRequestFactory)
                .build();
    }

    @Bean
    @Qualifier("integration")
    RestClient integrationRestClient(JdkClientHttpRequestFactory integrationRequestFactory) {
        return RestClient.builder().requestFactory(integrationRequestFactory).build();
    }
}
