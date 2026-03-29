import { estimateAutoRotationRad, estimateAutoRotationRadCenterAngle } from "./perspectiveAuto";
async function computeAutoRotationRadForCloud(blob, perspective) {
  if (perspective === "align_verticals_auto") {
    const bmp = await createImageBitmap(blob);
    try {
      return estimateAutoRotationRad(bmp, "verticals");
    } finally {
      bmp.close();
    }
  }
  if (perspective === "level_horizon_auto") {
    const bmp = await createImageBitmap(blob);
    try {
      return estimateAutoRotationRad(bmp, "horizon");
    } finally {
      bmp.close();
    }
  }
  if (perspective === "center_angle_auto" || perspective === "center_angle" || perspective === "change_angle_front" || perspective === "change_angle_side") {
    const bmp = await createImageBitmap(blob);
    try {
      return estimateAutoRotationRadCenterAngle(bmp);
    } finally {
      bmp.close();
    }
  }
  return null;
}
export {
  computeAutoRotationRadForCloud
};
