"use client";

import { useEffect, useLayoutEffect } from "react";
import { VIEWPORT_MODE_SYNC_EVENT } from "@/lib/ui/viewportMode";

function detectSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome\/|CriOS\/|Chromium\/|Edg\//.test(ua);
}

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function BrowserEnvSync() {
  useBrowserLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.uiReady = "0";
    const isSafari = detectSafari();
    root.dataset.browser = isSafari ? "safari" : "other";
    const isMobileWidth = window.matchMedia("(max-width: 767px)").matches;
    let readyRafA = 0;
    let readyRafB = 0;
    let readyFallbackTimer = 0;
    let hasMarkedReady = false;

    let lastViewportHeight = 0;
    let lastViewportWidth = 0;

    const syncSafariViewport = ({ updateHeight = true }: { updateHeight?: boolean } = {}) => {
      const viewport = window.visualViewport;
      const rawViewportHeight = viewport?.height ?? window.innerHeight;
      const isMobileWidth = window.matchMedia("(max-width: 767px)").matches;
      const viewportHeight = Math.max(rawViewportHeight, 450);
      const viewportWidth = viewport?.width ?? window.innerWidth;
      if (updateHeight) {
        if (isMobileWidth) {
          root.style.removeProperty("--viewport-h");
          lastViewportHeight = 0;
        } else if (Math.abs(viewportHeight - lastViewportHeight) > 0.5) {
          root.style.setProperty("--viewport-h", `${viewportHeight}px`);
          lastViewportHeight = viewportHeight;
        }
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

    const markUiReady = () => {
      if (hasMarkedReady) return;
      hasMarkedReady = true;
      root.dataset.uiReady = "1";
      window.clearTimeout(readyFallbackTimer);
    };

    const scheduleUiReady = () => {
      if (hasMarkedReady) return;
      window.cancelAnimationFrame(readyRafA);
      window.cancelAnimationFrame(readyRafB);
      readyRafA = window.requestAnimationFrame(() => {
        readyRafB = window.requestAnimationFrame(() => {
          markUiReady();
        });
      });
    };

    const onViewportModeSync = () => {
      scheduleUiReady();
    };

    readyFallbackTimer = window.setTimeout(markUiReady, 420);
    if (!isMobileWidth) {
      scheduleUiReady();
    } else {
      window.addEventListener(VIEWPORT_MODE_SYNC_EVENT, onViewportModeSync);
    }

    const shouldTrackVisualViewport = isSafari && !window.matchMedia("(max-width: 767px)").matches;

    if (isSafari) {
      syncSafariViewport();
      window.addEventListener("resize", syncSafariViewportFromChromeChange);
      window.addEventListener("orientationchange", syncSafariViewportFromOrientationChange);
      if (shouldTrackVisualViewport) {
        window.visualViewport?.addEventListener("resize", syncSafariViewportFromChromeChange);
        window.visualViewport?.addEventListener("scroll", syncSafariViewportFromChromeChange);
      }
    }

    return () => {
      delete root.dataset.uiReady;
      window.cancelAnimationFrame(readyRafA);
      window.cancelAnimationFrame(readyRafB);
      window.clearTimeout(readyFallbackTimer);
      window.removeEventListener(VIEWPORT_MODE_SYNC_EVENT, onViewportModeSync);
      if (isSafari) {
        window.removeEventListener("resize", syncSafariViewportFromChromeChange);
        window.removeEventListener("orientationchange", syncSafariViewportFromOrientationChange);
        if (shouldTrackVisualViewport) {
          window.visualViewport?.removeEventListener("resize", syncSafariViewportFromChromeChange);
          window.visualViewport?.removeEventListener("scroll", syncSafariViewportFromChromeChange);
        }
        root.style.removeProperty("--viewport-h");
        root.style.removeProperty("--viewport-w");
        root.style.removeProperty("--viewport-half-w");
      }
    };
  }, []);

  return null;
}
