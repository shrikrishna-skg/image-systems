import type { DetailedHTMLProps, HTMLAttributes } from "react";

type WebViewAttrs = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string;
  allowpopups?: boolean | string;
  partition?: string;
  webpreferences?: string;
  /** guest instance id — read-only */
  guestinstance?: string;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: WebViewAttrs;
    }
  }
}

export {};
