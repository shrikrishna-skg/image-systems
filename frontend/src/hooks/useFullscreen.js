import { useCallback, useEffect, useState } from "react";
function useFullscreen(targetRef, options) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const matchDescendants = options?.matchDescendants ?? false;
  useEffect(() => {
    const sync = () => {
      const el = targetRef.current;
      const fs = document.fullscreenElement;
      const active = !!el && !!fs && (fs === el || matchDescendants && el.contains(fs));
      setIsFullscreen(active);
    };
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [targetRef, matchDescendants]);
  const enter = useCallback(async () => {
    const el = targetRef.current;
    if (!el || !el.requestFullscreen) return;
    try {
      await el.requestFullscreen();
    } catch {
    }
  }, [targetRef]);
  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
    }
  }, []);
  const toggle = useCallback(async () => {
    const fs = document.fullscreenElement;
    const el = targetRef.current;
    const active = !!fs && !!el && (fs === el || matchDescendants && el.contains(fs));
    if (active) {
      await exit();
    } else {
      await enter();
    }
  }, [enter, exit, targetRef, matchDescendants]);
  return { isFullscreen, enter, exit, toggle };
}
export {
  useFullscreen
};
