import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
const STORAGE_DONE = "imagesystems.welcomeChecklistComplete";
function WelcomeChecklistBanner({
  hasEnhanceKey,
  hasWorkspaceAsset,
  archiveVisitedOrDownloaded
}) {
  const [hiddenForever, setHiddenForever] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_DONE) === "1"
  );
  const allDone = hasEnhanceKey && hasWorkspaceAsset && archiveVisitedOrDownloaded;
  useEffect(() => {
    if (!allDone || hiddenForever) return;
    try {
      localStorage.setItem(STORAGE_DONE, "1");
    } catch {
    }
    setHiddenForever(true);
  }, [allDone, hiddenForever]);
  const dismissManual = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_DONE, "1");
    } catch {
    }
    setHiddenForever(true);
  }, []);
  const items = useMemo(
    () => [
      {
        id: "key",
        done: hasEnhanceKey,
        label: "Connect your API key",
        href: "/settings",
        external: false
      },
      {
        id: "upload",
        done: hasWorkspaceAsset,
        label: "Upload or generate your first photo",
        href: "#operations-input",
        scroll: true
      },
      {
        id: "archive",
        done: archiveVisitedOrDownloaded,
        label: "Open Deliverables and download",
        href: "/history",
        external: false
      }
    ],
    [hasEnhanceKey, hasWorkspaceAsset, archiveVisitedOrDownloaded]
  );
  if (hiddenForever) return null;
  return /* @__PURE__ */ jsxs("div", { className: "mb-6 rounded-2xl border border-neutral-200 bg-neutral-50/90 p-4 sm:p-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-black", children: "Welcome \u2014 get your first result in minutes" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-neutral-600 leading-relaxed", children: "Work through the steps below. This banner disappears when you're done." })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: dismissManual,
          className: "text-[11px] font-medium text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-black shrink-0 self-start sm:self-center",
          children: "Hide guide"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("ul", { className: "mt-4 space-y-2", children: items.map((it) => /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-3", children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          className: `mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${it.done ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-transparent"}`,
          "aria-hidden": true,
          children: /* @__PURE__ */ jsx(Check, { className: "h-3.5 w-3.5", strokeWidth: 2.5 })
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "min-w-0 pt-0.5", children: it.href === "#operations-input" ? /* @__PURE__ */ jsx(
        "a",
        {
          href: it.href,
          className: `text-sm font-medium ${it.done ? "text-neutral-500 line-through" : "text-black underline-offset-2 hover:underline"}`,
          onClick: (e) => {
            e.preventDefault();
            document.getElementById("operations-input")?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          },
          children: it.label
        }
      ) : /* @__PURE__ */ jsx(
        Link,
        {
          to: it.href,
          className: `text-sm font-medium ${it.done ? "text-neutral-500 line-through" : "text-black underline-offset-2 hover:underline"}`,
          children: it.label
        }
      ) })
    ] }, it.id)) })
  ] });
}
export {
  WelcomeChecklistBanner as default
};
