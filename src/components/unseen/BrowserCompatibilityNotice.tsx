"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "unseen:browser-compatibility-notice-dismissed";
const MIN_SAFARI_VERSION = 14.1;
const MIN_CHROME_VERSION = 104;

function parseVersion(userAgent: string, pattern: RegExp) {
  const match = userAgent.match(pattern);
  if (!match?.[1]) return null;
  const parsed = Number.parseFloat(match[1].replace("_", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function isOlderThanOptimizedTarget() {
  if (typeof window === "undefined") return false;

  const userAgent = navigator.userAgent;
  const supportsCoreLayout =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("translate: 0 0") &&
    "ResizeObserver" in window &&
    "IntersectionObserver" in window;

  const safariVersion =
    /Safari\//.test(userAgent) && !/Chrome\/|CriOS\/|Chromium\/|Edg\//.test(userAgent)
      ? parseVersion(userAgent, /Version\/(\d+(?:[._]\d+)?)/)
      : null;
  const chromeVersion = parseVersion(userAgent, /(?:Chrome|CriOS)\/(\d+(?:[._]\d+)?)/);

  return (
    !supportsCoreLayout ||
    (safariVersion !== null && safariVersion < MIN_SAFARI_VERSION) ||
    (chromeVersion !== null && chromeVersion < MIN_CHROME_VERSION)
  );
}

export function BrowserCompatibilityNotice() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Dismissal is optional.
    }

    setShouldShow(isOlderThanOptimizedTarget());
  }, []);

  if (!shouldShow) return null;

  return (
    <aside
      aria-label="Browser compatibility notice"
      className="fixed bottom-4 left-4 right-4 z-[180] mx-auto max-w-[560px] rounded-[8px] border border-line bg-paper px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 font-ui text-[13px] font-normal leading-5 tracking-[0.01em] text-meta">
          Your browser is older than what cenoir is optimized for. The experience will work but may look
          different. Update your browser for the best experience.
        </p>
        <button
          type="button"
          className="h-[24px] w-[24px] shrink-0 rounded-full font-ui text-[16px] leading-none text-meta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          aria-label="Dismiss browser compatibility notice"
          onClick={() => {
            try {
              window.localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // Dismiss in-memory if storage is unavailable.
            }
            setShouldShow(false);
          }}
        >
          x
        </button>
      </div>
    </aside>
  );
}
