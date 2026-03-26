import { useState, useEffect } from "react";
import { Key, Trash2, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { listKeys, createKey, deleteKey, validateKey } from "../api/apiKeys";
import type { ApiKeyInfo } from "../types";
import toast from "react-hot-toast";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", description: "For image enhancement (GPT Image models)", placeholder: "sk-..." },
  { id: "gemini", name: "Google Gemini", description: "Alternative enhancement provider", placeholder: "AI..." },
  { id: "replicate", name: "Replicate", description: "For Real-ESRGAN upscaling", placeholder: "r8_..." },
];

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [validating, setValidating] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
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
      await createKey(provider, key.trim());
      setNewKeys((prev) => ({ ...prev, [provider]: "" }));
      await loadKeys();
      toast.success(`${provider} API key saved`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save key");
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
    const key = newKeys[provider] || "";
    if (!existing && !key.trim()) return;

    setValidating(provider);
    try {
      const result = await validateKey(provider, key.trim() || "stored");
      if (result.valid) {
        toast.success(`${provider} key is valid!`);
      } else {
        toast.error(`${provider} key is invalid: ${result.error || "authentication failed"}`);
      }
    } catch {
      toast.error("Validation failed");
    } finally {
      setValidating(null);
    }
  };

  const getExistingKey = (provider: string) => keys.find((k) => k.provider === provider);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-8">
        Configure your API keys. You bring your own keys — we never store them in plain text.
      </p>

      <div className="space-y-6">
        {PROVIDERS.map((provider) => {
          const existing = getExistingKey(provider.id);
          return (
            <div key={provider.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Key className="w-5 h-5 text-indigo-600" />
                    {provider.name}
                  </h3>
                  <p className="text-sm text-gray-500">{provider.description}</p>
                </div>
                {existing && (
                  <div className="flex items-center gap-1">
                    {existing.is_valid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="text-sm text-gray-500">{existing.masked_key}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={newKeys[provider.id] || ""}
                  onChange={(e) => setNewKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                  placeholder={existing ? "Enter new key to update..." : provider.placeholder}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <button
                  onClick={() => handleSave(provider.id)}
                  disabled={!newKeys[provider.id]?.trim() || saving === provider.id}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving === provider.id ? "Saving..." : existing ? "Update" : "Save"}
                </button>
                {existing && (
                  <button
                    onClick={() => handleDelete(existing.id, provider.name)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          <strong>Security:</strong> Your API keys are encrypted with AES-256 before storage.
          They are only decrypted server-side when processing your images. We never log or expose your keys.
        </p>
      </div>
    </div>
  );
}
