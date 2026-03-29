const WORKSPACE_GRID_VIRTUAL_THRESHOLD = 36;
const WORKSPACE_QUEUE_VIRTUAL_THRESHOLD = 48;
function workspaceThumbColumnCount(containerWidth, fullscreen) {
  if (!containerWidth || containerWidth < 640) return 3;
  if (containerWidth < 768) return 4;
  if (containerWidth < 1024) return 5;
  if (fullscreen && containerWidth >= 1280) return 7;
  return 6;
}
function workspaceThumbGapPx(fullscreen, containerWidth) {
  if (fullscreen) return containerWidth >= 640 ? 16 : 12;
  return containerWidth >= 640 ? 10 : 8;
}
export {
  WORKSPACE_GRID_VIRTUAL_THRESHOLD,
  WORKSPACE_QUEUE_VIRTUAL_THRESHOLD,
  workspaceThumbColumnCount,
  workspaceThumbGapPx
};
