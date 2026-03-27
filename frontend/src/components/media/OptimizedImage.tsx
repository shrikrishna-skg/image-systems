import type { ImgHTMLAttributes } from "react";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "loading" | "decoding" | "fetchPriority"> {
  /** Hero / primary viewport image — eager decode + fetch priority. */
  priority?: boolean;
  /** Thumbnails & below-fold grids. */
  lazy?: boolean;
}

/**
 * Browser hints for faster perceived load: async decode, optional lazy, fetch priority.
 */
export default function OptimizedImage({ priority = false, lazy = false, className = "", ...rest }: Props) {
  const fetchPriority: "high" | "low" | "auto" = priority ? "high" : lazy ? "low" : "auto";
  return (
    <img
      {...rest}
      className={className}
      decoding="async"
      loading={lazy ? "lazy" : "eager"}
      fetchPriority={fetchPriority}
    />
  );
}
