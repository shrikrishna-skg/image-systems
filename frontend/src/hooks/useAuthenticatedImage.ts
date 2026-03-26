import { useState, useEffect } from "react";
import client from "../api/client";

/**
 * Fetches an image via the authenticated API and returns a blob URL.
 */
export function useAuthenticatedImage(imageId: string | null, versionId?: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imageId) {
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchImage = async () => {
      try {
        let url = `/images/${imageId}/download`;
        if (versionId) url += `?version=${versionId}`;

        const res = await client.get(url, { responseType: "blob" });
        if (!cancelled) {
          const objectUrl = URL.createObjectURL(res.data);
          setBlobUrl(objectUrl);
        }
      } catch (err) {
        console.error("Failed to load image:", err);
        if (!cancelled) setBlobUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchImage();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [imageId, versionId]);

  return { blobUrl, loading };
}
