import { jsx, jsxs } from "react/jsx-runtime";
const CX = 28;
const CY = 28;
const PETAL_W = 8.25;
const PETAL_RX = PETAL_W / 2;
const Y_TOP = 5.75;
const Y_BOTTOM = CY - 5.35;
const PETAL_H = Y_BOTTOM - Y_TOP;
const PETAL_FILLS = [
  "#7DD3FC",
  "#4ADE80",
  "#FB923C",
  "#F87171",
  "#C084FC",
  "#3B82F6",
  "#2DD4BF",
  "#FBBF24"
];
function ImagesystemsLogo({ className, decorative = true }) {
  const x = CX - PETAL_RX;
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 56 56",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      className,
      role: decorative ? "presentation" : "img",
      "aria-hidden": decorative,
      children: [
        !decorative ? /* @__PURE__ */ jsx("title", { children: "ImageSystems" }) : null,
        /* @__PURE__ */ jsx("g", { children: PETAL_FILLS.map((fill, i) => /* @__PURE__ */ jsx("g", { transform: `rotate(${i * 45} ${CX} ${CY})`, children: /* @__PURE__ */ jsx("rect", { x, y: Y_TOP, width: PETAL_W, height: PETAL_H, rx: PETAL_RX, fill }) }, i)) }),
        /* @__PURE__ */ jsx("circle", { cx: CX, cy: CY, r: "5.35", fill: "white" })
      ]
    }
  );
}
export {
  ImagesystemsLogo
};
