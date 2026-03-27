import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import AppShell from "./components/layout/AppShell";
import FullscreenExitPortal from "./components/media/FullscreenExitPortal";
import { isStorageOnlyMode } from "./lib/storageOnlyMode";
import { isSupabaseAuthMisconfigured } from "./lib/supabase";
import DeploymentConfigPage from "./pages/DeploymentConfigPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useAuthStore } from "./stores/authStore";
import { useAdaptiveExperienceStore } from "./stores/adaptiveExperienceStore";
import { useImageStore } from "./stores/imageStore";

const storageOnlyApp = isStorageOnlyMode();

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));

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

  useEffect(() => {
    const tier = useAdaptiveExperienceStore.getState().experienceTier;
    useImageStore.getState().applyPipelineExperienceTier(tier);
  }, []);

  if (deploymentBlocked) {
    return <DeploymentConfigPage />;
  }

  return (
    <BrowserRouter>
      <FullscreenExitPortal />
      <Toaster
        position="bottom-right"
        theme="light"
        closeButton
        offset={24}
        gap={14}
        visibleToasts={4}
        toastOptions={{
          duration: 5000,
          classNames: {
            toast:
              "group pointer-events-auto flex w-[min(94vw,28rem)] items-start gap-4 rounded-[20px] border border-black/[0.08] bg-white/85 p-5 pr-12 !shadow-none backdrop-blur-2xl backdrop-saturate-[180%]",
            title:
              "text-[15px] font-semibold leading-snug tracking-[-0.015em] text-neutral-900 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Segoe_UI',system-ui,sans-serif]",
            description:
              "text-[13px] leading-[1.45] text-neutral-600 mt-1.5 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Segoe_UI',system-ui,sans-serif]",
            success: "!border-emerald-400/35 !bg-emerald-50/50",
            error: "!border-red-400/35 !bg-red-50/45",
            warning: "!border-amber-400/35 !bg-amber-50/45",
            closeButton:
              "absolute right-3 top-3 h-8 w-8 border-0 bg-black/[0.04] text-neutral-500 hover:text-neutral-900 hover:bg-black/[0.07] rounded-full transition-colors",
            icon: "mt-0.5 size-[22px]",
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
