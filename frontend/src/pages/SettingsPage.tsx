import { useState, useEffect } from "react";
import { Key, Trash2, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { listKeys, createKey, deleteKey, validateKey, validateSavedKey } from "../api/apiKeys";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import type { ApiKeyInfo } from "../types";
import { toast } from "sonner";
import AdaptiveWorkspacePanel from "../components/settings/AdaptiveWorkspacePanel";
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
    description: "Multimodal enhancement (generateContent + image output). Keys verified via Google API.",
    placeholder: "AIza... or key from AI Studio",
    models: GEMINI_IMAGE_MODELS,
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "Real-ESRGAN upscaling. Token verified against Replicate account API.",
    placeholder: "r8_...",
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

  useEffect(() => {
    if (storageOnly) return;
    void loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const data = await listKeys();
      setKeys(data);
    } catch {
      toast.error("Failed to load API keys");
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
      await loadKeys();
      toast.success(`${provider} API key saved`, {
        description: allowUnverifiedSave
          ? "Stored without live check — use Test when online to confirm."
          : "Verified with the provider.",
      });
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { detail?: string } } };
      const detail =
        typeof ax.response?.data?.detail === "string" ? ax.response.data.detail : "Failed to save key";
      if (ax.response?.status === 503) {
        toast.error("Provider unreachable", {
          description: `${detail} You can enable “Save without verifying” below, then save again.`,
          duration: 8000,
        });
      } else {
        toast.error(detail);
      }
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (keyId: string, provider: string) => {
    try {
      await deleteKey(keyId);
      await loadKeys();
      toast.success(`${provider} key removed`);
    } catch {
      toast.error("Failed to delete key");
    }
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
      await loadKeys();
    }
  };

  const getExistingKey = (provider: string) => keys.find((k) => k.provider === provider);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  if (storageOnly) {
    return (
      <div className="max-w-3xl mx-auto p-6 md:p-8 pb-16">
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
              npm run dev:full
            </code>{" "}
            from the project folder, then open Settings again in that session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 pb-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black mb-2">
        Integrations
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Settings</h1>
      <p className="mt-3 text-slate-600 mb-4 leading-relaxed max-w-2xl">
        Bring your own keys for enhancement and upscaling. Each save is{" "}
        <strong className="text-slate-800">checked against the provider</strong> unless you opt out below.
        Keys are encrypted at rest (AES-256), are not written to application logs, and are only decrypted on
        the API server—never exposed to the browser or Supabase client libraries.
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

      <AdaptiveWorkspacePanel />

      <div className="space-y-6">
        {PROVIDERS.map((provider) => {
          const existing = getExistingKey(provider.id);
          return (
            <div
              key={provider.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-6"
            >
              <div className="flex items-start justify-between mb-4 gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Key className="w-5 h-5 text-black" strokeWidth={2} />
                    {provider.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">{provider.description}</p>
                  {provider.models.length > 0 && (
                    <p className="text-xs text-slate-500 mt-2">
                      <span className="font-semibold text-slate-700">Models in app:</span>{" "}
                      {provider.models.join(", ")}
                    </p>
                  )}
                  <a
                    href={PROVIDER_CONSOLE_URLS[provider.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-black mt-2 underline underline-offset-2"
                  >
                    API / image docs
                    <ExternalLink className="w-3 h-3" aria-hidden />
                  </a>
                </div>
                {existing && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {existing.is_valid ? (
                      <CheckCircle className="w-5 h-5 text-black" />
                    ) : (
                      <XCircle className="w-5 h-5 text-black" />
                    )}
                    <span className="text-xs font-mono text-slate-500">{existing.masked_key}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  type="password"
                  value={newKeys[provider.id] || ""}
                  onChange={(e) => setNewKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                  placeholder={existing ? "Enter new key to update..." : provider.placeholder}
                  className="flex-1 min-w-[12rem] px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-400 focus:border-black outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSave(provider.id)}
                  disabled={!newKeys[provider.id]?.trim() || saving === provider.id}
                  className="px-4 py-2.5 bg-black text-white text-sm rounded-xl font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-all"
                >
                  {saving === provider.id ? "Saving..." : existing ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => handleValidate(provider.id)}
                  disabled={validating === provider.id || (!existing && !newKeys[provider.id]?.trim())}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 text-sm rounded-xl font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {validating === provider.id ? "Testing…" : "Test"}
                </button>
                {existing && (
                  <button
                    type="button"
                    onClick={() => handleDelete(existing.id, provider.name)}
                    className="px-3 py-2.5 text-black hover:bg-neutral-100 rounded-xl transition-colors"
                    aria-label={`Remove ${provider.name} key`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-5 bg-neutral-100 border border-neutral-300 rounded-2xl space-y-2">
        <p className="text-sm text-neutral-800 leading-relaxed">
          <strong className="text-black">Security:</strong> Keys are encrypted at rest (Fernet / AES-128-CBC +
          HMAC in transit to storage). They are only decrypted server-side for jobs and validation. Logs record
          provider and success/failure — never the secret.
        </p>
        <p className="text-sm text-neutral-800 leading-relaxed">
          <strong className="text-black">Hygiene:</strong> Use separate keys per environment, rotate if exposed,
          and restrict keys in OpenAI / Google Cloud / Replicate consoles where project scoping is available.
        </p>
      </div>
    </div>
  );
}
