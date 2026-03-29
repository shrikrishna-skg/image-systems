import { jsx, jsxs } from "react/jsx-runtime";
import { MAX_WORKSPACE_ASSETS, WORKSPACE_UI_SHOW_SLASH_TOTAL } from "../../lib/workspaceLimits";
function WorkspaceCapacityMeter({ used, variant = "compact" }) {
  const max = MAX_WORKSPACE_ASSETS;
  const full = used >= max;
  const hero = variant === "hero";
  const showProportionalFill = WORKSPACE_UI_SHOW_SLASH_TOTAL || full;
  const pct = showProportionalFill ? Math.min(100, used / max * 100) : 0;
  const emptyHero = hero && used === 0;
  const countLabel = WORKSPACE_UI_SHOW_SLASH_TOTAL ? `${used} / ${max} photos` : `${used.toLocaleString()} photos`;
  const queueTitle = `Add up to ${max} photos per batch run. Need more? Contact us.`;
  const ariaLabel = WORKSPACE_UI_SHOW_SLASH_TOTAL ? `Batch queue ${used} of ${max} photos` : `Batch queue has ${used.toLocaleString()} photos; maximum ${max.toLocaleString()}`;
  if (emptyHero) {
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: "w-full max-w-md mx-auto mt-6 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-3 text-center",
        role: "status",
        "aria-live": "polite",
        children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-neutral-800", children: "Your workspace is empty" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-neutral-600 leading-relaxed", children: "Drop files above to add photos. The queue fills as you import \u2014 then you can run enhance on one image or the whole batch." })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: hero ? "w-full max-w-md mx-auto mt-6" : "min-w-[9rem] flex-1 max-w-xs",
      role: "status",
      "aria-live": "polite",
      "aria-label": ariaLabel,
      title: queueTitle,
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: `flex items-center justify-between gap-2 ${hero ? "text-xs" : "text-[10px]"} font-semibold uppercase tracking-wider text-neutral-500`,
            children: [
              /* @__PURE__ */ jsx("span", { title: queueTitle, children: hero ? "Batch queue" : WORKSPACE_UI_SHOW_SLASH_TOTAL ? "Queue" : "Batch queue" }),
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: `font-data tabular-nums ${full ? "text-amber-700" : "text-neutral-800"}`,
                  title: queueTitle,
                  children: countLabel
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: `mt-2 rounded-full overflow-hidden ${full ? "bg-amber-100" : "bg-neutral-200"} ${hero ? "h-2" : "h-1.5"}`,
            children: /* @__PURE__ */ jsx(
              "div",
              {
                className: `h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out ${full ? "bg-amber-500" : showProportionalFill ? "bg-black" : "bg-transparent"}`,
                style: { width: `${pct}%` }
              }
            )
          }
        ),
        full && /* @__PURE__ */ jsx(
          "p",
          {
            className: `mt-2 text-neutral-600 leading-snug ${hero ? "text-sm" : "text-[10px]"}`,
            children: hero ? "You\u2019ve reached the per-workspace limit. Run the batch or clear the console, then import the next set." : "Workspace full \u2014 process or remove assets to add more."
          }
        )
      ]
    }
  );
}
export {
  WorkspaceCapacityMeter as default
};
