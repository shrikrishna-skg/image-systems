function remainingWorkspaceSlotsForMax(max, sessionCount) {
  return Math.max(0, max - Math.max(0, sessionCount));
}
function isWorkspaceFullForMax(max, sessionCount) {
  return sessionCount >= max;
}
function workspaceQueueCountLabelFor(max, current, showSlashTotal) {
  if (showSlashTotal) {
    return `${current}/${max}`;
  }
  return `${current}`;
}
export {
  isWorkspaceFullForMax,
  remainingWorkspaceSlotsForMax,
  workspaceQueueCountLabelFor
};
