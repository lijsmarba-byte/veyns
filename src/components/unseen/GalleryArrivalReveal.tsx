"use client";

import { useEffect, useState } from "react";

const GALLERY_ENTRY_ARRIVAL_KEY = "unseen:gallery-entry-arrival";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const MOBILE_GRID_PRODUCT_RETURN_KEY = "unseen:mobile-grid-product-return";
const DESKTOP_GRID_PRODUCT_RETURN_KEY = "unseen:desktop-grid-product-return";
const ARRIVAL_COMPLETE_EVENT = "unseen:gallery-arrival-complete";
const ARRIVAL_DURATION_SIGNUP_MS = 2800;
const ARRIVAL_DURATION_LOGIN_MS = 620;
const MOBILE_GRID_RETURN_MASK_HOLD_MS = 220;
const MOBILE_GRID_RETURN_MASK_FADE_MS = 150;
type RevealVariant = "arrival" | "mobile-return";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function GalleryArrivalReveal() {
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [variant, setVariant] = useState<RevealVariant>("arrival");

  useEffect(() => {
    let rafId = 0;
    let settleTimer: number | null = null;
    let completionTimer: number | null = null;
    let holdTimer: number | null = null;
    let completed = false;

    const completeArrival = (settleMs = 180) => {
      if (completed) return;
      completed = true;

      settleTimer = window.setTimeout(() => {
        setIsActive(false);
        try {
          window.sessionStorage.removeItem(GALLERY_ENTRY_ARRIVAL_KEY);
          window.sessionStorage.removeItem(GALLERY_ARRIVAL_ACTIVE_KEY);
        } catch {
          // Ignore storage failures.
        }
        window.dispatchEvent(new CustomEvent(ARRIVAL_COMPLETE_EVENT));
      }, 180);
    };

    let arrivalDurationMs = ARRIVAL_DURATION_SIGNUP_MS;
    let isLoginArrival = false;
    try {
      const rawDesktopProductReturn = window.sessionStorage.getItem(DESKTOP_GRID_PRODUCT_RETURN_KEY);
      if (rawDesktopProductReturn) {
        try {
          const parsed = JSON.parse(rawDesktopProductReturn) as { at?: unknown };
          const isFreshDesktopProductReturn = typeof parsed.at === "number" && Date.now() - parsed.at < 5000;
          if (isFreshDesktopProductReturn) {
            window.sessionStorage.removeItem(DESKTOP_GRID_PRODUCT_RETURN_KEY);
            window.sessionStorage.removeItem(GALLERY_ENTRY_ARRIVAL_KEY);
            window.sessionStorage.removeItem(GALLERY_ARRIVAL_ACTIVE_KEY);
            return () => undefined;
          }
        } catch {
          window.sessionStorage.removeItem(DESKTOP_GRID_PRODUCT_RETURN_KEY);
        }
      }

      const rawProductReturn = window.sessionStorage.getItem(MOBILE_GRID_PRODUCT_RETURN_KEY);
      if (rawProductReturn) {
        try {
          const parsed = JSON.parse(rawProductReturn) as { at?: unknown };
          const isFreshProductReturn = typeof parsed.at === "number" && Date.now() - parsed.at < 5000;
          if (isFreshProductReturn) {
            window.sessionStorage.removeItem(MOBILE_GRID_PRODUCT_RETURN_KEY);
            window.sessionStorage.removeItem(GALLERY_ENTRY_ARRIVAL_KEY);
            window.sessionStorage.removeItem(GALLERY_ARRIVAL_ACTIVE_KEY);
            setVariant("mobile-return");
            setIsActive(true);
            setProgress(0);
            holdTimer = window.setTimeout(() => {
              const startedAt = performance.now();
              const tick = (now: number) => {
                const raw = clamp((now - startedAt) / MOBILE_GRID_RETURN_MASK_FADE_MS, 0, 1);
                setProgress(raw);
                if (raw < 1) {
                  rafId = window.requestAnimationFrame(tick);
                  return;
                }
                completeArrival(0);
              };
              rafId = window.requestAnimationFrame(tick);
            }, MOBILE_GRID_RETURN_MASK_HOLD_MS);
            return () => undefined;
          }
        } catch {
          window.sessionStorage.removeItem(MOBILE_GRID_PRODUCT_RETURN_KEY);
        }
      }

      const rawEntry = window.sessionStorage.getItem(GALLERY_ENTRY_ARRIVAL_KEY);
      if (!rawEntry) {
        window.sessionStorage.removeItem(GALLERY_ARRIVAL_ACTIVE_KEY);
        return () => undefined;
      }
      try {
        const parsed = JSON.parse(rawEntry) as { source?: unknown };
        if (parsed?.source === "login") {
          arrivalDurationMs = ARRIVAL_DURATION_LOGIN_MS;
          isLoginArrival = true;
        }
      } catch {
        // Ignore malformed payload; keep signup default timing.
      }
      setIsActive(true);
      setProgress(0);
      window.sessionStorage.setItem(GALLERY_ARRIVAL_ACTIVE_KEY, "1");
    } catch {
      return () => undefined;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const raw = clamp((now - startedAt) / arrivalDurationMs, 0, 1);
      const eased = isLoginArrival ? raw : 1 - Math.pow(1 - raw, 2.3);
      setProgress(eased);
      if (raw < 1) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      completeArrival();
    };

    rafId = window.requestAnimationFrame(tick);
    completionTimer = window.setTimeout(completeArrival, arrivalDurationMs + 360);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
      if (completionTimer !== null) {
        window.clearTimeout(completionTimer);
      }
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
      }
    };
  }, []);

  if (!isActive) return null;

  if (variant === "mobile-return") {
    const veilOpacity = 1 - progress;
    return (
      <div className="pointer-events-none fixed inset-0 z-[140]" aria-hidden="true">
        <div className="absolute inset-0 bg-paper" style={{ opacity: veilOpacity }} />
      </div>
    );
  }

  const blurPx = (1 - progress) * 7;
  const veilOpacity = (1 - progress) * 0.26;
  const tintOpacity = (1 - progress) * 0.2;

  return (
    <div className="pointer-events-none fixed inset-0 z-[140]" aria-hidden="true">
      <div
        className="absolute inset-0 bg-paper"
        style={{ opacity: veilOpacity }}
      />
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: `blur(${blurPx}px)`,
          WebkitBackdropFilter: `blur(${blurPx}px)`,
          backgroundColor: `rgba(254,254,253,${tintOpacity})`,
        }}
      />
    </div>
  );
}
