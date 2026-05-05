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
  const cleanupTimerRef = useRef<number | null>(null);
  const motionRef = useRef<Animation | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    };

    const clearAnimations = () => {
      motionRef.current?.cancel();
      motionRef.current = null;
    };

    const handleStart = (event: Event) => {
      const detail = (event as CustomEvent<ReturnTransitionDetail>).detail ?? {};
      const raiseMs = Math.max(30, detail.raiseMs ?? 90);
      const holdMs = Math.max(0, detail.holdMs ?? 40);
      const fallMs = Math.max(120, detail.fallMs ?? 220);
      const targetOpacity = Math.max(0, Math.min(0.24, detail.targetOpacity ?? 0.06));
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
        motionRef.current = overlay.animate(
          [
            { opacity: 0 },
            { opacity: targetOpacity, offset: raiseMs / Math.max(1, raiseMs + holdMs + fallMs) },
            { opacity: targetOpacity, offset: (raiseMs + holdMs) / Math.max(1, raiseMs + holdMs + fallMs) },
            { opacity: 0 },
          ],
          {
            duration: raiseMs + holdMs + fallMs,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          },
        );
        motionRef.current.addEventListener(
          "finish",
          () => {
            overlay.style.opacity = "0";
            overlay.style.willChange = "";
            overlay.style.top = "";
            overlay.style.height = "";
            clearAnimations();
          },
          { once: true },
        );
      });

      cleanupTimerRef.current = window.setTimeout(() => {
        overlay.style.opacity = "0";
        overlay.style.willChange = "";
        overlay.style.top = "";
        overlay.style.height = "";
        clearAnimations();
      }, raiseMs + holdMs + fallMs + 80);
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
