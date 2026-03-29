package com.imagesystems.service;

import com.imagesystems.config.AppProperties;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class StorageService {

    private final AppProperties props;

    public StorageService(AppProperties props) {
        this.props = props;
    }

    public Path uploadRoot() {
        Path p = props.uploadDir().toAbsolutePath().normalize();
        try {
            Files.createDirectories(p);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create upload dir", e);
        }
        return p;
    }

    public Path userDir(String userId) throws IOException {
        Path d = uploadRoot().resolve(userId);
        Files.createDirectories(d);
        return d;
    }

    /** @return absolute storage path string */
    public String saveUpload(MultipartFile file, String userId) throws IOException {
        Path dir = userDir(userId);
        String orig = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.bin";
        String safe = orig.replaceAll("[^\\w.\\-]", "_");
        Path target = dir.resolve(UUID.randomUUID() + "_" + safe);
        try (InputStream in = file.getInputStream(); OutputStream out = Files.newOutputStream(target)) {
            in.transferTo(out);
        }
        return target.toAbsolutePath().toString();
    }

    public String saveBytes(byte[] data, String userId, String filename) throws IOException {
        Path dir = userDir(userId);
        String safe = filename.replaceAll("[^\\w.\\-]", "_");
        Path target = dir.resolve(safe);
        Files.write(target, data);
        return target.toAbsolutePath().toString();
    }

    public boolean fileExists(String path) {
        if (path == null || path.isBlank()) {
            return false;
        }
        return Files.isRegularFile(Path.of(path));
    }

    public void deleteFile(String path) {
        if (path == null || path.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(Path.of(path));
        } catch (IOException ignored) {
        }
    }
}
