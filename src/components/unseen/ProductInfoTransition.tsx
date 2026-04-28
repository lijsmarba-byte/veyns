"use client";

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef } from "react";

type ProductInfoTransitionProps = {
  children: ReactNode;
  className?: string;
  productId: string;
  style?: CSSProperties;
};

type ProductTransitionPayload = {
  at?: number;
  height?: number;
  itemId?: string;
  left?: number;
  top?: number;
  width?: number;
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readProductViewBackHref() {
  if (typeof window === "undefined") return "";
  try {
    return new URLSearchParams(window.location.search).get("back") ?? "";
  } catch {
    return "";
  }
}

function shouldUseIndicatedTextMotion(backHref: string) {
  return /\/immersive(?:$|[?#])/.test(backHref);
}

function getIndicatedTextStart(source: ProductTransitionPayload, target: DOMRect) {
  const sourceCenterX = (source.left ?? 0) + (source.width ?? 0) * 0.5;
  const sourceCenterY = (source.top ?? 0) + (source.height ?? 0) * 0.5;
  const targetCenterX = target.left + target.width * 0.5;
  const targetCenterY = target.top + target.height * 0.5;

  return {
    scale: 0.992,
    x: clampNumber((sourceCenterX - targetCenterX) * 0.045, -18, 18),
    y: clampNumber((sourceCenterY - targetCenterY) * 0.045, -16, 16),
  };
}

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

      const useIndicatedTextMotion = shouldUseIndicatedTextMotion(readProductViewBackHref());
      const targetRect = node.getBoundingClientRect();
      const indicatedStart =
        useIndicatedTextMotion && targetRect.width > 2 && targetRect.height > 2
          ? getIndicatedTextStart(parsed, targetRect)
          : null;
      const startTransform = indicatedStart
        ? `translate3d(${indicatedStart.x}px, ${indicatedStart.y}px, 0px) scale(${indicatedStart.scale})`
        : "translate3d(0px, 12px, 0px)";
      const transformTransition = indicatedStart
        ? "transform 720ms cubic-bezier(0.22, 1, 0.36, 1) 70ms"
        : "transform 620ms cubic-bezier(0.22, 1, 0.36, 1) 140ms";
      const opacityTransition = indicatedStart
        ? "opacity 520ms ease-out 90ms"
        : "opacity 460ms ease-out 140ms";

      didStartTransition = true;
      node.style.willChange = "transform, opacity";
      node.style.transition = "none";
      node.style.opacity = "0";
      node.style.transformOrigin = "center center";
      node.style.transform = startTransform;

      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          node.style.transition = `${transformTransition}, ${opacityTransition}`;
          node.style.opacity = "1";
          node.style.transform = "translate3d(0px, 0px, 0px) scale(1)";
          window.setTimeout(() => {
            resetNodeStyles();
          }, indicatedStart ? 920 : 860);
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
