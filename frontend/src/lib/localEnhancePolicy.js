function usesChangeAngleSobel(perspective) {
  return perspective === "center_angle_auto" || perspective === "center_angle" || perspective === "change_angle_front" || perspective === "change_angle_side";
}
function perspectiveUsesRotatedQuad(perspective) {
  return perspective === "align_verticals_auto" || perspective === "level_horizon_auto" || usesChangeAngleSobel(perspective) || perspective === "straighten";
}
function listingAngleUsesHorizontalRecenter(perspective) {
  return perspective === "center_angle" || perspective === "change_angle_front" || perspective === "change_angle_side" || perspective === "center_angle_auto";
}
function listingRecenterMaxShiftRatio(perspective) {
  switch (perspective) {
    case "change_angle_side":
    case "center_angle_auto":
      return 0.4;
    case "center_angle":
      return 0.38;
    case "change_angle_front":
      return 0.36;
    default:
      return 0.32;
  }
}
const LISTING_RECENTER_PASSES = 4;
function listingHeroCentroidProfile(perspective) {
  switch (perspective) {
    case "change_angle_side":
    case "center_angle_auto":
      return { lowerRowStartYRatio: 0.55, lowerRowScale: 0.48, dominanceYEndRatio: 0.58 };
    case "center_angle":
      return { lowerRowStartYRatio: 0.55, lowerRowScale: 0.52, dominanceYEndRatio: 0.58 };
    case "change_angle_front":
      return { lowerRowStartYRatio: 0.57, lowerRowScale: 0.72, dominanceYEndRatio: 0.62 };
    default:
      return { lowerRowStartYRatio: 0.56, lowerRowScale: 1, dominanceYEndRatio: 1 };
  }
}
export {
  LISTING_RECENTER_PASSES,
  listingAngleUsesHorizontalRecenter,
  listingHeroCentroidProfile,
  listingRecenterMaxShiftRatio,
  perspectiveUsesRotatedQuad,
  usesChangeAngleSobel
};
