import { useEffect, useRef, useCallback } from "react";
import { getJob } from "../api/jobs";
import { getImage } from "../api/images";
import { useImageStore } from "../stores/imageStore";
import type { JobInfo } from "../types";

export function useJobPolling() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { currentJob, setCurrentJob, setCurrentImage, currentImage } = useImageStore();

  const startPolling = useCallback(
    (jobId: string) => {
      // Clear any existing interval
      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(async () => {
        try {
          const job = await getJob(jobId);
          setCurrentJob(job);

          if (job.status === "completed" || job.status === "failed") {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;

            // Refresh image data to get new versions
            if (job.status === "completed" && currentImage) {
              const updatedImage = await getImage(currentImage.id);
              setCurrentImage(updatedImage);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 2000);
    },
    [setCurrentJob, setCurrentImage, currentImage]
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

  return { startPolling, stopPolling, currentJob };
}
