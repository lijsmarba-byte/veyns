"use client";

import { useEffect } from "react";

const DEFAULT_STICKY_HEIGHT = 156;

type StickyHeightSyncProps = {
  targetId?: string;
};

function readHeight(element: HTMLElement | null) {
  if (!element) return DEFAULT_STICKY_HEIGHT;
  const next = Math.round(element.getBoundingClientRect().height);
  return next > 0 ? next : DEFAULT_STICKY_HEIGHT;
}

export function StickyHeightSync({ targetId = "sticky-stack" }: StickyHeightSyncProps) {
  useEffect(() => {
    const root = document.documentElement;
    const target = document.getElementById(targetId);

    const applyHeight = () => {
      const stickyHeight = readHeight(target);
      root.style.setProperty("--sticky-h", `${stickyHeight}px`);
      window.dispatchEvent(new Event("sticky-height-change"));
    };

    applyHeight();

    if (!target) return;

    const observer = new ResizeObserver(() => {
      applyHeight();
    });
    observer.observe(target);
    window.addEventListener("resize", applyHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", applyHeight);
    };
  }, [targetId]);

  return null;
}
