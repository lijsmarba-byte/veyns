"use client";

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef } from "react";

type ProductInfoTransitionProps = {
  children: ReactNode;
  className?: string;
  productId: string;
  style?: CSSProperties;
};

export function ProductInfoTransition({
  children,
  className,
  productId,
  style,
}: ProductInfoTransitionProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    let raf1: number | null = null;
    let raf2: number | null = null;
    let cleanupTimer: number | null = null;

    const resetNodeStyles = () => {
      node.style.transition = "";
      node.style.opacity = "";
      node.style.transform = "";
      node.style.transformOrigin = "";
      node.style.willChange = "";
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      resetNodeStyles();
      return;
    }

    node.style.willChange = "transform, opacity";
    node.style.transition = "none";
    node.style.opacity = "0";
    node.style.transformOrigin = "center center";
    node.style.transform = "translate3d(0px, 8px, 0px) scale(0.996)";

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        node.style.transition =
          "transform 440ms cubic-bezier(0.22, 1, 0.36, 1) 30ms, opacity 300ms ease-out 20ms";
        node.style.opacity = "1";
        node.style.transform = "translate3d(0px, 0px, 0px) scale(1)";
      });
    });
    cleanupTimer = window.setTimeout(() => {
      resetNodeStyles();
    }, 700);

    return () => {
      if (raf1 !== null) window.cancelAnimationFrame(raf1);
      if (raf2 !== null) window.cancelAnimationFrame(raf2);
      if (cleanupTimer !== null) {
        window.clearTimeout(cleanupTimer);
      }
      resetNodeStyles();
    };
  }, [productId]);

  return (
    <div ref={rootRef} data-pv-info-block="true" className={className} style={style}>
      {children}
    </div>
  );
}
