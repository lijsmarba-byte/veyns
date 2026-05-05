"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const RETURN_FOCUS_ITEM_KEY = "unseen:return-focus-item";
const RETURN_FLIGHT_FINISHED_EVENT = "unseen:return-flight-finished";
const RETURN_FLIGHT_FINISHED_KEY = "unseen:return-flight-finished-flag";
const WORLD2_RETURN_REVEAL_KEY = "unseen:world2-return-reveal";
const IMMERSIVE_RETURN_STEADY_KEY = "unseen:immersive-return-steady";
const DESKTOP_GRID_PRODUCT_RETURN_KEY = "unseen:desktop-grid-product-return";
const DESKTOP_RETURN_FREEZE_ID = "unseen-desktop-grid-return-freeze";
const DESKTOP_RETURN_FREEZE_MAX_WAIT_MS = 560;
const DESKTOP_RETURN_FREEZE_HOLD_MS = 12;
const DESKTOP_RETURN_FREEZE_FADE_MS = 120;

type ProductViewCloseButtonProps = {
  backHref: string;
  className: string;
  enableBackdropClose?: boolean;
  productId: string;
};

function signalReturnFlightFinished() {
  try {
    window.sessionStorage.setItem(RETURN_FLIGHT_FINISHED_KEY, "1");
  } catch {
    // Non-critical.
  }
  window.dispatchEvent(new CustomEvent(RETURN_FLIGHT_FINISHED_EVENT));
}

function isDesktopGridOrFocusBackHref(backHref: string) {
  if (backHref.includes("/immersive")) return false;
  return (
    backHref === "/gallery" ||
    backHref.startsWith("/gallery?") ||
    backHref === "/archive" ||
    backHref.startsWith("/archive?") ||
    backHref.startsWith("/gallery/focus") ||
    backHref.startsWith("/archive/focus")
  );
}

