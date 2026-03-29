import { jsx } from "react/jsx-runtime";
function OptimizedImage({ priority = false, lazy = false, className = "", ...rest }) {
  const fetchPriority = priority ? "high" : lazy ? "low" : "auto";
  return /* @__PURE__ */ jsx(
    "img",
    {
      ...rest,
      className,
      decoding: "async",
      loading: lazy ? "lazy" : "eager",
      fetchPriority
    }
  );
}
export {
  OptimizedImage as default
};
