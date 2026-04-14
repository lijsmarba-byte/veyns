"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type RailImage = {
  id: string;
  src: string;
  alt: string;
};

type ProductImageRailProps = {
  cues: string[];
  disableMainImageTopLift?: boolean;
  images: RailImage[];
  mode: "gallery" | "archive";
  productId: string;
};

const DEFAULT_MAIN_ASPECT_RATIO = 560 / 660;
const ENTER_SCROLL_LOCK_KEY = "unseen:enter-scroll-lock";
const ENTER_SCROLL_INTENT_KEY = "unseen:enter-scroll-intent";
const ENTER_PREV_BODY_PADDING_ATTR = "data-unseen-enter-prev-pr";

function lockPageScrollForEnter() {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  const prevBodyPaddingRight = body.style.paddingRight;
  body.setAttribute(ENTER_PREV_BODY_PADDING_ATTR, prevBodyPaddingRight);

  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  if (scrollbarWidth > 0) {
    const computedBodyPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight);
    const safeBodyPaddingRight = Number.isFinite(computedBodyPaddingRight) ? computedBodyPaddingRight : 0;
    body.style.paddingRight = `${safeBodyPaddingRight + scrollbarWidth}px`;
  }

  try {
    window.sessionStorage.setItem(ENTER_SCROLL_LOCK_KEY, "1");
    window.sessionStorage.setItem(ENTER_SCROLL_INTENT_KEY, "0");
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

function unlockPageScrollForEnter() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ENTER_SCROLL_LOCK_KEY);
    window.sessionStorage.removeItem(ENTER_SCROLL_INTENT_KEY);
  } catch {
    // Non-critical.
  }
  const root = document.documentElement;
  const body = document.body;
  root.style.overflow = "";
  body.style.overflow = "";
  root.style.overscrollBehavior = "";
  body.style.overscrollBehavior = "";
  root.style.touchAction = "";
  body.style.touchAction = "";

  const prevBodyPaddingRight = body.getAttribute(ENTER_PREV_BODY_PADDING_ATTR);
  if (prevBodyPaddingRight !== null) {
    body.style.paddingRight = prevBodyPaddingRight;
    body.removeAttribute(ENTER_PREV_BODY_PADDING_ATTR);
  } else {
    body.style.paddingRight = "";
  }
}

function readTransitionAspectRatio(productId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem("unseen:product-view-transition");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; aspectRatio?: number; itemId?: string };
    const isFresh = typeof parsed.at === "number" && Date.now() - parsed.at < 30 * 60 * 1000;
    if (!isFresh || parsed.itemId !== productId) return null;
    if (!Number.isFinite(parsed.aspectRatio) || (parsed.aspectRatio ?? 0) <= 0) return null;
    return parsed.aspectRatio as number;
  } catch {
    return null;
  }
}

function getContainRect(containerRect: DOMRect, aspectRatio: number) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return {
      left: containerRect.left,
      top: containerRect.top,
      width: containerRect.width,
      height: containerRect.height,
    };
  }

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

