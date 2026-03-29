const PERSPECTIVE_OPTIONS = [
  {
    section: "geometry",
    value: null,
    label: "None",
    hint: "No roll or perspective preset \u2014 use for lighting/quality only."
  },
  {
    section: "geometry",
    value: "align_verticals_auto",
    label: "Align verticals",
    hint: "Straighten converging verticals (walls, jambs) \u2014 standard architectural correction after tilted shots."
  },
  {
    section: "geometry",
    value: "level_horizon_auto",
    label: "Level horizon",
    hint: "Level dominant horizontals: ceilings, countertops, shorelines \u2014 keeps the room from feeling tilted."
  },
  {
    section: "listing",
    value: "center_angle",
    label: "Center angle",
    hint: "Roll + horizontal hero center (~50% width), same general viewpoint \u2014 no forced front vs side axis."
  },
  {
    section: "listing",
    value: "change_angle_front",
    label: "Front angle",
    hint: "Includes Center angle in the pipeline, then straight-on listing \u2014 cloud reframes to match."
  },
  {
    section: "listing",
    value: "change_angle_side",
    label: "Side angle",
    hint: "Stand at **one narrow end** (entrance / foot of room), look **lengthwise** \u2014 plumb verticals, depth to far wall; beds may be **left or right** in frame, full size, not edge-sliced."
  },
  {
    section: "lens",
    value: "straighten",
    label: "Straighten Lines",
    hint: "Handheld deskew: mild rotation + shear when the whole frame reads skewed (not full lens profile)."
  },
  {
    section: "lens",
    value: "correct_distortion",
    label: "Fix Distortion",
    hint: "Reduce wide-angle barrel/stretch toward straighter lines \u2014 typical post step after ultra-wide interiors."
  }
];
const PERSPECTIVE_SECTION_LABELS = {
  geometry: {
    title: "Geometry & level",
    description: "Roll and line cues \u2014 same family as tripod-level + vertical guides in Lightroom/ACR."
  },
  listing: {
    title: "Listing composition",
    description: "Front = straight-on wall. Side = **same room**, **lengthwise** read (step back / widen lens), **not** a new layout. **Keep doorways** (bath, hall); **don\u2019t wall them over** or **fill empty gaps** with new tables/cabinets. **No new objects**, no moving furniture. Browser nudges first, then cloud."
  },
  lens: {
    title: "Skew & lens",
    description: "Handheld skew vs barrel distortion \u2014 often a second pass after verticals."
  }
};
const ROOM_TYPES = [
  "general",
  "bedroom",
  "bathroom",
  "lobby",
  "restaurant",
  "exterior",
  "pool",
  "living_room",
  "kitchen"
];
export {
  PERSPECTIVE_OPTIONS,
  PERSPECTIVE_SECTION_LABELS,
  ROOM_TYPES
};
