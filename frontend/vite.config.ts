import { defineConfig, loadEnv, type ConfigEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Loud hint when only Vite is running (e.g. `cd frontend && npm run dev`). */
function warnIfApiUnreachable(apiOrigin: string): Plugin {
  const base = apiOrigin.replace(/\/$/, "");
  return {
    name: "warn-if-api-unreachable",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        void (async () => {
          const url = `${base}/api/health`;
          const ac = new AbortController();
          const t = setTimeout(() => ac.abort(), 3000);
          try {
            const res = await fetch(url, { signal: ac.signal });
            clearTimeout(t);
            if (res.ok) {
              console.info(`[vite] API OK (${url})`);
            } else {
              console.warn(`[vite] API responded ${res.status} at ${url}`);
            }
          } catch {
            clearTimeout(t);
            const box = [
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "  No backend on port 8000 — /api returns 502 (login & keys will fail).",
              "",
              "  Fix: from the REPO ROOT run:  npm run dev",
              "       (starts API + Vite together). First time: npm run setup:backend",
              "",
              "  Or two terminals:  LOCAL_DEV_MODE=true npm run backend",
              "                    npm run dev:web",
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            ].join("\n");
            console.warn("\n\x1b[33m" + box + "\x1b[0m\n");
          }
        })();
      });
    },
  };
}

export default defineConfig(({ mode }: ConfigEnv) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget =
    process.env.API_PROXY_TARGET || env.API_PROXY_TARGET || "http://127.0.0.1:8000";

  const longTimeout = 600_000; // 10m — large image uploads through the dev proxy

  const logProxyError = (route: string, err: Error & { code?: string }) => {
    const code = err?.code ? ` (${err.code})` : "";
    console.error(`[vite proxy ${route}]${code}`, err?.message || err);
    if (err?.code === "ECONNREFUSED") {
      console.error(
        "[vite proxy] Start the API: from repo root run `npm run dev` (api + web) or `npm run backend` in another terminal."
      );
    }
  };

  return {
    plugins: [react(), tailwindcss(), warnIfApiUnreachable(apiProxyTarget)],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
            if (id.includes("react-router")) return "router";
          },
        },
      },
    },
    server: {
      port: Number(process.env.PORT || process.env.VITE_DEV_PORT || 2020),
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          timeout: longTimeout,
          proxyTimeout: longTimeout,
          configure(proxy) {
            proxy.on("error", (err) => logProxyError("/api", err as Error & { code?: string }));
          },
        },
        "/uploads": {
          target: apiProxyTarget,
          changeOrigin: true,
          timeout: longTimeout,
          proxyTimeout: longTimeout,
          configure(proxy) {
            proxy.on("error", (err) => logProxyError("/uploads", err as Error & { code?: string }));
          },
        },
      },
    },
  };
});
