/**
 * In the Electron desktop app, opens `url` in a dedicated Chromium BrowserWindow.
 * In a normal browser, opens a new tab.
 */
export function isElectronShell(): boolean {
  return typeof window !== "undefined" && window.iepElectron?.isElectron === true;
}

export async function openExternalUrl(url: string): Promise<void> {
  const api = typeof window !== "undefined" ? window.iepElectron : undefined;
  if (api?.openChromiumWindow) {
    const r = await api.openChromiumWindow(url);
    if (!r.ok) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
