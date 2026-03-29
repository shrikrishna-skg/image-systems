import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Wand2,
  ChevronRight,
  Lightbulb,
  ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import {
  composeImagePrompt,
  generateImageFromDescription,
  uploadLikeToImageInfo
} from "../api/imageGeneration";
import { listKeys } from "../api/apiKeys";
import { isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import { toastProcessingError } from "../lib/processingToast";
import { useImageStore } from "../stores/imageStore";
import { GEMINI_IMAGE_MODELS, OPENAI_IMAGE_MODELS } from "../lib/providerIntegrationMeta";
const storageOnly = isStorageOnlyMode();
function ImageGenerationPage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState("openai");
  const [naturalRequest, setNaturalRequest] = useState("");
  const [refinedPrompt, setRefinedPrompt] = useState("");
  const [openaiModel, setOpenaiModel] = useState(OPENAI_IMAGE_MODELS[0]);
  const [geminiModel, setGeminiModel] = useState(GEMINI_IMAGE_MODELS[0]);
  const [quality, setQuality] = useState("high");
  const [outputFormat, setOutputFormat] = useState("png");
  const [refining, setRefining] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [imagePromptRevealed, setImagePromptRevealed] = useState(false);
  const generateAbortRef = useRef(null);
  const misconfigured = isPlaceholderApiBaseUrl();
  useEffect(() => {
    return () => {
      generateAbortRef.current?.abort();
    };
  }, []);
  const imageModel = provider === "openai" ? openaiModel : geminiModel;
  useEffect(() => {
    if (storageOnly || misconfigured) return;
    void listKeys().then((keys) => {
      setHasOpenaiKey(keys.some((k) => k.provider === "openai"));
      setHasGeminiKey(keys.some((k) => k.provider === "gemini"));
    }).catch(() => {
      setHasOpenaiKey(false);
      setHasGeminiKey(false);
    });
  }, [misconfigured]);
  const hasKeyForProvider = provider === "openai" ? hasOpenaiKey : hasGeminiKey;
  const useManualPrompt = useMemo(() => refinedPrompt.trim().length >= 3, [refinedPrompt]);
  useEffect(() => {
    if (refinedPrompt.trim().length >= 3) setImagePromptRevealed(true);
  }, [refinedPrompt]);
  const handleRefine = useCallback(async () => {
    setImagePromptRevealed(true);
    const t = naturalRequest.trim();
    if (t.length < 3) {
      toast.error("Add a bit more detail", { description: "At least 3 characters in your description." });
      return;
    }
    if (!hasKeyForProvider) {
      toast.error("Save an API key first", { description: `Add a ${provider} key under Integrations.` });
      return;
    }
    setRefining(true);
    try {
      const res = await composeImagePrompt({ user_request: t, provider });
      setRefinedPrompt(res.interpreted_prompt);
      toast.success("Prompt refined", {
        description: `\u201C${res.short_title}\u201D \u2014 edit the refined prompt if you like, then Generate.`
      });
    } catch (err) {
      toastProcessingError(err, "Couldn\u2019t interpret that request");
    } finally {
      setRefining(false);
    }
  }, [naturalRequest, provider, hasKeyForProvider]);
  const handleGenerate = useCallback(async () => {
    if (!hasKeyForProvider) {
      toast.error("Save an API key first", { description: `Add a ${provider} key under Integrations.` });
      return;
    }
    const description = useManualPrompt ? refinedPrompt.trim() : naturalRequest.trim();
    if (description.length < 1) {
      toast.error(useManualPrompt ? "Refined prompt is empty." : "Describe what you want first.");
      return;
    }
    if (!useManualPrompt && description.length < 3) {
      toast.error("Add a bit more detail", { description: "At least 3 characters, or refine with AI first." });
      return;
    }
    generateAbortRef.current?.abort();
    const ac = new AbortController();
    generateAbortRef.current = ac;
    setGenerating(true);
    try {
      const res = await generateImageFromDescription({
        description,
        provider,
        interpret: !useManualPrompt,
        model: imageModel,
        quality,
        output_format: outputFormat,
        run_enhancement_pipeline: false,
        signal: ac.signal
      });
      const imageInfo = uploadLikeToImageInfo(res);
      const st = useImageStore.getState();
      if (!st.workspaceMode) {
        st.setStandardImport(imageInfo);
        toast.success("Image created", {
          description: res.used_interpretation ? "Opened on Operations \u2014 run enhance / pipeline when you\u2019re ready." : "Opened on Operations from your exact prompt."
        });
      } else {
        const r = st.addImagesToSession([imageInfo]);
        if (r.added < 1) {
          st.setStandardImport(imageInfo);
          toast.success("Image created", {
            description: "Workspace queue was full \u2014 opened this photo as the current asset on Operations. Remove items from the batch to add more."
          });
        } else {
          toast.success("Image added to workspace", {
            description: "Use batch tools on Operations, or open this asset to enhance one-by-one."
          });
        }
      }
      void navigate("/");
    } catch (err) {
      if (axios.isCancel(err) || axios.isAxiosError(err) && err.code === "ERR_CANCELED") {
        return;
      }
      const ax = err;
      if (ax.response?.status === 429) {
        toast.error("Rate limited", {
          description: typeof ax.response.data?.detail === "string" ? ax.response.data.detail : "Provider quota or rate limit \u2014 try again shortly."
        });
        return;
      }
      if (ax.response?.status === 501) {
        toast.message("Not available yet", {
          description: ax.response.data?.detail ?? "This option will be enabled in a future update."
        });
        return;
      }
      toastProcessingError(err, "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [
    hasKeyForProvider,
    naturalRequest,
    refinedPrompt,
    useManualPrompt,
    provider,
    imageModel,
    quality,
    outputFormat,
    navigate
  ]);
  if (storageOnly) {
    return /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-2xl page-safe py-12", children: [
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: "/",
          className: "mb-8 inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-black",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back to Operations"
          ]
        }
      ),
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold text-black", children: "Image Generation" }),
      /* @__PURE__ */ jsxs("p", { className: "mt-3 leading-relaxed text-neutral-600", children: [
        "Text-to-image uses your cloud API keys and the hosted backend. Switch off browser-only mode and run",
        " ",
        /* @__PURE__ */ jsx("code", { className: "rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-mono", children: "npm run dev" }),
        " to use this feature."
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "flex min-h-full min-w-0 flex-col bg-neutral-50", children: [
    /* @__PURE__ */ jsx("header", { className: "sticky top-0 z-20 border-b border-neutral-200/90 bg-white/95 page-safe py-3 backdrop-blur-md", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex max-w-3xl flex-wrap items-center gap-3", children: [
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: "/",
          className: "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-black",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "Operations" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-1 items-center gap-2 sm:gap-3", children: [
        /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-white ring-1 ring-black/10", children: /* @__PURE__ */ jsx(Wand2, { className: "h-4 w-4", strokeWidth: 2 }) }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("h1", { className: "truncate text-base font-semibold tracking-tight text-black sm:text-lg", children: "Image Generation" }),
          /* @__PURE__ */ jsx("p", { className: "hidden text-xs text-neutral-500 sm:block", children: "Describe a scene \u2014 we create a new image you can enhance on Operations like any upload." })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("main", { className: "mx-auto w-full max-w-3xl flex-1 page-safe py-6 pb-16", children: [
      misconfigured && /* @__PURE__ */ jsxs("div", { className: "mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950", children: [
        "Set ",
        /* @__PURE__ */ jsx("code", { className: "font-mono text-xs", children: "VITE_API_BASE_URL" }),
        " so this app can reach your API."
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "border-b border-neutral-100 pb-4", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold text-black", children: "How it works" }),
          /* @__PURE__ */ jsxs("p", { className: "mt-2 text-xs leading-relaxed text-neutral-600", children: [
            "Describe what you want in the box below. Optionally use ",
            /* @__PURE__ */ jsx("strong", { className: "text-neutral-800", children: "Refine with AI" }),
            " ",
            "to open a second field with a detailed prompt you can edit. Then pick a model and generate \u2014 the image opens on Operations for enhancement and download."
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-5 space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-neutral-500", children: "Image provider" }),
            /* @__PURE__ */ jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: ["openai", "gemini"].map((p) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setProvider(p),
                disabled: misconfigured,
                className: `rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${provider === p ? "border-black bg-black text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"} disabled:opacity-40`,
                children: p === "openai" ? "OpenAI" : "Gemini"
              },
              p
            )) }),
            provider === "openai" && !hasOpenaiKey ? /* @__PURE__ */ jsxs("p", { className: "mt-2 text-xs text-neutral-600", children: [
              /* @__PURE__ */ jsx(Link, { to: "/settings", className: "font-semibold text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black", children: "Add API key to unlock" }),
              " ",
              "\u2014 save an OpenAI key under Integrations to generate."
            ] }) : null,
            provider === "gemini" && !hasGeminiKey ? /* @__PURE__ */ jsxs("p", { className: "mt-2 text-xs text-neutral-600", children: [
              /* @__PURE__ */ jsx(Link, { to: "/settings", className: "font-semibold text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black", children: "Add API key to unlock" }),
              " ",
              "\u2014 save a Gemini key under Integrations to generate."
            ] }) : null
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-neutral-500", children: "Describe your scene" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: naturalRequest,
                onChange: (e) => setNaturalRequest(e.target.value),
                disabled: misconfigured,
                placeholder: "e.g. A sunlit hotel lobby with marble floors, wide angle, editorial travel photography style\u2026",
                rows: 4,
                className: "mt-2 w-full rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm text-black placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: [
              { label: "Sunlit living room", full: "Bright living room, Scandinavian style, soft daylight" },
              { label: "Luxury bathroom", full: "Luxury bathroom, marble, spa lighting" },
              { label: "Twilight exterior", full: "Exterior twilight, modern home, real estate photo" }
            ].map(({ label, full }) => /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                disabled: misconfigured,
                onClick: () => setNaturalRequest(full),
                className: "rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-black disabled:opacity-40",
                children: [
                  "Example: ",
                  label
                ]
              },
              label
            )) })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-neutral-200 bg-neutral-50/90 px-3 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => void handleRefine(),
                disabled: refining || generating || misconfigured || naturalRequest.trim().length < 3,
                className: "inline-flex items-center gap-2 rounded-xl border-2 border-neutral-800 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-50 disabled:opacity-40",
                children: [
                  refining ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": true }) : /* @__PURE__ */ jsx(Lightbulb, { className: "h-4 w-4" }),
                  "Refine with AI"
                ]
              }
            ),
            /* @__PURE__ */ jsxs("span", { className: "text-[11px] text-neutral-600", children: [
              "Opens the detailed prompt field below and suggests a stronger prompt (uses your ",
              provider,
              " key)."
            ] })
          ] }) }),
          !imagePromptRevealed ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setImagePromptRevealed(true),
              className: "text-left text-xs font-medium text-neutral-600 underline decoration-neutral-300 underline-offset-2 hover:text-black hover:decoration-black",
              children: "Paste a detailed prompt instead (skip \u201CRefine with AI\u201D)"
            }
          ) : null,
          imagePromptRevealed ? /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-neutral-500", children: "Detailed image prompt" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] text-neutral-500", children: "When this has text, Generate uses it as-is. Leave empty to expand your description automatically at generate time." }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                value: refinedPrompt,
                onChange: (e) => setRefinedPrompt(e.target.value),
                disabled: misconfigured,
                placeholder: "Refine with AI fills this \u2014 or type your own exact prompt for the image model.",
                rows: 5,
                className: "mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
              }
            )
          ] }) : null,
          /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-neutral-500", children: "Image model" }),
              /* @__PURE__ */ jsx(
                "select",
                {
                  value: imageModel,
                  onChange: (e) => provider === "openai" ? setOpenaiModel(e.target.value) : setGeminiModel(e.target.value),
                  disabled: misconfigured,
                  className: "mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50",
                  children: (provider === "openai" ? OPENAI_IMAGE_MODELS : GEMINI_IMAGE_MODELS).map((m) => /* @__PURE__ */ jsx("option", { value: m, children: m }, m))
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-neutral-500", children: "Quality" }),
              /* @__PURE__ */ jsxs(
                "select",
                {
                  value: quality,
                  onChange: (e) => setQuality(e.target.value),
                  disabled: misconfigured,
                  className: "mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50",
                  children: [
                    /* @__PURE__ */ jsx("option", { value: "high", children: "High" }),
                    /* @__PURE__ */ jsx("option", { value: "medium", children: "Medium" }),
                    /* @__PURE__ */ jsx("option", { value: "low", children: "Low" })
                  ]
                }
              ),
              provider === "gemini" ? /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[11px] text-neutral-500", children: "Same values as OpenAI are sent to the API; Gemini image models may not treat tiers identically." }) : null
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-neutral-500", children: "File format" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: outputFormat,
                onChange: (e) => setOutputFormat(e.target.value),
                disabled: misconfigured,
                className: "mt-2 w-full max-w-xs rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "png", children: "PNG" }),
                  /* @__PURE__ */ jsx("option", { value: "jpeg", children: "JPEG" }),
                  /* @__PURE__ */ jsx("option", { value: "webp", children: "WebP" })
                ]
              }
            ),
            provider === "gemini" ? /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[11px] text-neutral-500", children: "Request field matches OpenAI; saved file uses PNG because Gemini returns PNG image data." }) : null
          ] }),
          /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsxs("p", { className: "flex flex-wrap items-center gap-2 text-sm font-semibold text-black", children: [
                /* @__PURE__ */ jsx("span", { className: "rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600", children: "Coming soon" }),
                "Auto-enhance after generation"
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "mt-2 text-sm text-neutral-600 leading-snug", children: [
                /* @__PURE__ */ jsx("strong", { className: "font-medium text-neutral-900", children: "Today:" }),
                " after you click Generate, we take you to",
                " ",
                /* @__PURE__ */ jsx(Link, { to: "/", className: "font-medium text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black", children: "Operations" }),
                " ",
                "with this image loaded \u2014 run lighting and upscale there like any upload. In bulk workspace, new images join the queue for batch runs."
              ] }),
              /* @__PURE__ */ jsxs("details", { className: "group mt-2", children: [
                /* @__PURE__ */ jsxs("summary", { className: "flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-neutral-500 transition-colors hover:text-black marker:hidden [&::-webkit-details-marker]:hidden", children: [
                  /* @__PURE__ */ jsx(
                    ChevronRight,
                    {
                      className: "h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none",
                      "aria-hidden": true
                    }
                  ),
                  "What's next (roadmap)"
                ] }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 border-l-2 border-neutral-200 pl-3 text-[11px] leading-relaxed text-neutral-500", children: "Optional one-click enhancement from this screen after generation, using the same pipeline defaults as Operations \u2014 so a standard run won't require leaving this flow." })
              ] })
            ] }),
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/",
                className: "inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-black shadow-sm transition-colors hover:border-neutral-400 hover:bg-neutral-50 sm:self-center",
                children: [
                  /* @__PURE__ */ jsx(ImageIcon, { className: "h-4 w-4 shrink-0", strokeWidth: 2, "aria-hidden": true }),
                  "Open Operations"
                ]
              }
            )
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3 pt-2", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => void handleGenerate(),
                disabled: generating || refining || misconfigured,
                className: "inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40",
                children: [
                  generating ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": true }) : /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4" }),
                  "Generate image"
                ]
              }
            ),
            generating ? /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => generateAbortRef.current?.abort(),
                className: "inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50",
                children: "Cancel"
              }
            ) : null,
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/settings",
                className: "inline-flex items-center gap-1 text-sm font-semibold text-neutral-700 underline underline-offset-2 hover:text-black",
                children: [
                  "API keys",
                  /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4" })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/",
                className: "inline-flex items-center gap-1 text-sm font-semibold text-neutral-700 underline underline-offset-2 hover:text-black",
                children: [
                  /* @__PURE__ */ jsx(ImageIcon, { className: "h-4 w-4" }),
                  "Operations"
                ]
              }
            )
          ] })
        ] })
      ] })
    ] })
  ] });
}
export {
  ImageGenerationPage as default
};
