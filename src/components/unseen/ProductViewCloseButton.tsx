"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type TransitionPayload = {
  at: number;
  aspectRatio?: number;
  height: number;
  itemId: string;
  left: number;
  src: string;
  top: number;
  width: number;
};

const RETURN_FOCUS_ITEM_KEY = "unseen:return-focus-item";
const RETURN_SCROLL_LOCK_KEY = "unseen:return-scroll-lock";
const RETURN_SCROLL_INTENT_KEY = "unseen:return-scroll-intent";
const RETURN_FLIGHT_FINISHED_EVENT = "unseen:return-flight-finished";
const RETURN_FLIGHT_FINISHED_KEY = "unseen:return-flight-finished-flag";
const RETURN_PREV_BODY_PADDING_ATTR = "data-unseen-return-prev-pr";
const WORLD2_RETURN_REVEAL_KEY = "unseen:world2-return-reveal";

type ProductViewCloseButtonProps = {
  backHref: string;
  className: string;
  enableBackdropClose?: boolean;
  productId: string;
};

function getVisibleGridTop() {
  const stickyStack = document.getElementById("sticky-stack");
  if (stickyStack) {
    return Math.max(0, Math.round(stickyStack.getBoundingClientRect().bottom));
  }

  const stickyRoot = document.querySelector('[data-sticky-root="true"]') as HTMLElement | null;
  if (stickyRoot) {
    return Math.max(0, Math.round(stickyRoot.getBoundingClientRect().bottom));
  }

  const fallback = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--sticky-h"),
  );
  return Number.isFinite(fallback) ? Math.max(0, Math.round(fallback)) : 0;
}

function getContainRect(containerRect: DOMRect, aspectRatio: number) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return containerRect;
  const containerRatio = containerRect.width / Math.max(containerRect.height, 1);
  if (aspectRatio > containerRatio) {
    const fittedHeight = containerRect.width / aspectRatio;
    const insetY = (containerRect.height - fittedHeight) / 2;
    return {
      left: containerRect.left,
      top: containerRect.top + insetY,
      width: containerRect.width,
      height: fittedHeight,
    };
  }

  const fittedWidth = containerRect.height * aspectRatio;
  const insetX = (containerRect.width - fittedWidth) / 2;
  return {
    left: containerRect.left + insetX,
    top: containerRect.top,
    width: fittedWidth,
    height: containerRect.height,
  };
}

