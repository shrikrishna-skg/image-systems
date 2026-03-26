"""
Prompt templates for hotel/real estate image enhancement.
These prompts are carefully crafted based on research about:
- Professional architectural photography standards
- Hotel booking psychology (bright = clean = trustworthy)
- Platform requirements (Airbnb, Booking.com)
"""

BASE_INSTRUCTION = """You are enhancing a hotel/real estate photograph for professional listing use.
CRITICAL RULES:
- Improve ONLY the photographic quality (lighting, color, sharpness, exposure)
- Do NOT add, remove, or modify any physical objects, furniture, or architectural elements
- Do NOT change the room layout, size, or physical features
- The room contents must remain EXACTLY as photographed
- The result should look like it was taken by a professional architectural photographer with proper equipment"""

# Lighting presets
LIGHTING_PRESETS = {
    "bright": """Make the room significantly brighter with balanced, even exposure.
Apply HDR-style processing so both window views and interior details are clearly visible.
Eliminate dark shadows and underexposed areas. The space should feel open, airy, and spacious.""",

    "warm": """Apply warm, golden-hour lighting that makes the space feel inviting and luxurious.
Use warm color temperature (around 3500-4000K). Enhance the warmth of wood tones, textiles,
and ambient light sources. The room should feel cozy and welcoming.""",

    "natural": """Enhance natural light to its fullest potential. Make sunlight streaming through
windows look soft and diffused. Balance indoor and outdoor light levels. Colors should appear
true-to-life and vibrant. The lighting should feel effortless and organic.""",

    "hdr": """Apply professional HDR processing. Recover all detail in highlights (windows, lamps)
and shadows (corners, under furniture). Expand the dynamic range so every part of the room is
clearly visible. Maintain natural-looking color throughout. No artificial glow or halos.""",

    "evening": """Create a warm evening/twilight ambiance. Interior lights should glow warmly.
If windows are visible, show a blue-hour or dusk sky. The mood should be sophisticated
and intimate. Enhance bedside lamps, chandeliers, and accent lighting.""",
}

# Quality presets
QUALITY_PRESETS = {
    "sharpen": """Sharpen fine details throughout the image: textiles, wood grain, tile patterns,
architectural moldings, and surface textures. Remove any blur, softness, or camera shake.
Every surface should be crisp and well-defined.""",

    "denoise": """Remove all noise, grain, and compression artifacts while preserving fine details.
Clean up any digital noise especially in shadow areas. The image should appear smooth and
professional without losing texture detail.""",

    "color_correct": """Correct white balance for accurate, natural colors. Remove any color casts
(blue, yellow, green). Enhance color vibrancy and saturation to be rich but realistic.
Whites should be pure white, wood tones should be warm and natural.""",

    "full_enhance": """Apply comprehensive photographic enhancement:
- Correct white balance and remove color casts
- Sharpen details on all surfaces and textures
- Remove noise and compression artifacts
- Boost color vibrancy while keeping colors natural
- Ensure crisp linens appear bright white and clean
- Make metallic fixtures gleam naturally""",
}

# Perspective presets
PERSPECTIVE_PRESETS = {
    "straighten": """Correct any tilting or rotation so all vertical lines (walls, door frames,
windows) are perfectly vertical and horizontal lines (ceiling edges, floor lines) are perfectly
horizontal. Apply perspective correction to eliminate converging verticals.""",

    "correct_distortion": """Remove any wide-angle lens distortion. Straighten bowed lines at the
edges of the frame. Correct barrel distortion so straight architectural lines appear straight.
Maintain natural proportions throughout the room.""",
}

# Room type context (for smarter prompts)
ROOM_CONTEXTS = {
    "bedroom": "hotel bedroom or suite",
    "bathroom": "hotel bathroom",
    "lobby": "hotel lobby or reception area",
    "restaurant": "hotel restaurant or dining area",
    "exterior": "hotel exterior or building facade",
    "pool": "hotel pool or outdoor amenity area",
    "living_room": "living room or lounge area",
    "kitchen": "kitchen or kitchenette",
    "general": "hotel or real estate interior",
}


def build_enhancement_prompt(
    lighting: str = None,
    quality: str = None,
    perspective: str = None,
    room_type: str = "general",
    custom_prompt: str = None,
) -> str:
    """Build a composite enhancement prompt from selected presets."""

    if custom_prompt:
        # User provided their own prompt - prepend base instruction
        return f"{BASE_INSTRUCTION}\n\nUser instruction: {custom_prompt}"

    parts = [BASE_INSTRUCTION]

    room_context = ROOM_CONTEXTS.get(room_type, ROOM_CONTEXTS["general"])
    parts.append(f"\nThis is a photograph of a {room_context}.")

    if lighting and lighting in LIGHTING_PRESETS:
        parts.append(f"\nLIGHTING: {LIGHTING_PRESETS[lighting]}")

    if quality and quality in QUALITY_PRESETS:
        parts.append(f"\nQUALITY: {QUALITY_PRESETS[quality]}")

    if perspective and perspective in PERSPECTIVE_PRESETS:
        parts.append(f"\nPERSPECTIVE: {PERSPECTIVE_PRESETS[perspective]}")

    # If no specific presets chosen, apply general enhancement
    if not any([lighting, quality, perspective]):
        parts.append(f"\nApply professional-grade enhancement: {QUALITY_PRESETS['full_enhance']}")
        parts.append(f"\n{LIGHTING_PRESETS['bright']}")

    parts.append("\nThe final result must look photorealistic — like a high-end professional photograph, not AI-generated.")

    return "\n".join(parts)


def get_available_presets() -> dict:
    """Return all available presets for the frontend."""
    return {
        "lighting": list(LIGHTING_PRESETS.keys()),
        "quality": list(QUALITY_PRESETS.keys()),
        "perspective": list(PERSPECTIVE_PRESETS.keys()),
        "room_types": list(ROOM_CONTEXTS.keys()),
    }
