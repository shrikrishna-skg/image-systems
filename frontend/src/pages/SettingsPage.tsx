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
  Pencil,
} from "lucide-react";
import { listKeys, createKey, deleteKey, validateKey, validateSavedKey } from "../api/apiKeys";
import { isApiBaseMisconfiguredError, isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import type { ApiKeyInfo } from "../types";
import { toast } from "sonner";
import AdaptiveWorkspacePanel from "../components/settings/AdaptiveWorkspacePanel";
import { PasswordInput } from "../components/ui/PasswordInput";
import {
  GEMINI_IMAGE_MODELS,
  OPENAI_IMAGE_MODELS,
  PROVIDER_CONSOLE_URLS,
  PROVIDER_DOC_URLS,
} from "../lib/providerIntegrationMeta";

const storageOnly = isStorageOnlyMode();

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Image enhancement via GPT Image (images.edit). Keys are verified live before save.",
    placeholder: "sk-...",
    models: OPENAI_IMAGE_MODELS,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description:
      "Multimodal enhancement (generateContent + image output). After saving, use Test saved key: the backend calls Google’s model list API; if it succeeds, your key works. If Google returns permission errors, enable the Generative Language API for the key’s project in Google Cloud / AI Studio.",
    placeholder: "AIza... or key from AI Studio",
    models: GEMINI_IMAGE_MODELS,
  },
  {
    id: "replicate",
    name: "Replicate",
    description:
      "Real-ESRGAN upscaling. Requires a funded Replicate account (GPU runs are metered). Token is verified via the account API.",
    placeholder: "r8_...",
    models: [] as readonly string[],
  },
  {
    id: "zyte",
    name: "Zyte API",
    description:
      "Optional engine for Import from URL: headless browser HTML (JavaScript rendered). Without a key, scans use plain HTTP. Test uses a small HTTP extract to verify your key.",
    placeholder: "Paste Zyte API key",
    models: [] as readonly string[],
  },
] as const;

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(!storageOnly);
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [validating, setValidating] = useState<string | null>(null);
  const [allowUnverifiedSave, setAllowUnverifiedSave] = useState(false);
  const [keysBanner, setKeysBanner] = useState<null | "offline" | "auth" | "misconfigured">(null);
  /** When a key already exists, editor starts collapsed until user chooses Edit. */
  const [replaceEditorOpen, setReplaceEditorOpen] = useState<Record<string, boolean>>({});
  const secretInputRefs = useRef<Partial<Record<string, HTMLInputElement | null>>>({});

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
          toast.error("Cannot reach the API", {
            description: "Start the backend from the repo root: npm run dev (or npm run backend in another terminal).",
          });
        } else if (err.response.status === 401 || err.response.status === 403) {
          setKeysBanner("auth");
          toast.error("Session expired or not allowed", {
            description: "Sign in again to save and use API keys.",
          });
        } else {
          const detail = err.response.data;
          const msg =
            typeof detail === "object" &&
            detail !== null &&
            "detail" in detail &&
            typeof (detail as { detail: unknown }).detail === "string"
              ? (detail as { detail: string }).detail
              : "Failed to load API keys";
          toast.error(msg);
        }
      } else {
        toast.error("Failed to load API keys");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (provider: string) => {
    const key = newKeys[provider];
    if (!key?.trim()) return;

    setSaving(provider);
    try {
      await createKey(provider, key.trim(), undefined, allowUnverifiedSave);
      setNewKeys((prev) => ({ ...prev, [provider]: "" }));
      setReplaceEditorOpen((prev) => ({ ...prev, [provider]: false }));
      await loadKeys();
      toast.success(`${provider} API key saved`, {
        description: allowUnverifiedSave
          ? "Stored without live check — use Test when online to confirm."
          : "Verified with the provider.",
      });
    } catch (err: unknown) {
      if (isApiBaseMisconfiguredError(err)) {
        toast.error(err.message);
        return;
      }
      const ax = err as { response?: { status?: number; data?: { detail?: string } } };
      const detail =
        typeof ax.response?.data?.detail === "string" ? ax.response.data.detail : "Failed to save key";
      if (ax.response?.status === 503) {
        toast.error("Provider unreachable", {
          description: `${detail} You can enable “Save without verifying” below, then save again.`,
        });
      } else {
        toast.error(detail);
      }
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (keyId: string, providerId: string, providerLabel: string) => {
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

  const requestDeleteKey = (keyId: string, providerId: string, providerLabel: string) => {
    const ok = window.confirm(
      `Remove the ${providerLabel} API key from this workspace?\n\nJobs that need this provider will stop working until you add a key again.`
    );
    if (!ok) return;
    void handleDelete(keyId, providerId, providerLabel);
  };

  const openReplaceEditor = (providerId: string) => {
    setReplaceEditorOpen((p) => ({ ...p, [providerId]: true }));
    queueMicrotask(() => {
      secretInputRefs.current[providerId]?.focus();
    });
  };

  const closeReplaceEditor = (providerId: string) => {
    setReplaceEditorOpen((p) => ({ ...p, [providerId]: false }));
    setNewKeys((prev) => ({ ...prev, [providerId]: "" }));
  };

  const handleValidate = async (provider: string) => {
    const existing = keys.find((k) => k.provider === provider);
    const typed = newKeys[provider]?.trim() || "";
    if (!typed && !existing) {
      toast.error("Enter a key in the field, or save one first.");
      return;
    }

    setValidating(provider);
    try {
      let result: { valid: boolean; error?: string };
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
    } catch (err: unknown) {
      if (isApiBaseMisconfiguredError(err)) {
        toast.error(err.message);
        return;
      }
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" &&
              err !== null &&
              "response" in err &&
              typeof (err as { response?: { data?: { detail?: string } } }).response?.data
                ?.detail === "string"
            ? (err as { response: { data: { detail: string } } }).response.data.detail
            : "Validation failed";
      toast.error(msg);
    } finally {
      setValidating(null);
      if (!isPlaceholderApiBaseUrl()) {
        await loadKeys();
      }
    }
  };

  const getExistingKey = (provider: string) => keys.find((k) => k.provider === provider);
  const apiMisconfigured = keysBanner === "misconfigured";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  if (storageOnly) {
    return (
      <div className="max-w-3xl mx-auto min-w-0 px-3 py-4 sm:px-6 sm:py-6 md:p-8 pb-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black mb-2">
          Cloud models
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <div className="mt-6">
          <AdaptiveWorkspacePanel />
        </div>
        <div className="mt-6 rounded-2xl border border-neutral-200/90 bg-neutral-50 p-6">
          <p className="text-slate-800 font-medium">You&apos;re in local studio mode</p>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            No backend is attached, so API keys aren&apos;t used. Processing stays in the browser—great
            for privacy and quick comps.
          </p>
          <p className="mt-4 text-sm text-slate-600 leading-relaxed">
            To connect <strong className="text-slate-800">OpenAI</strong>,{" "}
            <strong className="text-slate-800">Gemini</strong>, or{" "}
            <strong className="text-slate-800">Replicate</strong>, run{" "}
            <code className="rounded-md bg-white px-1.5 py-0.5 text-xs font-mono text-black border border-neutral-200">
              npm run dev
            </code>{" "}
            from the repo root (or remove browser-only overrides in{" "}
            <code className="rounded-md bg-white px-1.5 py-0.5 text-xs font-mono text-black border border-neutral-200">
              frontend/.env.development.local
            </code>
            ), then open Settings again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto min-w-0 px-3 py-4 sm:px-6 sm:py-6 md:p-8 pb-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black mb-2">
        Integrations
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Settings</h1>

      {keysBanner === "offline" && (
        <div
          className="mt-4 rounded-2xl border border-amber-300/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold text-amber-950">Backend not reachable</p>
          <p className="mt-1.5 text-amber-900/90 leading-relaxed">
            API keys are stored by the FastAPI server. From the{" "}
            <strong className="text-amber-950">repository root</strong>, run{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-mono border border-amber-200/80">
              npm run dev
            </code>{" "}
            (starts API + web), or run{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-mono border border-amber-200/80">
              npm run backend
            </code>{" "}
            in one terminal and{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-mono border border-amber-200/80">
              npm run dev:web
            </code>{" "}
            in another (with{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-mono border border-amber-200/80">
              LOCAL_DEV_MODE=true
            </code>{" "}
            on the API for local JWT).
          </p>
          <button
            type="button"
            onClick={() => void loadKeys()}
            className="mt-3 text-sm font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-900"
          >
            Retry
          </button>
        </div>
      )}

      {keysBanner === "auth" && (
        <div
          className="mt-4 rounded-2xl border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-900"
          role="alert"
        >
          <p className="font-semibold">Sign in required</p>
          <p className="mt-1.5 text-neutral-700 leading-relaxed">
            Open the login page and sign in (local dev session or Supabase). Then return here to add keys.
          </p>
          <Link
            to="/login"
            className="mt-3 inline-block text-sm font-semibold text-black underline underline-offset-2 hover:text-neutral-700"
          >
            Go to login
          </Link>
        </div>
      )}

      {keysBanner === "misconfigured" && (
        <div
          className="mt-4 rounded-2xl border border-amber-400/90 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold text-amber-950">Backend API URL is not set on this deployment</p>
          <p className="mt-1.5 text-amber-900/95 leading-relaxed">
            The frontend was built with a placeholder <code className="rounded bg-white/90 px-1 py-0.5 text-xs font-mono">VITE_API_BASE_URL</code>, so it will not call the network until you fix it (this avoids broken DNS errors in the console).
          </p>
          <ol className="mt-2 list-decimal pl-5 text-amber-900/95 space-y-1">
            <li>
              Open{" "}
              <strong className="text-amber-950">Vercel</strong> → your project →{" "}
              <strong className="text-amber-950">Settings → Environment Variables</strong>.
            </li>
            <li>
              Set <code className="rounded bg-white/90 px-1 py-0.5 text-xs font-mono">VITE_API_BASE_URL</code>{" "}
              to your live API root, including <code className="rounded bg-white/90 px-1 py-0.5 text-xs font-mono">/api</code>{" "}
              (example: <code className="rounded bg-white/90 px-1 py-0.5 text-xs font-mono">https://api.myapp.com/api</code>).
            </li>
            <li>
              <strong className="text-amber-950">Redeploy</strong> the production build so Vite picks up the new value.
            </li>
          </ol>
          <button
            type="button"
            onClick={() => void loadKeys()}
            className="mt-3 text-sm font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-900"
          >
            I&apos;ve updated env — retry
          </button>
        </div>
      )}

      {!apiMisconfigured && (
        <>
          <p className="mt-3 text-slate-600 mb-4 leading-relaxed max-w-2xl">
            Bring your own keys for enhancement and upscaling. Each save is{" "}
            <strong className="text-slate-800">checked against the provider</strong> unless you opt out below.
            On the hosted app, the browser sends your key once to your deployed API over HTTPS; the API encrypts it
            and stores ciphertext in your <strong className="text-slate-800">Supabase Postgres</strong>{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono text-slate-800">api_keys</code>{" "}
            row (never in browser storage and not readable via the Supabase JS client). Only the API decrypts keys
            when running jobs or validation.
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm mb-8">
            {(Object.keys(PROVIDER_DOC_URLS) as (keyof typeof PROVIDER_DOC_URLS)[]).map((id) => (
              <a
                key={id}
                href={PROVIDER_DOC_URLS[id]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-black font-medium underline underline-offset-2 hover:text-neutral-700"
              >
                Get {id} key
                <ExternalLink className="w-3.5 h-3.5 opacity-70" aria-hidden />
              </a>
            ))}
          </div>

          <label className="flex items-start gap-3 mb-8 p-4 rounded-xl border border-amber-200/90 bg-amber-50/50 max-w-2xl cursor-pointer">
            <input
              type="checkbox"
              checked={allowUnverifiedSave}
              onChange={(e) => setAllowUnverifiedSave(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-neutral-300 text-black focus:ring-neutral-400"
            />
            <span className="text-sm text-neutral-800 leading-relaxed">
              <span className="font-semibold text-black">Save without verifying</span> — use if you are offline,
              behind a strict firewall, or air-gapped. The key is stored encrypted but marked unverified until you
              run <strong className="text-black">Test</strong> successfully.
            </span>
          </label>
        </>
      )}

      <AdaptiveWorkspacePanel />

      {!apiMisconfigured && (
        <>
      <div className="space-y-5">
        {PROVIDERS.map((provider) => {
          const existing = getExistingKey(provider.id);
          const editorOpen = !existing || Boolean(replaceEditorOpen[provider.id]);
          return (
            <article
              key={provider.id}
              className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="p-5 md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="flex min-w-0 gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 ring-1 ring-black/[0.06]"
                      aria-hidden
                    >
                      <Key className="h-5 w-5 text-neutral-800" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold tracking-tight text-slate-900">{provider.name}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{provider.description}</p>
                      {provider.models.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Models in app
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {provider.models.map((m) => (
                              <span
                                key={m}
                                className="inline-flex items-center rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <a
                        href={PROVIDER_CONSOLE_URLS[provider.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-black hover:decoration-slate-500"
                      >
                        Provider console &amp; docs
                        <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
                      </a>
                    </div>
                  </div>

                  {existing ? (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-[min(100%,20rem)] sm:shrink-0 sm:items-end">
                      <div
                        className={
                          existing.is_valid
                            ? "inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-950"
                            : "inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50/90 px-3 py-1 text-xs font-semibold text-amber-950"
                        }
                      >
                        {existing.is_valid ? (
                          <CheckCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                        )}
                        {existing.is_valid ? "Verified with provider" : "Not verified — run Test"}
                      </div>
                      <div className="w-full rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 sm:text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Stored key (masked)
                        </p>
                        <p className="mt-1 font-mono text-[13px] leading-snug tracking-wide text-slate-800 break-all">
                          {existing.masked_key}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-600 sm:w-auto sm:max-w-xs">
                      <Shield className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <span>No key saved yet. Paste a secret below and save.</span>
                    </div>
                  )}
                </div>
              </div>

              {existing && !editorOpen && (
                <div className="border-t border-slate-100 bg-slate-50/30 px-5 py-4 md:px-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Manage key
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Edit replaces the stored secret. Test checks the saved key with the provider. Remove deletes
                    it from this workspace.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => openReplaceEditor(provider.id)}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                      Edit or replace key
                    </button>
                    <button
                      type="button"
                      onClick={() => handleValidate(provider.id)}
                      disabled={validating === provider.id}
                      className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {validating === provider.id ? "Testing…" : "Test saved key"}
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDeleteKey(existing.id, provider.id, provider.name)}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                      Remove key
                    </button>
                  </div>
                </div>
              )}

              {editorOpen && (
                <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4 md:px-6">
                  <label
                    htmlFor={`api-key-${provider.id}`}
                    className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                  >
                    {existing ? "New secret key" : "Secret key"}
                  </label>
                  {existing && (
                    <p className="mt-1 text-xs text-slate-600">
                      Paste a full replacement. Saving overwrites the current key for {provider.name}.
                    </p>
                  )}
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
                    <PasswordInput
                      ref={(el) => {
                        secretInputRefs.current[provider.id] = el;
                      }}
                      wrapperClassName="min-w-0 flex-1"
                      id={`api-key-${provider.id}`}
                      autoComplete="off"
                      value={newKeys[provider.id] || ""}
                      onChange={(e) => setNewKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                      placeholder={existing ? "Paste new key…" : provider.placeholder}
                      className="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-black focus:ring-2 focus:ring-neutral-300/80 sm:min-w-[14rem]"
                    />
                    <div className="flex flex-wrap gap-2 sm:shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSave(provider.id)}
                        disabled={!newKeys[provider.id]?.trim() || saving === provider.id}
                        className="min-h-[44px] flex-1 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
                      >
                        {saving === provider.id ? "Saving…" : existing ? "Save new key" : "Save key"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleValidate(provider.id)}
                        disabled={
                          validating === provider.id || (!existing && !newKeys[provider.id]?.trim())
                        }
                        className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
                      >
                        {validating === provider.id
                          ? "Testing…"
                          : newKeys[provider.id]?.trim()
                            ? "Test pasted key"
                            : "Test saved key"}
                      </button>
                      {existing && (
                        <>
                          <button
                            type="button"
                            onClick={() => closeReplaceEditor(provider.id)}
                            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteKey(existing.id, provider.id, provider.name)}
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-8 p-5 bg-neutral-100 border border-neutral-300 rounded-2xl space-y-2">
        <p className="text-sm text-neutral-800 leading-relaxed">
          <strong className="text-black">Security:</strong> At rest, secrets are Fernet-encrypted before the
          insert into Postgres. RLS blocks direct reads of <code className="text-xs font-mono">api_keys</code> from
          anon/authenticated Supabase clients; your API uses the database connection string and decrypts only on the
          server for jobs and tests. Logs record provider and success/failure — never the secret.
        </p>
        <p className="text-sm text-neutral-800 leading-relaxed">
          <strong className="text-black">Hygiene:</strong> Use separate keys per environment, rotate if exposed,
          and restrict keys in OpenAI / Google Cloud / Replicate consoles where project scoping is available.
        </p>
      </div>
        </>
      )}
    </div>
  );
}
