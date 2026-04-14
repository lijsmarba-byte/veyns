"use client";

import { useEffect, useState } from "react";

const GALLERY_ENTRY_ARRIVAL_KEY = "unseen:gallery-entry-arrival";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const ARRIVAL_COMPLETE_EVENT = "unseen:gallery-arrival-complete";
const ARRIVAL_DURATION_MS = 2800;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function GalleryArrivalReveal() {
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId = 0;
    let activationTimer: number | null = null;
    let settleTimer: number | null = null;
    let completionTimer: number | null = null;
    let completed = false;

    const completeArrival = () => {
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

    try {
      const rawEntry = window.sessionStorage.getItem(GALLERY_ENTRY_ARRIVAL_KEY);
      if (!rawEntry) {
        window.sessionStorage.removeItem(GALLERY_ARRIVAL_ACTIVE_KEY);
        return () => undefined;
      }
      activationTimer = window.setTimeout(() => {
        setIsActive(true);
        setProgress(0);
      }, 0);
      window.sessionStorage.setItem(GALLERY_ARRIVAL_ACTIVE_KEY, "1");
    } catch {
      return () => undefined;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const raw = clamp((now - startedAt) / ARRIVAL_DURATION_MS, 0, 1);
      const eased = 1 - Math.pow(1 - raw, 2.3);
      setProgress(eased);
      if (raw < 1) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      completeArrival();
    };

    rafId = window.requestAnimationFrame(tick);
    completionTimer = window.setTimeout(completeArrival, ARRIVAL_DURATION_MS + 360);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (activationTimer !== null) {
        window.clearTimeout(activationTimer);
      }
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
      if (completionTimer !== null) {
        window.clearTimeout(completionTimer);
      }
    };
  }, []);

  if (!isActive) return null;

  const blurPx = (1 - progress) * 8;
  const veilOpacity = (1 - progress) * 0.26;
  const tintOpacity = (1 - progress) * 0.2;

  return (
    <div className="pointer-events-none fixed inset-0 z-[140]" aria-hidden="true">
      <div
        className="absolute inset-0 bg-paper"
        style={{ opacity: veilOpacity, transition: "opacity 120ms linear" }}
      />
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: `blur(${blurPx}px)`,
          WebkitBackdropFilter: `blur(${blurPx}px)`,
          backgroundColor: `rgba(254,254,253,${tintOpacity})`,
          transition: "backdrop-filter 120ms linear, background-color 120ms linear",
        }}
      />
    </div>
  );
}
