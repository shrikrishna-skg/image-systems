import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import { isElectronShell } from "../../lib/openExternalUrl";

/** Electron `<webview>` guest surface (not in DOM typings). */
type WebviewEl = HTMLElement & { reload: () => void };

export type EmbeddedUrlPreviewHandle = {
  reload: () => void;
};

type Props = {
  url: string;
  className?: string;
};

/**
 * In-app preview: Electron uses `<webview>` (full Chromium guest). Browser uses `<iframe>`.
 * Some sites block embedding; if the view stays blank, use “Open in new tab”.
 */
export const EmbeddedUrlPreview = forwardRef<EmbeddedUrlPreviewHandle, Props>(function EmbeddedUrlPreview(
  { url, className },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const webviewRef = useRef<WebviewEl | null>(null);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  const electron = isElectronShell();

  const reload = useCallback(() => {
    setEmbedBlocked(false);
    if (electron) {
      const w = webviewRef.current;
      if (w && typeof w.reload === "function") w.reload();
      return;
    }
    try {
      iframeRef.current?.contentWindow?.location.reload();
    } catch {
      /* cross-origin — remount iframe */
      const el = iframeRef.current;
      if (el) el.src = url;
    }
  }, [electron, url]);

  useImperativeHandle(ref, () => ({ reload }), [reload]);

  useEffect(() => {
    setEmbedBlocked(false);
  }, [url]);

  useEffect(() => {
    if (!electron) return;
    const el = webviewRef.current;
    if (!el) return;

    const onFail = () => setEmbedBlocked(true);
    el.addEventListener("did-fail-load", onFail as EventListener);
    return () => {
      el.removeEventListener("did-fail-load", onFail as EventListener);
    };
  }, [electron, url]);

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col ${className ?? ""}`}>
      {embedBlocked && (
        <div className="absolute inset-x-0 top-0 z-10 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-950">
          This site blocked in-app embedding. Use <strong>Open in new tab</strong> below.
        </div>
      )}
      {electron ? (
        <webview
          ref={webviewRef as Ref<WebviewEl>}
          src={url}
          className="h-full min-h-[12rem] w-full flex-1 border-0 bg-white"
          allowpopups
        />
      ) : (
        <iframe
          ref={iframeRef}
          title="Page preview"
          src={url}
          className="h-full min-h-[12rem] w-full flex-1 border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  );
});
