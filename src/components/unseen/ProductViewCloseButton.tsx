"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nextAnimationFrame, waitForProductImageDecode, warmProductImage } from "@/components/unseen/productImagePreload";

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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getIndicatedTextExit(payload: TransitionPayload, target: DOMRect) {
  const sourceCenterX = payload.left + payload.width * 0.5;
  const sourceCenterY = payload.top + payload.height * 0.5;
  const targetCenterX = target.left + target.width * 0.5;
  const targetCenterY = target.top + target.height * 0.5;

  return {
    scale: 0.992,
    x: clampNumber((sourceCenterX - targetCenterX) * 0.045, -18, 18),
    y: clampNumber((sourceCenterY - targetCenterY) * 0.045, -16, 16),
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

  const scrollBlockOptions = { passive: false, capture: true } as const;
  const touchStartOptions = { passive: true, capture: true } as const;
  const keyBlockOptions = { capture: true } as const;

  window.addEventListener("wheel", onWheel, scrollBlockOptions);
  window.addEventListener("touchstart", onTouchStart, touchStartOptions);
  window.addEventListener("touchmove", onTouchMove, scrollBlockOptions);
  window.addEventListener("keydown", onKeyDown, keyBlockOptions);

  return () => {
    window.removeEventListener("wheel", onWheel, scrollBlockOptions);
    window.removeEventListener("touchstart", onTouchStart, touchStartOptions);
    window.removeEventListener("touchmove", onTouchMove, scrollBlockOptions);
    window.removeEventListener("keydown", onKeyDown, keyBlockOptions);
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
  const touchBlockOptions = { passive: false, capture: true } as const;
  const captureOptions = { capture: true } as const;

  window.addEventListener("pointerdown", blockPointer, captureOptions);
  window.addEventListener("pointerup", blockPointer, captureOptions);
  window.addEventListener("mousedown", blockClickLike, captureOptions);
  window.addEventListener("mouseup", blockClickLike, captureOptions);
  window.addEventListener("click", blockClickLike, captureOptions);
  window.addEventListener("dblclick", blockClickLike, captureOptions);
  window.addEventListener("touchstart", blockPointer, touchBlockOptions);
  window.addEventListener("touchend", blockPointer, touchBlockOptions);
  window.addEventListener("contextmenu", blockClickLike, captureOptions);

  return () => {
    window.removeEventListener("pointerdown", blockPointer, captureOptions);
    window.removeEventListener("pointerup", blockPointer, captureOptions);
    window.removeEventListener("mousedown", blockClickLike, captureOptions);
    window.removeEventListener("mouseup", blockClickLike, captureOptions);
    window.removeEventListener("click", blockClickLike, captureOptions);
    window.removeEventListener("dblclick", blockClickLike, captureOptions);
    window.removeEventListener("touchstart", blockPointer, touchBlockOptions);
    window.removeEventListener("touchend", blockPointer, touchBlockOptions);
    window.removeEventListener("contextmenu", blockClickLike, captureOptions);
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
  const hasViewportResizedRef = useRef(false);
  const initialViewportSizeRef = useRef<{ height: number; width: number } | null>(null);
  const CLOSE_DURATION_MS = 640;
  const CLOSE_END_HOLD_MS = 36;
  const CLOSE_TARGET_PREPAINT_LEAD_MS = 80;
  const CLOSE_ROUTE_DELAY_MS = 260;
  const CLOSE_TEXT_EXIT_DELAY_MS = 120;
  const CLOSE_SHELL_FADE_DURATION_MS = 460;
  const CLOSE_SHELL_FADE_DELAY_MS = 70;
  const CLOSE_ICON_LINE_WIDTH_PX = 18;
  const CLOSE_ICON_STROKE_PX = 1.5;
  const CLOSE_ICON_BOX_HEIGHT_PX = 14;
  const closeIconCenterPx = CLOSE_ICON_BOX_HEIGHT_PX / 2 - CLOSE_ICON_STROKE_PX / 2;
  const isImmersiveReturn = backHref.includes("/immersive");
  const closeEndHoldMs = isImmersiveReturn ? 80 : CLOSE_END_HOLD_MS;

  useEffect(() => {
    router.prefetch(backHref);
  }, [backHref, router]);

  useEffect(() => {
    let isArmed = false;
    let raf1: number | null = null;
    let raf2: number | null = null;

    const readSize = () => ({
      height: Math.round(window.visualViewport?.height ?? window.innerHeight),
      width: Math.round(window.visualViewport?.width ?? window.innerWidth),
    });

    const markIfResized = () => {
      if (!isArmed) return;
      const initial = initialViewportSizeRef.current;
      if (!initial) return;
      const current = readSize();
      if (Math.abs(current.width - initial.width) > 2 || Math.abs(current.height - initial.height) > 2) {
        hasViewportResizedRef.current = true;
      }
    };

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        initialViewportSizeRef.current = readSize();
        isArmed = true;
      });
    });

    window.addEventListener("resize", markIfResized);
    window.visualViewport?.addEventListener("resize", markIfResized);
    return () => {
      if (raf1 !== null) window.cancelAnimationFrame(raf1);
      if (raf2 !== null) window.cancelAnimationFrame(raf2);
      window.removeEventListener("resize", markIfResized);
      window.visualViewport?.removeEventListener("resize", markIfResized);
    };
  }, []);

  const handleClose = useCallback(async () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setIsAnimating(true);
    lockPageScrollForReturn();
    const stopIntentCapture = startReturnIntentCapture();
    const stopScrollBlock = startReturnScrollBlock();
    const stopInteractionBlock = isImmersiveReturn ? () => {} : startReturnInteractionBlock();
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
    const useIndicatedImageReturn = isImmersiveReturn && !hasViewportResizedRef.current;
    const canUseImageReturn = Boolean(
      payload &&
      imageRoot &&
      imageRect &&
      isRectMostlyInViewport(imageRect) &&
      !hasViewportResizedRef.current,
    );
    const canUseExactImageReturn = canUseImageReturn && !useIndicatedImageReturn;
    const canUseIndicatedImageReturn = canUseImageReturn && useIndicatedImageReturn;
    let closeDurationMs = CLOSE_DURATION_MS;
    let closeSettleHoldMs = closeEndHoldMs;
    let closeFlightEasing = "cubic-bezier(0.22, 1, 0.36, 1)";
    let closeOverlay: HTMLDivElement | null = null;
    const returnBackdropDetail = canUseExactImageReturn || canUseIndicatedImageReturn
      ? {
          targetOpacity: isImmersiveReturn ? 0.085 : 0.16,
          raiseMs: 240,
          holdMs: isImmersiveReturn ? 260 : 260,
          fallMs: isImmersiveReturn ? 1260 : 780,
        }
      : {
          targetOpacity: isImmersiveReturn ? 0.08 : 0.18,
          raiseMs: 110,
          holdMs: isImmersiveReturn ? 300 : 280,
          fallMs: isImmersiveReturn ? 1500 : 860,
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

    const hideLiveImage = () => {
      if (!imageRoot) return;
      imageRoot.style.willChange = "opacity";
      imageRoot.style.transition = "none";
      imageRoot.style.opacity = "0";
      imageRoot.style.visibility = "hidden";
    };

    if (imageRoot && !canUseExactImageReturn && !canUseIndicatedImageReturn) {
      hideLiveImage();
    }

    if (textRoot) {
      const textExit =
        isImmersiveReturn && payload
          ? getIndicatedTextExit(payload, textRoot.getBoundingClientRect())
          : null;
      const textTransform = textExit
        ? `translate3d(${textExit.x}px, ${textExit.y}px, 0px) scale(${textExit.scale})`
        : "translate3d(0px, -8px, 0px)";
      textRoot.style.willChange = "opacity, transform";
      textRoot.style.transformOrigin = "center center";
      textRoot.style.transition = textExit
        ? "opacity 440ms ease-out 80ms, transform 700ms cubic-bezier(0.22, 1, 0.36, 1) 60ms"
        : `opacity 460ms ease-out ${CLOSE_TEXT_EXIT_DELAY_MS}ms, transform 620ms cubic-bezier(0.22, 1, 0.36, 1) ${CLOSE_TEXT_EXIT_DELAY_MS}ms`;
      textRoot.style.opacity = "0";
      textRoot.style.transform = textTransform;
    }

    if ((canUseExactImageReturn || canUseIndicatedImageReturn) && shellRoot) {
      shellRoot.style.willChange = "opacity";
      shellRoot.style.transition = `opacity ${CLOSE_SHELL_FADE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${CLOSE_SHELL_FADE_DELAY_MS}ms`;
      shellRoot.style.opacity = "0";
      shellRoot.style.pointerEvents = "none";
    }

    if (canUseExactImageReturn && payload && imageRoot) {
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
      if (isImmersiveReturn) {
        const travelDistancePx = Math.hypot(translateX, translateY);
        const viewportDiagonalPx = Math.max(1, Math.hypot(window.innerWidth, window.innerHeight));
        const travelRatio = Math.min(2.2, travelDistancePx / viewportDiagonalPx);
        const clampedScale = Math.max(0.08, Math.min(12, scale));
        const scaleDeltaRatio = Math.abs(Math.log(clampedScale));
        const motionIntensity = Math.min(3.2, travelRatio * 1.1 + scaleDeltaRatio * 0.7);
        closeDurationMs = Math.round(
          Math.min(1280, Math.max(CLOSE_DURATION_MS, CLOSE_DURATION_MS + motionIntensity * 205)),
        );
        closeSettleHoldMs = Math.round(
          Math.min(140, Math.max(closeEndHoldMs, closeEndHoldMs + motionIntensity * 28)),
        );
        closeFlightEasing = "cubic-bezier(0.2, 0.88, 0.24, 1)";
      }
      const visibleTop = isImmersiveReturn ? 0 : getVisibleGridTop();

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
      motionLayer.style.transformStyle = "preserve-3d";
      motionLayer.style.contain = "layout paint style";
      motionLayer.style.userSelect = "none";

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
      overlayImg.style.userSelect = "none";
      motionLayer.appendChild(overlayImg);
      closeOverlay.appendChild(motionLayer);
      document.body.appendChild(closeOverlay);
      await waitForProductImageDecode(overlayImg, payload.src, 90);
      void warmProductImage(imageTag?.currentSrc || imageTag?.src || payload.src);
      await nextAnimationFrame();
      await nextAnimationFrame();
      hideLiveImage();
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
    } else if (canUseIndicatedImageReturn && payload && imageRoot) {
      closeDurationMs = 760;
      closeSettleHoldMs = 70;
      const rootRect = imageRoot.getBoundingClientRect();
      const aspectRatio =
        payload.aspectRatio && payload.aspectRatio > 0
          ? payload.aspectRatio
          : imageTag && imageTag.naturalWidth > 0 && imageTag.naturalHeight > 0
            ? imageTag.naturalWidth / imageTag.naturalHeight
            : 0;
      const start = aspectRatio > 0 ? getContainRect(rootRect, aspectRatio) : imageTag?.getBoundingClientRect() ?? rootRect;
      const startCenterX = start.left + start.width * 0.5;
      const startCenterY = start.top + start.height * 0.5;
      const sourceCenterX = payload.left + payload.width * 0.5;
      const sourceCenterY = payload.top + payload.height * 0.5;
      const deltaX = sourceCenterX - startCenterX;
      const deltaY = sourceCenterY - startCenterY;
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      const driftDistance = Math.min(74, Math.max(30, distance * 0.1));
      const indicatedX = (deltaX / distance) * driftDistance;
      const indicatedY = (deltaY / distance) * driftDistance;
      const indicatedScale = 0.88;
      const visibleTop = isImmersiveReturn ? 0 : getVisibleGridTop();

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
      motionLayer.style.transformOrigin = "center center";
      motionLayer.style.willChange = "transform, opacity";
      motionLayer.style.transform = "translate3d(0px, 0px, 0px) scale(1, 1)";
      motionLayer.style.backfaceVisibility = "hidden";
      motionLayer.style.webkitBackfaceVisibility = "hidden";
      motionLayer.style.transformStyle = "preserve-3d";
      motionLayer.style.contain = "layout paint style";
      motionLayer.style.userSelect = "none";

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
      overlayImg.style.userSelect = "none";
      motionLayer.appendChild(overlayImg);
      closeOverlay.appendChild(motionLayer);
      document.body.appendChild(closeOverlay);
      await waitForProductImageDecode(overlayImg, payload.src, 70);
      void warmProductImage(imageTag?.currentSrc || imageTag?.src || payload.src);
      await nextAnimationFrame();
      await nextAnimationFrame();
      hideLiveImage();

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
            { transform: "translate3d(0px, 0px, 0px) scale(1, 1)", opacity: 1 },
            {
              transform: `translate3d(${indicatedX * 0.46}px, ${indicatedY * 0.46}px, 0px) scale(${1 - (1 - indicatedScale) * 0.46}, ${1 - (1 - indicatedScale) * 0.46})`,
              opacity: 0.78,
              offset: 0.52,
            },
            { transform: `translate3d(${indicatedX}px, ${indicatedY}px, 0px) scale(${indicatedScale}, ${indicatedScale})`, opacity: 0 },
          ],
          {
            duration: closeDurationMs,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          },
        );
        motion.addEventListener(
          "finish",
          () => {
            window.setTimeout(removeCloseOverlay, Math.max(0, closeSettleHoldMs));
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
      if (isImmersiveReturn) {
        try {
          const now = Date.now();
          const world2RevealLagMs = canUseIndicatedImageReturn
            ? Math.max(500, closeDurationMs + closeSettleHoldMs - CLOSE_ROUTE_DELAY_MS - 40)
            : 180;
          const world2LockTailMs = canUseIndicatedImageReturn ? 80 : 60;
          window.sessionStorage.setItem(
            WORLD2_RETURN_REVEAL_KEY,
            JSON.stringify({
              at: now,
              itemId: productId,
              href: backHref,
              revealAt: now + world2RevealLagMs,
              lockUntil: now + world2RevealLagMs + world2LockTailMs,
              fadeMs: canUseIndicatedImageReturn ? 380 : 500,
            }),
          );
        } catch {
          // Optional return polish only.
        }
      }
      if (canUseExactImageReturn || canUseIndicatedImageReturn) {
        try {
          const closeSettleMs = Math.max(0, closeSettleHoldMs);
          const remainingHideBaseMs = Math.max(0, closeDurationMs + closeSettleMs - CLOSE_ROUTE_DELAY_MS);
          const targetPrepaintLeadMs = canUseExactImageReturn ? CLOSE_TARGET_PREPAINT_LEAD_MS : 0;
          window.sessionStorage.setItem(
            RETURN_FOCUS_ITEM_KEY,
            JSON.stringify({
              itemId: productId,
              at: Date.now(),
              hideUntil: Date.now() + Math.max(0, remainingHideBaseMs - targetPrepaintLeadMs),
            }),
          );
        } catch {
          // Optional return polish only.
        }
      }
      router.replace(backHref, { scroll: false });
    }, CLOSE_ROUTE_DELAY_MS);
  }, [backHref, closeEndHoldMs, isImmersiveReturn, productId, router]);

  useEffect(() => {
    if (!enableBackdropClose) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const hasProtectedHit = path.some((entry) => {
        if (!(entry instanceof Element)) return false;
        return (
          entry.matches('[data-pv-close-button="true"]') ||
          entry.matches('[data-pv-info-hit="true"]') ||
          entry.matches('[data-pv-image-hit="true"]')
        );
      });
      if (hasProtectedHit) return;

      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest('[data-pv-close-button="true"]')) return;
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
