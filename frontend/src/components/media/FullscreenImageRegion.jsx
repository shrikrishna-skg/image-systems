import { jsx, jsxs } from "react/jsx-runtime";
import { useRef } from "react";
import { Maximize2 } from "lucide-react";
import { useFullscreen } from "../../hooks/useFullscreen";
function FullscreenImageRegion({
  children,
  className = "",
  fullscreenClassName = "min-h-[100dvh] w-full bg-black flex items-center justify-center p-3 sm:p-6",
  stopInteractionPropagation = false,
  alwaysShowTrigger = false
}) {
  const ref = useRef(null);
  const { isFullscreen, enter } = useFullscreen(ref);
  const triggerVisibility = alwaysShowTrigger ? "opacity-100" : "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/fs:opacity-100";
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref,
      className: `relative group/fs ${className} ${isFullscreen ? fullscreenClassName : ""}`,
      children: [
        !isFullscreen && /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: (e) => {
              if (stopInteractionPropagation) {
                e.stopPropagation();
                e.preventDefault();
              }
              void enter();
            },
            onMouseDown: (e) => {
              if (stopInteractionPropagation) e.stopPropagation();
            },
            className: `absolute top-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-black/12 bg-white/95 text-black backdrop-blur-sm transition-opacity focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 ${triggerVisibility}`,
            "aria-label": "Full screen",
            title: "Full screen",
            children: /* @__PURE__ */ jsx(Maximize2, { className: "h-4 w-4", strokeWidth: 2 })
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: isFullscreen ? "flex max-h-[100dvh] max-w-full items-center justify-center [&_img]:max-h-[calc(100dvh-2rem)] [&_img]:max-w-full [&_img]:object-contain" : "h-full w-full min-h-0 flex items-center justify-center",
            children
          }
        )
      ]
    }
  );
}
export {
  FullscreenImageRegion as default
};
