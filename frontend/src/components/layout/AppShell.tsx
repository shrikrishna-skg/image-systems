import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ImageUp,
  Settings,
  History,
  LogOut,
  Building2,
  Menu,
  X,
  Globe,
  Wand2,
} from "lucide-react";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import { useAuthStore } from "../../stores/authStore";
import SonarAmbient from "./SonarAmbient";
import { ImagesystemsLogo } from "../brand/ImagesystemsLogo";
import { BrandWordmark } from "../brand/BrandWordmark";

const storageOnlyShell = isStorageOnlyMode();

export default function AppShell() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const syncBodyScroll = () => {
      document.body.style.overflow = mq.matches && mobileNavOpen ? "hidden" : "";
    };
    syncBodyScroll();
    mq.addEventListener("change", syncBodyScroll);
    return () => {
      mq.removeEventListener("change", syncBodyScroll);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const navItems = [
    {
      path: "/",
      label: "Operations",
      hint: "Queue & pipeline",
      icon: ImageUp,
    },
    ...(!storageOnlyShell
      ? [
          {
            path: "/image-generation",
            label: "Image Generation",
            hint: "Describe · AI creates",
            icon: Wand2,
          } as const,
          {
            path: "/import-url",
            label: "Import URL",
            hint: "Scrape page images",
            icon: Globe,
          } as const,
        ]
      : []),
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

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-white text-neutral-900 lg:flex-row">
      {/* Mobile / small tablet: top bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
          aria-expanded={mobileNavOpen}
          aria-controls="app-sidebar"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>
        <div
          className="group flex min-w-0 flex-1 items-center justify-center gap-2"
          aria-label="Imagesystems by Multisystems"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-50 ring-1 ring-neutral-200">
            <ImagesystemsLogo className="h-7 w-7 transition-transform duration-200 motion-reduce:transition-none motion-reduce:group-hover:scale-100 group-hover:scale-110" decorative />
          </div>
          <BrandWordmark variant="compact" titleAs="div" className="min-w-0 shrink" />
        </div>
        <span className="w-11 shrink-0" aria-hidden />
      </header>

      {/* Drawer backdrop */}
      <div
        role="presentation"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 lg:hidden ${
          mobileNavOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!mobileNavOpen}
        onClick={closeMobileNav}
      />

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,90vw)] max-w-[100vw] flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-out motion-reduce:transition-none lg:static lg:z-0 lg:w-[17rem] lg:max-w-none lg:shrink-0 lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-end border-b border-neutral-200 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
          <button
            type="button"
            onClick={closeMobileNav}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100 hover:text-black"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="p-4 sm:p-5 border-b border-neutral-200 lg:border-b-neutral-200">
          <div className="group flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-50 ring-1 ring-neutral-200">
              <ImagesystemsLogo className="h-8 w-8 transition-transform duration-200 motion-reduce:transition-none motion-reduce:group-hover:scale-100 group-hover:scale-110" decorative />
            </div>
            <BrandWordmark variant="sidebar" titleAs="h1" />
          </div>
          <p className="mt-3 sm:mt-4 text-[11px] sm:text-xs leading-relaxed text-neutral-600">
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

        <nav className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {navItems.map(({ path, label, hint, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={closeMobileNav}
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

        <div className="p-3 sm:p-4 border-t border-neutral-200 bg-neutral-50/80 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!storageOnlyShell && (
            <a
              href="https://www.multisystems.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 block text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500 transition-colors hover:text-black"
            >
              Part of Multisystems
            </a>
          )}
          <div className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3">
            <Building2 className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <div className="min-w-0 text-xs text-neutral-600">
              <p className="font-medium text-black truncate text-sm font-data" title={user?.email}>
                {user?.email || "Operator"}
              </p>
              {user?.full_name ? (
                <p className="text-[11px] text-neutral-600 mt-0.5 truncate">{user.full_name}</p>
              ) : null}
              <p className="text-[11px] text-neutral-500 mt-1 font-data">
                {storageOnlyShell ? "Local session" : `${user?.images_processed ?? 0} assets lifetime`}
              </p>
            </div>
          </div>
          {!storageOnlyShell && isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                closeMobileNav();
                void handleLogout();
              }}
              className="mt-3 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50 hover:border-neutral-400"
            >
              <LogOut className="w-4 h-4" strokeWidth={2} aria-hidden />
              Log out
            </button>
          )}
        </div>
      </aside>

      <main className="relative flex min-h-0 flex-1 flex-col overflow-auto min-w-0 bg-white text-neutral-900 pb-[env(safe-area-inset-bottom)]">
        <Outlet />
        <SonarAmbient />
      </main>
    </div>
  );
}
