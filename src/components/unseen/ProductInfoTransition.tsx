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
    let didStartTransition = false;

    const resetNodeStyles = () => {
      node.style.transition = "";
      node.style.opacity = "";
      node.style.transform = "";
      node.style.transformOrigin = "";
      node.style.willChange = "";
    };

    try {
      const raw = window.sessionStorage.getItem("unseen:product-view-text-transition");
      if (!raw) {
        resetNodeStyles();
        return;
      }
      const parsed = JSON.parse(raw) as {
        at: number;
        height: number;
        itemId: string;
        left: number;
        top: number;
        width: number;
      };
      const isFresh = Date.now() - parsed.at < 4000;
      if (!isFresh || parsed.itemId !== productId) {
        resetNodeStyles();
        return;
      }

      didStartTransition = true;
      node.style.willChange = "transform, opacity";
      node.style.transition = "none";
      node.style.opacity = "0";
      node.style.transform = "translate3d(0px, 12px, 0px)";

      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          node.style.transition =
            "transform 620ms cubic-bezier(0.22, 1, 0.36, 1) 140ms, opacity 460ms ease-out 140ms";
          node.style.opacity = "1";
          node.style.transform = "translate3d(0px, 0px, 0px)";
          window.setTimeout(() => {
            resetNodeStyles();
          }, 860);
        });
      });

    } catch {
      // Ignore malformed transition payloads.
      resetNodeStyles();
    }

    return () => {
      if (raf1 !== null) window.cancelAnimationFrame(raf1);
      if (raf2 !== null) window.cancelAnimationFrame(raf2);
      if (didStartTransition) {
        resetNodeStyles();
      }
    };
  }, [productId]);

  return (
    <div ref={rootRef} data-pv-info-block="true" className={className} style={style}>
      {children}
    </div>
  );
}
