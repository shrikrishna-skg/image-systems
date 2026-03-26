import { useState, useRef, useCallback } from "react";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import { Loader2 } from "lucide-react";

interface Props {
  imageId: string;
  resultVersionId: string;
}

export default function BeforeAfterSlider({ imageId, resultVersionId }: Props) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const { blobUrl: beforeUrl, loading: beforeLoading } = useAuthenticatedImage(imageId);
  const { blobUrl: afterUrl, loading: afterLoading } = useAuthenticatedImage(imageId, resultVersionId);

  const loading = beforeLoading || afterLoading;

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      updatePosition(e.touches[0].clientX);
    },
    [updatePosition]
  );

  if (loading || !beforeUrl || !afterUrl) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="ml-3 text-sm text-gray-400">Loading comparison...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-semibold uppercase tracking-wider">
        <span className="text-gray-400 bg-gray-100 px-2.5 py-1 rounded-md">Original</span>
        <span className="text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">Enhanced</span>
      </div>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl cursor-col-resize select-none border border-gray-200"
        style={{ maxHeight: "500px" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        {/* After image (full width, behind) */}
        <img
          src={afterUrl}
          alt="Enhanced"
          className="w-full block"
          style={{ maxHeight: "500px", objectFit: "contain" }}
          draggable={false}
        />

        {/* Before image (clipped) */}
        <div
          className="absolute top-0 left-0 h-full overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <img
            src={beforeUrl}
            alt="Original"
            className="block"
            style={{
              maxHeight: "500px",
              objectFit: "contain",
              width: containerRef.current?.offsetWidth || "100%",
            }}
            draggable={false}
          />
        </div>

        {/* Slider line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/80 shadow-lg"
          style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        >
          {/* Handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-xl border border-gray-200 flex items-center justify-center">
            <div className="flex gap-0.5">
              <div className="w-0.5 h-4 bg-gray-400 rounded" />
              <div className="w-0.5 h-4 bg-gray-400 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
