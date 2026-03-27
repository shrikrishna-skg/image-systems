# AI Image Upscaling & Enhancement Technologies Research (2025-2026)

## 1. Super-Resolution / Upscaling APIs and Tools

### Real-ESRGAN
- **Type:** GAN-based (open source)
- **Capabilities:** Up to 8x upscale while maintaining fine details, textures, and natural appearance
- **Best for:** Realistic photo restoration — it will not hallucinate/invent details
- **API access:** Available via Replicate (`nightmareai/real-esrgan`), WaveSpeedAI, and self-hostable
- **Speed:** ~0.7s for 2x on Nvidia A100; ~1.8s on Nvidia T4
- **Cost via Replicate:** ~$0.02-$0.10 per image depending on resolution
- **Self-hosting:** Fully open source, runs on any Vulkan-compatible GPU

### Topaz Gigapixel AI
- **Type:** Conservative interpolation + edge sharpening (proprietary)
- **Approach:** Will NOT invent detail — if detail isn't there, result may look flat but will be accurate
- **Best for:** Photographers, print reproduction, faithful restoration
- **Speed:** 12-25 seconds per image depending on denoise/sharpen modules
- **Pricing:** $69/month for all desktop + cloud apps with unlimited renders; perpetual license also available
- **API:** Desktop application, no public API

### Magnific AI
- **Type:** Diffusion-based "latent upscaling" (proprietary)
- **Capabilities:** Up to 16x upscale; hallucinates/dreams up new details (pores, threads, leaves)
- **Best for:** AI-generated art, creative detail-heavy upscaling
- **Controls:** Creativity slider (0 = normal upscaler; 5 = adds wrinkles, stitching, leaves)
- **API:** Yes, via Freepik Magnific API — supports text-guided and style-guided generation
- **Pricing:** Starting at ~$39/month
- **Speed:** 2-3 minutes per 2x upscale
- **Weakness for architecture:** Can introduce unwanted artifacts/distortions when realism/precision is required

### Krea AI
- **Type:** Hybrid (offers own enhancer + third-party enhancers including Topaz)
- **Controls:** Fine-tune AI strength (creativity), clarity, sharpness, color match
- **Extras:** Image/video generation, motion transfer, video lipsync
- **Pricing:** Starting at $10/month; free 2K upscaling available
- **Positioning:** "Magnific Lite" — good for teams needing upscaling + generation + video

### LetsEnhance / Claid.ai
- **Capabilities:** Up to 16x enlargement, 4K/8K outputs, 300 DPI print-ready
- **Modes:** "Gentle" (high fidelity, minimal hallucination) to "Ultra" (portraits/large prints)
- **API:** Yes, designed for SaaS/product integration

### Replicate API Models (Pay-per-use)
| Model | Best For | Cost | Speed |
|-------|----------|------|-------|
| `nightmareai/real-esrgan` | Batch jobs, speed | ~$0.02-0.05/image | Fast |
| `batouresearch/magic-image-refiner` | Realism, fine detail | ~$0.095/run (~98s) | Medium |
| `philz1337x/crystal-upscaler` | Portraits, faces, products | $0.10-$0.40 by MP tier | Medium |
| `recraft-ai/recraft-creative-upscale` | Creative/painterly | Varies | Medium |

### WaveSpeedAI
- Models: ESRGAN, Real-ESRGAN, SwinIR, specialized anime/photo models
- RESTful API, 2x/4x/8x scaling, batch processing, GPU-accelerated
- Credit-based pricing: $0.02-$0.10 per image

### Quality Comparison for Architectural/Interior Photos
- **Best photorealism preservation:** Topaz Gigapixel or Real-ESRGAN (conservative, no hallucination)
- **Best creative enhancement:** Magnific AI (but risks artifacts on precise architectural geometry)
- **Best budget option:** Krea AI or Real-ESRGAN via Replicate
- **Recommendation:** For architectural photos, use restorative (GAN-based) upscalers — they don't invent detail that could misrepresent structural elements

