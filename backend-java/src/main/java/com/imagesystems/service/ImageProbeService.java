package com.imagesystems.service;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Locale;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Service;

@Service
public class ImageProbeService {

    public record DimensionsMime(int width, int height, String mimeType) {}

    public DimensionsMime probeStoredImage(String filePath) throws IOException {
        Path p = Path.of(filePath);
        BufferedImage img = ImageIO.read(p.toFile());
        if (img == null) {
            throw new IOException("Not a decodable image");
        }
        String name = p.getFileName().toString().toLowerCase(Locale.ROOT);
        String mime = guessMime(name);
        return new DimensionsMime(img.getWidth(), img.getHeight(), mime);
    }

    public int[] dimensions(String filePath) throws IOException {
        BufferedImage img = ImageIO.read(Path.of(filePath).toFile());
        if (img == null) {
            throw new IOException("bad image");
        }
        return new int[] {img.getWidth(), img.getHeight()};
    }

    public String guessMime(String filename) {
        String n = filename.toLowerCase(Locale.ROOT);
        if (n.endsWith(".png")) {
            return "image/png";
        }
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (n.endsWith(".webp")) {
            return "image/webp";
        }
        if (n.endsWith(".gif")) {
            return "image/gif";
        }
        return "application/octet-stream";
    }

    public String mimeForPath(String path) {
        return guessMime(Path.of(path).getFileName().toString());
    }

    /** Resize to fit max edge; returns PNG bytes (OpenAI edit input). */
    public byte[] resizeForApi(String filePath, int maxDimension) throws IOException {
        BufferedImage src = ImageIO.read(Path.of(filePath).toFile());
        if (src == null) {
            throw new IOException("bad image");
        }
        BufferedImage rgb = toRgb(src);
        int w = rgb.getWidth();
        int h = rgb.getHeight();
        int max = Math.max(w, h);
        if (max > maxDimension) {
            double r = maxDimension / (double) max;
            w = Math.max(1, (int) Math.round(w * r));
            h = Math.max(1, (int) Math.round(h * r));
            BufferedImage scaled = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = scaled.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.drawImage(rgb, 0, 0, w, h, null);
            g.dispose();
            rgb = scaled;
        }
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(rgb, "png", baos);
        return baos.toByteArray();
    }

    public byte[] resizeRasterBytesToSize(byte[] data, int targetW, int targetH, String outputFormat, int jpegQuality)
            throws IOException {
        BufferedImage src = ImageIO.read(new ByteArrayInputStream(data));
        if (src == null) {
            throw new IOException("bad image");
        }
        BufferedImage work = src.getType() == BufferedImage.TYPE_INT_ARGB ? src : toRgb(src);
        BufferedImage out =
                new BufferedImage(targetW, targetH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.drawImage(work, 0, 0, targetW, targetH, null);
        g.dispose();
        String fmt = switch (outputFormat.toLowerCase(Locale.ROOT)) {
            case "jpg", "jpeg" -> "jpg";
            case "webp" -> "webp";
            default -> "png";
        };
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        if ("jpg".equals(fmt)) {
            ImageIO.write(out, "jpg", baos);
        } else if ("webp".equals(fmt)) {
            ImageIO.write(out, "webp", baos);
        } else {
            ImageIO.write(out, "png", baos);
        }
        return baos.toByteArray();
    }

    private static BufferedImage toRgb(BufferedImage src) {
        if (src.getType() == BufferedImage.TYPE_INT_RGB) {
            return src;
        }
        BufferedImage rgb = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return rgb;
    }
}
