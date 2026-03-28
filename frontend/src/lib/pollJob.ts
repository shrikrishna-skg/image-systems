import { getJob } from "../api/jobs";
import type { JobInfo } from "../types";

const POLL_MS = 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Poll until job completes or fails. */
export async function pollJobUntilComplete(
  jobId: string,
  onTick?: (job: JobInfo) => void,
  /** When true, stop polling (throws {@link DOMException} name `AbortError`). */
  shouldAbort?: () => boolean
): Promise<JobInfo> {
  for (;;) {
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
