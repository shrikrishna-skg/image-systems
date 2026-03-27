import { Link, Outlet, useLocation } from "react-router-dom";
import { ImageUp, Settings, History, LogOut, Sparkles, Building2 } from "lucide-react";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import { useAuthStore } from "../../stores/authStore";
import SonarAmbient from "./SonarAmbient";

const storageOnlyShell = isStorageOnlyMode();

export default function AppShell() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const navItems = [
    {
      path: "/",
      label: "Operations",
      hint: "Queue & pipeline",
      icon: ImageUp,
    },
    {
      path: "/history",
      label: "Archive",
      hint: "Deliverables",
      icon: History,
    },
    {
      path: "/settings",
      label: "Integrations",
      hint: "Model keys",
      icon: Settings,
    },
  ];

  return (
    <div className="flex h-screen bg-white text-neutral-900">
      <aside className="w-[17rem] shrink-0 flex flex-col border-r border-neutral-200 bg-white">
        <div className="p-5 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white ring-1 ring-black/10">
              <Sparkles className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-black leading-tight">
                ImageEnhance Pro
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500 mt-1">
                Enterprise
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-neutral-600">
            {storageOnlyShell ? (
              <>
                <span className="text-black font-medium">Isolated region.</span> No egress—batch work stays on
                this machine for security review.
              </>
            ) : (
              <>
                <span className="text-black font-medium">Production imagery.</span> Queue-scale processing for
                portfolios, campaigns, and channel syndication.
              </>
            )}
          </p>
          {storageOnlyShell && (
            <span className="mt-3 inline-flex items-center rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-black font-data">
              AIR-GAPPED
            </span>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ path, label, hint, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                  isActive
                    ? "bg-black text-white font-medium"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-black"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    isActive
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-neutral-200 bg-white text-neutral-500"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                </span>
                <span className="flex flex-col items-start gap-0 min-w-0">
                  <span>{label}</span>
                  <span
                    className={`text-[10px] font-normal font-data ${isActive ? "text-white/70" : "text-neutral-500"}`}
                  >
                    {hint}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-200 bg-neutral-50/80">
          <div className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3">
            <Building2 className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <div className="min-w-0 text-xs text-neutral-600">
              <p className="font-medium text-black truncate text-sm">
                {user?.full_name || user?.email || "Operator"}
              </p>
              <p className="text-[11px] text-neutral-500 mt-1 font-data">
                {storageOnlyShell ? "Local session" : `${user?.images_processed ?? 0} assets lifetime`}
              </p>
            </div>
          </div>
          {!storageOnlyShell && (
            <button
              type="button"
              onClick={logout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-semibold text-neutral-500 hover:bg-neutral-200/80 hover:text-black transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              End session
            </button>
          )}
        </div>
      </aside>

      <main className="relative flex-1 overflow-auto min-w-0 bg-white text-neutral-900">
        <Outlet />
        <SonarAmbient />
      </main>
    </div>
  );
}
