"use client";

import { useEffect, useLayoutEffect } from "react";

const DEFAULT_STICKY_HEIGHT = 156;
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type StickyHeightSyncProps = {
  targetId?: string;
};

function readHeight(element: HTMLElement | null) {
  if (!element) return DEFAULT_STICKY_HEIGHT;
  const next = Math.round(element.getBoundingClientRect().height);
  return next > 0 ? next : DEFAULT_STICKY_HEIGHT;
}

export function StickyHeightSync({ targetId = "sticky-stack" }: StickyHeightSyncProps) {
  useBrowserLayoutEffect(() => {
    const root = document.documentElement;
    const target = document.getElementById(targetId);

    const applyHeight = () => {
      const stickyHeight = readHeight(target);
      root.style.setProperty("--sticky-h", `${stickyHeight}px`);
      window.dispatchEvent(new Event("sticky-height-change"));
    };

    applyHeight();
    root.dataset.stickyReady = "1";
    window.dispatchEvent(new Event("unseen:sticky-paint-ready"));

    if (!target) {
      return () => {
        delete root.dataset.stickyReady;
      };
    }

    const observer = new ResizeObserver(() => {
      applyHeight();
    });
    observer.observe(target);
    window.addEventListener("resize", applyHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", applyHeight);
      delete root.dataset.stickyReady;
    };
  }, [targetId]);

  return null;
}
