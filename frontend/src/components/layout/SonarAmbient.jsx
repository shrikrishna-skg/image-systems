import { jsx, jsxs } from "react/jsx-runtime";
import { HelpCircle } from "lucide-react";
function SonarAmbient() {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "sonar-ambient pointer-events-none fixed z-40 flex flex-col items-end gap-2",
      style: {
        bottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
        right: "max(1rem, env(safe-area-inset-right, 0px))"
      },
      children: [
        /* @__PURE__ */ jsxs("div", { className: "relative flex h-[7.5rem] w-[7.5rem] items-center justify-center", "aria-hidden": true, children: [
          /* @__PURE__ */ jsx("span", { className: "sonar-ambient__core" }),
          [0, 1, 2, 3].map((i) => /* @__PURE__ */ jsx(
            "span",
            {
              className: "sonar-ambient__ring",
              style: { animationDelay: `${i * 1.05}s` }
            },
            i
          ))
        ] }),
        /* @__PURE__ */ jsxs(
          "a",
          {
            href: "https://www.multisystems.ai/",
            target: "_blank",
            rel: "noopener noreferrer",
            className: "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm backdrop-blur-sm transition-colors hover:border-neutral-300 hover:bg-white",
            children: [
              /* @__PURE__ */ jsx(HelpCircle, { className: "h-3.5 w-3.5 shrink-0", strokeWidth: 2, "aria-hidden": true }),
              "Help"
            ]
          }
        )
      ]
    }
  );
}
export {
  SonarAmbient as default
};
