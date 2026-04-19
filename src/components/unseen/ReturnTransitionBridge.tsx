"use client";

import { useEffect, useRef } from "react";

type ReturnTransitionDetail = {
  blurPx?: number;
  fallMs?: number;
  holdMs?: number;
  raiseMs?: number;
  targetOpacity?: number;
};

function getStickyBottomOffset() {
  if (typeof window === "undefined") return 0;
  const stickyStack = document.getElementById("sticky-stack");
  if (stickyStack) {
    return Math.max(0, Math.round(stickyStack.getBoundingClientRect().bottom));
  }
  const stickyRoot = document.querySelector('[data-sticky-root="true"]') as HTMLElement | null;
  if (stickyRoot) {
    return Math.max(0, Math.round(stickyRoot.getBoundingClientRect().bottom));
  }
  return 0;
}

export function ReturnTransitionBridge() {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const raiseAnimRef = useRef<Animation | null>(null);
  const fallAnimRef = useRef<Animation | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    };

    const clearAnimations = () => {
      raiseAnimRef.current?.cancel();
      fallAnimRef.current?.cancel();
      raiseAnimRef.current = null;
      fallAnimRef.current = null;
    };

    const handleStart = (event: Event) => {
      const detail = (event as CustomEvent<ReturnTransitionDetail>).detail ?? {};
      const raiseMs = Math.max(40, detail.raiseMs ?? 110);
      const holdMs = Math.max(0, detail.holdMs ?? 180);
      const fallMs = Math.max(120, detail.fallMs ?? 2350);
      const targetOpacity = Math.max(0, Math.min(0.95, detail.targetOpacity ?? 0.08));
      const riseEase = "cubic-bezier(0.2, 0.88, 0.24, 1)";
      const fallEase = "cubic-bezier(0.23, 0.84, 0.18, 1)";
      const overlay = overlayRef.current;
      if (!overlay) return;
      const stickyBottom = getStickyBottomOffset();
      const overlayTop = Math.min(window.innerHeight, Math.max(0, stickyBottom));
      const overlayHeight = Math.max(0, window.innerHeight - overlayTop);

      overlay.style.top = `${overlayTop}px`;
      overlay.style.height = `${overlayHeight}px`;

      clearTimers();
      clearAnimations();
      overlay.style.opacity = "0";
      overlay.style.transition = "none";
      overlay.style.backdropFilter = "none";
      overlay.style.setProperty("-webkit-backdrop-filter", "none");
      overlay.style.willChange = "opacity";

      window.requestAnimationFrame(() => {
        raiseAnimRef.current = overlay.animate(
          [
            { opacity: 0 },
            { opacity: targetOpacity },
          ],
          {
            duration: raiseMs,
            easing: riseEase,
            fill: "forwards",
          },
        );
      });

      holdTimerRef.current = window.setTimeout(() => {
        fallAnimRef.current = overlay.animate(
          [
            { opacity: targetOpacity },
            { opacity: targetOpacity * 0.92, offset: 0.28 },
            { opacity: targetOpacity * 0.62, offset: 0.62 },
            { opacity: targetOpacity * 0.24, offset: 0.9 },
            { opacity: 0 },
          ],
          {
            duration: fallMs,
            easing: fallEase,
            fill: "forwards",
          },
        );
        fallAnimRef.current.addEventListener(
          "finish",
          () => {
            overlay.style.opacity = "0";
            overlay.style.backdropFilter = "none";
            overlay.style.setProperty("-webkit-backdrop-filter", "none");
          },
          { once: true },
        );
      }, holdMs);

      cleanupTimerRef.current = window.setTimeout(() => {
        overlay.style.willChange = "";
        overlay.style.backdropFilter = "none";
        overlay.style.setProperty("-webkit-backdrop-filter", "none");
        overlay.style.top = "";
        overlay.style.height = "";
        clearAnimations();
      }, holdMs + fallMs + 120);
    };

    window.addEventListener("unseen:return-transition-start", handleStart as EventListener);
    return () => {
      window.removeEventListener("unseen:return-transition-start", handleStart as EventListener);
      clearTimers();
      clearAnimations();
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 top-0 z-[170] bg-paper/90 opacity-0"
      style={{ height: "var(--viewport-h)" }}
    />
  );
}
