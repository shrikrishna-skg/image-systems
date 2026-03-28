import { useState } from "react";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { BrandWordmark } from "../components/brand/BrandWordmark";
import { ImagesystemsLogo } from "../components/brand/ImagesystemsLogo";
import { getApiBase } from "../lib/apiBase";

const ENV_ROWS: { name: string; hint: string }[] = [
  {
    name: "VITE_SUPABASE_URL",
    hint: "Supabase → Project Settings → API → Project URL",
  },
  {
    name: "VITE_SUPABASE_ANON_KEY",
    hint: "Supabase → Project Settings → API → anon public key",
  },
  {
    name: "VITE_API_BASE_URL",
    hint: "Full URL to your FastAPI app, ending in /api (e.g. https://api.yourdomain.com/api). Required because this Vercel app is static-only.",
  },
];

export default function DeploymentConfigPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const apiBase = getApiBase();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 mb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-50 ring-1 ring-neutral-200">
              <ImagesystemsLogo className="h-9 w-9" decorative />
            </div>
            <BrandWordmark variant="hero" titleAs="h1" />
          </div>
          <p className="text-neutral-600 text-sm leading-relaxed max-w-md mx-auto">
            This build is missing <strong className="text-neutral-900">Supabase</strong> environment
            variables. Add them in Vercel, then trigger a new deployment so Vite can embed them at
            build time.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/90 p-8 space-y-6">
          <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 leading-relaxed">
            <strong className="font-semibold">Vite inlines</strong>{" "}
            <code className="rounded bg-white/90 px-1 font-mono text-xs">VITE_*</code> variables when{" "}
            <code className="rounded bg-white/90 px-1 font-mono text-xs">npm run build</code> runs.
            Set variables under{" "}
            <strong className="font-semibold">Vercel → Project → Settings → Environment Variables</strong>{" "}
            for <strong>Production</strong> (and Preview if you use it), then redeploy.
          </div>

          <div>
            <h2 className="text-sm font-semibold text-black mb-3">Required variables</h2>
            <ul className="space-y-3">
              {ENV_ROWS.map((row) => (
                <li
                  key={row.name}
                  className="rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <code className="text-xs font-mono text-neutral-900 break-all">{row.name}</code>
                    <button
                      type="button"
                      onClick={() => void copy(row.name)}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      {copied === row.name ? (
                        <>
                          <ClipboardCheck className="size-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        "Copy name"
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-neutral-600 leading-relaxed">{row.hint}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/30 px-4 py-3 text-xs text-neutral-700 leading-relaxed">
            <p className="font-medium text-neutral-900 mb-1">Current API base in this build</p>
            <code className="block font-mono text-[11px] break-all text-neutral-800">{apiBase}</code>
            {apiBase === "/api" && (
              <p className="mt-2 text-amber-900/90">
                Relative <code className="rounded bg-white px-1 font-mono">/api</code> only works when
                something serves your FastAPI app on the same origin. On Vercel static hosting, set{" "}
                <code className="rounded bg-white px-1 font-mono">VITE_API_BASE_URL</code> to your API
                origin and add that API URL to backend{" "}
                <code className="rounded bg-white px-1 font-mono">CORS_ORIGINS</code>.
              </p>
            )}
          </div>

          <a
            href="https://vercel.com/docs/projects/environment-variables"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-black underline-offset-2 hover:underline"
          >
            Vercel environment variables docs
            <ExternalLink className="size-4" strokeWidth={2} />
          </a>
        </div>
      </div>
    </div>
  );
}