export function ProductImageRail({
  images,
  cues,
  mode,
  productId,
  disableMainImageTopLift = false,
}: ProductImageRailProps) {
  const ENTER_DURATION_MS = 780;
  const ENTER_END_HOLD_MS = 12;
  const ENTER_CROSSFADE_MS = 280;
  const railRef = useRef<HTMLDivElement | null>(null);
  const firstImageRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const cuePillRef = useRef<HTMLSpanElement | null>(null);
  const cueTargetRef = useRef({ x: 0, y: 0 });
  const cueCurrentRef = useRef({ x: 0, y: 0 });
  const cueFrameRef = useRef<number | null>(null);
  const cuePointerActiveRef = useRef(false);
  const cueVisibleRef = useRef(false);
  const cueActiveIndexRef = useRef(0);
  const cueLastSwitchAtRef = useRef(0);
  const cuePrevTextTimerRef = useRef<number | null>(null);
  const cueActivationTimerRef = useRef<number | null>(null);
  const cueLastMoveRef = useRef<{ t: number; x: number; y: number }>({ t: 0, x: 0, y: 0 });
  const cueTravelDistanceRef = useRef(0);
  const [hasAnyFollowingImageInView, setHasAnyFollowingImageInView] = useState(false);
  const [isScrollHintDismissed, setIsScrollHintDismissed] = useState(false);
  const [railViewportBounds, setRailViewportBounds] = useState({ left: 0, width: 0 });
  const [isCueVisible, setIsCueVisible] = useState(false);
  const [activeCueIndex, setActiveCueIndex] = useState(0);
  const [previousCueText, setPreviousCueText] = useState<string | null>(null);
  const [areCuesEnabled, setAreCuesEnabled] = useState(false);
  const [isProductSaved, setIsProductSaved] = useState(false);
  const resolvedMainImageSrc = images[0]?.src ?? "";
  const [mainImageAspectRatio, setMainImageAspectRatio] = useState(
    () => readTransitionAspectRatio(productId) ?? DEFAULT_MAIN_ASPECT_RATIO,
  );

  const showScrollHint = useMemo(
    () => !hasAnyFollowingImageInView && !isScrollHintDismissed,
    [hasAnyFollowingImageInView, isScrollHintDismissed],
  );
  const resolvedCues = useMemo(() => cues.filter(Boolean), [cues]);
  const cuePillToneClass = mode === "archive" || isProductSaved ? "bg-accent" : "bg-ink";

  useEffect(() => {
    const following = sectionRefs.current.slice(1).filter(Boolean) as HTMLElement[];
    if (following.length === 0) return;

    const visibleById = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.imageId;
          if (!id) return;
          visibleById.set(id, entry.isIntersecting);
        });

        const anyVisible = Array.from(visibleById.values()).some(Boolean);
        setHasAnyFollowingImageInView(anyVisible);
      },
      { threshold: 0.01 },
    );

    following.forEach((node) => {
      observer.observe(node);
      visibleById.set(node.dataset.imageId ?? "", false);
    });

    return () => observer.disconnect();
  }, [images.length]);

  useEffect(() => {
    if (isScrollHintDismissed) return;

    let initialY = window.scrollY;

    const dismissHint = () => {
      setIsScrollHintDismissed(true);
    };

    const handleScroll = () => {
      const delta = Math.abs(window.scrollY - initialY);
      if (delta > 8) {
        dismissHint();
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > 2) {
        dismissHint();
      }
    };

    const handleTouchMove = () => {
      dismissHint();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " ", "End"].includes(event.key)) {
        dismissHint();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isScrollHintDismissed]);

  useEffect(() => {
    const updateRailBounds = () => {
      if (!railRef.current) return;
      const rect = railRef.current.getBoundingClientRect();
      setRailViewportBounds({
        left: Math.max(0, rect.left),
        width: Math.max(0, rect.width),
      });
    };

    updateRailBounds();
    window.addEventListener("resize", updateRailBounds);
    window.addEventListener("scroll", updateRailBounds, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && railRef.current) {
      resizeObserver = new ResizeObserver(updateRailBounds);
      resizeObserver.observe(railRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateRailBounds);
      window.removeEventListener("scroll", updateRailBounds);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    cueActiveIndexRef.current = activeCueIndex;
  }, [activeCueIndex]);

  useEffect(() => {
    return () => {
      if (cueFrameRef.current !== null) {
        window.cancelAnimationFrame(cueFrameRef.current);
      }
      if (cuePrevTextTimerRef.current !== null) {
        window.clearTimeout(cuePrevTextTimerRef.current);
      }
      if (cueActivationTimerRef.current !== null) {
        window.clearTimeout(cueActivationTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    setMainImageAspectRatio(readTransitionAspectRatio(productId) ?? DEFAULT_MAIN_ASPECT_RATIO);
  }, [productId]);

  useEffect(() => {
    const syncSavedState = () => {
      try {
        const raw = window.localStorage.getItem("unseen:saved-items");
        const records = raw ? (JSON.parse(raw) as Array<{ itemId: string }>) : [];
        setIsProductSaved(records.some((record) => record.itemId === productId));
      } catch {
        setIsProductSaved(false);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "unseen:saved-items") return;
      syncSavedState();
    };

    const handleSavedItemsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ itemId?: string; isSaved?: boolean }>).detail;
      if (!detail?.itemId || detail.itemId === productId) {
        syncSavedState();
      }
    };

    syncSavedState();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("unseen:saved-items-updated", handleSavedItemsUpdated as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("unseen:saved-items-updated", handleSavedItemsUpdated as EventListener);
    };
  }, [productId]);

  useLayoutEffect(() => {
    let cleanupTimer: number | null = null;
    let unlockFallbackTimer: number | null = null;
    const root = firstImageRef.current;
    const image = root?.querySelector("img") as HTMLImageElement | null;
    let overlay: HTMLDivElement | null = null;
    let overlayMotion: Animation | null = null;
    let removeImageReadyListeners: (() => void) | null = null;
    let removeIntentListeners: (() => void) | null = null;
    let assistRafId: number | null = null;
    let assistInputDetachTimer: number | null = null;
    let assistVelocity = 0;
    let assistUntil = 0;
    let assistLastTs = 0;
    let pendingScrollIntent = 0;
    let pendingScrollIntentAt = 0;
    let pendingScrollMagnitude = 16;
    let touchStartY: number | null = null;
    let hasEnterScrollLock = false;
    let didComplete = false;
    setAreCuesEnabled(true);

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const normalizeMagnitude = (delta: number) => clamp(Math.abs(delta), 8, 120);

    const feedAssistInput = (delta: number) => {
      const direction = delta > 0 ? 1 : -1;
      const magnitude = normalizeMagnitude(delta);
      const velocityBoost = 0.12 + magnitude * 0.0075;
      assistVelocity = clamp(assistVelocity * 0.78 + direction * velocityBoost, -2.8, 2.8);
      assistUntil = Math.max(assistUntil, performance.now() + 900);
    };

    const startAssistScroll = (direction: number, intentAt: number, magnitude: number) => {
      const now = Date.now();
      const age = now - intentAt;
      const freshFactor = age < 600 ? 1 : age < 1200 ? 0.82 : 0.68;
      const baseVelocity = clamp((0.28 + magnitude * 0.0115) * freshFactor, 0.38, 2.4);
      assistVelocity = direction * baseVelocity;
      assistUntil = performance.now() + 1050;
      assistLastTs = 0;

      const handleAssistWheel = (event: WheelEvent) => {
        if (Math.abs(event.deltaY) < 0.5) return;
        feedAssistInput(event.deltaY);
      };
      const handleAssistTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        touchStartY = touch ? touch.clientY : null;
      };
      const handleAssistTouchMove = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (!touch || touchStartY === null) return;
        const delta = touchStartY - touch.clientY;
        touchStartY = touch.clientY;
        if (Math.abs(delta) < 0.5) return;
        feedAssistInput(delta);
      };
      const handleAssistKey = (event: KeyboardEvent) => {
        if (["ArrowDown", "PageDown", " ", "End"].includes(event.key)) {
          feedAssistInput(18);
          return;
        }
        if (["ArrowUp", "PageUp", "Home"].includes(event.key)) {
          feedAssistInput(-18);
        }
      };
      const detachAssistInput = () => {
        window.removeEventListener("wheel", handleAssistWheel);
        window.removeEventListener("touchstart", handleAssistTouchStart);
        window.removeEventListener("touchmove", handleAssistTouchMove);
        window.removeEventListener("keydown", handleAssistKey);
      };
      window.addEventListener("wheel", handleAssistWheel, { passive: true });
      window.addEventListener("touchstart", handleAssistTouchStart, { passive: true });
      window.addEventListener("touchmove", handleAssistTouchMove, { passive: true });
      window.addEventListener("keydown", handleAssistKey);
      assistInputDetachTimer = window.setTimeout(() => {
        detachAssistInput();
        assistInputDetachTimer = null;
      }, 1300);

      const tick = (ts: number) => {
        const dt = assistLastTs > 0 ? Math.min(34, Math.max(0, ts - assistLastTs)) : 16;
        assistLastTs = ts;
        const active = ts <= assistUntil;
        const damping = active ? 0.92 : 0.85;
        assistVelocity *= damping;
        const step = assistVelocity * dt;
        if (Math.abs(step) > 0.01) {
          window.scrollBy({ top: step, left: 0, behavior: "auto" });
        }
        if (Math.abs(assistVelocity) > 0.035 || active) {
          assistRafId = window.requestAnimationFrame(tick);
        } else {
          assistRafId = null;
          if (assistInputDetachTimer !== null) {
            window.clearTimeout(assistInputDetachTimer);
            assistInputDetachTimer = null;
          }
          detachAssistInput();
        }
      };

      assistRafId = window.requestAnimationFrame(tick);
    };

    const rememberScrollIntent = (delta: number) => {
      if (!hasEnterScrollLock) return;
      if (Math.abs(delta) < 1) return;
      const magnitude = normalizeMagnitude(delta);
      pendingScrollIntent = delta > 0 ? 1 : -1;
      pendingScrollIntentAt = Date.now();
      pendingScrollMagnitude = magnitude;
      try {
        window.sessionStorage.setItem(
          ENTER_SCROLL_INTENT_KEY,
          JSON.stringify({
            direction: pendingScrollIntent,
            at: pendingScrollIntentAt,
            magnitude,
          }),
        );
      } catch {
        // Non-critical.
      }
    };

    const startEnterIntentCapture = () => {
      const onWheel = (event: WheelEvent) => {
        rememberScrollIntent(event.deltaY);
      };
      const onTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        touchStartY = touch ? touch.clientY : null;
      };
      const onTouchMove = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (!touch || touchStartY === null) return;
        const delta = touchStartY - touch.clientY;
        touchStartY = touch.clientY;
        rememberScrollIntent(delta);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (["ArrowDown", "PageDown", " ", "End"].includes(event.key)) {
          rememberScrollIntent(1);
          return;
        }
        if (["ArrowUp", "PageUp", "Home"].includes(event.key)) {
          rememberScrollIntent(-1);
        }
      };

      window.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("keydown", onKeyDown);
      removeIntentListeners = () => {
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("keydown", onKeyDown);
      };
    };

    const releaseEnterScrollLock = () => {
      if (!hasEnterScrollLock) return;
      hasEnterScrollLock = false;
      if (unlockFallbackTimer !== null) {
        window.clearTimeout(unlockFallbackTimer);
        unlockFallbackTimer = null;
      }
      removeIntentListeners?.();
      removeIntentListeners = null;
      unlockPageScrollForEnter();
      if (pendingScrollIntent !== 0) {
        const direction = pendingScrollIntent;
        const intentAt = pendingScrollIntentAt || Date.now();
        const magnitude = pendingScrollMagnitude;
        pendingScrollIntent = 0;
        pendingScrollIntentAt = 0;
        pendingScrollMagnitude = 16;
        window.requestAnimationFrame(() => {
          startAssistScroll(direction, intentAt, magnitude);
        });
      }
    };

    const clearStyles = () => {
      if (!root) return;
      root.style.opacity = "";
      root.style.transition = "";
      root.style.willChange = "";
    };

    const completeTransition = () => {
      if (didComplete) return;
      didComplete = true;
      if (cleanupTimer !== null) {
        window.clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
      removeImageReadyListeners?.();
      removeImageReadyListeners = null;
      overlayMotion?.cancel();
      overlay?.remove();
      overlayMotion = null;
      overlay = null;
      clearStyles();
      releaseEnterScrollLock();
      setAreCuesEnabled(true);
    };

    const runTransition = () => {
      if (!root) return;
      let raw: string | null = null;
      try {
        raw = window.sessionStorage.getItem("unseen:product-view-transition");
      } catch {
        return;
      }
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw) as {
          at: number;
          height: number;
          itemId: string;
          left: number;
          src: string;
          top: number;
          width: number;
          aspectRatio?: number;
        };
        const isFresh = Date.now() - parsed.at < 6000;
        if (!isFresh || parsed.itemId !== productId) return;
        if (!parsed.src?.startsWith("/")) return;
        const container = root.getBoundingClientRect();
        if (container.width < 2 || container.height < 2) return;

        const ratio =
          parsed.aspectRatio && parsed.aspectRatio > 0
            ? parsed.aspectRatio
            : image && image.naturalWidth > 0 && image.naturalHeight > 0
              ? image.naturalWidth / image.naturalHeight
              : mainImageAspectRatio;
        const fallbackLast = ratio > 0 ? getContainRect(container, ratio) : container;
        const liveImageRect = image?.getBoundingClientRect();
        const last =
          liveImageRect && liveImageRect.width > 2 && liveImageRect.height > 2
            ? {
                left: liveImageRect.left,
                top: liveImageRect.top,
                width: liveImageRect.width,
                height: liveImageRect.height,
              }
            : fallbackLast;
        if (last.width < 2 || last.height < 2) return;

        lockPageScrollForEnter();
        hasEnterScrollLock = true;
        startEnterIntentCapture();
        unlockFallbackTimer = window.setTimeout(() => {
          releaseEnterScrollLock();
        }, ENTER_DURATION_MS + ENTER_END_HOLD_MS + ENTER_CROSSFADE_MS + 700);

        setAreCuesEnabled(false);
        root.style.opacity = "0";
        root.style.willChange = "opacity";
        overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.left = `${parsed.left}px`;
        overlay.style.top = `${parsed.top}px`;
        overlay.style.width = `${parsed.width}px`;
        overlay.style.height = `${parsed.height}px`;
        overlay.style.transformOrigin = "top left";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "145";
        overlay.style.willChange = "transform, opacity";

        const overlayImg = document.createElement("img");
        overlayImg.src = image?.currentSrc || parsed.src;
        overlayImg.alt = "";
        overlayImg.decoding = "sync";
        overlayImg.loading = "eager";
        overlayImg.style.display = "block";
        overlayImg.style.width = "100%";
        overlayImg.style.height = "100%";
        overlayImg.style.objectFit = "contain";
        overlay.appendChild(overlayImg);
        document.body.appendChild(overlay);

        // Use exact endpoint geometry to eliminate last-frame size correction at handoff.
        const translateX = last.left - parsed.left;
        const translateY = last.top - parsed.top;
        const scaleX = last.width / Math.max(parsed.width, 1);
        const scaleY = last.height / Math.max(parsed.height, 1);

        overlayMotion = overlay.animate(
          [
            { transform: "translate3d(0px, 0px, 0px) scale(1, 1)", opacity: 1 },
            { transform: `translate3d(${translateX}px, ${translateY}px, 0px) scale(${scaleX}, ${scaleY})`, opacity: 1 },
          ],
          {
            duration: ENTER_DURATION_MS,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          },
        );
        overlayMotion.addEventListener(
          "finish",
          () => {
            if (!root) return;
            const revealLiveImage = () => {
              if (!root) return;
              // Hold the end state briefly, then overlap live image with overlay fade
              // so no white flash appears between layers.
              root.style.transition = "none";
              root.style.willChange = "opacity";
              root.style.opacity = "0";

              const startCrossfade = () => {
                if (!overlay) {
                  root.style.opacity = "1";
                  completeTransition();
                  return;
                }

                // Keep live image visible through the whole overlay fade window
                // to avoid end-of-enter brightness/flash artifacts.
                root.style.transition = "none";
                root.style.opacity = "1";

                // Fade overlay slightly after live image starts to create a tiny overlap.
                window.requestAnimationFrame(() => {
                  if (!overlay) {
                    completeTransition();
                    return;
                  }
                  const fadeOverlay = overlay.animate(
                    [{ opacity: 1 }, { opacity: 0 }],
                    { duration: ENTER_CROSSFADE_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
                  );
                  fadeOverlay.addEventListener("finish", () => completeTransition(), { once: true });
                  window.setTimeout(() => {
                    completeTransition();
                  }, ENTER_CROSSFADE_MS + 120);
                });
              };

              window.setTimeout(() => {
                startCrossfade();
              }, ENTER_END_HOLD_MS);
            };

            if (image && (!image.complete || image.naturalWidth <= 0)) {
              const handleImageReady = () => {
                removeImageReadyListeners?.();
                removeImageReadyListeners = null;
                revealLiveImage();
              };
              image.addEventListener("load", handleImageReady);
              image.addEventListener("error", handleImageReady);
              removeImageReadyListeners = () => {
                image.removeEventListener("load", handleImageReady);
                image.removeEventListener("error", handleImageReady);
              };
              return;
            }

            revealLiveImage();
          },
          { once: true },
        );

        cleanupTimer = window.setTimeout(() => {
          if (root) root.style.opacity = "1";
          completeTransition();
        }, ENTER_DURATION_MS + ENTER_END_HOLD_MS + ENTER_CROSSFADE_MS + 420);
      } catch {
        // Ignore malformed transition payloads.
        clearStyles();
        setAreCuesEnabled(true);
      }
    };

    runTransition();

    return () => {
      if (cleanupTimer !== null) window.clearTimeout(cleanupTimer);
      if (unlockFallbackTimer !== null) window.clearTimeout(unlockFallbackTimer);
      removeImageReadyListeners?.();
      removeIntentListeners?.();
      overlayMotion?.cancel();
      overlay?.remove();
      if (assistRafId !== null) {
        window.cancelAnimationFrame(assistRafId);
      }
      if (assistInputDetachTimer !== null) {
        window.clearTimeout(assistInputDetachTimer);
      }
      if (hasEnterScrollLock) {
        unlockPageScrollForEnter();
        hasEnterScrollLock = false;
      }
      clearStyles();
      setAreCuesEnabled(true);
    };
  }, [mainImageAspectRatio, productId]);

  const mainImageIntrinsicWidth = Math.max(1, Math.round(mainImageAspectRatio * 1000));
  const mainImageIntrinsicHeight = 1000;

  useEffect(() => {
    const handleClosing = () => {
      cuePointerActiveRef.current = false;
      cueVisibleRef.current = false;
      cueTravelDistanceRef.current = 0;
      setIsCueVisible(false);
      setPreviousCueText(null);
      if (cuePrevTextTimerRef.current !== null) {
        window.clearTimeout(cuePrevTextTimerRef.current);
        cuePrevTextTimerRef.current = null;
      }
      if (cueActivationTimerRef.current !== null) {
        window.clearTimeout(cueActivationTimerRef.current);
        cueActivationTimerRef.current = null;
      }
      setAreCuesEnabled(false);
    };
    window.addEventListener("unseen:product-view-closing", handleClosing);
    return () => window.removeEventListener("unseen:product-view-closing", handleClosing);
  }, []);

  const queueCueFrame = () => {
    if (cueFrameRef.current !== null) return;

    const animate = () => {
      const node = cuePillRef.current;
      if (!node) {
        cueFrameRef.current = null;
        return;
      }

      const current = cueCurrentRef.current;
      const target = cueTargetRef.current;
      const nextX = current.x + (target.x - current.x) * 0.18;
      const nextY = current.y + (target.y - current.y) * 0.18;
      cueCurrentRef.current = { x: nextX, y: nextY };
      node.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) translate3d(-50%, 16px, 0)`;

      const distance = Math.abs(target.x - nextX) + Math.abs(target.y - nextY);
      if (cuePointerActiveRef.current || distance > 0.25) {
        cueFrameRef.current = window.requestAnimationFrame(animate);
        return;
      }
      cueFrameRef.current = null;
    };

    cueFrameRef.current = window.requestAnimationFrame(animate);
  };

  const commitCueIndex = (nextIndex: number) => {
    const currentIndex = cueActiveIndexRef.current;
    if (nextIndex === currentIndex) return;

    const outgoing = resolvedCues[currentIndex];
    if (outgoing) {
      setPreviousCueText(outgoing);
    }
    if (cuePrevTextTimerRef.current !== null) {
      window.clearTimeout(cuePrevTextTimerRef.current);
    }

    cueActiveIndexRef.current = nextIndex;
    cueLastSwitchAtRef.current = performance.now();
    setActiveCueIndex(nextIndex);
    cuePrevTextTimerRef.current = window.setTimeout(() => {
      setPreviousCueText(null);
      cuePrevTextTimerRef.current = null;
    }, 340);
  };

  const advanceCueByMovement = (distance: number, speed: number, now: number) => {
    const count = resolvedCues.length;
    if (count <= 1) return;
    cueTravelDistanceRef.current += distance;

    const speedNorm = Math.max(0, Math.min(1, speed / 1.2));
    const stepDistancePx = 50 - speedNorm * 22;
    const cooldownMs = 300 - speedNorm * 180;

    if (now - cueLastSwitchAtRef.current < cooldownMs) return;
    if (cueTravelDistanceRef.current < stepDistancePx) return;

    cueTravelDistanceRef.current = cueTravelDistanceRef.current % stepDistancePx;
    const nextIndex = (cueActiveIndexRef.current + 1) % count;
    commitCueIndex(nextIndex);
  };

  return (
    <div ref={railRef} className="w-full max-w-[700px]">
      <div className="space-y-28">
        {images.map((entry, index) => (
          <section
            key={`${entry.id}-${index}`}
            id={`pv-image-${index + 1}`}
            data-image-id={entry.id}
            ref={(node) => {
              sectionRefs.current[index] = node;
            }}
            className={`scroll-mt-8 ${index === 0 && !disableMainImageTopLift ? "lg:-mt-[180px]" : ""}`}
          >
          <div
            ref={index === 0 ? firstImageRef : undefined}
            data-pv-image-hit="true"
            data-pv-main-image-root={index === 0 ? "true" : undefined}
            className={`relative mx-auto w-full ${index === 0 ? "max-w-[560px]" : "max-w-[562px]"}`}
          >
            <Image
              src={index === 0 && resolvedMainImageSrc ? resolvedMainImageSrc : entry.src}
              alt={entry.alt}
              width={index === 0 ? mainImageIntrinsicWidth : 562}
              height={index === 0 ? mainImageIntrinsicHeight : 662}
              priority={index === 0}
              fetchPriority={index === 0 ? "high" : "auto"}
              sizes={index === 0 ? "(max-width: 1024px) 86vw, 560px" : "(max-width: 1024px) 82vw, 562px"}
              className={`h-auto w-full ${
                index === 0
                  ? "max-h-[68vh] object-contain"
                  : "object-cover"
              }`}
            />

            {index === 0 && resolvedCues.length > 0 ? (
              <div
                className="absolute inset-0"
                onMouseEnter={() => {
                  if (!areCuesEnabled) return;
                  cuePointerActiveRef.current = false;
                }}
                onMouseLeave={() => {
                  cuePointerActiveRef.current = false;
                  cueTravelDistanceRef.current = 0;
                  cueLastMoveRef.current = { t: 0, x: 0, y: 0 };
                  if (cueActivationTimerRef.current !== null) {
                    window.clearTimeout(cueActivationTimerRef.current);
                    cueActivationTimerRef.current = null;
                  }
                  if (cueVisibleRef.current) {
                    cueVisibleRef.current = false;
                    setIsCueVisible(false);
                    setPreviousCueText(null);
                    if (cuePrevTextTimerRef.current !== null) {
                      window.clearTimeout(cuePrevTextTimerRef.current);
                      cuePrevTextTimerRef.current = null;
                    }
                  }
                }}
                onMouseMove={(event) => {
                  if (!areCuesEnabled) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  const y = event.clientY - rect.top;
                  const now = performance.now();
                  const prevMove = cueLastMoveRef.current;
                  const cueZoneTop = rect.height * 0.08;
                  const cueZoneBottom = rect.height * 0.92;
                  const cueZoneLeft = rect.width * 0.13;
                  const cueZoneRight = rect.width * 0.87;
                  const inCueZone = x >= cueZoneLeft && x <= cueZoneRight && y >= cueZoneTop && y <= cueZoneBottom;

                  if (!inCueZone) {
                    cuePointerActiveRef.current = false;
                    cueTravelDistanceRef.current = 0;
                    cueLastMoveRef.current = { t: 0, x: 0, y: 0 };
                    if (cueActivationTimerRef.current !== null) {
                      window.clearTimeout(cueActivationTimerRef.current);
                      cueActivationTimerRef.current = null;
                    }
                    if (cueVisibleRef.current) {
                      cueVisibleRef.current = false;
                      setIsCueVisible(false);
                      setPreviousCueText(null);
                      if (cuePrevTextTimerRef.current !== null) {
                        window.clearTimeout(cuePrevTextTimerRef.current);
                        cuePrevTextTimerRef.current = null;
                      }
                    }
                    return;
                  }

                  cuePointerActiveRef.current = true;
                  cueTargetRef.current = { x, y };
                  queueCueFrame();

                  if (!cueVisibleRef.current) {
                    cueLastMoveRef.current = { t: now, x, y };
                    if (cueActivationTimerRef.current === null) {
                      cueActivationTimerRef.current = window.setTimeout(() => {
                        cueActivationTimerRef.current = null;
                        if (!cuePointerActiveRef.current || !areCuesEnabled || cueVisibleRef.current) return;
                        const anchor = cueTargetRef.current;
                        cueVisibleRef.current = true;
                        cueCurrentRef.current = { x: anchor.x, y: anchor.y };
                        cueTargetRef.current = { x: anchor.x, y: anchor.y };
                        const initialIndex = cueActiveIndexRef.current % Math.max(resolvedCues.length, 1);
                        cueActiveIndexRef.current = initialIndex;
                        cueLastSwitchAtRef.current = performance.now();
                        cueTravelDistanceRef.current = 0;
                        cueLastMoveRef.current = { t: performance.now(), x: anchor.x, y: anchor.y };
                        setPreviousCueText(null);
                        if (cuePrevTextTimerRef.current !== null) {
                          window.clearTimeout(cuePrevTextTimerRef.current);
                          cuePrevTextTimerRef.current = null;
                        }
                        setActiveCueIndex(initialIndex);
                        setIsCueVisible(true);
                      }, 250);
                    }
                    return;
                  }
                  const dt = Math.max(8, now - prevMove.t);
                  const dx = x - prevMove.x;
                  const dy = y - prevMove.y;
                  const distance = Math.hypot(dx, dy);
                  const speed = distance / dt;
                  cueLastMoveRef.current = { t: now, x, y };
                  advanceCueByMovement(distance, speed, now);
                }}
              >
                <span
                  ref={cuePillRef}
                  className={`pointer-events-none absolute left-0 top-0 z-30 inline-flex h-[29px] items-center whitespace-nowrap rounded-[999px] px-[11px] shadow-[0_10px_26px_rgba(17,17,17,0.22),0_2px_6px_rgba(17,17,17,0.16)] transition-opacity duration-180 ease-out ${cuePillToneClass} ${
                    isCueVisible && areCuesEnabled ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span
                    className="relative inline-flex min-w-[1px] items-center"
                  >
                    {previousCueText ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper"
                        style={{ animation: "pv-cue-text-out 240ms cubic-bezier(0.22,1,0.36,1) forwards" }}
                      >
                        {previousCueText}
                      </span>
                    ) : null}
                    <span
                      key={`${activeCueIndex}-${resolvedCues[activeCueIndex] ?? ""}`}
                      className="relative whitespace-nowrap font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper"
                      style={{ animation: "pv-cue-text-in 240ms cubic-bezier(0.22,1,0.36,1) both" }}
                    >
                      {resolvedCues[activeCueIndex]}
                    </span>
                  </span>
                </span>
              </div>
            ) : null}
          </div>

            {index === 0 ? (
              <div className="mt-5 flex justify-center">
                <span
                  aria-hidden="true"
                  className={`inline-flex text-[16px] leading-none text-meta transition-opacity duration-200 motion-safe:[animation:pv-scroll-hint-bob_1.4s_ease-in-out_infinite] ${
                    showScrollHint ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="inline-block rotate-90">{">"}</span>
                </span>
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 z-40 hidden h-10 bg-gradient-to-b from-paper/38 via-paper/14 to-transparent backdrop-blur-[0.6px] lg:block"
        style={{ left: `${railViewportBounds.left}px`, width: `${railViewportBounds.width}px` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 z-40 hidden h-10 bg-gradient-to-t from-paper/38 via-paper/14 to-transparent backdrop-blur-[0.6px] lg:block"
        style={{ left: `${railViewportBounds.left}px`, width: `${railViewportBounds.width}px` }}
      />
      <style jsx>{`
        @keyframes pv-scroll-hint-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(4px);
          }
        }
        @keyframes pv-cue-text-in {
          0% {
            opacity: 0;
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pv-cue-text-out {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}
