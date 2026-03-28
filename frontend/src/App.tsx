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
  usesLocalOrStorageAuth,
} from "./lib/supabase";
import DeploymentConfigPage from "./pages/DeploymentConfigPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useAuthStore } from "./stores/authStore";
import { useAdaptiveExperienceStore } from "./stores/adaptiveExperienceStore";
import { useImageStore } from "./stores/imageStore";
import { useServerPolicyStore } from "./stores/serverPolicyStore";
import { isPlaceholderApiBaseUrl } from "./lib/apiBase";

const storageOnlyApp = isStorageOnlyMode();

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const ImportFromUrlPage = lazy(() => import("./pages/ImportFromUrlPage"));
const ImageGenerationPage = lazy(() => import("./pages/ImageGenerationPage"));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-black" aria-hidden />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { loadUser, isAuthenticated } = useAuthStore();
  const deploymentBlocked = isSupabaseAuthMisconfigured();

  useEffect(() => {
    if (!deploymentBlocked) loadUser();
  }, [loadUser, deploymentBlocked]);

  /** After email confirmation / magic link, Supabase puts tokens in the URL hash — sync session and strip the hash. */
  useEffect(() => {
    if (deploymentBlocked) return;
    if (usesLocalOrStorageAuth || isSupabaseAuthMisconfigured()) return;

    const stripAuthHashIfPresent = () => {
      const h = window.location.hash;
      if (!h || h.length < 2) return;
      if (
        h.includes("access_token=") ||
        h.includes("error=") ||
        h.includes("type=signup") ||
        h.includes("type=recovery") ||
        h.includes("type=magiclink")
      ) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
    };

    const {
      data: { subscription },
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
    return <DeploymentConfigPage />;
  }

  return (
    <BrowserRouter>
      {!storageOnlyApp && isPlaceholderApiBaseUrl() && (
        <div
          role="alert"
          className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs sm:text-sm text-amber-950 sm:px-4"
        >
          <strong className="font-semibold">API URL not configured.</strong>{" "}
          <span className="text-amber-900">
            Vercel still has a placeholder <code className="rounded bg-amber-100/80 px-1">VITE_API_BASE_URL</code>
            . Set it to your deployed API origin (ending in <code className="rounded bg-amber-100/80 px-1">/api</code>
            ), then redeploy.
          </span>
        </div>
      )}
      <FullscreenExitPortal />
      <Toaster
        position="bottom-right"
        theme="light"
        richColors={false}
        closeButton
        offset={20}
        gap={12}
        visibleToasts={4}
        toastOptions={{
          unstyled: true,
          duration: 1000,
          classNames: {
            toast:
              "group pointer-events-auto flex w-[min(94vw,28rem)] items-start gap-4 rounded-[18px] border border-black/[0.08] bg-white p-5 pr-12 shadow-none",
            title:
              "text-[15px] font-semibold leading-snug tracking-[-0.015em] text-neutral-900 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Segoe_UI',system-ui,sans-serif]",
            description:
              "text-[13px] leading-[1.45] text-black mt-1.5 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Segoe_UI',system-ui,sans-serif]",
            success: "!border-black/15 !bg-white",
            error: "!border-black/15 !bg-white",
            warning: "!border-black/15 !bg-white",
            info: "!border-black/15 !bg-white",
            loading: "!border-black/15 !bg-white",
            default: "!border-black/15 !bg-white",
            closeButton:
              "absolute right-3 top-3 h-8 w-8 border-0 bg-black/[0.06] text-neutral-600 hover:text-black hover:bg-black/[0.1] rounded-full transition-colors",
            icon: "mt-0.5 size-[22px] text-neutral-900 [&_svg]:text-neutral-900",
          },
        }}
      />
      <Routes>
        <Route
          path="/login"
          element={
            storageOnlyApp ? (
              <Navigate to="/" replace />
            ) : isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route
          path="/register"
          element={
            storageOnlyApp ? (
              <Navigate to="/" replace />
            ) : isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <RegisterPage />
            )
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<RouteFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<RouteFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route
            path="history"
            element={
              <Suspense fallback={<RouteFallback />}>
                <HistoryPage />
              </Suspense>
            }
          />
          <Route
            path="import-url"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ImportFromUrlPage />
              </Suspense>
            }
          />
          <Route
            path="image-generation"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ImageGenerationPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
