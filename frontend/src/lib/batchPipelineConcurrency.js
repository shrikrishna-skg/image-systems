function getBatchPipelineConcurrency() {
  const raw = import.meta.env.VITE_BATCH_PIPELINE_CONCURRENCY;
  const parsed = raw !== void 0 && String(raw).trim() !== "" ? Number(String(raw).trim()) : NaN;
  const n = Number.isFinite(parsed) ? Math.floor(parsed) : 4;
  return Math.max(1, Math.min(12, n));
}
export {
  getBatchPipelineConcurrency
};
