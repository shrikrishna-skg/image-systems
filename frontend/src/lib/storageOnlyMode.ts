/**
 * Browser-only: IndexedDB + canvas — no FastAPI.
 *
 * - Development: `frontend/.env.development` sets VITE_USE_API=true so Settings and jobs use the API.
 *   For browser-only dev, add `.env.development.local` with VITE_USE_API=false and VITE_STORAGE_ONLY=true.
 * - Production: defaults to false (relative /api) unless VITE_STORAGE_ONLY=true.
 */
export function isStorageOnlyMode(): boolean {
  if (import.meta.env.VITE_USE_API === "true" || import.meta.env.VITE_USE_API === true) {
    return false;
  }
  if (import.meta.env.VITE_STORAGE_ONLY === "false" || import.meta.env.VITE_STORAGE_ONLY === false) {
    return false;
  }
  if (import.meta.env.VITE_STORAGE_ONLY === "true" || import.meta.env.VITE_STORAGE_ONLY === true) {
    return true;
  }
  if (import.meta.env.DEV) {
    return true;
  }
  return false;
}
