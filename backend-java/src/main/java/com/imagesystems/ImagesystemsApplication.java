package com.imagesystems;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class ImagesystemsApplication {

    public static void main(String[] args) {
        SpringApplication.run(ImagesystemsApplication.class, args);
    }
}
