import { jsx, jsxs } from "react/jsx-runtime";
import { ImageIcon, Layers } from "lucide-react";
import { useImageStore } from "../../stores/imageStore";
function WorkflowModePicker({ variant = "segmented" }) {
  const workspaceMode = useImageStore((s) => s.workspaceMode);
  const setWorkspaceMode = useImageStore((s) => s.setWorkspaceMode);
  if (variant === "compact") {
    return /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 justify-between rounded-xl border border-neutral-200 bg-neutral-50/80 p-1.5 sm:justify-start", children: [
      /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-500 px-2 hidden sm:inline", children: "Flow" }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-1 min-w-0 gap-1", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setWorkspaceMode(false),
            className: `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${!workspaceMode ? "bg-black text-white" : "text-neutral-600 hover:text-black border border-transparent hover:border-neutral-200"}`,
            children: [
              /* @__PURE__ */ jsx(ImageIcon, { className: "h-3.5 w-3.5 shrink-0", strokeWidth: 2 }),
              "Single"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setWorkspaceMode(true),
            className: `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${workspaceMode ? "bg-black text-white" : "text-neutral-600 hover:text-black border border-transparent hover:border-neutral-200"}`,
            children: [
              /* @__PURE__ */ jsx(Layers, { className: "h-3.5 w-3.5 shrink-0", strokeWidth: 2 }),
              "Bulk"
            ]
          }
        )
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "mb-6 w-full max-w-xl mx-auto", children: [
    /* @__PURE__ */ jsx("p", { className: "text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 mb-3", children: "Choose workflow" }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "flex rounded-full border-2 border-neutral-200 bg-neutral-100/90 p-1 shadow-sm",
        role: "tablist",
        "aria-label": "Processing mode",
        children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": !workspaceMode,
              onClick: () => setWorkspaceMode(false),
              className: `flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 px-4 text-sm font-semibold transition-all ${!workspaceMode ? "bg-black text-white shadow-md ring-2 ring-black/10" : "text-neutral-600 hover:text-black"}`,
              children: [
                /* @__PURE__ */ jsx(ImageIcon, { className: "h-4 w-4 shrink-0", strokeWidth: 2 }),
                "Single photo"
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": workspaceMode,
              onClick: () => setWorkspaceMode(true),
              className: `flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 px-4 text-sm font-semibold transition-all ${workspaceMode ? "bg-black text-white shadow-md ring-2 ring-black/10" : "text-neutral-600 hover:text-black"}`,
              children: [
                /* @__PURE__ */ jsx(Layers, { className: "h-4 w-4 shrink-0", strokeWidth: 2 }),
                "Batch workspace"
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx("p", { className: "mt-3 text-center text-sm text-neutral-600 leading-relaxed px-2", children: workspaceMode ? "Import many photos at once, run the same enhancement on your queue, and export together \u2014 ideal for a full shoot." : "Work on one photo at a time: upload, enhance, compare, and download before moving to the next." })
  ] });
}
export {
  WorkflowModePicker as default
};
