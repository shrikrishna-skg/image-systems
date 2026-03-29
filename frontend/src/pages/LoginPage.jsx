import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordInput } from "../components/ui/PasswordInput";
import { useAuthStore } from "../stores/authStore";
import { Building2 } from "lucide-react";
import { BrandWordmark } from "../components/brand/BrandWordmark";
import { ImagesystemsLogo } from "../components/brand/ImagesystemsLogo";
import { toast } from "sonner";
const localDevUi = import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true;
async function checkApiHealth() {
  const url = new URL("/api/health", window.location.origin).toString();
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 4e3);
  try {
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    clearTimeout(t);
    return false;
  }
}
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiUp, setApiUp] = useState(null);
  const { login, resetPasswordForEmail } = useAuthStore();
  const [resetSending, setResetSending] = useState(false);
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
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String(err.message) : "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email above first.");
      return;
    }
    setResetSending(true);
    try {
      await resetPasswordForEmail(email);
      toast.success("If that account exists, Supabase sent a reset link. Check your inbox.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String(err.message) : "Could not send reset email";
      toast.error(msg);
    } finally {
      setResetSending(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "flex min-h-[100dvh] min-h-screen items-center justify-center bg-white pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
    /* @__PURE__ */ jsxs("div", { className: "text-center mb-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center justify-center gap-3 mb-5", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-50 ring-1 ring-neutral-200", children: /* @__PURE__ */ jsx(ImagesystemsLogo, { className: "h-9 w-9", decorative: true }) }),
        /* @__PURE__ */ jsx(BrandWordmark, { variant: "hero", titleAs: "h1" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "text-neutral-600 text-sm leading-relaxed max-w-sm mx-auto flex items-start justify-center gap-2", children: [
        /* @__PURE__ */ jsx(Building2, { className: "w-4 h-4 text-black shrink-0 mt-0.5", strokeWidth: 2 }),
        /* @__PURE__ */ jsx("span", { children: "Sign in to save API keys, run cloud enhancement, and keep a history of listing-ready versions." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-8", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-black mb-6", children: "Sign in" }),
      !localDevUi && /* @__PURE__ */ jsxs("div", { className: "mb-5 rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-3 py-2.5 text-xs text-neutral-700 leading-relaxed", children: [
        /* @__PURE__ */ jsx("strong", { className: "text-neutral-900", children: "Hosted app" }),
        " uses",
        " ",
        /* @__PURE__ */ jsx("strong", { className: "text-neutral-900", children: "Supabase" }),
        " for accounts. If you only used this app locally before, create an account here first\u2014your local password is not reused. If email confirmation is on in Supabase, check your inbox before signing in."
      ] }),
      import.meta.env.DEV && localDevUi && apiUp === false && /* @__PURE__ */ jsxs(
        "div",
        {
          className: "mb-5 rounded-xl border border-red-300/90 bg-red-50 px-3 py-3 text-xs text-red-950 leading-relaxed",
          role: "alert",
          children: [
            /* @__PURE__ */ jsx("strong", { className: "text-red-950", children: "Backend not running" }),
            /* @__PURE__ */ jsxs("p", { className: "mt-2 text-red-900/95", children: [
              "This page proxies ",
              /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 font-mono", children: "/api" }),
              " to",
              " ",
              /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 font-mono", children: "127.0.0.1:8000" }),
              ". Nothing is listening there, so sign-in cannot work."
            ] }),
            /* @__PURE__ */ jsxs("p", { className: "mt-2 font-medium text-red-950", children: [
              "Fix: open a terminal at the ",
              /* @__PURE__ */ jsx("strong", { children: "repository root" }),
              " (folder with",
              " ",
              /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 font-mono", children: "package.json" }),
              ") and run:"
            ] }),
            /* @__PURE__ */ jsx("code", { className: "mt-2 block rounded-lg bg-white/90 px-3 py-2 font-mono text-[11px] text-red-950 border border-red-200", children: "npm run dev" }),
            /* @__PURE__ */ jsxs("p", { className: "mt-2 text-red-900/90", children: [
              "Or run ",
              /* @__PURE__ */ jsx("code", { className: "rounded bg-white/80 px-1 font-mono", children: "LOCAL_DEV_MODE=true npm run backend" }),
              " ",
              "here, then click",
              " ",
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "font-semibold underline underline-offset-2",
                  onClick: () => void checkApiHealth().then(setApiUp),
                  children: "Check again"
                }
              ),
              "."
            ] })
          ]
        }
      ),
      import.meta.env.DEV && localDevUi && apiUp === true && /* @__PURE__ */ jsxs("div", { className: "mb-5 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-950 leading-relaxed", children: [
        /* @__PURE__ */ jsx("strong", { className: "text-emerald-950", children: "API reachable" }),
        " \u2014 you can sign in below."
      ] }),
      import.meta.env.DEV && localDevUi && apiUp === null && /* @__PURE__ */ jsx("div", { className: "mb-5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600", children: "Checking API on port 8000\u2026" }),
      /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-neutral-700 mb-1", children: "Email" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "email",
              value: email,
              onChange: (e) => setEmail(e.target.value),
              className: "w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-black outline-none transition-colors",
              placeholder: "you@hotel.com",
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-neutral-700 mb-1", children: "Password" }),
          /* @__PURE__ */ jsx(
            PasswordInput,
            {
              value: password,
              onChange: (e) => setPassword(e.target.value),
              className: "w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-black outline-none transition-colors",
              placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
              autoComplete: "current-password",
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "submit",
            disabled: loading,
            className: "w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-all",
            children: loading ? "Signing in..." : "Sign in"
          }
        )
      ] }),
      !localDevUi && /* @__PURE__ */ jsx("p", { className: "mt-3 text-center text-sm", children: /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => void handleForgotPassword(),
          disabled: resetSending,
          className: "text-neutral-600 underline-offset-2 hover:underline hover:text-black disabled:opacity-50",
          children: resetSending ? "Sending\u2026" : "Forgot password?"
        }
      ) }),
      /* @__PURE__ */ jsxs("p", { className: "mt-6 text-center text-sm text-neutral-600", children: [
        "Don't have an account?",
        " ",
        /* @__PURE__ */ jsx(
          Link,
          {
            to: "/register",
            className: "text-black font-semibold underline-offset-2 hover:underline",
            children: "Create one"
          }
        )
      ] })
    ] })
  ] }) });
}
export {
  LoginPage as default
};
