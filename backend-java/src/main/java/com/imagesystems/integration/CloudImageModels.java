package com.imagesystems.integration;

import com.imagesystems.service.EnhancementPromptService;
import java.util.Set;

public final class CloudImageModels {

    private static final Set<String> OPENAI =
            Set.of("gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini");
    private static final Set<String> GEMINI =
            Set.of("gemini-2.5-flash-image", "gemini-2.0-flash-exp-image-generation");

    private CloudImageModels() {}

    public static void validateCloudModel(String provider, String model) {
        String m = model == null ? "" : model.strip();
        if ("openai".equals(provider) && !OPENAI.contains(m)) {
            throw new IllegalArgumentException(
                    "Unsupported OpenAI image model. Use one of: " + String.join(", ", OPENAI) + ".");
        }
        if ("gemini".equals(provider) && !GEMINI.contains(m)) {
            throw new IllegalArgumentException(
                    "Unsupported Gemini image model. Use one of: " + String.join(", ", GEMINI) + ".");
        }
    }

    public static boolean listingCompositionRelaxPerspective(String perspective) {
        String k = EnhancementPromptService.resolvePerspectivePresetKey(perspective);
        return "change_angle_front".equals(k)
                || "change_angle_side".equals(k)
                || "center_angle".equals(k);
    }

    public static boolean listingCameraAngleGemini(String perspective) {
        String k = EnhancementPromptService.resolvePerspectivePresetKey(perspective);
        return "change_angle_front".equals(k) || "change_angle_side".equals(k);
    }
}
