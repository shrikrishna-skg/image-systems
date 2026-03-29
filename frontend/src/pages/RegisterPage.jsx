import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PasswordInput } from "../components/ui/PasswordInput";
import { EmailConfirmationPendingError } from "../lib/supabaseAuthErrors";
import { useAuthStore } from "../stores/authStore";
import { Building2 } from "lucide-react";
import { BrandWordmark } from "../components/brand/BrandWordmark";
import { ImagesystemsLogo } from "../components/brand/ImagesystemsLogo";
import { toast } from "sonner";
const localDevUi = import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true;
function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, fullName || void 0);
      navigate("/settings");
      toast.success("Account created! Add your API keys to get started.");
    } catch (err) {
      if (err instanceof EmailConfirmationPendingError) {
        toast.success(
          `We sent a confirmation link to ${err.email}. Open it, then sign in on the login page.`
        );
        navigate("/login");
        return;
      }
      const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String(err.message) : "Registration failed";
      toast.error(msg);
    } finally {
      setLoading(false);
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
        /* @__PURE__ */ jsx("span", { children: "Create an account, add your model keys in Settings, and ship brighter property photos across channels." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-8", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-black mb-6", children: "Create account" }),
      import.meta.env.DEV && localDevUi && /* @__PURE__ */ jsxs("div", { className: "mb-5 rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950 leading-relaxed", children: [
        /* @__PURE__ */ jsx("strong", { className: "text-amber-950", children: "Local API" }),
        " \u2014 start the backend on port",
        " ",
        /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 font-mono", children: "8000" }),
        " (",
        /* @__PURE__ */ jsx("code", { className: "rounded bg-white/90 px-1 font-mono", children: "npm run dev" }),
        " from repo root)."
      ] }),
      /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-neutral-700 mb-1", children: "Full name" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: fullName,
              onChange: (e) => setFullName(e.target.value),
              className: "w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-black outline-none transition-colors",
              placeholder: "Alex Rivera"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-neutral-700 mb-1", children: "Email" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "email",
              value: email,
              onChange: (e) => setEmail(e.target.value),
              className: "w-full px-4 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-black outline-none transition-colors",
              placeholder: "you@brand.com",
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
              placeholder: "At least 6 characters",
              minLength: 6,
              autoComplete: "new-password",
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
            children: loading ? "Creating account..." : "Create account"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "mt-6 text-center text-sm text-neutral-600", children: [
        "Already have an account?",
        " ",
        /* @__PURE__ */ jsx(
          Link,
          {
            to: "/login",
            className: "text-black font-semibold underline-offset-2 hover:underline",
            children: "Sign in"
          }
        )
      ] })
    ] })
  ] }) });
}
export {
  RegisterPage as default
};
