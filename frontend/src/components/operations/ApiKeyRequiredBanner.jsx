import { jsx, jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
function ApiKeyRequiredBanner() {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      role: "alert",
      className: "mb-6 flex flex-col gap-3 rounded-xl border border-amber-400/80 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
      children: [
        /* @__PURE__ */ jsxs("p", { className: "text-sm text-amber-950 leading-snug", children: [
          /* @__PURE__ */ jsx("span", { className: "font-semibold text-black", children: "You need an API key to enhance photos." }),
          " Set one up in 30 seconds \u2014 we never store keys in plain text."
        ] }),
        /* @__PURE__ */ jsx(
          Link,
          {
            to: "/settings",
            className: "inline-flex shrink-0 items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800",
            children: "Connect API Key"
          }
        )
      ]
    }
  );
}
export {
  ApiKeyRequiredBanner as default
};