function readPayload(productId: string) {
  try {
    const raw = window.sessionStorage.getItem("unseen:product-view-transition");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TransitionPayload;
    const isFresh = Date.now() - parsed.at < 30 * 60 * 1000;
    if (!isFresh || parsed.itemId !== productId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isRectMostlyInViewport(rect: DOMRect, minVisibleRatio = 0.22) {
  if (rect.width <= 0 || rect.height <= 0) return false;
  const viewportTop = 0;
  const viewportBottom = window.innerHeight;
  const visibleTop = Math.max(viewportTop, rect.top);
  const visibleBottom = Math.min(viewportBottom, rect.bottom);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  return visibleHeight / rect.height >= minVisibleRatio;
}

function lockPageScrollForReturn() {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  const prevBodyPaddingRight = body.style.paddingRight;
  body.setAttribute(RETURN_PREV_BODY_PADDING_ATTR, prevBodyPaddingRight);

  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  if (scrollbarWidth > 0) {
    const computedBodyPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight);
    const safeBodyPaddingRight = Number.isFinite(computedBodyPaddingRight) ? computedBodyPaddingRight : 0;
    body.style.paddingRight = `${safeBodyPaddingRight + scrollbarWidth}px`;
  }

  try {
    // Always reset stale "finished" marker before a new return flight begins.
    window.sessionStorage.removeItem(RETURN_FLIGHT_FINISHED_KEY);
    window.sessionStorage.setItem(RETURN_SCROLL_LOCK_KEY, "1");
    window.sessionStorage.setItem(RETURN_SCROLL_INTENT_KEY, "0");
  } catch {
    // Non-critical.
  }
  root.style.overflow = "hidden";
  body.style.overflow = "hidden";
  root.style.overscrollBehavior = "none";
  body.style.overscrollBehavior = "none";
  root.style.touchAction = "none";
  body.style.touchAction = "none";
}

function writeReturnScrollIntent(delta: number) {
  if (typeof window === "undefined") return;
  if (Math.abs(delta) < 1) return;
  try {
    window.sessionStorage.setItem(
      RETURN_SCROLL_INTENT_KEY,
      JSON.stringify({
        direction: delta > 0 ? 1 : -1,
        at: Date.now(),
      }),
    );
  } catch {
    // Non-critical.
  }
}

function startReturnIntentCapture() {
  if (typeof window === "undefined") return () => {};
  let touchStartY: number | null = null;

  const onWheel = (event: WheelEvent) => {
    writeReturnScrollIntent(event.deltaY);
  };
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    touchStartY = touch ? touch.clientY : null;
  };
  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch || touchStartY === null) return;
    const delta = touchStartY - touch.clientY;
    writeReturnScrollIntent(delta);
    touchStartY = touch.clientY;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (["ArrowDown", "PageDown", " ", "End"].includes(event.key)) {
      writeReturnScrollIntent(1);
      return;
    }
    if (["ArrowUp", "PageUp", "Home"].includes(event.key)) {
      writeReturnScrollIntent(-1);
    }
  };

  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("keydown", onKeyDown);

  return () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("keydown", onKeyDown);
  };
}

function startReturnScrollBlock() {
  if (typeof window === "undefined") return () => {};
  let touchStartY: number | null = null;
  const isScrollKey = (key: string) =>
    ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"].includes(key);

  const onWheel = (event: WheelEvent) => {
    writeReturnScrollIntent(event.deltaY);
    event.preventDefault();
  };
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    touchStartY = touch ? touch.clientY : null;
  };
  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch && touchStartY !== null) {
      const delta = touchStartY - touch.clientY;
      writeReturnScrollIntent(delta);
      touchStartY = touch.clientY;
    }
    event.preventDefault();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isScrollKey(event.key)) return;
    if (["ArrowDown", "PageDown", " ", "Spacebar", "End"].includes(event.key)) {
      writeReturnScrollIntent(1);
    } else {
      writeReturnScrollIntent(-1);
    }
    event.preventDefault();
  };

  window.addEventListener("wheel", onWheel, { passive: false, capture: true });
  window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
  window.addEventListener("keydown", onKeyDown, true);

  return () => {
    window.removeEventListener("wheel", onWheel, true);
    window.removeEventListener("touchstart", onTouchStart, true);
    window.removeEventListener("touchmove", onTouchMove, true);
    window.removeEventListener("keydown", onKeyDown, true);
  };
}

function startReturnInteractionBlock() {
  if (typeof window === "undefined") return () => {};

  const blockPointer = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const blockClickLike = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  window.addEventListener("pointerdown", blockPointer, true);
  window.addEventListener("pointerup", blockPointer, true);
  window.addEventListener("mousedown", blockClickLike, true);
  window.addEventListener("mouseup", blockClickLike, true);
  window.addEventListener("click", blockClickLike, true);
  window.addEventListener("dblclick", blockClickLike, true);
  window.addEventListener("touchstart", blockPointer, { passive: false, capture: true });
  window.addEventListener("touchend", blockPointer, { passive: false, capture: true });
  window.addEventListener("contextmenu", blockClickLike, true);

  return () => {
    window.removeEventListener("pointerdown", blockPointer, true);
    window.removeEventListener("pointerup", blockPointer, true);
    window.removeEventListener("mousedown", blockClickLike, true);
    window.removeEventListener("mouseup", blockClickLike, true);
    window.removeEventListener("click", blockClickLike, true);
    window.removeEventListener("dblclick", blockClickLike, true);
    window.removeEventListener("touchstart", blockPointer, true);
    window.removeEventListener("touchend", blockPointer, true);
    window.removeEventListener("contextmenu", blockClickLike, true);
  };
}

