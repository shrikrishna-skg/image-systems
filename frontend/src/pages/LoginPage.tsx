import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { Sparkles, Building2 } from "lucide-react";
import { toast } from "sonner";

const localDevUi =
  import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true;

async function checkApiHealth(): Promise<boolean> {
  const url = new URL("/api/health", window.location.origin).toString();
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 4000);
  try {
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    clearTimeout(t);
    return false;
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiUp, setApiUp] = useState<boolean | null>(null);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!import.meta.env.DEV || !localDevUi) return;
    let cancelled = false;
    void (async () => {
      const ok = await checkApiHealth();
      if (!cancelled) setApiUp(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 mb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white ring-1 ring-black/10">
              <Sparkles className="w-6 h-6" strokeWidth={2} />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-semibold tracking-tight text-black">ImageEnhance Pro</h1>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mt-0.5">
                Listing studio
              </p>
            </div>
          </div>
          <p className="text-neutral-600 text-sm leading-relaxed max-w-sm mx-auto flex items-start justify-center gap-2">
            <Building2 className="w-4 h-4 text-black shrink-0 mt-0.5" strokeWidth={2} />
            <span>
              Sign in to save API keys, run cloud enhancement, and keep a history of listing-ready
              versions.
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/90 p-8">
          <h2 className="text-lg font-semibold text-black mb-6">Sign in</h2>
          {!localDevUi && (
            <div className="mb-5 rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-3 py-2.5 text-xs text-neutral-700 leading-relaxed">
              <strong className="text-neutral-900">Hosted app</strong> uses{" "}
              <strong className="text-neutral-900">Supabase</strong> for accounts. If you only used
              this app locally before, create an account here first—your local password is not reused.
              If email confirmation is on in Supabase, check your inbox before signing in.
            </div>
          )}
          {import.meta.env.DEV && localDevUi && apiUp === false && (
            <div
              className="mb-5 rounded-xl border border-red-300/90 bg-red-50 px-3 py-3 text-xs text-red-950 leading-relaxed"
              role="alert"
            >
              <strong className="text-red-950">Backend not running</strong>
              <p className="mt-2 text-red-900/95">
                This page proxies <code className="rounded bg-white/90 px-1 font-mono">/api</code> to{" "}
                <code className="rounded bg-white/90 px-1 font-mono">127.0.0.1:8000</code>. Nothing is
                listening there, so sign-in cannot work.
              </p>
              <p className="mt-2 font-medium text-red-950">
                Fix: open a terminal at the <strong>repository root</strong> (folder with{" "}
                <code className="rounded bg-white/90 px-1 font-mono">package.json</code>) and run:
              </p>
              <code className="mt-2 block rounded-lg bg-white/90 px-3 py-2 font-mono text-[11px] text-red-950 border border-red-200">
                npm run dev
              </code>
              <p className="mt-2 text-red-900/90">
                Or run <code className="rounded bg-white/80 px-1 font-mono">LOCAL_DEV_MODE=true npm run backend</code>{" "}
                here, then click{" "}
                <button
                  type="button"
                  className="font-semibold underline underline-offset-2"
                  onClick={() => void checkApiHealth().then(setApiUp)}
                >
                  Check again
                </button>
                .
              </p>
            </div>
          )}
          {import.meta.env.DEV && localDevUi && apiUp === true && (
            <div className="mb-5 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-950 leading-relaxed">
              <strong className="text-emerald-950">API reachable</strong> — you can sign in below.
            </div>
          )}
          {import.meta.env.DEV && localDevUi && apiUp === null && (
            <div className="mb-5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600">
              Checking API on port 8000…
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-black outline-none transition-colors"
                placeholder="you@hotel.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-black outline-none transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-all"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-neutral-600">
            Don&apos;t have an account?{" "}
            <Link
              to="/register"
              className="text-black font-semibold underline-offset-2 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
