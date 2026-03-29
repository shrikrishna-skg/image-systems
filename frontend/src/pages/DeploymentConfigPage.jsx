import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { BrandWordmark } from "../components/brand/BrandWordmark";
import { ImagesystemsLogo } from "../components/brand/ImagesystemsLogo";
import { getApiBase } from "../lib/apiBase";
const ENV_ROWS = [
  {
    name: "VITE_SUPABASE_URL",
    hint: "Supabase \u2192 Project Settings \u2192 API \u2192 Project URL"
  },
  {
    name: "VITE_SUPABASE_ANON_KEY",
    hint: "Supabase \u2192 Project Settings \u2192 API \u2192 anon public key"
  },
  {
    name: "VITE_API_BASE_URL",
    hint: "Full URL to your hosted API (Spring Boot), ending in /api (e.g. https://api.yourdomain.com/api). Required because this Vercel app is static-only."
  }
];
function DeploymentConfigPage() {
  const [copied, setCopied] = useState(null);
  const apiBase = getApiBase();
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2e3);
    } catch {
      setCopied(null);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-white flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-lg", children: [
    /* @__PURE__ */ jsxs("div", { className: "text-center mb-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center justify-center gap-3 mb-5", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-50 ring-1 ring-neutral-200", children: /* @__PURE__ */ jsx(ImagesystemsLogo, { className: "h-9 w-9", decorative: true }) }),
        /* @__PURE__ */ jsx(BrandWordmark, { variant: "hero", titleAs: "h1" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "text-neutral-600 text-sm leading-relaxed max-w-md mx-auto", children: [
        "This build is missing ",
        /* @__PURE__ */ jsx("strong", { className: "text-neutral-900", children: "Supabase" }),
        " environment variables. Add them in Vercel, then trigger a new deployment so Vite can embed them at build time."
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl border border-neutral-200/90 p-8 space-y-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 leading-relaxed", children: [
        /* @__PURE__ */ jsx("strong", { className: "font-semibold", children: "Vite inlines" }),
        " ",
        /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 font-mono text-xs", children: "VITE_*" }),
        " variables when",
        " ",
        /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 font-mono text-xs", children: "npm run build" }),
        " runs. Set variables under",
        " ",
        /* @__PURE__ */ jsx("strong", { className: "font-semibold", children: "Vercel \u2192 Project \u2192 Settings \u2192 Environment Variables" }),
        " ",
        "for ",
        /* @__PURE__ */ jsx("strong", { children: "Production" }),
        " (and Preview if you use it), then redeploy."
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold text-black mb-3", children: "Required variables" }),
        /* @__PURE__ */ jsx("ul", { className: "space-y-3", children: ENV_ROWS.map((row) => /* @__PURE__ */ jsxs(
          "li",
          {
            className: "rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-3",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-2", children: [
                /* @__PURE__ */ jsx("code", { className: "text-xs font-mono text-neutral-900 break-all", children: row.name }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => void copy(row.name),
                    className: "shrink-0 inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50",
                    children: copied === row.name ? /* @__PURE__ */ jsxs(Fragment, { children: [
                      /* @__PURE__ */ jsx(ClipboardCheck, { className: "size-3.5 text-emerald-600" }),
                      "Copied"
                    ] }) : "Copy name"
                  }
                )
              ] }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-neutral-600 leading-relaxed", children: row.hint })
            ]
          },
          row.name
        )) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-neutral-200/90 bg-neutral-50/30 px-4 py-3 text-xs text-neutral-700 leading-relaxed", children: [
        /* @__PURE__ */ jsx("p", { className: "font-medium text-neutral-900 mb-1", children: "Current API base in this build" }),
        /* @__PURE__ */ jsx("code", { className: "block font-mono text-[11px] break-all text-neutral-800", children: apiBase }),
        apiBase === "/api" && /* @__PURE__ */ jsxs("p", { className: "mt-2 text-amber-900/90", children: [
          "Relative ",
          /* @__PURE__ */ jsx("code", { className: "rounded bg-white px-1 font-mono", children: "/api" }),
          " only works when something serves your API on the same origin. On Vercel static hosting, set",
          " ",
          /* @__PURE__ */ jsx("code", { className: "rounded bg-white px-1 font-mono", children: "VITE_API_BASE_URL" }),
          " to your API origin and add that origin to the Java API",
          " ",
          /* @__PURE__ */ jsx("code", { className: "rounded bg-white px-1 font-mono", children: "CORS_ORIGINS" }),
          "."
        ] })
      ] }),
      /* @__PURE__ */ jsxs(
        "a",
        {
          href: "https://vercel.com/docs/projects/environment-variables",
          target: "_blank",
          rel: "noopener noreferrer",
          className: "inline-flex items-center gap-2 text-sm font-semibold text-black underline-offset-2 hover:underline",
          children: [
            "Vercel environment variables docs",
            /* @__PURE__ */ jsx(ExternalLink, { className: "size-4", strokeWidth: 2 })
          ]
        }
      )
    ] })
  ] }) });
}
export {
  DeploymentConfigPage as default
};
