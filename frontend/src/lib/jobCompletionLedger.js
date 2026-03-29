const KEY = "iep-completed-job-ids-v1";
function consumePipelineCompletionOnce(jobId) {
  try {
    const raw = sessionStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (arr.includes(jobId)) return false;
    arr.push(jobId);
    sessionStorage.setItem(KEY, JSON.stringify(arr.slice(-500)));
    return true;
  } catch {
    return true;
  }
}
export {
  consumePipelineCompletionOnce
};
