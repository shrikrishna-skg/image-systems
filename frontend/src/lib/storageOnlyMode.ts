/**
 * Browser-only: IndexedDB + canvas — no FastAPI.
 *
 * - Development: defaults to true so `cd frontend && npm run dev` works without port 8000.
 * - Opt into API: set VITE_USE_API=true or VITE_STORAGE_ONLY=false (see npm run dev:full).
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
