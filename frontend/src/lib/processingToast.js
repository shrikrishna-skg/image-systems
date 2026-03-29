import axios from "axios";
import { toast } from "sonner";
const PIPELINE_CLOUD_STARTED_TOAST_ID = "pipeline-cloud-started";
function dismissPipelineStartedToast() {
  toast.dismiss(PIPELINE_CLOUD_STARTED_TOAST_ID);
}
function toastProcessingError(err, fallbackTitle = "Something went wrong") {
  let title = fallbackTitle;
  let description;
  if (axios.isAxiosError(err)) {
    const d = err.response?.data?.detail;
    if (typeof d === "string") {
      description = d;
      title = "Request failed";
    } else if (Array.isArray(d)) {
      description = d.map((x) => x.msg || JSON.stringify(x)).join(" ");
      title = "Request failed";
    } else {
      description = err.message || void 0;
    }
  } else if (err instanceof Error && err.message) {
    title = "Couldn't complete processing";
    description = err.message;
  } else {
    description = "Please try again or use a smaller image.";
  }
  toast.error(title, {
    description
  });
}
export {
  PIPELINE_CLOUD_STARTED_TOAST_ID,
  dismissPipelineStartedToast,
  toastProcessingError
};
