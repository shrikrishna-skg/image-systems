import { jsx, jsxs } from "react/jsx-runtime";
const titleClasses = {
  compact: "text-sm font-semibold tracking-tight leading-tight",
  sidebar: "text-[15px] font-semibold tracking-tight leading-tight",
  hero: "text-2xl font-semibold tracking-tight text-black"
};
const subClasses = {
  compact: "mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-500",
  sidebar: "mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500",
  hero: "mt-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500"
};
const BRAND_BLUE = "#3B82F6";
function BrandWordmark({ variant, titleAs = "div", className = "" }) {
  const TitleTag = titleAs;
  return /* @__PURE__ */ jsxs("div", { className: className ? `min-w-0 text-left ${className}` : "min-w-0 text-left", children: [
    /* @__PURE__ */ jsxs(TitleTag, { className: titleClasses[variant], children: [
      /* @__PURE__ */ jsx("span", { className: "text-black", children: "Image" }),
      /* @__PURE__ */ jsx("span", { style: { color: BRAND_BLUE }, children: "Systems" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: subClasses[variant], children: "BY MULTISYSTEMS" })
  ] });
}
export {
  BrandWordmark
};
