function isStorageOnlyMode() {
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
export {
  isStorageOnlyMode
};
