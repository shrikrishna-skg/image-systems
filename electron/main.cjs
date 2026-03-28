"use strict";

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

/** Reuse one preview window so “Open again” refreshes the same Chromium window. */
let previewBrowserWindow = null;

function assertAllowedHttpUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  return u.href;
}

function createPreviewWindow(url) {
  if (previewBrowserWindow && !previewBrowserWindow.isDestroyed()) {
    previewBrowserWindow.loadURL(url);
    previewBrowserWindow.focus();
    return previewBrowserWindow;
  }

  previewBrowserWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 640,
    minHeight: 480,
    title: "Browser",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: true,
  });

  previewBrowserWindow.on("closed", () => {
    previewBrowserWindow = null;
  });

  previewBrowserWindow.loadURL(url);
  return previewBrowserWindow;
}

function createMainWindow() {
  const preloadPath = path.join(__dirname, "preload.cjs");

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Imagesystems",
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const devServer =
    process.env.ELECTRON_DEV_SERVER || "http://127.0.0.1:2020";
  const isDev = process.env.ELECTRON_DEV === "1" || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL(devServer).catch((err) => {
      console.error("[electron] Failed to load dev server:", devServer, err);
      mainWindow.loadURL("data:text/html,<h1>Start Vite first</h1><p>Run: <code>npm run dev --prefix frontend</code> (or <code>npm run dev</code> from repo root).</p>");
    });
    if (process.env.ELECTRON_DEV === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    const indexHtml = path.join(__dirname, "..", "frontend", "dist", "index.html");
    mainWindow.loadFile(indexHtml).catch((err) => {
      console.error("[electron] Failed to load built app:", err);
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const href = assertAllowedHttpUrl(url);
      createPreviewWindow(href);
    } catch {
      /* ignore */
    }
    return { action: "deny" };
  });

  return mainWindow;
}

ipcMain.handle("chromium-window:open", async (_event, rawUrl) => {
  try {
    const url = assertAllowedHttpUrl(rawUrl);
    createPreviewWindow(url);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
