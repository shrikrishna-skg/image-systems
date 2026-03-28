"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("iepElectron", {
  isElectron: true,
  /**
   * Opens URL in a separate Chromium BrowserWindow (same engine as Electron).
   * @param {string} url
   * @returns {Promise<{ ok: boolean; error?: string }>}
   */
  openChromiumWindow(url) {
    return ipcRenderer.invoke("chromium-window:open", url);
  },
});
