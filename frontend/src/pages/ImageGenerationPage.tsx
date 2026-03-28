import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Wand2,
  ChevronRight,
  Lightbulb,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  composeImagePrompt,
  generateImageFromDescription,
  uploadLikeToImageInfo,
  type ImageGenProvider,
} from "../api/imageGeneration";
import { listKeys } from "../api/apiKeys";
import { isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import { useImageStore } from "../stores/imageStore";
import { toastProcessingError } from "../lib/processingToast";
import { GEMINI_IMAGE_MODELS, OPENAI_IMAGE_MODELS } from "../lib/providerIntegrationMeta";

const storageOnly = isStorageOnlyMode();

export default function ImageGenerationPage() {
  const navigate = useNavigate();
  const workspaceMode = useImageStore((s) => s.workspaceMode);

  const [provider, setProvider] = useState<ImageGenProvider>("openai");
  const [naturalRequest, setNaturalRequest] = useState("");
  const [refinedPrompt, setRefinedPrompt] = useState("");
  const [openaiModel, setOpenaiModel] = useState<string>(OPENAI_IMAGE_MODELS[0]);
  const [geminiModel, setGeminiModel] = useState<string>(GEMINI_IMAGE_MODELS[0]);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const [outputFormat, setOutputFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [refining, setRefining] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  const misconfigured = isPlaceholderApiBaseUrl();

  const imageModel = provider === "openai" ? openaiModel : geminiModel;

  useEffect(() => {
    if (storageOnly || misconfigured) return;
    void listKeys()
      .then((keys) => {
        setHasOpenaiKey(keys.some((k) => k.provider === "openai"));
        setHasGeminiKey(keys.some((k) => k.provider === "gemini"));
      })
      .catch(() => {
        setHasOpenaiKey(false);
        setHasGeminiKey(false);
      });
  }, [misconfigured]);

  const hasKeyForProvider = provider === "openai" ? hasOpenaiKey : hasGeminiKey;

  const useManualPrompt = useMemo(() => refinedPrompt.trim().length >= 3, [refinedPrompt]);

  const handleRefine = useCallback(async () => {
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
        description: `“${res.short_title}” — edit the refined prompt if you like, then Generate.`,
      });
    } catch (err: unknown) {
      toastProcessingError(err, "Couldn’t interpret that request");
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
      });
      const imageInfo = uploadLikeToImageInfo(res);
      const st = useImageStore.getState();
      if (!st.workspaceMode) {
        st.setStandardImport(imageInfo);
        toast.success("Image created", {
          description: res.used_interpretation
            ? "Opened on Operations — run enhance / pipeline when you’re ready."
            : "Opened on Operations from your exact prompt.",
        });
      } else {
        const r = st.addImagesToSession([imageInfo]);
        if (r.added < 1) {
          st.setStandardImport(imageInfo);
          toast.success("Image created", {
            description:
              "Workspace queue was full — opened this photo as the current asset on Operations. Remove items from the batch to add more.",
          });
        } else {
          toast.success("Image added to workspace", {
            description: "Use batch tools on Operations, or open this asset to enhance one-by-one.",
          });
        }
      }
      void navigate("/");
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { detail?: string } } };
      if (ax.response?.status === 501) {
        toast.message("Phase 2", { description: ax.response.data?.detail ?? "Not available yet." });
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
    navigate,
  ]);

  if (storageOnly) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Operations
        </Link>
        <h1 className="text-2xl font-semibold text-black">Image Generation</h1>
        <p className="mt-3 leading-relaxed text-neutral-600">
          Text-to-image uses your cloud API keys and the hosted backend. Switch off browser-only mode and run{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-mono">npm run dev</code> to use this
          feature.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full min-w-0 flex-col bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200/90 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Operations</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
              <Wand2 className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-black sm:text-lg">Image Generation</h1>
              <p className="hidden text-xs text-neutral-500 sm:block">
                Phase 1 · Describe → AI understands → image API → Operations (enhance optional)
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-16 sm:px-6">
        {misconfigured && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Set <code className="font-mono text-xs">VITE_API_BASE_URL</code> so this app can reach your API.
          </div>
        )}

        <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-black">Pipeline</h2>
              <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-neutral-600">
                <li className="flex gap-2">
                  <span className="font-mono text-[10px] text-violet-600">1</span>
                  You describe the scene in plain language (or paste a precise prompt).
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-[10px] text-violet-600">2</span>
                  Optional: <strong className="text-neutral-800">Refine with AI</strong> turns it into a detailed
                  generation prompt (same provider key as the image model).
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-[10px] text-violet-600">3</span>
                  The image model renders pixels; the result is saved like an upload and opens on{" "}
                  <strong className="text-neutral-800">Operations</strong>.
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-[10px] text-neutral-400">4</span>
                  <span className="text-neutral-500">
                    Phase 2 (later): auto-run your usual enhancement after generation. Today, enhance from Operations
                    like any other asset — single photo or workspace batch.
                  </span>
                </li>
              </ol>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Provider</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["openai", "gemini"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    disabled={misconfigured}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                      provider === p
                        ? "border-black bg-black text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                    } disabled:opacity-40`}
                  >
                    {p === "openai" ? "OpenAI" : "Gemini"}
                    {p === "openai" && !hasOpenaiKey ? " · no key" : p === "gemini" && !hasGeminiKey ? " · no key" : ""}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                What do you want?
              </label>
              <textarea
                value={naturalRequest}
                onChange={(e) => setNaturalRequest(e.target.value)}
                disabled={misconfigured}
                placeholder="e.g. A sunlit hotel lobby with marble floors, wide angle, editorial travel photography style…"
                rows={4}
                className="mt-2 w-full rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm text-black placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRefine()}
                disabled={refining || generating || misconfigured || naturalRequest.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-950 hover:bg-violet-100 disabled:opacity-40"
              >
                {refining ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Lightbulb className="h-4 w-4" />}
                Refine with AI
              </button>
              <span className="text-[11px] text-neutral-500">
                Fills the box below. When that box has text, Generate uses it verbatim (no second AI pass).
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Image prompt (edit after refine)
              </label>
              <textarea
                value={refinedPrompt}
                onChange={(e) => setRefinedPrompt(e.target.value)}
                disabled={misconfigured}
                placeholder="After “Refine with AI”, edit here. Leave empty to let AI expand “What do you want?” at generate time."
                rows={5}
                className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Image model</span>
                <select
                  value={imageModel}
                  onChange={(e) =>
                    provider === "openai" ? setOpenaiModel(e.target.value) : setGeminiModel(e.target.value)
                  }
                  disabled={misconfigured}
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
                >
                  {(provider === "openai" ? OPENAI_IMAGE_MODELS : GEMINI_IMAGE_MODELS).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Quality</span>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as "low" | "medium" | "high")}
                  disabled={misconfigured}
                  className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                {provider === "gemini" ? (
                  <p className="mt-1.5 text-[11px] text-neutral-500">
                    Same values as OpenAI are sent to the API; Gemini image models may not treat tiers identically.
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">File format</span>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as "png" | "jpeg" | "webp")}
                disabled={misconfigured}
                className="mt-2 w-full max-w-xs rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
              {provider === "gemini" ? (
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  Request field matches OpenAI; saved file uses PNG because Gemini returns PNG image data.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-3">
              <p className="text-xs font-semibold text-neutral-700">Phase 2 (not enabled)</p>
              <label className="mt-2 flex cursor-not-allowed items-start gap-2 text-sm text-neutral-500">
                <input type="checkbox" disabled className="mt-1 h-4 w-4 rounded border-neutral-300" />
                <span>
                  After generation, automatically run the full enhancement pipeline. This will ship later; for now use
                  Operations to enhance in <strong className="text-neutral-600">single</strong> or{" "}
                  <strong className="text-neutral-600">batch</strong> mode.
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating || refining || misconfigured}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" />}
                Generate image
              </button>
              <Link
                to="/settings"
                className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900"
              >
                API keys
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-700 underline underline-offset-2 hover:text-black"
              >
                <ImageIcon className="h-4 w-4" />
                Operations
              </Link>
            </div>

            {useManualPrompt ? (
              <p className="text-[11px] text-violet-800">
                Generate will send the <strong>refined prompt</strong> exactly as written (no extra AI interpretation).
              </p>
            ) : (
              <p className="text-[11px] text-neutral-600">
                Generate will <strong>optionally expand</strong> “What do you want?” via a small LLM call, then call the
                image model.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