function signalReturnFlightFinished() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RETURN_FLIGHT_FINISHED_KEY, "1");
  } catch {
    // Non-critical.
  }
  window.dispatchEvent(new CustomEvent(RETURN_FLIGHT_FINISHED_EVENT));
}

export function ProductViewCloseButton({
  backHref,
  className,
  enableBackdropClose = false,
  productId,
}: ProductViewCloseButtonProps) {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);
  const CLOSE_DURATION_MS = 780;
  const CLOSE_END_HOLD_MS = 48;
  const CLOSE_TARGET_REVEAL_LEAD_MS = 360;
  const CLOSE_TARGET_REVEAL_LEAD_IMMERSIVE_MS = 320;
  const CLOSE_ROUTE_DELAY_MS = 260;
  const CLOSE_TEXT_EXIT_DELAY_MS = 120;
  const CLOSE_SHELL_FADE_DURATION_MS = 460;
  const CLOSE_SHELL_FADE_DELAY_MS = 70;
  const isImmersiveReturn = backHref.includes("/immersive");
  const isWorld2Return = backHref.includes("/world-2");
  const closeEndHoldMs = isImmersiveReturn ? 190 : isWorld2Return ? 80 : CLOSE_END_HOLD_MS;

  useEffect(() => {
    router.prefetch(backHref);
  }, [backHref, router]);

  const handleClose = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setIsAnimating(true);
    lockPageScrollForReturn();
    const stopIntentCapture = startReturnIntentCapture();
    const stopScrollBlock = startReturnScrollBlock();
    const stopInteractionBlock = startReturnInteractionBlock();
    let hardBlockReleased = false;
    let hardBlockReleaseTimer: number | null = null;
    const onReturnFlightFinished = () => {
      if (hardBlockReleased) return;
      hardBlockReleased = true;
      if (hardBlockReleaseTimer !== null) {
        window.clearTimeout(hardBlockReleaseTimer);
        hardBlockReleaseTimer = null;
      }
      window.removeEventListener(RETURN_FLIGHT_FINISHED_EVENT, onReturnFlightFinished as EventListener);
      stopScrollBlock();
      stopInteractionBlock();
    };
    window.addEventListener(RETURN_FLIGHT_FINISHED_EVENT, onReturnFlightFinished as EventListener);
    hardBlockReleaseTimer = window.setTimeout(() => {
      onReturnFlightFinished();
    }, 2200);
    window.dispatchEvent(new CustomEvent("unseen:product-view-closing"));
    const payload = readPayload(productId);
    const shellRoot = document.querySelector('[data-pv-shell="true"]') as HTMLElement | null;
    const textRoot = document.querySelector('[data-pv-info-block="true"]') as HTMLElement | null;
    const imageRoot = document.querySelector('[data-pv-main-image-root="true"]') as HTMLElement | null;
    const imageTag = imageRoot?.querySelector("img") as HTMLImageElement | null;
    const imageRect = imageRoot?.getBoundingClientRect() ?? null;
    const canUseImageReturn = Boolean(payload && imageRoot && imageRect && isRectMostlyInViewport(imageRect));
    let closeDurationMs = CLOSE_DURATION_MS;
    let closeSettleHoldMs = closeEndHoldMs;
    let world2TravelRatio = 0;
    let world2MotionIntensity = 0;
    let closeFlightEasing = "cubic-bezier(0.22, 1, 0.36, 1)";
    let closeOverlay: HTMLDivElement | null = null;
    const returnBackdropDetail = canUseImageReturn
      ? {
          targetOpacity: 0.055,
          raiseMs: 240,
          holdMs: 160,
          fallMs: 1080,
        }
      : {
          targetOpacity: 0.05,
          raiseMs: 110,
          holdMs: 220,
          fallMs: 1700,
        };
    window.dispatchEvent(
      new CustomEvent("unseen:return-transition-start", {
        detail: {
          targetOpacity: returnBackdropDetail.targetOpacity,
          blurPx: 0,
          raiseMs: returnBackdropDetail.raiseMs,
          holdMs: returnBackdropDetail.holdMs,
          fallMs: returnBackdropDetail.fallMs,
        },
      }),
    );

    if (imageRoot) {
      imageRoot.style.willChange = "opacity";
      imageRoot.style.transition = "none";
      imageRoot.style.opacity = "0";
      imageRoot.style.visibility = "hidden";
    }

    if (textRoot) {
      textRoot.style.willChange = "opacity, transform";
      textRoot.style.transition = `opacity 460ms ease-out ${CLOSE_TEXT_EXIT_DELAY_MS}ms, transform 620ms cubic-bezier(0.22, 1, 0.36, 1) ${CLOSE_TEXT_EXIT_DELAY_MS}ms`;
      textRoot.style.opacity = "0";
      textRoot.style.transform = "translate3d(0px, -8px, 0px)";
    }

    if (canUseImageReturn && shellRoot) {
      shellRoot.style.willChange = "opacity";
      shellRoot.style.transition = `opacity ${CLOSE_SHELL_FADE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${CLOSE_SHELL_FADE_DELAY_MS}ms`;
      shellRoot.style.opacity = "0";
      shellRoot.style.pointerEvents = "none";
    }

    if (canUseImageReturn && payload && imageRoot) {
      const rootRect = imageRoot.getBoundingClientRect();
      const aspectRatio =
        payload.aspectRatio && payload.aspectRatio > 0
          ? payload.aspectRatio
          : imageTag && imageTag.naturalWidth > 0 && imageTag.naturalHeight > 0
            ? imageTag.naturalWidth / imageTag.naturalHeight
            : 0;
      const start = aspectRatio > 0 ? getContainRect(rootRect, aspectRatio) : imageTag?.getBoundingClientRect() ?? rootRect;
      const translateX = payload.left - start.left;
      const translateY = payload.top - start.top;
      const scaleX = payload.width / Math.max(start.width, 1);
      const scaleY = payload.height / Math.max(start.height, 1);
      const scale = (scaleX + scaleY) * 0.5;
      if (isWorld2Return) {
        const travelDistancePx = Math.hypot(translateX, translateY);
        const viewportDiagonalPx = Math.max(1, Math.hypot(window.innerWidth, window.innerHeight));
        const travelRatio = Math.min(2.2, travelDistancePx / viewportDiagonalPx);
        const clampedScale = Math.max(0.08, Math.min(12, scale));
        const scaleDeltaRatio = Math.abs(Math.log(clampedScale));
        const motionIntensity = Math.min(3.2, travelRatio * 1.1 + scaleDeltaRatio * 0.7);
        world2TravelRatio = travelRatio;
        world2MotionIntensity = motionIntensity;
        closeDurationMs = Math.round(
          Math.min(1820, Math.max(CLOSE_DURATION_MS, CLOSE_DURATION_MS + motionIntensity * 320)),
        );
        closeSettleHoldMs = Math.round(
          Math.min(170, Math.max(closeEndHoldMs, closeEndHoldMs + motionIntensity * 34)),
        );
        closeFlightEasing = "cubic-bezier(0.2, 0.88, 0.24, 1)";
      }
      const visibleTop = getVisibleGridTop();

      closeOverlay = document.createElement("div");
      closeOverlay.style.position = "fixed";
      closeOverlay.style.left = "0px";
      closeOverlay.style.top = "0px";
      closeOverlay.style.width = "100vw";
      closeOverlay.style.height = "100vh";
      closeOverlay.style.zIndex = "180";
      closeOverlay.style.pointerEvents = "none";
      closeOverlay.style.overflow = "hidden";
      if (visibleTop > 0) {
        const clip = `inset(${visibleTop}px 0px 0px 0px)`;
        closeOverlay.style.clipPath = clip;
        closeOverlay.style.setProperty("-webkit-clip-path", clip);
      }

      const motionLayer = document.createElement("div");
      motionLayer.style.position = "absolute";
      motionLayer.style.left = `${start.left}px`;
      motionLayer.style.top = `${start.top}px`;
      motionLayer.style.width = `${start.width}px`;
      motionLayer.style.height = `${start.height}px`;
      motionLayer.style.transformOrigin = "top left";
      motionLayer.style.willChange = "transform, opacity";
      motionLayer.style.transform = "translate3d(0px, 0px, 0px) scale(1, 1)";
      motionLayer.style.backfaceVisibility = "hidden";
      motionLayer.style.webkitBackfaceVisibility = "hidden";
      motionLayer.style.contain = "layout paint style";

      const overlayImg = document.createElement("img");
      overlayImg.src = imageTag?.currentSrc || imageTag?.src || payload.src;
      overlayImg.alt = "";
      overlayImg.decoding = "sync";
      overlayImg.loading = "eager";
      overlayImg.style.width = "100%";
      overlayImg.style.height = "100%";
      overlayImg.style.objectFit = "contain";
      overlayImg.style.display = "block";
      overlayImg.style.backfaceVisibility = "hidden";
      overlayImg.style.webkitBackfaceVisibility = "hidden";
      overlayImg.style.transform = "translateZ(0)";
      motionLayer.appendChild(overlayImg);
      closeOverlay.appendChild(motionLayer);
      document.body.appendChild(closeOverlay);
      let cleanupTimerId: number | null = null;
      let didSignalFlightFinished = false;

      const markFlightFinished = () => {
        if (didSignalFlightFinished) return;
        didSignalFlightFinished = true;
        signalReturnFlightFinished();
      };

      const removeCloseOverlay = () => {
        if (cleanupTimerId !== null) {
          window.clearTimeout(cleanupTimerId);
          cleanupTimerId = null;
        }
        closeOverlay?.remove();
        closeOverlay = null;
        markFlightFinished();
      };

      let motion: Animation | null = null;
      const startFlight = () => {
        motion = motionLayer.animate(
          [
            { transform: "translate3d(0px, 0px, 0px) scale(1, 1)" },
            { transform: `translate3d(${translateX}px, ${translateY}px, 0px) scale(${scale}, ${scale})` },
          ],
          {
            duration: closeDurationMs,
            easing: closeFlightEasing,
            fill: "forwards",
          },
        );
        motion.addEventListener(
          "finish",
          () => {
            window.setTimeout(() => {
              removeCloseOverlay();
            }, Math.max(0, closeSettleHoldMs));
          },
          { once: true },
        );
      };
      window.requestAnimationFrame(startFlight);
      cleanupTimerId = window.setTimeout(() => {
        motion?.cancel();
        removeCloseOverlay();
      }, closeDurationMs + closeSettleHoldMs + 500);
    } else {
      const shell = document.querySelector('[data-pv-shell="true"]') as HTMLElement | null;
      if (shell) {
        const rect = shell.getBoundingClientRect();
        closeOverlay = document.createElement("div");
        closeOverlay.style.position = "fixed";
        closeOverlay.style.left = `${rect.left}px`;
        closeOverlay.style.top = `${rect.top}px`;
        closeOverlay.style.width = `${rect.width}px`;
        closeOverlay.style.height = `${rect.height}px`;
        closeOverlay.style.zIndex = "180";
        closeOverlay.style.pointerEvents = "none";
        closeOverlay.style.background = "var(--paper)";
        closeOverlay.style.willChange = "opacity";

        const shellClone = shell.cloneNode(true) as HTMLElement;
        shellClone.style.margin = "0";
        shellClone.style.width = "100%";
        shellClone.style.height = "100%";
        shellClone.style.pointerEvents = "none";
        closeOverlay.appendChild(shellClone);
        document.body.appendChild(closeOverlay);
        shell.style.pointerEvents = "none";

        const fadeMotion = closeOverlay.animate(
          [
            { opacity: 1 },
            { opacity: 0 },
          ],
          {
            duration: 520,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          },
        );
        fadeMotion.addEventListener(
          "finish",
          () => {
            closeOverlay?.remove();
            closeOverlay = null;
            signalReturnFlightFinished();
          },
          { once: true },
        );
        window.setTimeout(() => {
          fadeMotion.cancel();
          closeOverlay?.remove();
          closeOverlay = null;
        }, 1100);
      }
    }

    window.setTimeout(() => {
      stopIntentCapture();
      if (isWorld2Return) {
        try {
          const now = Date.now();
          const remainingFlightMs = Math.max(0, closeDurationMs + closeSettleHoldMs - CLOSE_ROUTE_DELAY_MS);
          const world2RevealLagMs = Math.round(72 + world2MotionIntensity * 22 + world2TravelRatio * 10);
          const world2LockTailMs = Math.round(38 + world2MotionIntensity * 24);
          window.sessionStorage.setItem(
            WORLD2_RETURN_REVEAL_KEY,
            JSON.stringify({
              at: now,
              href: backHref,
              revealAt: now + remainingFlightMs + world2RevealLagMs,
              lockUntil: now + remainingFlightMs + world2RevealLagMs + world2LockTailMs,
              fadeMs: 260,
            }),
          );
        } catch {
          // Optional return polish only.
        }
      }
      if (canUseImageReturn) {
        try {
          const closeSettleMs = Math.max(0, closeSettleHoldMs);
          const hideBaseMs = closeDurationMs + closeSettleMs;
          const targetRevealLeadMs = isImmersiveReturn
            ? CLOSE_TARGET_REVEAL_LEAD_IMMERSIVE_MS
            : CLOSE_TARGET_REVEAL_LEAD_MS;
          window.sessionStorage.setItem(
            RETURN_FOCUS_ITEM_KEY,
            JSON.stringify({
              itemId: productId,
              at: Date.now(),
              hideUntil: Date.now() + Math.max(0, hideBaseMs - targetRevealLeadMs),
            }),
          );
        } catch {
          // Optional return polish only.
        }
      }
      if (window.history.length > 1) {
        router.back();
        return;
      }
      router.push(backHref, { scroll: false });
    }, CLOSE_ROUTE_DELAY_MS);
  }, [backHref, closeEndHoldMs, isImmersiveReturn, isWorld2Return, productId, router]);

  useEffect(() => {
    if (!enableBackdropClose) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const hasProtectedHit = path.some((entry) => {
        if (!(entry instanceof Element)) return false;
        return (
          entry.matches('[data-pv-close-button="true"]') ||
          entry.matches('[data-pv-info-block="true"]') ||
          entry.matches('[data-pv-info-hit="true"]') ||
          entry.matches('[data-pv-image-hit="true"]')
        );
      });
      if (hasProtectedHit) return;

      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest('[data-pv-close-button="true"]')) return;
      if (target.closest('[data-pv-info-block="true"]')) return;
      if (target.closest('[data-pv-info-hit="true"]')) return;
      if (target.closest('[data-pv-image-hit="true"]')) return;

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
        className="absolute block h-[1.5px] w-[15px] rounded-full bg-current rotate-45"
      />
      <span
        aria-hidden="true"
        className="absolute block h-[1.5px] w-[15px] rounded-full bg-current -rotate-45"
      />
    </button>
  );
}
