import axios from "axios";
import { toast } from "sonner";

/**
 * Rich Sonner errors: short title + body (Apple-style alert copy).
 */
export function toastProcessingError(err: unknown, fallbackTitle = "Something went wrong"): void {
  let title = fallbackTitle;
  let description: string | undefined;

  if (axios.isAxiosError(err)) {
    const d = err.response?.data?.detail;
    if (typeof d === "string") {
      description = d;
      title = "Request failed";
    } else if (Array.isArray(d)) {
      description = d.map((x: { msg?: string }) => x.msg || JSON.stringify(x)).join(" ");
      title = "Request failed";
    } else {
      description = err.message || undefined;
    }
  } else if (err instanceof Error && err.message) {
    title = "Couldn't complete processing";
    description = err.message;
  } else {
    description = "Please try again or use a smaller image.";
  }

  toast.error(title, {
    description,
  });
}
