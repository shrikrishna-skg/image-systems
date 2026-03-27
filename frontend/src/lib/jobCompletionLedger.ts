const KEY = "iep-completed-job-ids-v1";

/** Dedupe job completion signals (StrictMode-safe) before counting toward calibration. */
export function consumePipelineCompletionOnce(jobId: string): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (arr.includes(jobId)) return false;
    arr.push(jobId);
    sessionStorage.setItem(KEY, JSON.stringify(arr.slice(-500)));
    return true;
  } catch {
    return true;
  }
}
