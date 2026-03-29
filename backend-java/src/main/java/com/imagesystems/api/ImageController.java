package com.imagesystems.api;

import com.imagesystems.service.EnhancementPromptService;
import com.imagesystems.service.ImageWorkspaceService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/images")
@Validated
public class ImageController {

    private final ImageWorkspaceService workspace;
    private final EnhancementPromptService prompts;

    public ImageController(ImageWorkspaceService workspace, EnhancementPromptService prompts) {
        this.workspace = workspace;
        this.prompts = prompts;
    }

    @GetMapping("/presets")
    public Map<String, Object> presets() {
        return prompts.getAvailablePresets();
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<Map<String, Object>> upload(@RequestParam("files") List<MultipartFile> files) throws IOException {
        return workspace.upload(CurrentUser.require().id(), files);
    }

    @PostMapping("/{imageId}/enhance")
    public Map<String, Object> enhance(
            @PathVariable String imageId, @RequestBody Map<String, Object> body) {
        return workspace.enhance(CurrentUser.require().id(), imageId, body);
    }

    @PostMapping("/{imageId}/upscale")
    public Map<String, Object> upscale(
            @PathVariable String imageId, @RequestBody Map<String, Object> body) {
        return workspace.upscale(CurrentUser.require().id(), imageId, body);
    }

    @PostMapping("/{imageId}/process")
    public Map<String, Object> process(
            @PathVariable String imageId, @RequestBody Map<String, Object> body) {
        return workspace.processFullPipeline(CurrentUser.require().id(), imageId, body);
    }

    @PostMapping(value = "/{imageId}/local-improve", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> localImprove(
            @PathVariable String imageId, @RequestParam("file") MultipartFile file) throws IOException {
        return workspace.localImprove(CurrentUser.require().id(), imageId, file);
    }

    @GetMapping("/{imageId}")
    public Map<String, Object> getOne(@PathVariable String imageId) {
        return workspace.getDetail(CurrentUser.require().id(), imageId);
    }

    @GetMapping("/{imageId}/download")
    public ResponseEntity<Resource> download(
            @PathVariable String imageId, @RequestParam(required = false) String version) {
        return workspace.download(CurrentUser.require().id(), imageId, version);
    }

    @PostMapping("/{imageId}/suggest-filename")
    public Map<String, Object> suggestFilename(@PathVariable String imageId) {
        return workspace.suggestFilename(CurrentUser.require().id(), imageId);
    }

    @GetMapping("")
    public List<Map<String, Object>> list(
            @RequestParam(defaultValue = "0") @Min(0) @Max(50_000) int skip,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit) {
        return workspace.list(CurrentUser.require().id(), skip, limit);
    }

    @DeleteMapping("/{imageId}")
    public Map<String, String> delete(@PathVariable String imageId) {
        return workspace.delete(CurrentUser.require().id(), imageId);
    }

    @PostMapping("/estimate-cost")
    public Map<String, Object> estimateCost(@RequestBody Map<String, Object> body) {
        return workspace.estimateCost(body);
    }
}
