import { useState, useEffect, useRef } from "react";
import { getCachedImageBlob } from "../lib/imageBlobCache";
function useAuthenticatedImage(imageId, versionId) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const revokeRef = useRef(null);
  useEffect(() => {
    if (!imageId) {
      setBlobUrl(null);
      return;
    }
    let cancelled = false;
    if (revokeRef.current) {
      URL.revokeObjectURL(revokeRef.current);
      revokeRef.current = null;
    }
    setLoading(true);
    const run = async () => {
      try {
        const blob = await getCachedImageBlob(imageId, versionId);
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        revokeRef.current = u;
        setBlobUrl(u);
      } catch (err) {
        console.error("Failed to load image:", err);
        if (!cancelled) setBlobUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current);
        revokeRef.current = null;
      }
    };
  }, [imageId, versionId]);
  return { blobUrl, loading };
}
export {
  useAuthenticatedImage
};
