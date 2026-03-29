package com.imagesystems.api;

import java.util.Map;
import java.util.Set;

public final class RuleRegistry {

    public static final Set<String> IDS =
            Set.of(
                    "photographic_only",
                    "no_new_light_fixtures",
                    "spatial_fidelity",
                    "doorway_opening_preservation",
                    "gap_empty_architecture_only",
                    "no_fake_symmetry",
                    "listing_reframe_only",
                    "corner_outpaint_architecture_only",
                    "zero_additions_product_policy",
                    "fixture_count_lock_preamble",
                    "full_bleed_no_frames",
                    "food_plate_integrity",
                    "menu_truthfulness",
                    "exterior_structure_lock",
                    "people_identity_preserve",
                    "lamp_shade_geometry_lock",
                    "floor_guest_amenity_preservation",
                    "casegood_drawer_layout_lock");

    public static final Map<String, String> TEXT =
            Map.ofEntries(
                    Map.entry(
                            "photographic_only",
                            "Improve only exposure, color, sharpness, and noise; do not alter inventory or layout."),
                    Map.entry(
                            "no_new_light_fixtures",
                            "Never add lamps, sconces, pendants, ceiling fixtures, or duplicate existing fixtures."),
                    Map.entry(
                            "spatial_fidelity",
                            "No additions, relocations, or removals of furniture, decor, or architecture."),
                    Map.entry(
                            "doorway_opening_preservation",
                            "Visible doorways to bath, hall, closet, or exterior must remain openings, not sealed walls."),
                    Map.entry(
                            "gap_empty_architecture_only",
                            "Empty floor/wall between pieces or beside doorways stays bare architecture."),
                    Map.entry("no_fake_symmetry", "Do not mirror furniture or add matching nightstand/lamp for balance."),
                    Map.entry(
                            "listing_reframe_only",
                            "Front/side/center angle modes: crop, pan, rotation, mild perspective only."),
                    Map.entry(
                            "corner_outpaint_architecture_only",
                            "White void fills extend wall/floor/ceiling/trim/sky only; no new furniture in fills."),
                    Map.entry(
                            "zero_additions_product_policy",
                            "Product-wide: no unproven objects; no relocation; gaps stay empty; doorways stay visible."),
                    Map.entry(
                            "fixture_count_lock_preamble",
                            "Output lamp/fixture count and host furniture must match the source photograph."),
                    Map.entry("full_bleed_no_frames", "Output is a single full-bleed photograph—no borders or frames."),
                    Map.entry(
                            "food_plate_integrity",
                            "Do not add garnishes, utensils, or extra dishes; do not rearrange plating."),
                    Map.entry(
                            "menu_truthfulness",
                            "Visible signage, menus, and labels must not be rewritten to fake offers or brands."),
                    Map.entry(
                            "exterior_structure_lock",
                            "Do not add wings, floors, windows, or landscaping not present in the source."),
                    Map.entry(
                            "people_identity_preserve",
                            "If people appear, do not add/remove individuals or change poses without product allowance."),
                    Map.entry(
                            "lamp_shade_geometry_lock",
                            "Preserve each lamp's real silhouette — twin shades stay twin."),
                    Map.entry(
                            "floor_guest_amenity_preservation",
                            "Do not remove pet bowls, mats, trash cans, shoes, bags, or small surface amenities."),
                    Map.entry(
                            "casegood_drawer_layout_lock",
                            "Dresser/desk drawer front count and grid layout must match the photograph."));

    private RuleRegistry() {}
}
