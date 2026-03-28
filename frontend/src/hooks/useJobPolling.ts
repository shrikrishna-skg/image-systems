import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { getJob } from "../api/jobs";
import { getImage } from "../api/images";
import { useImageStore } from "../stores/imageStore";
import { useServerPolicyStore } from "../stores/serverPolicyStore";

/** Tight loop while jobs run — first check is immediate (no 2s blind wait). */
const POLL_MS = 1000;

export function useJobPolling() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const { setCurrentJob, setCurrentImage } = useImageStore();

  const startPolling = useCallback(
    (jobId: string, imageId: string) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;

      const pollOnce = async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
          const job = await getJob(jobId);
          setCurrentJob(job);

          if (job.status === "completed" || job.status === "failed") {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;

            if (job.status === "completed") {
              const updatedImage = await getImage(imageId);
              setCurrentImage(updatedImage);
              useImageStore.getState().upsertSessionImage(updatedImage);
              const { persistImageFiles, ephemeralGraceSeconds, policyLoaded } =
                useServerPolicyStore.getState();
              toast.success("Pipeline finished", {
                description: "Your result is below — use the before/after slider.",
              });
              if (policyLoaded && !persistImageFiles) {
                toast.info("Server privacy mode", {
                  description: `Image files are removed from the API host after processing. Save or export within about ${ephemeralGraceSeconds}s if you need the file from the server.`,
                });
              }
            } else {
              toast.error("Pipeline failed", {
                description: job.error_message || "Check API keys, billing, and backend logs.",
              });
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
        } finally {
          inFlightRef.current = false;
        }
      };

      void pollOnce();
      intervalRef.current = setInterval(() => void pollOnce(), POLL_MS);
    },
    [setCurrentJob, setCurrentImage]
  );

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { startPolling, stopPolling };
}
