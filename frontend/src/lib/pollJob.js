import { getJob } from "../api/jobs";
const POLL_MS = 1e3;
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function pollJobUntilComplete(jobId, onTick, shouldAbort) {
  for (; ; ) {
    if (shouldAbort?.()) {
      throw new DOMException("Polling stopped by user", "AbortError");
    }
    const job = await getJob(jobId);
    onTick?.(job);
    if (job.status === "completed" || job.status === "failed") {
      return job;
    }
    if (shouldAbort?.()) {
      throw new DOMException("Polling stopped by user", "AbortError");
    }
    await sleep(POLL_MS);
  }
}
export {
  pollJobUntilComplete
};