function createDesktopGridReturnFreeze(sourceNode: HTMLElement | null) {
  if (!sourceNode) return;
  document.getElementById(DESKTOP_RETURN_FREEZE_ID)?.remove();
  const sourceRect = sourceNode.getBoundingClientRect();

  const overlay = document.createElement("div");
  overlay.id = DESKTOP_RETURN_FREEZE_ID;
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "220";
  overlay.style.width = "100vw";
  overlay.style.height = "100dvh";
  overlay.style.overflow = "hidden";
  overlay.style.pointerEvents = "none";
  overlay.style.background = "var(--paper)";
  overlay.style.opacity = "1";
  overlay.style.contain = "layout paint style";
  overlay.style.willChange = "opacity";

  const clone = sourceNode.cloneNode(true) as HTMLElement;
  clone.style.position = "absolute";
  clone.style.left = `${Math.round(sourceRect.left)}px`;
  clone.style.top = `${Math.round(sourceRect.top)}px`;
  clone.style.zIndex = "0";
  clone.style.width = `${Math.round(sourceRect.width)}px`;
  clone.style.maxWidth = `${Math.round(sourceRect.width)}px`;
  clone.style.height = `${Math.round(sourceRect.height)}px`;
  clone.style.opacity = "1";
  clone.style.transform = "none";
  clone.style.transition = "none";
  clone.style.pointerEvents = "none";
  clone.querySelectorAll<HTMLElement>("*").forEach((node) => {
    node.style.transition = "none";
    node.style.animation = "none";
  });
  clone.querySelectorAll("button, a, input, textarea, select").forEach((node) => {
    if (node instanceof HTMLElement) {
      node.setAttribute("tabindex", "-1");
    }
  });
  overlay.appendChild(clone);
  document.body.appendChild(overlay);

  const startedAt = performance.now();
  let didFade = false;
  const fadeWhenDestinationIsReady = () => {
    if (didFade) return;
    const hasDestinationMounted = Boolean(document.querySelector('[data-return-root="true"]'));
    const hasWaitedLongEnough = performance.now() - startedAt >= DESKTOP_RETURN_FREEZE_MAX_WAIT_MS;
    if (!hasDestinationMounted && !hasWaitedLongEnough) {
      window.requestAnimationFrame(fadeWhenDestinationIsReady);
      return;
    }

    didFade = true;
    window.setTimeout(() => {
      overlay.style.transition = `opacity ${DESKTOP_RETURN_FREEZE_FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      overlay.style.opacity = "0";
      window.setTimeout(() => {
        overlay.remove();
        try {
          window.sessionStorage.removeItem(DESKTOP_GRID_PRODUCT_RETURN_KEY);
        } catch {
          // Optional cleanup only.
        }
      }, DESKTOP_RETURN_FREEZE_FADE_MS + 70);
    }, DESKTOP_RETURN_FREEZE_HOLD_MS);
  };

  window.requestAnimationFrame(fadeWhenDestinationIsReady);
}

function prepareDesktopProductClose(backHref: string, sourceNode: HTMLElement | null) {
  if (typeof window === "undefined") return;
  if (!isDesktopGridOrFocusBackHref(backHref)) return;
  createDesktopGridReturnFreeze(sourceNode);
  try {
    window.sessionStorage.setItem(
      DESKTOP_GRID_PRODUCT_RETURN_KEY,
      JSON.stringify({
        at: Date.now(),
        backHref,
      }),
    );
  } catch {
    // Optional return polish only.
  }
}

export function ProductViewCloseButton({
  backHref,
  className,
  enableBackdropClose = false,
  productId,
}: ProductViewCloseButtonProps) {
  const router = useRouter();
  const mountedAtRef = useRef<number | null>(null);
  const timerIdsRef = useRef<number[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);

  const CLOSE_TOTAL_MS = 200;
  const CLOSE_ROUTE_DELAY_MS = 64;
  const CLOSE_ICON_LINE_WIDTH_PX = 18;
  const CLOSE_ICON_STROKE_PX = 1.5;
  const CLOSE_ICON_BOX_HEIGHT_PX = 14;
  const closeIconCenterPx = CLOSE_ICON_BOX_HEIGHT_PX / 2 - CLOSE_ICON_STROKE_PX / 2;

  const isImmersiveReturn = backHref.includes("/immersive");

  useEffect(() => {
    mountedAtRef.current = Date.now();
    router.prefetch(backHref);
    return () => {
      timerIdsRef.current.forEach((id) => window.clearTimeout(id));
      timerIdsRef.current = [];
    };
  }, [backHref, router]);

  const handleClose = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setIsAnimating(true);

    timerIdsRef.current.forEach((id) => window.clearTimeout(id));
    timerIdsRef.current = [];

    const shellRoot = document.querySelector('[data-pv-shell="true"]') as HTMLElement | null;

    if (!isImmersiveReturn) {
      prepareDesktopProductClose(backHref, shellRoot);
    }

    window.dispatchEvent(new CustomEvent("unseen:product-view-closing"));
    window.dispatchEvent(
      new CustomEvent("unseen:return-transition-start", {
        detail: {
          targetOpacity: 0.06,
          raiseMs: 70,
          holdMs: 20,
          fallMs: 170,
        },
      }),
    );

    if (shellRoot) {
      shellRoot.style.willChange = "opacity";
      shellRoot.style.transition = "opacity 190ms cubic-bezier(0.22, 1, 0.36, 1)";
      shellRoot.style.opacity = "0";
      shellRoot.style.pointerEvents = "none";
    }

    if (isImmersiveReturn) {
      try {
        const now = Date.now();
        window.sessionStorage.setItem(
          WORLD2_RETURN_REVEAL_KEY,
          JSON.stringify({
            at: now,
            itemId: productId,
            href: backHref,
            revealAt: now + 180,
            lockUntil: now + 260,
            fadeMs: 320,
          }),
        );
        window.sessionStorage.setItem(
          IMMERSIVE_RETURN_STEADY_KEY,
          JSON.stringify({
            at: now,
            href: backHref,
          }),
        );
        window.sessionStorage.removeItem(RETURN_FOCUS_ITEM_KEY);
      } catch {
        // Optional polish only.
      }
    }

    timerIdsRef.current.push(
      window.setTimeout(() => {
        router.replace(backHref, { scroll: false });
      }, CLOSE_ROUTE_DELAY_MS),
    );

    timerIdsRef.current.push(
      window.setTimeout(() => {
        signalReturnFlightFinished();
      }, CLOSE_TOTAL_MS + 80),
    );
  }, [backHref, isImmersiveReturn, productId, router]);

  useEffect(() => {
    if (!enableBackdropClose) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (mountedAtRef.current !== null && Date.now() - mountedAtRef.current < 420) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const hasProtectedHit = path.some((entry) => {
        if (!(entry instanceof Element)) return false;
        return (
          entry.matches('[data-pv-close-button="true"]') ||
          entry.matches('[data-pv-info-hit="true"]') ||
          entry.matches('[data-pv-image-hit="true"]') ||
          entry.matches('[data-pv-mobile-hit="true"]')
        );
      });
      if (hasProtectedHit) return;

      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest('[data-pv-close-button="true"]')) return;
      if (target.closest('[data-pv-info-hit="true"]')) return;
      if (target.closest('[data-pv-image-hit="true"]')) return;
      if (target.closest('[data-pv-mobile-hit="true"]')) return;

      handleClose();
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [enableBackdropClose, handleClose]);

  return (
    <button
      type="button"
      data-pv-close-button="true"
      aria-label="Close preview"
      className={className}
      onClick={handleClose}
      disabled={isAnimating}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/2 block -translate-x-1/2 rounded-full bg-current rotate-45"
        style={{
          width: `${CLOSE_ICON_LINE_WIDTH_PX}px`,
          height: `${CLOSE_ICON_STROKE_PX}px`,
          top: `${closeIconCenterPx}px`,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute left-1/2 block -translate-x-1/2 rounded-full bg-current -rotate-45"
        style={{
          width: `${CLOSE_ICON_LINE_WIDTH_PX}px`,
          height: `${CLOSE_ICON_STROKE_PX}px`,
          top: `${closeIconCenterPx}px`,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      />
    </button>
  );
}