---

## 2. AI Image Enhancement for Real Estate / Hotels

### REimagineHome (by Styldod)
- **Features:** AI virtual staging, room redesign, exposure/color/contrast correction, vertical correction, day-to-dusk conversion, sky replacement, indoor/outdoor light activation
- **Pricing:** Starting at $14/month
- **API:** Enterprise API available for MLSs, brokers, consumer portals, iBuyers
- **Speed:** Minutes per image

### Autoenhance.ai
- **Features:** Sky replacement, perspective correction, image relighting, HDR enhancement
- **API:** Yes — designed for proptech platforms and large teams
- **Pricing:** From EUR 44.99/month
- **Speed:** Instant/automated (batch processing)
- **Notable:** One of the first to automate sky replacements with AI

### BoxBrownie
- **Type:** Human-powered service (not AI-only)
- **Features:** Virtual staging ($30/image), image enhancement ($1.60/image), clutter removal ($5+/image), day-to-night editing
- **API:** Not specified
- **Speed:** ~24 hour turnaround
- **Quality:** High (human editors) but slower and per-image cost adds up

### Styldod
- **Features:**
  - Virtual staging (8 design styles) — $16/image (bulk) or $23/image (small orders)
  - Commercial virtual staging
  - Matterport 3D virtual staging ($25/hotspot)
  - Virtual renovation (walls, ceilings, floors, kitchens, bathrooms)
  - Photo editing (clutter removal, brightness, sharpness, reflection removal)
  - AI property feature identification (82 features)
  - AI listing copy generation
  - Content moderation (adult content, watermarks, faces)
- **API:** Yes — image classification by room type, property feature extraction, content moderation
- **Turnaround:** 24 hours (12-hour super rapid option)
- **Clients:** ReMax, Coldwell Banker, Keller Williams, Sotheby's, Berkshire Hathaway, Century21

### Feature Comparison Matrix
| Feature | REimagineHome | Autoenhance.ai | BoxBrownie | Styldod |
|---------|--------------|----------------|------------|---------|
| Virtual Staging | Yes | No | Yes ($30/img) | Yes ($16-23/img) |
| Sky Replacement | Yes | Yes | Yes | Yes |
| Day-to-Dusk | Yes | Yes | Yes | Yes |
| Decluttering | Yes | No | Yes ($5+/img) | Yes |
| Relighting | Yes | Yes | Manual | Yes |
| Perspective Correction | Yes | Yes | Manual | Yes |
| API Available | Enterprise | Yes | No | Yes |
| Speed | Minutes | Instant | 24 hours | 24 hours |
| Pricing Model | Subscription | Subscription | Per-image | Per-image |

---

## 3. Technical Approaches

### Diffusion-Based vs GAN-Based Upscaling

**Key research finding (ICLR 2025):** Under truly fair comparisons (matched architecture, model size, dataset, compute budget), GANs achieve results comparable or superior to diffusion models for pure upscaling.

| Aspect | GAN-Based | Diffusion-Based |
|--------|-----------|-----------------|
| Inference | Single forward pass | Iterative multi-step denoising |
| Speed | Fast (real-time capable) | Slow (seconds to minutes) |
| Detail invention | Minimal — faithful to source | Can hallucinate new details |
| Training stability | Harder to train | More stable training |
| Output diversity | Limited | More diverse outputs |
| Best for | Faithful restoration, speed | Creative enhancement, flexibility |

**Hybrid approach (SRDDGAN):** Combines diffusion + GAN — outperforms pure diffusion in PSNR and perceptual quality, infers ~11x faster than diffusion-based SR3.

**Recommendation for architectural photos:** GAN-based (Real-ESRGAN) for faithful upscaling; diffusion-based only when creative enhancement is desired and manual review of structural accuracy is planned.

### ControlNet for Maintaining Structure

ControlNet adds structural conditioning to diffusion models, critical for architectural work:

