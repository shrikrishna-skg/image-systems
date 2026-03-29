import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import AppShell from "./components/layout/AppShell";
import FullscreenExitPortal from "./components/media/FullscreenExitPortal";
import { isStorageOnlyMode } from "./lib/storageOnlyMode";
import {
  isSupabaseAuthMisconfigured,
  supabase,
  usesLocalOrStorageAuth
} from "./lib/supabase";
import DeploymentConfigPage from "./pages/DeploymentConfigPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useAuthStore } from "./stores/authStore";
import { useAdaptiveExperienceStore } from "./stores/adaptiveExperienceStore";
import { useImageStore } from "./stores/imageStore";
import { useServerPolicyStore } from "./stores/serverPolicyStore";
import { isPlaceholderApiBaseUrl } from "./lib/apiBase";
import { useMediaQuery } from "./hooks/useMediaQuery";
const storageOnlyApp = isStorageOnlyMode();
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const ImportFromUrlPage = lazy(() => import("./pages/ImportFromUrlPage"));
const ImageGenerationPage = lazy(() => import("./pages/ImageGenerationPage"));
const KnowledgeCatalogPage = lazy(() => import("./pages/KnowledgeCatalogPage"));
function RouteFallback() {
  return /* @__PURE__ */ jsx("div", { className: "min-h-[40vh] flex items-center justify-center", children: /* @__PURE__ */ jsx(Loader2, { className: "w-8 h-8 animate-spin text-black", "aria-hidden": true }) });
}
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen flex items-center justify-center", children: /* @__PURE__ */ jsx(Loader2, { className: "w-8 h-8 animate-spin text-black" }) });
  }
  if (!isAuthenticated) {
    return /* @__PURE__ */ jsx(Navigate, { to: "/login", replace: true });
  }
  return /* @__PURE__ */ jsx(Fragment, { children });
}
function App() {
  const { loadUser, isAuthenticated } = useAuthStore();
  const deploymentBlocked = isSupabaseAuthMisconfigured();
  const narrowToasts = useMediaQuery("(max-width: 639px)");
  useEffect(() => {
    if (!deploymentBlocked) loadUser();
  }, [loadUser, deploymentBlocked]);
  useEffect(() => {
    if (deploymentBlocked) return;
    if (usesLocalOrStorageAuth || isSupabaseAuthMisconfigured()) return;
    const stripAuthHashIfPresent = () => {
      const h = window.location.hash;
      if (!h || h.length < 2) return;
      if (h.includes("access_token=") || h.includes("error=") || h.includes("type=signup") || h.includes("type=recovery") || h.includes("type=magiclink")) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
    };
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session) {
        void useAuthStore.getState().loadUser();
        stripAuthHashIfPresent();
      }
    });
    return () => subscription.unsubscribe();
  }, [deploymentBlocked]);
  useEffect(() => {
    const tier = useAdaptiveExperienceStore.getState().experienceTier;
    useImageStore.getState().applyPipelineExperienceTier(tier);
  }, []);
  useEffect(() => {
    if (deploymentBlocked || storageOnlyApp) return;
    void useServerPolicyStore.getState().fetchPolicy();
  }, [deploymentBlocked]);
  if (deploymentBlocked) {
    return /* @__PURE__ */ jsx(DeploymentConfigPage, {});
  }
  return /* @__PURE__ */ jsxs(BrowserRouter, { children: [
    !storageOnlyApp && isPlaceholderApiBaseUrl() && /* @__PURE__ */ jsxs(
      "div",
      {
        role: "alert",
        className: "border-b border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs sm:text-sm text-amber-950 sm:px-4",
        children: [
          /* @__PURE__ */ jsx("strong", { className: "font-semibold", children: "API URL not configured." }),
          " ",
          /* @__PURE__ */ jsxs("span", { className: "text-amber-900", children: [
            "Vercel still has a placeholder ",
            /* @__PURE__ */ jsx("code", { className: "rounded bg-amber-100/80 px-1", children: "VITE_API_BASE_URL" }),
            ". Set it to your deployed API origin (ending in ",
            /* @__PURE__ */ jsx("code", { className: "rounded bg-amber-100/80 px-1", children: "/api" }),
            "), then redeploy."
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx(FullscreenExitPortal, {}),
    /* @__PURE__ */ jsx(
      Toaster,
      {
        position: narrowToasts ? "bottom-center" : "bottom-right",
        theme: "light",
        richColors: false,
        closeButton: true,
        offset: narrowToasts ? 12 : 20,
        gap: 12,
        visibleToasts: 4,
        toastOptions: {
          unstyled: true,
          duration: 3500,
          classNames: {
            toast: "group pointer-events-auto relative flex h-[7.5rem] min-h-[7.5rem] max-h-[7.5rem] w-[min(20rem,calc(100vw-2rem))] min-w-0 shrink-0 flex-row items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/95 py-3 pl-10 pr-4 shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/80",
            content: "flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden pr-1",
            title: "line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-neutral-900 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Segoe_UI',system-ui,sans-serif]",
            description: "line-clamp-2 text-[13px] leading-snug text-neutral-600 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Segoe_UI',system-ui,sans-serif]",
            success: "!border-black/[0.06] !bg-white/95 supports-[backdrop-filter]:!bg-white/80",
            error: "!border-black/[0.06] !bg-white/95 supports-[backdrop-filter]:!bg-white/80",
            warning: "!border-black/[0.06] !bg-white/95 supports-[backdrop-filter]:!bg-white/80",
            info: "!border-black/[0.06] !bg-white/95 supports-[backdrop-filter]:!bg-white/80",
            loading: "!border-black/[0.06] !bg-white/95 supports-[backdrop-filter]:!bg-white/80",
            default: "!border-black/[0.06] !bg-white/95 supports-[backdrop-filter]:!bg-white/80",
            closeButton: "absolute left-2 top-2 z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-[17px] font-light leading-none text-neutral-400 antialiased transition-[color,background-color,transform] duration-150 hover:bg-black/[0.05] hover:text-neutral-800 active:scale-95",
            icon: "size-[22px] shrink-0 self-center text-neutral-900 [&_svg]:text-neutral-900"
          }
        }
      }
    ),
    /* @__PURE__ */ jsxs(Routes, { children: [
      /* @__PURE__ */ jsx(
        Route,
        {
          path: "/login",
          element: storageOnlyApp ? /* @__PURE__ */ jsx(Navigate, { to: "/", replace: true }) : isAuthenticated ? /* @__PURE__ */ jsx(Navigate, { to: "/", replace: true }) : /* @__PURE__ */ jsx(LoginPage, {})
        }
      ),
      /* @__PURE__ */ jsx(
        Route,
        {
          path: "/register",
          element: storageOnlyApp ? /* @__PURE__ */ jsx(Navigate, { to: "/", replace: true }) : isAuthenticated ? /* @__PURE__ */ jsx(Navigate, { to: "/", replace: true }) : /* @__PURE__ */ jsx(RegisterPage, {})
        }
      ),
      /* @__PURE__ */ jsxs(
        Route,
        {
          path: "/",
          element: /* @__PURE__ */ jsx(ProtectedRoute, { children: /* @__PURE__ */ jsx(AppShell, {}) }),
          children: [
            /* @__PURE__ */ jsx(
              Route,
              {
                index: true,
                element: /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx(RouteFallback, {}), children: /* @__PURE__ */ jsx(DashboardPage, {}) })
              }
            ),
            /* @__PURE__ */ jsx(
              Route,
              {
                path: "settings",
                element: /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx(RouteFallback, {}), children: /* @__PURE__ */ jsx(SettingsPage, {}) })
              }
            ),
            /* @__PURE__ */ jsx(
              Route,
              {
                path: "history",
                element: /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx(RouteFallback, {}), children: /* @__PURE__ */ jsx(HistoryPage, {}) })
              }
            ),
            /* @__PURE__ */ jsx(
              Route,
              {
                path: "import-url",
                element: /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx(RouteFallback, {}), children: /* @__PURE__ */ jsx(ImportFromUrlPage, {}) })
              }
            ),
            /* @__PURE__ */ jsx(
              Route,
              {
                path: "image-generation",
                element: /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx(RouteFallback, {}), children: /* @__PURE__ */ jsx(ImageGenerationPage, {}) })
              }
            ),
            /* @__PURE__ */ jsx(
              Route,
              {
                path: "knowledge",
                element: /* @__PURE__ */ jsx(Suspense, { fallback: /* @__PURE__ */ jsx(RouteFallback, {}), children: /* @__PURE__ */ jsx(KnowledgeCatalogPage, {}) })
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsx(Route, { path: "*", element: /* @__PURE__ */ jsx(Navigate, { to: "/", replace: true }) })
    ] })
  ] });
}
var stdin_default = App;
export {
  stdin_default as default
};
