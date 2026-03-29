package com.imagesystems.integration;

import java.util.Locale;

public final class ImageMathUtils {

    private ImageMathUtils() {}

    public static String normalizeTargetResolutionKey(String raw) {
        if (raw == null) {
            return null;
        }
        String k = raw.strip().toLowerCase(Locale.ROOT).replace(" ", "").replace("_", "");
        return switch (k) {
            case "1080p" -> "1080p";
            case "2k" -> "2k";
            case "4k" -> "4k";
            case "8k" -> "8k";
            default -> null;
        };
    }

    public static int[] calculateTargetResolution(int ow, int oh, String target) {
        int maxDim =
                switch (target) {
                    case "1080p" -> 1920;
                    case "2k" -> 2560;
                    case "4k" -> 3840;
                    case "8k" -> 7680;
                    default -> 3840;
                };
        double ratio = ow / (double) oh;
        if (ratio >= 1) {
            return new int[] {maxDim, Math.max(1, (int) Math.round(maxDim / ratio))};
        }
        return new int[] {Math.max(1, (int) Math.round(maxDim * ratio)), maxDim};
    }

    public static int[] planReplicateUpscaleTotal(int ew, int eh, String targetResolution, double scaleFactorPref) {
        double pref = scaleFactorPref > 0 ? scaleFactorPref : 2.0;
        int sfSnap = pref <= 2 ? 2 : pref <= 4 ? 4 : 8;
        String norm = normalizeTargetResolutionKey(targetResolution);
        if (norm != null && ew > 0 && eh > 0) {
            int[] twth = calculateTargetResolution(ew, eh, norm);
            double need = Math.max(twth[0] / (double) ew, twth[1] / (double) eh);
            need = Math.max(need, sfSnap);
            int chosen = 8;
            for (int p : new int[] {2, 4, 8}) {
                if (p + 1e-9 >= need) {
                    chosen = p;
                    break;
                }
            }
            return new int[] {chosen, twth[0], twth[1]};
        }
        return new int[] {sfSnap, -1, -1};
    }

    public static int[] desiredFinalPixelSize(int sw, int sh, String targetResolution, double scaleFactorPref) {
        if (sw <= 0 || sh <= 0) {
            return null;
        }
        int[] plan = planReplicateUpscaleTotal(sw, sh, targetResolution, scaleFactorPref);
        int rep = plan[0];
        int tw = plan[1];
        int th = plan[2];
        if (tw > 0 && th > 0) {
            return new int[] {tw, th};
        }
        return new int[] {Math.max(1, (int) Math.round(sw * rep)), Math.max(1, (int) Math.round(sh * rep))};
    }
}
