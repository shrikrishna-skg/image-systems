function getLatestImageVersion(versions) {
  if (!versions?.length) return void 0;
  return [...versions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
}
function getLatestImproveVersion(versions) {
  if (!versions?.length) return void 0;
  const improves = versions.filter((v) => (v.provider || "").toLowerCase() === "improve");
  if (improves.length === 0) return getLatestImageVersion(versions);
  return [...improves].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
}
export {
  getLatestImageVersion,
  getLatestImproveVersion
};
