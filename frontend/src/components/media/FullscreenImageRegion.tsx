import { useRef, type ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { useFullscreen } from "../../hooks/useFullscreen";

interface Props {
  children: ReactNode;
  /** Normal layout wrapper */
  className?: string;
  /** Applied to the same node while fullscreen */
  fullscreenClassName?: string;
  /** Stop parent click handlers (e.g. history card “open in workspace”). */
  stopInteractionPropagation?: boolean;
  /** Always show the expand control (e.g. touch devices). */
  alwaysShowTrigger?: boolean;
}

/**
 * Wraps visual media: hover (or always) shows full-screen; global {@link FullscreenExitPortal} exits.
 */
export default function FullscreenImageRegion({
  children,
  className = "",
  fullscreenClassName = "min-h-[100dvh] w-full bg-black flex items-center justify-center p-3 sm:p-6",
  stopInteractionPropagation = false,
  alwaysShowTrigger = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { isFullscreen, enter } = useFullscreen(ref);

  const triggerVisibility = alwaysShowTrigger
    ? "opacity-100"
    : "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/fs:opacity-100";

  return (
    <div
      ref={ref}
      className={`relative group/fs ${className} ${isFullscreen ? fullscreenClassName : ""}`}
    >
      {!isFullscreen && (
        <button
          type="button"
          onClick={(e) => {
            if (stopInteractionPropagation) {
              e.stopPropagation();
              e.preventDefault();
            }
            void enter();
          }}
          onMouseDown={(e) => {
            if (stopInteractionPropagation) e.stopPropagation();
          }}
          className={`absolute top-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-black/12 bg-white/95 text-black backdrop-blur-sm transition-opacity focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 ${triggerVisibility}`}
          aria-label="Full screen"
          title="Full screen"
        >
          <Maximize2 className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
      <div
        className={
          isFullscreen
            ? "flex max-h-[100dvh] max-w-full items-center justify-center [&_img]:max-h-[calc(100dvh-2rem)] [&_img]:max-w-full [&_img]:object-contain"
            : "h-full w-full min-h-0 flex items-center justify-center"
        }
      >
        {children}
      </div>
    </div>
  );
}