- **Canny Edge Detection:** 94.2% structural accuracy (vs 22% for text-only prompting)
- **MLSD (Mobile Line Segment Detection):** Best for architecture/interiors — detects straight lines, keeps parallel lines parallel, prevents perspective distortion
- **ControlNet Tile:** Replaces missing details while preserving overall image structure; works tile-by-tile for fine texture enhancement
- **Flux.1 Canny:** Superior performance to SD 3.5 for architectural edge preservation

**Architecture workflow:** Use MLSD + Canny ControlNet in ComfyUI to maintain structural integrity while enhancing materials, lighting, or style.

### Changing Camera Angles (Novel View Synthesis)

**NeRF (Neural Radiance Fields):**
- Uses MLPs to learn 3D scene geometry + lighting from multiple 2D photos
- Can render novel viewpoints not in original photo collection
- Google uses NeRF in Google Maps for immersive views
- Limitation: Requires multiple input photos of the same scene

**3D Gaussian Splatting (2023+):**
- Direct competitor to NeRF, now dominant framework for novel view synthesis
- Faster rendering, better quality in many cases
- Being standardized via Khronos Group (glTF integration, webinar April 2026)

**Single-Image Solutions:**
- **Higgsfield Angles:** Consumer tool — change viewing angle of any single image using intuitive 3D rotation and manual sliders
- Works on objects, scenes, and people
- No re-prompting needed — direct camera control after photo is taken

**Recent advances:**
- **RAS-NeRF (2025):** Handles reflective materials (glass covers) — removes reflection interference for accurate reconstruction
- **ExpanDyNeRF (ICLR 2025):** Large-angle rotation from constrained viewpoints using Gaussian splatting prior
- **Stereo3D-NeRF (MMM 2026):** Stereoscopic 3D from pairwise inputs with improved depth and texture

**Practical reality:** For single real estate/hotel photos, true camera angle changes are still limited. Multi-photo capture + Gaussian Splatting/NeRF can create virtual walkthroughs. Single-image tools (Higgsfield) work for modest angle adjustments.

### Relighting Techniques

**IC-Light (Imposing Consistent Light) — ICLR 2025:**
- Created by Lvmin Zhang (also created ControlNet)
- Two models: text-conditioned relighting and background-conditioned
- Enforces physically-rooted constraints — modifies only illumination while preserving albedo and fine details
- Trained on 10M+ diverse samples (real photos, rendered images, in-the-wild images)
- Users control lighting with natural language prompts
- Can match subject lighting to any background for harmonization
- Open source: github.com/lllyasviel/IC-Light
- License note: BRIA RMBG 1.4 component is non-commercial; replace with BiRefNet for commercial use

**Relightful Harmonization (Ren et al., 2024):**
- Manipulates illumination of image foregrounds using background conditions
- Consistent subject relighting in diverse scenes using synthetic data

**RelightVid (2025):**
- Extension to video — temporally consistent relighting across frames

**Autoenhance.ai** also offers AI relighting specifically for real estate photos.

### Realistic Resolution Limits

| Source Quality | Max Reliable Upscale | Output from 1080p | Notes |
|---------------|---------------------|-------------------|-------|
| Sharp, high-quality | 4-6x | 4K-6K | Manual review recommended above 4x |
| Average quality | 2-4x | 2K-4K | Sweet spot for most use cases |
| Low quality/compressed | 2x max | 2K | Beyond 2x introduces artifacts |
| AI-generated | 4-8x | 4K-8K | Works well with Magnific-style tools |

**Key principles:**
1. 2x-4x is the realistic quality-preserving range for most source images
2. Two-pass approach (2x + 2x) often outperforms single 4x pass
3. Architecture-specific models outperform generic upscalers for building details
4. Fine text, complex geometric patterns, and railings/mullions are most prone to hallucination errors
5. Always zoom in and verify details after upscaling

---

## 4. Open Source / Self-Hostable Models

