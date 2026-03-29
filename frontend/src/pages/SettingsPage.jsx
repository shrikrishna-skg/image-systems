import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  Key,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Shield,
  Pencil
} from "lucide-react";
import { listKeys, createKey, deleteKey, validateKey, validateSavedKey } from "../api/apiKeys";
import { isApiBaseMisconfiguredError, isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import { toast } from "sonner";
import AdaptiveWorkspacePanel from "../components/settings/AdaptiveWorkspacePanel";
import { PasswordInput } from "../components/ui/PasswordInput";
import {
  GEMINI_IMAGE_MODELS,
  OPENAI_IMAGE_MODELS,
  PROVIDER_CONSOLE_URLS,
  PROVIDER_DOC_URLS
} from "../lib/providerIntegrationMeta";
const storageOnly = isStorageOnlyMode();
const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    usageBadge: "Enhancement",
    description: "Image enhancement via GPT Image (images.edit). Keys are verified live before save.",
    placeholder: "sk-...",
    models: OPENAI_IMAGE_MODELS
  },
  {
    id: "gemini",
    name: "Google Gemini",
    usageBadge: "Enhancement",
    description: "Multimodal enhancement (generateContent + image output). After saving, use Test saved key: the backend calls Google\u2019s model list API; if it succeeds, your key works. If Google returns permission errors, enable the Generative Language API for the key\u2019s project in Google Cloud / AI Studio.",
    placeholder: "AIza... or key from AI Studio",
    models: GEMINI_IMAGE_MODELS
  },
  {
    id: "replicate",
    name: "Replicate",
    usageBadge: "Upscaling",
    description: "Real-ESRGAN upscaling. Requires a funded Replicate account (GPU runs are metered). Token is verified via the account API.",
    placeholder: "r8_...",
    models: []
  },
  {
    id: "zyte",
    name: "Zyte API",
    usageBadge: "Optional \u2014 URL import",
    description: "Optional engine for Import from URL: headless browser HTML (JavaScript rendered). Without a key, scans use plain HTTP. Test uses a small HTTP extract to verify your key.",
    placeholder: "Paste Zyte API key",
    models: []
  },
  {
    id: "groq",
    name: "Groq",
    usageBadge: "Optional \u2014 Import URL naming",
    description: "Fast text-only naming when you import images from a URL. Uses the same kebab-case rules as Gemini/OpenAI export filename suggestions so names stay consistent across your library. Groq never sees your enhancement keys.",
    placeholder: "gsk_...",
    models: []
  }
];
function SettingsPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(!storageOnly);
  const [newKeys, setNewKeys] = useState({});
  const [saving, setSaving] = useState(null);
  const [validating, setValidating] = useState(null);
  const [allowUnverifiedSave, setAllowUnverifiedSave] = useState(false);
  const [keysBanner, setKeysBanner] = useState(null);
  const [replaceEditorOpen, setReplaceEditorOpen] = useState({});
  const secretInputRefs = useRef({});
  useEffect(() => {
    if (storageOnly) return;
    void loadKeys();
  }, []);
  const loadKeys = async () => {
    setKeysBanner(null);
    try {
      const data = await listKeys();
      setKeys(data);
    } catch (err) {
      if (isApiBaseMisconfiguredError(err)) {
        setKeysBanner("misconfigured");
        return;
      }
      if (isAxiosError(err)) {
        if (err.response == null) {
          setKeysBanner("offline");
          toast.error("Can\u2019t reach your workspace server", {
            description: "Check your connection or try again shortly. Expand the notice on this page if you\u2019re running the API locally."
          });
        } else if (err.response.status === 401 || err.response.status === 403) {
          setKeysBanner("auth");
          toast.error("Session expired or not allowed", {
            description: "Sign in again to save and use API keys."
          });
        } else {
          const detail = err.response.data;
          const msg = typeof detail === "object" && detail !== null && "detail" in detail && typeof detail.detail === "string" ? detail.detail : "Failed to load API keys";
          toast.error(msg);
        }
      } else {
        toast.error("Failed to load API keys");
      }
    } finally {
      setLoading(false);
    }
  };
  const handleSave = async (provider) => {
    const key = newKeys[provider];
    if (!key?.trim()) return;
    setSaving(provider);
    try {
      await createKey(provider, key.trim(), void 0, allowUnverifiedSave);
      setNewKeys((prev) => ({ ...prev, [provider]: "" }));
      setReplaceEditorOpen((prev) => ({ ...prev, [provider]: false }));
      await loadKeys();
      toast.success(`${provider} API key saved`, {
        description: allowUnverifiedSave ? "Stored without live check \u2014 use Test when online to confirm." : "Verified with the provider."
      });
    } catch (err) {
      if (isApiBaseMisconfiguredError(err)) {
        toast.error(err.message);
        return;
      }
      const ax = err;
      const detail = typeof ax.response?.data?.detail === "string" ? ax.response.data.detail : "Failed to save key";
      if (ax.response?.status === 503) {
        toast.error("Provider unreachable", {
          description: `${detail} You can enable \u201CSave without verifying\u201D below, then save again.`
        });
      } else {
        toast.error(detail);
      }
    } finally {
      setSaving(null);
    }
  };
  const handleDelete = async (keyId, providerId, providerLabel) => {
    try {
      await deleteKey(keyId);
      setReplaceEditorOpen((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      setNewKeys((prev) => ({ ...prev, [providerId]: "" }));
      await loadKeys();
      toast.success(`${providerLabel} key removed`);
    } catch {
      toast.error("Failed to delete key");
    }
  };
  const requestDeleteKey = (keyId, providerId, providerLabel) => {
    const ok = window.confirm(
      `Remove the ${providerLabel} API key from this workspace?

Jobs that need this provider will stop working until you add a key again.`
    );
    if (!ok) return;
    void handleDelete(keyId, providerId, providerLabel);
  };
  const openReplaceEditor = (providerId) => {
    setReplaceEditorOpen((p) => ({ ...p, [providerId]: true }));
    queueMicrotask(() => {
      secretInputRefs.current[providerId]?.focus();
    });
  };
  const closeReplaceEditor = (providerId) => {
    setReplaceEditorOpen((p) => ({ ...p, [providerId]: false }));
    setNewKeys((prev) => ({ ...prev, [providerId]: "" }));
  };
  const handleValidate = async (provider) => {
    const existing = keys.find((k) => k.provider === provider);
    const typed = newKeys[provider]?.trim() || "";
    if (!typed && !existing) {
      toast.error("Enter a key in the field, or save one first.");
      return;
    }
    setValidating(provider);
    try {
      let result;
      if (typed) {
        result = await validateKey(provider, typed);
      } else {
        result = await validateSavedKey(provider);
      }
      if (result.valid) {
        toast.success(`${provider} key is valid!`);
      } else {
        toast.error(`${provider} key check failed: ${result.error || "authentication failed"}`);
      }
    } catch (err) {
      if (isApiBaseMisconfiguredError(err)) {
        toast.error(err.message);
        return;
      }
      const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null && "response" in err && typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Validation failed";
      toast.error(msg);
    } finally {
      setValidating(null);
      if (!isPlaceholderApiBaseUrl()) {
        await loadKeys();
      }
    }
  };
  const getExistingKey = (provider) => keys.find((k) => k.provider === provider);
  const apiMisconfigured = keysBanner === "misconfigured";
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center h-full", children: /* @__PURE__ */ jsx(Loader2, { className: "w-8 h-8 animate-spin text-black" }) });
  }
  if (storageOnly) {
    return /* @__PURE__ */ jsxs("div", { className: "max-w-3xl mx-auto min-w-0 page-safe py-4 sm:py-6 md:py-8 pb-16", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-black mb-2", children: "Cloud models" }),
      /* @__PURE__ */ jsx("h1", { className: "text-3xl font-semibold tracking-tight text-slate-900", children: "Settings" }),
      /* @__PURE__ */ jsx("div", { className: "mt-6", children: /* @__PURE__ */ jsx(AdaptiveWorkspacePanel, {}) }),
      /* @__PURE__ */ jsxs("div", { className: "mt-6 rounded-2xl border border-neutral-200/90 bg-neutral-50 p-6", children: [
        /* @__PURE__ */ jsx("p", { className: "text-slate-800 font-medium", children: "You're in local studio mode" }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-slate-600 leading-relaxed", children: "No backend is attached, so API keys aren't used. Processing stays in the browser\u2014great for privacy and quick comps." }),
        /* @__PURE__ */ jsxs("p", { className: "mt-4 text-sm text-slate-600 leading-relaxed", children: [
          "To connect ",
          /* @__PURE__ */ jsx("strong", { className: "text-slate-800", children: "OpenAI" }),
          ",",
          " ",
          /* @__PURE__ */ jsx("strong", { className: "text-slate-800", children: "Gemini" }),
          ", or",
          " ",
          /* @__PURE__ */ jsx("strong", { className: "text-slate-800", children: "Replicate" }),
          ", run",
          " ",
          /* @__PURE__ */ jsx("code", { className: "rounded-md bg-white px-1.5 py-0.5 text-xs font-mono text-black border border-neutral-200", children: "npm run dev" }),
          " ",
          "from the repo root (or remove browser-only overrides in",
          " ",
          /* @__PURE__ */ jsx("code", { className: "rounded-md bg-white px-1.5 py-0.5 text-xs font-mono text-black border border-neutral-200", children: "frontend/.env.development.local" }),
          "), then open Settings again."
        ] })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "max-w-3xl mx-auto min-w-0 page-safe py-4 sm:py-6 md:py-8 pb-16", children: [
    /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.2em] text-black mb-2", children: "Account" }),
    /* @__PURE__ */ jsx("h1", { className: "text-3xl font-semibold tracking-tight text-slate-900", children: "Integrations" }),
    /* @__PURE__ */ jsxs("p", { className: "mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1.5 text-xs font-medium text-emerald-950", children: [
      /* @__PURE__ */ jsx(Shield, { className: "h-3.5 w-3.5 shrink-0", strokeWidth: 2, "aria-hidden": true }),
      "Your keys are encrypted on the server \u2014 never stored in the browser."
    ] }),
    keysBanner === "offline" && /* @__PURE__ */ jsxs(
      "div",
      {
        className: "mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950",
        role: "alert",
        children: [
          /* @__PURE__ */ jsx("p", { className: "font-semibold text-amber-950", children: "We can't reach your workspace server" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-amber-900/95 leading-relaxed", children: "Saving or testing API keys needs a connection to your backend. Check your network, VPN, or whether the app is running \u2014 then try again." }),
          /* @__PURE__ */ jsxs("details", { className: "mt-3 rounded-lg border border-amber-200/80 bg-white/60 px-3 py-2 text-xs text-amber-950", children: [
            /* @__PURE__ */ jsx("summary", { className: "cursor-pointer font-semibold text-amber-950", children: "Developer: start the API locally" }),
            /* @__PURE__ */ jsxs("p", { className: "mt-2 leading-relaxed text-amber-900", children: [
              "From the repo root run ",
              /* @__PURE__ */ jsx("code", { className: "rounded bg-amber-100/80 px-1 py-0.5 font-mono", children: "npm run dev" }),
              " ",
              "(API + web), or ",
              /* @__PURE__ */ jsx("code", { className: "rounded bg-amber-100/80 px-1 py-0.5 font-mono", children: "npm run backend" }),
              " with",
              " ",
              /* @__PURE__ */ jsx("code", { className: "rounded bg-amber-100/80 px-1 py-0.5 font-mono", children: "npm run dev:web" }),
              " in another terminal."
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => void loadKeys(),
              className: "mt-3 text-sm font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-900",
              children: "Retry connection"
            }
          )
        ]
      }
    ),
    keysBanner === "auth" && /* @__PURE__ */ jsxs(
      "div",
      {
        className: "mt-4 rounded-2xl border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-900",
        role: "alert",
        children: [
          /* @__PURE__ */ jsx("p", { className: "font-semibold", children: "Sign in required" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-neutral-700 leading-relaxed", children: "Open the login page and sign in (local dev session or Supabase). Then return here to add keys." }),
          /* @__PURE__ */ jsx(
            Link,
            {
              to: "/login",
              className: "mt-3 inline-block text-sm font-semibold text-black underline underline-offset-2 hover:text-neutral-700",
              children: "Go to login"
            }
          )
        ]
      }
    ),
    keysBanner === "misconfigured" && /* @__PURE__ */ jsxs(
      "div",
      {
        className: "mt-4 rounded-2xl border border-amber-400/90 bg-amber-50 px-4 py-3 text-sm text-amber-950",
        role: "alert",
        children: [
          /* @__PURE__ */ jsx("p", { className: "font-semibold text-amber-950", children: "Backend API URL is not set on this deployment" }),
          /* @__PURE__ */ jsxs("p", { className: "mt-1.5 text-amber-900/95 leading-relaxed", children: [
            "The frontend was built with a placeholder ",
            /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 py-0.5 text-xs font-mono", children: "VITE_API_BASE_URL" }),
            ", so it will not call the network until you fix it (this avoids broken DNS errors in the console)."
          ] }),
          /* @__PURE__ */ jsxs("ol", { className: "mt-2 list-decimal pl-5 text-amber-900/95 space-y-1", children: [
            /* @__PURE__ */ jsxs("li", { children: [
              "Open",
              " ",
              /* @__PURE__ */ jsx("strong", { className: "text-amber-950", children: "Vercel" }),
              " \u2192 your project \u2192",
              " ",
              /* @__PURE__ */ jsx("strong", { className: "text-amber-950", children: "Settings \u2192 Environment Variables" }),
              "."
            ] }),
            /* @__PURE__ */ jsxs("li", { children: [
              "Set ",
              /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 py-0.5 text-xs font-mono", children: "VITE_API_BASE_URL" }),
              " ",
              "to your live API root, including ",
              /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 py-0.5 text-xs font-mono", children: "/api" }),
              " ",
              "(example: ",
              /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 py-0.5 text-xs font-mono", children: "https://api.myapp.com/api" }),
              ")."
            ] }),
            /* @__PURE__ */ jsxs("li", { children: [
              /* @__PURE__ */ jsx("strong", { className: "text-amber-950", children: "Redeploy" }),
              " the production build so Vite picks up the new value."
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => void loadKeys(),
              className: "mt-3 text-sm font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-900",
              children: "I've updated env \u2014 retry"
            }
          )
        ]
      }
    ),
    !apiMisconfigured && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("p", { className: "mt-4 text-slate-600 mb-4 leading-relaxed max-w-2xl", children: "Add the providers you use. We verify keys with each service when you save (unless you choose offline save below). You need at least one enhancement provider (OpenAI or Gemini) plus Replicate if you want AI upscaling." }),
      /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-x-4 gap-y-2 text-sm mb-8", children: Object.keys(PROVIDER_DOC_URLS).map((id) => /* @__PURE__ */ jsxs(
        "a",
        {
          href: PROVIDER_DOC_URLS[id],
          target: "_blank",
          rel: "noopener noreferrer",
          className: "inline-flex items-center gap-1 text-black font-medium underline underline-offset-2 hover:text-neutral-700",
          children: [
            "Get ",
            id,
            " key",
            /* @__PURE__ */ jsx(ExternalLink, { className: "w-3.5 h-3.5 opacity-70", "aria-hidden": true })
          ]
        },
        id
      )) }),
      /* @__PURE__ */ jsxs("label", { className: "flex items-start gap-3 mb-8 p-4 rounded-xl border border-amber-200/90 bg-amber-50/50 max-w-2xl cursor-pointer", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: allowUnverifiedSave,
            onChange: (e) => setAllowUnverifiedSave(e.target.checked),
            className: "h-4 w-4 mt-0.5 rounded border-neutral-300 text-black focus:ring-neutral-400"
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-neutral-800 leading-relaxed", children: [
          /* @__PURE__ */ jsx("span", { className: "font-semibold text-black", children: "Save without verifying" }),
          " \u2014 use if you are offline, behind a strict firewall, or air-gapped. The key is stored encrypted but marked unverified until you run ",
          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "Test" }),
          " successfully."
        ] })
      ] })
    ] }),
    !apiMisconfigured && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "space-y-5", children: PROVIDERS.map((provider) => {
        const existing = getExistingKey(provider.id);
        const editorOpen = !existing || Boolean(replaceEditorOpen[provider.id]);
        return /* @__PURE__ */ jsxs(
          "article",
          {
            className: "overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
            children: [
              /* @__PURE__ */ jsx("div", { className: "p-5 md:p-6", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 gap-4", children: [
                  /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 ring-1 ring-black/[0.06]",
                      "aria-hidden": true,
                      children: /* @__PURE__ */ jsx(Key, { className: "h-5 w-5 text-neutral-800", strokeWidth: 2 })
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                      /* @__PURE__ */ jsx("h3", { className: "text-lg font-semibold tracking-tight text-slate-900", children: provider.name }),
                      /* @__PURE__ */ jsx("span", { className: "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600", children: provider.usageBadge })
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm leading-relaxed text-slate-600", children: provider.description }),
                    provider.models.length > 0 && /* @__PURE__ */ jsxs("div", { className: "mt-3", children: [
                      /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wider text-slate-400", children: "Models in app" }),
                      /* @__PURE__ */ jsx("div", { className: "mt-1.5 flex flex-wrap gap-1.5", children: provider.models.map((m) => /* @__PURE__ */ jsx(
                        "span",
                        {
                          className: "inline-flex items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700",
                          children: m
                        },
                        m
                      )) })
                    ] }),
                    /* @__PURE__ */ jsxs(
                      "a",
                      {
                        href: PROVIDER_CONSOLE_URLS[provider.id],
                        target: "_blank",
                        rel: "noopener noreferrer",
                        className: "mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-black hover:decoration-slate-500",
                        children: [
                          "Provider console & docs",
                          /* @__PURE__ */ jsx(ExternalLink, { className: "h-3.5 w-3.5 opacity-70", "aria-hidden": true })
                        ]
                      }
                    )
                  ] })
                ] }),
                existing ? /* @__PURE__ */ jsxs("div", { className: "flex w-full flex-col gap-2 sm:w-auto sm:max-w-[min(100%,20rem)] sm:shrink-0 sm:items-end", children: [
                  /* @__PURE__ */ jsxs(
                    "div",
                    {
                      className: existing.is_valid ? "inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-950" : "inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50/90 px-3 py-1 text-xs font-semibold text-amber-950",
                      children: [
                        existing.is_valid ? /* @__PURE__ */ jsx(CheckCircle, { className: "h-3.5 w-3.5 shrink-0", strokeWidth: 2.5, "aria-hidden": true }) : /* @__PURE__ */ jsx(XCircle, { className: "h-3.5 w-3.5 shrink-0", strokeWidth: 2.5, "aria-hidden": true }),
                        existing.is_valid ? "Verified with provider" : "Not verified \u2014 run Test"
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { className: "w-full rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 sm:text-right", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wider text-slate-500", children: "Stored key (masked)" }),
                    /* @__PURE__ */ jsx("p", { className: "mt-1 font-mono text-[13px] leading-snug tracking-wide text-slate-800 break-all", children: existing.masked_key })
                  ] })
                ] }) : /* @__PURE__ */ jsxs("div", { className: "flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-600 sm:w-auto sm:max-w-xs", children: [
                  /* @__PURE__ */ jsx(Shield, { className: "h-4 w-4 shrink-0 text-slate-400", "aria-hidden": true }),
                  /* @__PURE__ */ jsx("span", { children: "No key saved yet. Paste a secret below and save." })
                ] })
              ] }) }),
              existing && !editorOpen && /* @__PURE__ */ jsxs("div", { className: "border-t border-slate-100 bg-slate-50/30 px-5 py-4 md:px-6", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500", children: "Manage key" }),
                /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-slate-600", children: "Edit replaces the stored secret. Test checks the saved key with the provider. Remove deletes it from this workspace." }),
                /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap", children: [
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      type: "button",
                      onClick: () => openReplaceEditor(provider.id),
                      className: "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50",
                      children: [
                        /* @__PURE__ */ jsx(Pencil, { className: "h-4 w-4 shrink-0", "aria-hidden": true }),
                        "Edit or replace key"
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleValidate(provider.id),
                      disabled: validating === provider.id,
                      className: "min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45",
                      children: validating === provider.id ? "Testing\u2026" : "Test saved key"
                    }
                  ),
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      type: "button",
                      onClick: () => requestDeleteKey(existing.id, provider.id, provider.name),
                      className: "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50",
                      children: [
                        /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4 shrink-0", "aria-hidden": true }),
                        "Remove key"
                      ]
                    }
                  )
                ] })
              ] }),
              editorOpen && /* @__PURE__ */ jsxs("div", { className: "border-t border-slate-100 bg-slate-50/40 px-5 py-4 md:px-6", children: [
                /* @__PURE__ */ jsx(
                  "label",
                  {
                    htmlFor: `api-key-${provider.id}`,
                    className: "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500",
                    children: existing ? "New secret key" : "Secret key"
                  }
                ),
                existing && /* @__PURE__ */ jsxs("p", { className: "mt-1 text-xs text-slate-600", children: [
                  "Paste a full replacement. Saving overwrites the current key for ",
                  provider.name,
                  "."
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch", children: [
                  /* @__PURE__ */ jsx(
                    PasswordInput,
                    {
                      ref: (el) => {
                        secretInputRefs.current[provider.id] = el;
                      },
                      wrapperClassName: "min-w-0 flex-1",
                      id: `api-key-${provider.id}`,
                      autoComplete: "off",
                      value: newKeys[provider.id] || "",
                      onChange: (e) => setNewKeys((prev) => ({ ...prev, [provider.id]: e.target.value })),
                      placeholder: existing ? "Paste new key\u2026" : provider.placeholder,
                      className: "min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-black focus:ring-2 focus:ring-neutral-300/80 sm:min-w-[14rem]"
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2 sm:shrink-0", children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleSave(provider.id),
                        disabled: !newKeys[provider.id]?.trim() || saving === provider.id,
                        className: "min-h-[44px] flex-1 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none",
                        children: saving === provider.id ? "Saving\u2026" : existing ? "Save new key" : "Save key"
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleValidate(provider.id),
                        disabled: validating === provider.id || !existing && !newKeys[provider.id]?.trim(),
                        className: "min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none",
                        children: validating === provider.id ? "Testing\u2026" : newKeys[provider.id]?.trim() ? "Test pasted key" : "Test saved key"
                      }
                    ),
                    existing && /* @__PURE__ */ jsxs(Fragment, { children: [
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => closeReplaceEditor(provider.id),
                          className: "min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100",
                          children: "Cancel"
                        }
                      ),
                      /* @__PURE__ */ jsxs(
                        "button",
                        {
                          type: "button",
                          onClick: () => requestDeleteKey(existing.id, provider.id, provider.name),
                          className: "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50",
                          children: [
                            /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4 shrink-0", "aria-hidden": true }),
                            "Remove"
                          ]
                        }
                      )
                    ] })
                  ] })
                ] })
              ] })
            ]
          },
          provider.id
        );
      }) }),
      /* @__PURE__ */ jsxs("div", { className: "mt-10", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2", children: "Workspace" }),
        /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold tracking-tight text-slate-900", children: "Preferences & learning" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-slate-600 max-w-2xl leading-relaxed", children: "Optional: how the app remembers your workflow on this device. API keys live in the section above." }),
        /* @__PURE__ */ jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsx(AdaptiveWorkspacePanel, {}) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-8 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-5 space-y-2", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-sm text-neutral-800 leading-relaxed", children: [
          /* @__PURE__ */ jsx("strong", { className: "text-black", children: "Technical detail:" }),
          " Secrets are encrypted before they are stored. Only your API server can use them for jobs and validation \u2014 not the browser or public database clients."
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-800 leading-relaxed", children: "Use separate keys per environment and rotate them if they are ever exposed." })
      ] })
    ] })
  ] });
}
export {
  SettingsPage as default
};
