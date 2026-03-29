package com.imagesystems.config;

import java.nio.file.Path;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final AppProperties props;

    public WebMvcConfig(AppProperties props) {
        this.props = props;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        if ("development".equalsIgnoreCase(props.appEnv())) {
            Path upload = props.uploadDir().toAbsolutePath().normalize();
            registry.addResourceHandler("/uploads/**").addResourceLocations("file:" + upload + "/");
        }
    }
}