### Real-ESRGAN
- **License:** BSD-3-Clause
- **Hardware:** Any Vulkan-compatible GPU; NVIDIA recommended
- **Variants:** RealESRGAN_x4plus (photos), RealESRGAN_x4plus_anime (anime/illustrations)
- **Apple Silicon:** Core ML conversion achieves 78x speedup via Neural Engine
- **Desktop app:** Upscayl (AGPLv3) — wraps Real-ESRGAN with GUI, batch processing

### Stable Diffusion XL (Image-to-Image)
- **Use for:** Creative enhancement, style transfer, material transformation
- **Architecture-specific LoRAs available:**
  - Bilus Commercial Architecture V0.2
  - MIR Architectural Rendering SDXL1.0
  - Cityscape SDXL v1.0
  - Kiwi SDXL Nonlinear Architecture v1.0
- **Workflow:** ComfyUI + SDXL + ControlNet (Canny/MLSD) + ESRGAN post-processing
- **Best practice:** Use ControlNet to maintain structural integrity while enhancing

### Clarity AI Upscaler
- Open source diffusion-based upscaler
- Generates additional visual information beyond interpolation
- Intended as free alternative to commercial AI upscaling tools
- Can run locally

### Upscayl (Desktop Application)
- Open source (AGPLv3), cross-platform (Linux, macOS, Windows)
- Bundles multiple ESRGAN models: Real-ESRGAN, UltraSharp, Digital Art
- Batch processing, no cloud uploads, no watermarks
- Requires Vulkan-compatible GPU (no CPU/iGPU support)

### Upscale-Enhance
- MIT license, open source
- macOS 13.0+ (no GPU required — uses Neural Engine on Apple Silicon)
- Windows/Linux with NVIDIA GPU
- 78x speedup on Apple Silicon vs CPU PyTorch

### Warlock-Studio (Windows)
- Bundles Real-ESRGAN, BSRGAN, IRCNN, GFPGAN, RealESRNet, RIFE
- Multi-GPU support, batch processing, automatic tiling for VRAM management
- Face restoration (GFPGAN) + upscaling in one pipeline

### IC-Light (Relighting)
- Open source (github.com/lllyasviel/IC-Light)
- Self-hostable with standard diffusion model infrastructure
- Text-conditioned and background-conditioned relighting

### Recommended Self-Hosted Pipeline for Architectural/Interior Photos

```
Input Photo
    |
    v
[Preprocessing] — Autoenhance.ai API or manual adjustments
    |
    v
[Relighting if needed] — IC-Light (self-hosted)
    |
    v
[Enhancement] — SDXL + ControlNet (MLSD + Canny) via ComfyUI
    |          — Use architecture-specific LoRAs
    |
    v
[Upscaling] — Real-ESRGAN 2x (first pass)
    |
    v
[Upscaling] — Real-ESRGAN 2x (second pass, if 4x needed)
    |
    v
[Quality Check] — Manual review of architectural details
    |
    v
Output (up to 4K from 1080p source)
```

---

## Summary: Tool Selection Guide

| Need | Best Tool | Open Source? | API? | Cost |
|------|-----------|-------------|------|------|
| Faithful photo upscaling | Real-ESRGAN | Yes | Yes (Replicate) | $0.02-0.10/img |
| Creative upscaling | Magnific AI | No | Yes | $39+/mo |
| Budget upscaling | Krea AI | No | Yes | $10/mo |
| Desktop upscaling | Topaz Gigapixel | No | No | $69/mo |
| Real estate enhancement | Autoenhance.ai | No | Yes | EUR 44.99/mo |
| Virtual staging | Styldod / REimagineHome | No | Yes | $14-23/img |
| Relighting | IC-Light | Yes | Via Replicate | Free self-hosted |
| Structure preservation | ControlNet (MLSD/Canny) | Yes | Via ComfyUI | Free self-hosted |
| Camera angle change | Higgsfield / NeRF / 3DGS | Partial | Varies | Varies |
| Self-hosted pipeline | ComfyUI + SDXL + ESRGAN | Yes | N/A | GPU cost only |
