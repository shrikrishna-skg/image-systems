/**
 * Max parallel POST /images/:id/process calls during workspace batch (remote API).
 * Override with VITE_BATCH_PIPELINE_CONCURRENCY (integer 1–12).
 */
export function getBatchPipelineConcurrency(): number {
  const raw = import.meta.env.VITE_BATCH_PIPELINE_CONCURRENCY;
  const parsed =
    raw !== undefined && String(raw).trim() !== "" ? Number(String(raw).trim()) : NaN;
  const n = Number.isFinite(parsed) ? Math.floor(parsed) : 4;
  return Math.max(1, Math.min(12, n));
}
