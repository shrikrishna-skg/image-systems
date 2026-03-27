import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { Sparkles, Building2 } from "lucide-react";
import { toast } from "sonner";

const localDevUi =
  import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true;

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, fullName || undefined);
      navigate("/settings");
      toast.success("Account created! Add your API keys to get started.");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Registration failed";
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
              Create an account, add your model keys in Settings, and ship brighter property photos
              across channels.
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/90 p-8">
          <h2 className="text-lg font-semibold text-black mb-6">Create account</h2>
          {import.meta.env.DEV && localDevUi && (
            <div className="mb-5 rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950 leading-relaxed">
              <strong className="text-amber-950">Local API</strong> — start the backend on port{" "}
              <code className="rounded bg-white/90 px-1 font-mono">8000</code> (
              <code className="rounded bg-white/90 px-1 font-mono">npm run dev</code> from repo root).
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-black outline-none transition-colors"
                placeholder="Alex Rivera"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-black outline-none transition-colors"
                placeholder="you@brand.com"
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
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-all"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-neutral-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-black font-semibold underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
