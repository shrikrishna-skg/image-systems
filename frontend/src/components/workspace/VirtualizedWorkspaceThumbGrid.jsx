import { jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { workspaceThumbColumnCount, workspaceThumbGapPx } from "../../lib/workspaceGridVirtual";
function VirtualizedWorkspaceThumbGrid({
  items,
  getId,
  isFullscreen,
  scrollClassName,
  renderCell,
  onLayout,
  captionEstimatePx = 0,
  thumbAspect = "square"
}) {
  const scrollRef = useRef(null);
  const [cols, setCols] = useState(3);
  const [gapPx, setGapPx] = useState(8);
  const measureWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const c = workspaceThumbColumnCount(w, isFullscreen);
    const g = workspaceThumbGapPx(isFullscreen, w);
    setCols((prev) => prev === c ? prev : c);
    setGapPx(g);
    onLayout?.(c);
  }, [isFullscreen, onLayout]);
  useEffect(() => {
    measureWidth();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measureWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureWidth]);
  const rowCount = Math.ceil(items.length / cols);
  const estimateRowSize = useCallback(() => {
    const el = scrollRef.current;
    const w = el?.clientWidth ?? 360;
    const c = Math.max(1, workspaceThumbColumnCount(w, isFullscreen));
    const g = workspaceThumbGapPx(isFullscreen, w);
    const cell = (w - (c - 1) * g) / c;
    const imgBand = thumbAspect === "fourThree" ? cell * (3 / 4) : cell;
    return Math.max(72, Math.round(imgBand + captionEstimatePx));
  }, [isFullscreen, captionEstimatePx, thumbAspect]);
  const virtualizer = useVirtualizer({
    count: Math.max(0, rowCount),
    getScrollElement: () => scrollRef.current,
    estimateSize: estimateRowSize,
    overscan: 4
  });
  if (items.length === 0) return null;
  return /* @__PURE__ */ jsx("div", { ref: scrollRef, className: scrollClassName, children: /* @__PURE__ */ jsx("div", { className: "relative w-full", style: { height: `${virtualizer.getTotalSize()}px` }, children: virtualizer.getVirtualItems().map((vr) => {
    const startIdx = vr.index * cols;
    return /* @__PURE__ */ jsx(
      "div",
      {
        "data-index": vr.index,
        ref: virtualizer.measureElement,
        className: "absolute left-0 top-0 w-full pb-0",
        style: { transform: `translateY(${vr.start}px)` },
        children: /* @__PURE__ */ jsx(
          "div",
          {
            className: "grid w-full",
            style: {
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: gapPx
            },
            children: Array.from({ length: cols }, (_, j) => {
              const item = items[startIdx + j];
              if (!item) {
                return /* @__PURE__ */ jsx("div", { className: "min-w-0", "aria-hidden": true }, `empty-${vr.index}-${j}`);
              }
              return /* @__PURE__ */ jsx("div", { className: "min-w-0", children: renderCell(item) }, getId(item));
            })
          }
        )
      },
      vr.key
    );
  }) }) });
}
export {
  VirtualizedWorkspaceThumbGrid as default
};
