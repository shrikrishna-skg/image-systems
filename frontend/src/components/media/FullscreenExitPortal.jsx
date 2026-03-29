import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
function FullscreenExitPortal() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = () => setActive(!!document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  if (!active) return null;
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      className: "fixed top-4 right-4 z-[2147483646] flex items-center gap-2 rounded-full border border-white/20 bg-black/75 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md hover:bg-black/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
      onClick: () => void document.exitFullscreen?.(),
      "aria-label": "Exit full screen",
      children: [
        /* @__PURE__ */ jsx(X, { className: "h-4 w-4 shrink-0", strokeWidth: 2 }),
        "Exit full screen"
      ]
    }
  );
}
export {
  FullscreenExitPortal as default
};
