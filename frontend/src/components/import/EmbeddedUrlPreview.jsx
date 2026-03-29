import { jsx } from "react/jsx-runtime";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
const EmbeddedUrlPreview = forwardRef(function EmbeddedUrlPreview2({ url, className }, ref) {
  const iframeRef = useRef(null);
  const reload = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.location.reload();
    } catch {
      const el = iframeRef.current;
      if (el) el.src = url;
    }
  }, [url]);
  useImperativeHandle(ref, () => ({ reload }), [reload]);
  return /* @__PURE__ */ jsx("div", { className: `relative flex min-h-0 flex-1 flex-col ${className ?? ""}`, children: /* @__PURE__ */ jsx(
    "iframe",
    {
      ref: iframeRef,
      title: "Page preview",
      src: url,
      className: "h-full min-h-[12rem] w-full flex-1 border-0 bg-white",
      sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads",
      referrerPolicy: "no-referrer-when-downgrade"
    }
  ) });
});
export {
  EmbeddedUrlPreview
};
