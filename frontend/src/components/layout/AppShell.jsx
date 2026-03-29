import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  BookMarked
} from "lucide-react";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import { useAuthStore } from "../../stores/authStore";
import { useImageStore } from "../../stores/imageStore";
import { useNavIntegrationStatus } from "../../hooks/useNavIntegrationStatus";
import SonarAmbient from "./SonarAmbient";
import { ImagesystemsLogo } from "../brand/ImagesystemsLogo";
import { BrandWordmark } from "../brand/BrandWordmark";
const storageOnlyShell = isStorageOnlyMode();
function AppShell() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navIntegration = useNavIntegrationStatus();
  const currentJob = useImageStore((s) => s.currentJob);
  const jobActive = !!currentJob && (currentJob.status === "processing" || currentJob.status === "pending");
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
    { path: "/", label: "Operations", hint: "Single or bulk photos", icon: ImageUp },
    ...!storageOnlyShell ? [
      {
        path: "/image-generation",
        label: "Image Generation",
        hint: "Type a prompt, get a photo",
        icon: Wand2
      },
      {
        path: "/import-url",
        label: "Import URL",
        hint: "Pull images from any website",
        icon: Globe
      },
      {
        path: "/knowledge",
        label: "Scenario library",
        hint: "Enhancement QA catalog & rules",
        icon: BookMarked
      }
    ] : [],
    { path: "/history", label: "Deliverables", hint: "Past exports & history", icon: History },
    { path: "/settings", label: "Integrations", hint: "API keys & workspace", icon: Settings }
  ];
  const closeMobileNav = () => setMobileNavOpen(false);
  return /* @__PURE__ */ jsxs("div", { className: "flex h-[100dvh] min-h-0 flex-col bg-white text-neutral-900 lg:flex-row", children: [
    /* @__PURE__ */ jsx(
      "a",
      {
        href: "#main-content",
        className: "pointer-events-auto fixed left-3 top-3 z-[200] -translate-y-[140%] rounded-xl border border-white/20 bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-lg opacity-0 transition-[transform,opacity] duration-200 focus:translate-y-0 focus:opacity-100 focus:outline-none motion-reduce:transition-none",
        onClick: (e) => {
          e.preventDefault();
          const el = document.getElementById("main-content");
          el?.focus();
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        children: "Skip to main content"
      }
    ),
    /* @__PURE__ */ jsxs("header", { className: "flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] lg:hidden", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => setMobileNavOpen(true),
          className: "flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50",
          "aria-expanded": mobileNavOpen,
          "aria-controls": "app-sidebar",
          "aria-label": "Open menu",
          children: /* @__PURE__ */ jsx(Menu, { className: "h-5 w-5", strokeWidth: 2 })
        }
      ),
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: "group flex min-w-0 flex-1 items-center justify-center gap-2",
          "aria-label": "Imagesystems by Multisystems",
          children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-50 ring-1 ring-neutral-200", children: /* @__PURE__ */ jsx(ImagesystemsLogo, { className: "h-7 w-7 transition-transform duration-200 motion-reduce:transition-none motion-reduce:group-hover:scale-100 group-hover:scale-110", decorative: true }) }),
            /* @__PURE__ */ jsx(BrandWordmark, { variant: "compact", titleAs: "div", className: "min-w-0 shrink" })
          ]
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "w-11 shrink-0", "aria-hidden": true })
    ] }),
    /* @__PURE__ */ jsx(
      "div",
      {
        role: "presentation",
        className: `fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 lg:hidden ${mobileNavOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`,
        "aria-hidden": !mobileNavOpen,
        onClick: closeMobileNav
      }
    ),
    /* @__PURE__ */ jsxs(
      "aside",
      {
        id: "app-sidebar",
        className: `fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,90vw)] max-w-[100vw] flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-out motion-reduce:transition-none lg:static lg:z-0 lg:w-[17rem] lg:max-w-none lg:shrink-0 lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`,
        children: [
          /* @__PURE__ */ jsx("div", { className: "flex items-center justify-end border-b border-neutral-200 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden", children: /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: closeMobileNav,
              className: "flex h-10 w-10 items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100 hover:text-black",
              "aria-label": "Close menu",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5", strokeWidth: 2 })
            }
          ) }),
          /* @__PURE__ */ jsxs("div", { className: "p-4 sm:p-5 border-b border-neutral-200 lg:border-b-neutral-200", children: [
            /* @__PURE__ */ jsxs("div", { className: "group flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-50 ring-1 ring-neutral-200", children: /* @__PURE__ */ jsx(ImagesystemsLogo, { className: "h-8 w-8 transition-transform duration-200 motion-reduce:transition-none motion-reduce:group-hover:scale-100 group-hover:scale-110", decorative: true }) }),
              /* @__PURE__ */ jsx(BrandWordmark, { variant: "sidebar", titleAs: "h1" })
            ] }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 sm:mt-4 text-[11px] sm:text-xs leading-relaxed text-neutral-600", children: storageOnlyShell ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { className: "text-black font-medium", children: "Isolated region." }),
              " No egress\u2014batch work stays on this machine for security review."
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { className: "text-black font-medium", children: "Production imagery." }),
              " Queue-scale processing for portfolios, campaigns, and channel syndication."
            ] }) }),
            storageOnlyShell && /* @__PURE__ */ jsx("span", { className: "mt-3 inline-flex items-center rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-black font-data", children: "AIR-GAPPED" })
          ] }),
          /* @__PURE__ */ jsx("nav", { className: "flex-1 overflow-y-auto overscroll-contain p-3 space-y-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]", children: navItems.map(({ path, label, hint, icon: Icon }) => {
            const isActive = location.pathname === path;
            const archiveCount = navIntegration.archiveCount;
            const showArchiveCount = path === "/history" && !storageOnlyShell && archiveCount != null && archiveCount > 0;
            const archiveCountLabel = showArchiveCount ? archiveCount > 499 ? "499+" : String(archiveCount) : null;
            const showIntegrationsDot = path === "/settings" && !storageOnlyShell && !navIntegration.loading;
            const integrationsOk = navIntegration.hasAnyProviderKey;
            const showProcessingPulse = path === "/" && !storageOnlyShell && jobActive;
            return /* @__PURE__ */ jsxs(
              Link,
              {
                to: path,
                onClick: closeMobileNav,
                className: `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${isActive ? "bg-black text-white font-medium" : "text-neutral-600 hover:bg-neutral-100 hover:text-black"}`,
                children: [
                  /* @__PURE__ */ jsx(
                    "span",
                    {
                      className: `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${isActive ? "border-white/20 bg-white/10 text-white" : "border-neutral-200 bg-white text-neutral-500"}`,
                      children: /* @__PURE__ */ jsx(Icon, { className: "w-[18px] h-[18px]", strokeWidth: 2 })
                    }
                  ),
                  /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 flex-1 flex-col items-start gap-0", children: [
                    /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 max-w-full items-center gap-2", children: [
                      /* @__PURE__ */ jsx("span", { className: "truncate", children: label }),
                      archiveCountLabel != null ? /* @__PURE__ */ jsx(
                        "span",
                        {
                          className: `shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold font-data tabular-nums ${isActive ? "bg-white/15 text-white" : "bg-neutral-200 text-neutral-700"}`,
                          title: "Saved deliverables (recent)",
                          children: archiveCountLabel
                        }
                      ) : null,
                      showProcessingPulse ? /* @__PURE__ */ jsxs(
                        "span",
                        {
                          className: "relative flex h-2 w-2 shrink-0",
                          title: "Processing in progress",
                          "aria-hidden": true,
                          children: [
                            /* @__PURE__ */ jsx("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60 motion-reduce:animate-none" }),
                            /* @__PURE__ */ jsx("span", { className: "relative inline-flex h-2 w-2 rounded-full bg-sky-500" })
                          ]
                        }
                      ) : null,
                      showIntegrationsDot ? /* @__PURE__ */ jsx(
                        "span",
                        {
                          className: `h-2 w-2 shrink-0 rounded-full ${integrationsOk ? "bg-emerald-500" : "bg-amber-500"}`,
                          title: integrationsOk ? "API key connected" : "Connect API key",
                          "aria-hidden": true
                        }
                      ) : null
                    ] }),
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: `text-[10px] font-normal font-data ${isActive ? "text-white/70" : "text-neutral-500"}`,
                        children: hint
                      }
                    )
                  ] })
                ]
              },
              path
            );
          }) }),
          !storageOnlyShell && jobActive ? /* @__PURE__ */ jsxs("div", { className: "mx-3 mb-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-snug text-sky-950", children: [
            /* @__PURE__ */ jsx("span", { className: "font-semibold", children: "Processing" }),
            " \u2014 open",
            " ",
            /* @__PURE__ */ jsx(Link, { to: "/", onClick: closeMobileNav, className: "font-semibold underline underline-offset-2 hover:text-sky-900", children: "Operations" }),
            " ",
            "to watch progress on the current job."
          ] }) : null,
          /* @__PURE__ */ jsxs("div", { className: "p-3 sm:p-4 border-t border-neutral-200 bg-neutral-50/80 pb-[max(1rem,env(safe-area-inset-bottom))]", children: [
            !storageOnlyShell && /* @__PURE__ */ jsx(
              "a",
              {
                href: "https://www.multisystems.ai/",
                target: "_blank",
                rel: "noopener noreferrer",
                className: "mb-3 block text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500 transition-colors hover:text-black",
                children: "Part of Multisystems"
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3", children: [
              /* @__PURE__ */ jsx(Building2, { className: "w-4 h-4 text-neutral-400 shrink-0 mt-0.5" }),
              /* @__PURE__ */ jsxs("div", { className: "min-w-0 text-xs text-neutral-600", children: [
                /* @__PURE__ */ jsx("p", { className: "font-medium text-black truncate text-sm font-data", title: user?.email, children: user?.email || "Operator" }),
                user?.full_name ? /* @__PURE__ */ jsx("p", { className: "text-[11px] text-neutral-600 mt-0.5 truncate", children: user.full_name }) : null,
                /* @__PURE__ */ jsx("p", { className: "text-[11px] text-neutral-500 mt-1 font-data", title: "Total photos processed on this account", children: storageOnlyShell ? "Local session" : `${user?.images_processed ?? 0} photos processed (all time)` })
              ] })
            ] }),
            !storageOnlyShell && isAuthenticated && /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => {
                  closeMobileNav();
                  void handleLogout();
                },
                className: "mt-3 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-neutral-50 hover:border-neutral-400",
                children: [
                  /* @__PURE__ */ jsx(LogOut, { className: "w-4 h-4", strokeWidth: 2, "aria-hidden": true }),
                  "Log out"
                ]
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      "main",
      {
        id: "main-content",
        tabIndex: -1,
        className: "relative flex min-h-0 flex-1 flex-col overflow-auto min-w-0 bg-white text-neutral-900 pb-[env(safe-area-inset-bottom)] outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        children: [
          /* @__PURE__ */ jsx(Outlet, {}),
          /* @__PURE__ */ jsx(SonarAmbient, {})
        ]
      }
    )
  ] });
}
export {
  AppShell as default
};
