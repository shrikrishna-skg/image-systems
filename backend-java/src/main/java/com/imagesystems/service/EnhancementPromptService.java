package com.imagesystems.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.imagesystems.config.AppProperties;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class EnhancementPromptService {

    private final AppProperties props;
    private final ObjectMapper mapper;
    private JsonNode bundle;

    public EnhancementPromptService(AppProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    @PostConstruct
    void load() {
        ClassPathResource res = new ClassPathResource("prompts/enhancement-prompt-bundle.json");
        try (InputStream in = res.getInputStream()) {
            bundle = mapper.readTree(in);
        } catch (IOException e) {
            throw new IllegalStateException("Missing prompts/enhancement-prompt-bundle.json", e);
        }
    }

    @Cacheable(value = "presets", unless = "#result == null || #result.isEmpty()")
    public Map<String, Object> getAvailablePresets() {
        Map<String, Object> out = new HashMap<>();
        out.put("lighting", keys(bundle.path("LIGHTING_PRESETS")));
        out.put("quality", keys(bundle.path("QUALITY_PRESETS")));
        out.put("perspective", keys(bundle.path("PERSPECTIVE_PRESETS")));
        out.put("room_types", keys(bundle.path("ROOM_CONTEXTS")));
        return out;
    }

    private static List<String> keys(JsonNode obj) {
        List<String> k = new ArrayList<>();
        if (obj.isObject()) {
            obj.fieldNames().forEachRemaining(k::add);
        }
        return k;
    }

    public String buildEnhancementPrompt(
            String lighting,
            String quality,
            String perspective,
            String roomType,
            String customPrompt,
            boolean perspectiveCornerOutpaint) {
        String perspectiveKey = resolvePerspectivePresetKey(perspective);
        boolean listingBlocks = props.listingPromptBlocksEnabled();
        boolean listingReframe = listingBlocks && isChangeAngle(perspectiveKey);
        boolean listingCenterOnly = listingBlocks && "center_angle".equals(perspectiveKey);
        boolean listingComposition = listingReframe || listingCenterOnly;

        String base;
        if (listingBlocks) {
            if (listingReframe) {
                base = text("BASE_INSTRUCTION_LISTING_VIEWPOINT");
            } else if (listingCenterOnly) {
                base = text("BASE_INSTRUCTION_LISTING_CENTER_ANGLE");
            } else {
                base = text("BASE_INSTRUCTION");
            }
        } else {
            base = text("BASE_INSTRUCTION");
        }

        String cloudPreamble = text("CLOUD_FIXTURE_LOCK_PREAMBLE");
        String zero = text("ZERO_ADDITIONS_ENFORCEMENT");
        String fixtureRem = text("FIXTURE_PARITY_FINAL_REMINDER");
        String listingCheck = text("LISTING_CENTER_GEOMETRY_CHECK");

        Map<String, String> roomContexts = stringMap("ROOM_CONTEXTS");
        String roomContext = roomContexts.getOrDefault(
                roomType == null || roomType.isBlank() ? "general" : roomType, roomContexts.get("general"));

        if (customPrompt != null && !customPrompt.isBlank()) {
            StringBuilder out = new StringBuilder();
            out.append(cloudPreamble).append(base).append("\n\nUser instruction: ").append(customPrompt);
            if (listingComposition) {
                out.append("\n\nPERSPECTIVE: ").append(presetText("PERSPECTIVE_PRESETS", perspectiveKey));
                out.append(listingNoWhitePlateNote(perspectiveKey, perspectiveCornerOutpaint));
            } else if (perspectiveKey != null && bundle.path("PERSPECTIVE_PRESETS").has(perspectiveKey)) {
                out.append("\n\nPERSPECTIVE: ").append(presetText("PERSPECTIVE_PRESETS", perspectiveKey));
            }
            if (perspectiveCornerOutpaint) {
                out.append("\n\n").append(cornerOutpaintBlock(perspective));
            }
            out.append("\n\n").append(zero);
            if (listingComposition) {
                out.append(listingCheck);
            }
            out.append(fixtureRem);
            out.append(
                    "\n\nThe final result must look photorealistic — like a high-end professional photograph, not AI-generated.");
            return out.toString();
        }

        StringBuilder parts = new StringBuilder();
        parts.append(cloudPreamble).append(base);

        if (listingComposition) {
            parts.append("\n\nPERSPECTIVE: ").append(presetText("PERSPECTIVE_PRESETS", perspectiveKey));
            parts.append(listingNoWhitePlateNote(perspectiveKey, perspectiveCornerOutpaint));
            parts.append("\nThis is a photograph of a ").append(roomContext).append(".");
        } else {
            parts.append("\nThis is a photograph of a ").append(roomContext).append(".");
        }

        Map<String, String> lightingPresets = stringMap("LIGHTING_PRESETS");
        if (lighting != null && lightingPresets.containsKey(lighting)) {
            parts.append("\nLIGHTING: ").append(lightingPresets.get(lighting));
        }
        Map<String, String> qualityPresets = stringMap("QUALITY_PRESETS");
        if (quality != null && qualityPresets.containsKey(quality)) {
            parts.append("\nQUALITY: ").append(qualityPresets.get(quality));
        }

        if (!listingComposition) {
            if (perspectiveKey != null && bundle.path("PERSPECTIVE_PRESETS").has(perspectiveKey)) {
                parts.append("\nPERSPECTIVE: ").append(presetText("PERSPECTIVE_PRESETS", perspectiveKey));
            }
            parts.append(listingNoWhitePlateNote(perspectiveKey, perspectiveCornerOutpaint));
        }

        boolean anyPreset =
                (lighting != null && !lighting.isBlank())
                        || (quality != null && !quality.isBlank())
                        || perspectiveKey != null;
        if (!anyPreset) {
            parts.append("\nApply professional-grade enhancement: ")
                    .append(qualityPresets.get("full_enhance"));
            parts.append("\n").append(lightingPresets.get("bright"));
        }

        if (perspectiveCornerOutpaint) {
            parts.append("\n").append(cornerOutpaintBlock(perspective));
        }

        parts.append("\n").append(zero);
        if (listingComposition) {
            parts.append(listingCheck);
        }
        parts.append(fixtureRem);
        parts.append("\nThe final result must look photorealistic — like a high-end professional photograph, not AI-generated.");
        return parts.toString();
    }

    private String text(String key) {
        return bundle.path(key).asText("");
    }

    private Map<String, String> stringMap(String key) {
        Map<String, String> m = new HashMap<>();
        JsonNode n = bundle.path(key);
        if (n.isObject()) {
            Iterator<String> it = n.fieldNames();
            while (it.hasNext()) {
                String k = it.next();
                m.put(k, n.path(k).asText(""));
            }
        }
        return m;
    }

    private String presetText(String section, String key) {
        return bundle.path(section).path(key).asText("");
    }

    private boolean isChangeAngle(String perspectiveKey) {
        JsonNode arr = bundle.path("CHANGE_ANGLE_PRESET_KEYS");
        if (arr.isArray()) {
            for (JsonNode x : arr) {
                if (x.asText("").equals(perspectiveKey)) {
                    return true;
                }
            }
        }
        return false;
    }

    public static String resolvePerspectivePresetKey(String perspective) {
        if ("center_angle_auto".equals(perspective)) {
            return "change_angle_side";
        }
        return perspective;
    }

    private String cornerOutpaintBlock(String perspective) {
        String p = resolvePerspectivePresetKey(perspective);
        String base = text("CORNER_OUTPAINT_INSTRUCTION");
        if ("change_angle_front".equals(p) || "change_angle_side".equals(p)) {
            return base + "\n\n" + text("CORNER_OUTPAINT_CHANGE_ANGLE_ADDENDUM");
        }
        if ("center_angle".equals(p)) {
            return base + "\n\n" + text("CORNER_OUTPAINT_CENTER_ANGLE_ADDENDUM");
        }
        return base;
    }

    private String listingNoWhitePlateNote(String perspectiveKey, boolean cornerOutpaint) {
        if (cornerOutpaint || perspectiveKey == null) {
            return "";
        }
        if (isChangeAngle(perspectiveKey)) {
            return text("CHANGE_ANGLE_WITHOUT_PLATE_NOTE");
        }
        if ("center_angle".equals(perspectiveKey)) {
            return text("CENTER_ANGLE_WITHOUT_PLATE_NOTE");
        }
        return "";
    }
}
