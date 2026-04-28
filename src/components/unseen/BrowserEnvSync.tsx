"use client";

import { useEffect, useLayoutEffect } from "react";

function detectSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome\/|CriOS\/|Chromium\/|Edg\//.test(ua);
}

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function BrowserEnvSync() {
  useBrowserLayoutEffect(() => {
    const root = document.documentElement;
    const isSafari = detectSafari();
    root.dataset.browser = isSafari ? "safari" : "other";

    if (!isSafari) return;

    let lastViewportHeight = 0;
    let lastViewportWidth = 0;

    const syncSafariViewport = ({ updateHeight = true }: { updateHeight?: boolean } = {}) => {
      const viewport = window.visualViewport;
      const viewportHeight = Math.max(viewport?.height ?? window.innerHeight, 450);
      const viewportWidth = viewport?.width ?? window.innerWidth;
      if (updateHeight && Math.abs(viewportHeight - lastViewportHeight) > 0.5) {
        root.style.setProperty("--viewport-h", `${viewportHeight}px`);
        lastViewportHeight = viewportHeight;
      }
      if (Math.abs(viewportWidth - lastViewportWidth) > 0.5) {
        root.style.setProperty("--viewport-w", `${viewportWidth}px`);
        root.style.setProperty("--viewport-half-w", `${viewportWidth / 2}px`);
        lastViewportWidth = viewportWidth;
      }
    };

    const syncSafariViewportFromChromeChange = () => {
      syncSafariViewport();
    };
    const syncSafariViewportFromOrientationChange = () => {
      syncSafariViewport();
    };

    syncSafariViewport();

    window.addEventListener("resize", syncSafariViewportFromChromeChange);
    window.addEventListener("orientationchange", syncSafariViewportFromOrientationChange);
    window.visualViewport?.addEventListener("resize", syncSafariViewportFromChromeChange);
    window.visualViewport?.addEventListener("scroll", syncSafariViewportFromChromeChange);

    return () => {
      window.removeEventListener("resize", syncSafariViewportFromChromeChange);
      window.removeEventListener("orientationchange", syncSafariViewportFromOrientationChange);
      window.visualViewport?.removeEventListener("resize", syncSafariViewportFromChromeChange);
      window.visualViewport?.removeEventListener("scroll", syncSafariViewportFromChromeChange);
      root.style.removeProperty("--viewport-h");
      root.style.removeProperty("--viewport-w");
      root.style.removeProperty("--viewport-half-w");
    };
  }, []);

  return null;
}
