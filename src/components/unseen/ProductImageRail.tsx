"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import Image from "next/image";
import {
  clearProductTransitionHold,
  completeProductTransitionHold,
  nextAnimationFrame,
  waitForProductImageDecode,
  warmProductImage,
} from "@/components/unseen/productImagePreload";
import { useViewportMode } from "@/lib/ui/viewportMode";

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
const PRIMARY_IMAGE_BASE_WIDTH = 560;
const SECONDARY_IMAGE_BASE_WIDTH = 562;
const STACKED_TEXT_COLUMN_WIDTH = 460;
const DEFAULT_VIEWPORT_SIZE = { width: 1440, height: 900 };
const ENTER_SCROLL_LOCK_KEY = "unseen:enter-scroll-lock";
const ENTER_SCROLL_INTENT_KEY = "unseen:enter-scroll-intent";
const ENTER_PREV_BODY_PADDING_ATTR = "data-unseen-enter-prev-pr";
const IPAD_PREV_SCROLL_Y_ATTR = "data-unseen-ipad-pv-scroll-y";
const IPAD_PREV_BODY_POSITION_ATTR = "data-unseen-ipad-pv-prev-position";
const IPAD_PREV_BODY_TOP_ATTR = "data-unseen-ipad-pv-prev-top";
const IPAD_PREV_BODY_LEFT_ATTR = "data-unseen-ipad-pv-prev-left";
const IPAD_PREV_BODY_WIDTH_ATTR = "data-unseen-ipad-pv-prev-width";
const IPAD_VERTICAL_SWIPE_INTENT_PX = 14;
const IPAD_VERTICAL_SWIPE_COMMIT_PX = 62;
const IPAD_VERTICAL_SWIPE_MAX_HORIZONTAL_PX = 64;
const IPAD_VERTICAL_SWIPE_CUE_BLOCK_EXTRA_PX = 36;

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

function hasFreshProductTransitionPayload(productId: string) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem("unseen:product-view-transition");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { at?: number; itemId?: string };
    return typeof parsed.at === "number" && Date.now() - parsed.at < 6000 && parsed.itemId === productId;
  } catch {
    return false;
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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function interpolateClamped(value: number, start: number, end: number, startValue: number, endValue: number) {
  if (end <= start) return endValue;
  const progress = clampNumber((value - start) / (end - start), 0, 1);
  return startValue + (endValue - startValue) * progress;
}

function readProductViewBackHref() {
  if (typeof window === "undefined") return "";
  try {
    return new URLSearchParams(window.location.search).get("back") ?? "";
  } catch {
    return "";
  }
}

function isImmersiveBackHref(backHref: string) {
  return /\/immersive(?:$|[?#])/.test(backHref);
}

export function ProductImageRail({
  images,
  cues,
  mode,
  productId,
  disableMainImageTopLift = false,
}: ProductImageRailProps) {
  const { isIPadExperience } = useViewportMode();
  const ENTER_DURATION_MS = 640;
  const ENTER_END_HOLD_MS = 0;
  const ENTER_CROSSFADE_MS = 220;
  const railRef = useRef<HTMLDivElement | null>(null);
  const iPadStageRef = useRef<HTMLDivElement | null>(null);
  const firstImageRef = useRef<HTMLDivElement | null>(null);
  const enterTransitionActiveRef = useRef(false);
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
  const cueTouchRef = useRef({ active: false, eligible: false, startX: 0, startY: 0 });
  const iPadImageSwipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    vertical: false,
  });
  const alignImageToInfoRafRef = useRef<number | null>(null);
  const hasInitializedDesktopLiftRef = useRef(false);
  const [hasAnyFollowingImageInView, setHasAnyFollowingImageInView] = useState(false);
  const [isScrollHintDismissed, setIsScrollHintDismissed] = useState(false);
  const [railViewportBounds, setRailViewportBounds] = useState({ left: 0, width: 0 });
  const [viewportSize, setViewportSize] = useState(DEFAULT_VIEWPORT_SIZE);
  const [hasMeasuredViewport, setHasMeasuredViewport] = useState(false);
  const [isCueVisible, setIsCueVisible] = useState(false);
  const [activeCueIndex, setActiveCueIndex] = useState(0);
  const [previousCueText, setPreviousCueText] = useState<string | null>(null);
  const [areCuesEnabled, setAreCuesEnabled] = useState(false);
  const [isProductSaved, setIsProductSaved] = useState(false);
  const [activeIpadImageIndex, setActiveIpadImageIndex] = useState(0);
  const [iPadDotsTopPx, setIPadDotsTopPx] = useState<number | null>(null);
  const [iPadStageUpShiftPx, setIPadStageUpShiftPx] = useState(0);
  const iPadStageUpShiftRef = useRef(0);
  const resolvedMainImageSrc = images[0]?.src ?? "";
  const [mainImageAspectRatio, setMainImageAspectRatio] = useState(DEFAULT_MAIN_ASPECT_RATIO);

  const showScrollHint = useMemo(
    () => !hasAnyFollowingImageInView && !isScrollHintDismissed,
    [hasAnyFollowingImageInView, isScrollHintDismissed],
  );
  const isDesktopSplitLayout = viewportSize.width >= 1024;
  const baseMainImageTopLiftPx = useMemo(() => {
    if (!isDesktopSplitLayout || disableMainImageTopLift) return 0;
    if (viewportSize.height <= 700) return 40;
    if (viewportSize.height <= 800) {
      return interpolateClamped(viewportSize.height, 700, 800, 40, 64);
    }
    if (viewportSize.height <= 920) {
      return interpolateClamped(viewportSize.height, 800, 920, 64, 110);
    }
    if (viewportSize.height <= 1100) {
      return interpolateClamped(viewportSize.height, 920, 1100, 110, 180);
    }
    return 180;
  }, [disableMainImageTopLift, isDesktopSplitLayout, viewportSize.height]);
  const [mainImageTopLiftPx, setMainImageTopLiftPx] = useState(baseMainImageTopLiftPx);
  const mainImageTopLiftRef = useRef(baseMainImageTopLiftPx);
  const widthConstrainedScale = useMemo(() => {
    if (!isDesktopSplitLayout) {
      return STACKED_TEXT_COLUMN_WIDTH / PRIMARY_IMAGE_BASE_WIDTH;
    }
    if (viewportSize.width <= 1180) {
      return interpolateClamped(viewportSize.width, 1024, 1180, 0.82, 0.9);
    }
    if (viewportSize.width <= 1280) {
      return interpolateClamped(viewportSize.width, 1180, 1280, 0.9, 0.96);
    }
    if (viewportSize.width <= 1380) {
      return interpolateClamped(viewportSize.width, 1280, 1380, 0.96, 1);
    }
    return 1;
  }, [isDesktopSplitLayout, viewportSize.width]);
  const primaryImageMaxWidthPx = Math.round(PRIMARY_IMAGE_BASE_WIDTH * widthConstrainedScale);
  const nonPrimaryImageScale = useMemo(() => {
    if (!isDesktopSplitLayout) return 1;
    if (viewportSize.height <= 700) return 0.88;
    if (viewportSize.height <= 800) {
      return interpolateClamped(viewportSize.height, 700, 800, 0.88, 0.92);
    }
    if (viewportSize.height <= 920) {
      return interpolateClamped(viewportSize.height, 800, 920, 0.92, 0.96);
    }
    if (viewportSize.height <= 1100) {
      return interpolateClamped(viewportSize.height, 920, 1100, 0.96, 1);
    }
    return 1;
  }, [isDesktopSplitLayout, viewportSize.height]);
  const nonPrimaryImageMaxWidthPx = Math.round(
    SECONDARY_IMAGE_BASE_WIDTH * Math.min(nonPrimaryImageScale, widthConstrainedScale),
  );
  const resolvedCues = useMemo(() => cues.filter(Boolean), [cues]);
  const cuePillToneClass = mode === "archive" || isProductSaved ? "bg-accent" : "bg-ink";
  const cuePillBorderToneClass = mode === "archive" || isProductSaved ? "border-accent" : "border-ink";

  const alignFirstImageToInfoCenterNow = () => {
    if (!isDesktopSplitLayout || disableMainImageTopLift) return false;
    const infoBlock = document.querySelector('[data-pv-info-block="true"]') as HTMLElement | null;
    const imageRoot = firstImageRef.current;
    if (!infoBlock || !imageRoot) return false;

    const infoRect = infoBlock.getBoundingClientRect();
    const imageRect = imageRoot.getBoundingClientRect();
    const infoCenterY = infoRect.top + infoRect.height * 0.5;
    const imageCenterY = imageRect.top + imageRect.height * 0.5;
    const currentLift = mainImageTopLiftRef.current;
    const desiredLift = Math.round(clampNumber((imageCenterY + currentLift) - infoCenterY, 0, 260));

    if (Math.abs(desiredLift - currentLift) <= 0.75) return false;
    mainImageTopLiftRef.current = desiredLift;
    setMainImageTopLiftPx(desiredLift);
    return true;
  };

  useEffect(() => {
    if (!isDesktopSplitLayout || disableMainImageTopLift) {
      hasInitializedDesktopLiftRef.current = false;
      mainImageTopLiftRef.current = 0;
      setMainImageTopLiftPx(0);
      return;
    }
    if (!hasInitializedDesktopLiftRef.current) {
      hasInitializedDesktopLiftRef.current = true;
      mainImageTopLiftRef.current = baseMainImageTopLiftPx;
      setMainImageTopLiftPx(baseMainImageTopLiftPx);
    }
  }, [baseMainImageTopLiftPx, disableMainImageTopLift, isDesktopSplitLayout]);

  useEffect(() => {
    mainImageTopLiftRef.current = mainImageTopLiftPx;
  }, [mainImageTopLiftPx]);

  useEffect(() => {
    iPadStageUpShiftRef.current = iPadStageUpShiftPx;
  }, [iPadStageUpShiftPx]);

  useLayoutEffect(() => {
    if (!isDesktopSplitLayout || disableMainImageTopLift) return;
    let resizeObserver: ResizeObserver | null = null;
    let observerStopTimer: number | null = null;

    const alignFirstImageToInfoCenter = () => {
      if (enterTransitionActiveRef.current) return;
      alignFirstImageToInfoCenterNow();
    };

    const scheduleAlign = () => {
      if (alignImageToInfoRafRef.current !== null) {
        window.cancelAnimationFrame(alignImageToInfoRafRef.current);
      }
      alignImageToInfoRafRef.current = window.requestAnimationFrame(() => {
        alignImageToInfoRafRef.current = null;
        alignFirstImageToInfoCenter();
      });
    };

    scheduleAlign();

    const infoBlock = document.querySelector('[data-pv-info-block="true"]') as HTMLElement | null;
    if (typeof ResizeObserver !== "undefined" && infoBlock && firstImageRef.current) {
      resizeObserver = new ResizeObserver(scheduleAlign);
      resizeObserver.observe(infoBlock);
      resizeObserver.observe(firstImageRef.current);
      observerStopTimer = window.setTimeout(() => {
        resizeObserver?.disconnect();
        resizeObserver = null;
      }, 900);
    }

    return () => {
      if (alignImageToInfoRafRef.current !== null) {
        window.cancelAnimationFrame(alignImageToInfoRafRef.current);
        alignImageToInfoRafRef.current = null;
      }
      if (observerStopTimer !== null) {
        window.clearTimeout(observerStopTimer);
      }
      resizeObserver?.disconnect();
    };
  }, [disableMainImageTopLift, isDesktopSplitLayout]);

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
    let syncFrame: number | null = null;
    const syncViewportSize = () => {
      const vv = window.visualViewport;
      setViewportSize({
        width: Math.max(window.innerWidth, document.documentElement.clientWidth, vv?.width ?? 0),
        height: Math.max(window.innerHeight, document.documentElement.clientHeight, vv?.height ?? 0),
      });
      setHasMeasuredViewport(true);
    };

    syncFrame = window.requestAnimationFrame(() => {
      syncFrame = null;
      syncViewportSize();
    });
    window.addEventListener("resize", syncViewportSize);
    window.visualViewport?.addEventListener("resize", syncViewportSize);
    return () => {
      if (syncFrame !== null) {
        window.cancelAnimationFrame(syncFrame);
      }
      window.removeEventListener("resize", syncViewportSize);
      window.visualViewport?.removeEventListener("resize", syncViewportSize);
    };
  }, []);

  useEffect(() => {
    if (!isIPadExperience) return;

    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    body.setAttribute(IPAD_PREV_SCROLL_Y_ATTR, `${scrollY}`);
    body.setAttribute(IPAD_PREV_BODY_POSITION_ATTR, body.style.position);
    body.setAttribute(IPAD_PREV_BODY_TOP_ATTR, body.style.top);
    body.setAttribute(IPAD_PREV_BODY_LEFT_ATTR, body.style.left);
    body.setAttribute(IPAD_PREV_BODY_WIDTH_ATTR, body.style.width);

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.width = "100vw";

    return () => {
      const previousScrollY = Number.parseFloat(body.getAttribute(IPAD_PREV_SCROLL_Y_ATTR) ?? "0");
      body.style.position = body.getAttribute(IPAD_PREV_BODY_POSITION_ATTR) ?? "";
      body.style.top = body.getAttribute(IPAD_PREV_BODY_TOP_ATTR) ?? "";
      body.style.left = body.getAttribute(IPAD_PREV_BODY_LEFT_ATTR) ?? "";
      body.style.width = body.getAttribute(IPAD_PREV_BODY_WIDTH_ATTR) ?? "";
      body.removeAttribute(IPAD_PREV_SCROLL_Y_ATTR);
      body.removeAttribute(IPAD_PREV_BODY_POSITION_ATTR);
      body.removeAttribute(IPAD_PREV_BODY_TOP_ATTR);
      body.removeAttribute(IPAD_PREV_BODY_LEFT_ATTR);
      body.removeAttribute(IPAD_PREV_BODY_WIDTH_ATTR);
      root.style.overflow = "";
      root.style.overscrollBehavior = "";
      body.style.overflow = "";
      body.style.overscrollBehavior = "";
      window.scrollTo(0, Number.isFinite(previousScrollY) ? previousScrollY : 0);
    };
  }, [isIPadExperience]);

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
    window.visualViewport?.addEventListener("resize", updateRailBounds);
    window.visualViewport?.addEventListener("scroll", updateRailBounds);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && railRef.current) {
      resizeObserver = new ResizeObserver(updateRailBounds);
      resizeObserver.observe(railRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateRailBounds);
      window.removeEventListener("scroll", updateRailBounds);
      window.visualViewport?.removeEventListener("resize", updateRailBounds);
      window.visualViewport?.removeEventListener("scroll", updateRailBounds);
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
  }, [hasMeasuredViewport, productId]);

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
    const root = firstImageRef.current;
    if (!root || hasMeasuredViewport) return;
    if (!hasFreshProductTransitionPayload(productId)) return;

    root.style.transition = "none";
    root.style.opacity = "0";
    root.style.willChange = "opacity";
  }, [hasMeasuredViewport, productId]);

  useLayoutEffect(() => {
    if (!hasMeasuredViewport) return;

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
    let didCancel = false;
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
      root.style.transform = "";
      root.style.transformOrigin = "";
      root.style.willChange = "";
    };

    const completeTransition = () => {
      if (didComplete) return;
      didComplete = true;
      enterTransitionActiveRef.current = false;
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

    const handleViewportResizeDuringEnter = () => {
      if (!overlay && !overlayMotion) return;
      if (root) root.style.opacity = "1";
      completeTransition();
    };

    const runTransition = async () => {
      if (!root) return;
      let raw: string | null = null;
      try {
        raw = window.sessionStorage.getItem("unseen:product-view-transition");
      } catch {
        return;
      }
      if (!raw) {
        clearStyles();
        return;
      }

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
        if (alignFirstImageToInfoCenterNow()) {
          await nextAnimationFrame();
          if (didCancel || !root) return;
        }
        const container = root.getBoundingClientRect();
        if (container.width < 2 || container.height < 2) return;

        const ratio =
          parsed.aspectRatio && parsed.aspectRatio > 0
            ? parsed.aspectRatio
            : image && image.naturalWidth > 0 && image.naturalHeight > 0
              ? image.naturalWidth / image.naturalHeight
              : DEFAULT_MAIN_ASPECT_RATIO;
        const fallbackLast = ratio > 0 ? getContainRect(container, ratio) : container;
        const last = fallbackLast;
        if (last.width < 2 || last.height < 2) return;
        enterTransitionActiveRef.current = true;
        const isImmersiveEnter = isImmersiveBackHref(readProductViewBackHref());
        const isIpadEnter = isIPadExperience;
        const enterDurationMs = isImmersiveEnter ? 720 : ENTER_DURATION_MS;
        const enterDecodeTimeoutMs = isIpadEnter ? 320 : isImmersiveEnter ? 120 : 80;
        const enterCrossfadeMs = isIpadEnter ? 160 : ENTER_CROSSFADE_MS;

        // Hide the destination image before any async decode work so the first
        // product-view paint cannot flash a second, unanimated image layer.
        root.style.transition = "none";
        root.style.opacity = "0";
        root.style.willChange = "opacity";

        await waitForProductImageDecode(image, parsed.src, enterDecodeTimeoutMs);
        void warmProductImage(image?.currentSrc || parsed.src);
        if (didCancel || !root) return;

        lockPageScrollForEnter();
        hasEnterScrollLock = true;
        startEnterIntentCapture();
        unlockFallbackTimer = window.setTimeout(() => {
          releaseEnterScrollLock();
        }, enterDurationMs + ENTER_END_HOLD_MS + enterCrossfadeMs + 700);

        setAreCuesEnabled(false);

        const persistentOverlayDidStart = !isIpadEnter
          ? completeProductTransitionHold({
              productId,
              src: image?.currentSrc || parsed.src,
              targetRect: last,
              durationMs: enterDurationMs,
              crossfadeMs: enterCrossfadeMs,
              easing: isImmersiveEnter ? "cubic-bezier(0.2, 0.88, 0.24, 1)" : "cubic-bezier(0.22, 1, 0.36, 1)",
              onArrive: () => {
                if (!root) return;
                root.style.willChange = "opacity";
                root.style.opacity = "1";
              },
              onDone: () => {
                completeTransition();
              },
            })
          : false;

        if (persistentOverlayDidStart) {
          cleanupTimer = window.setTimeout(() => {
            clearProductTransitionHold();
            if (root) root.style.opacity = "1";
            completeTransition();
          }, enterDurationMs + enterCrossfadeMs + 900);
          return;
        }
        if (isIpadEnter) {
          // iPad uses the local overlay path for a more stable end-of-enter handoff.
          clearProductTransitionHold();
        }

        let targetWidth = last.width;
        let targetHeight = last.height;
        let targetLeft = last.left;
        let targetTop = last.top;
        let startTransform = "";
        let startOpacity = 1;

        // Keep fallback enter zoom uniformly scaled to avoid aspect warping during flight.
        const scaleX = last.width / Math.max(parsed.width, 1);
        const scaleY = last.height / Math.max(parsed.height, 1);
        const scale = Math.max(0.0001, (scaleX + scaleY) * 0.5);
        targetWidth = parsed.width * scale;
        targetHeight = parsed.height * scale;
        targetLeft = last.left + (last.width - targetWidth) * 0.5;
        targetTop = last.top + (last.height - targetHeight) * 0.5;
        const invertScale = 1 / scale;
        const invertX = parsed.left - targetLeft;
        const invertY = parsed.top - targetTop;
        startTransform = `translate3d(${invertX}px, ${invertY}px, 0px) scale(${invertScale}, ${invertScale})`;

        overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.left = `${targetLeft}px`;
        overlay.style.top = `${targetTop}px`;
        overlay.style.width = `${targetWidth}px`;
        overlay.style.height = `${targetHeight}px`;
        overlay.style.transformOrigin = "top left";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "145";
        overlay.style.willChange = "transform, opacity";
        overlay.style.backfaceVisibility = "hidden";
        overlay.style.transformStyle = "preserve-3d";
        overlay.style.userSelect = "none";
        overlay.style.contain = "layout paint style";
        overlay.style.transform = startTransform;
        overlay.style.opacity = String(startOpacity);
        overlay.style.setProperty("-webkit-backface-visibility", "hidden");

        const overlayImg = document.createElement("img");
        overlayImg.src = image?.currentSrc || parsed.src;
        overlayImg.alt = "";
        overlayImg.decoding = "sync";
        overlayImg.loading = "eager";
        overlayImg.style.display = "block";
        overlayImg.style.width = "100%";
        overlayImg.style.height = "100%";
        overlayImg.style.objectFit = "contain";
        overlayImg.style.backfaceVisibility = "hidden";
        overlayImg.style.transform = "translateZ(0)";
        overlayImg.style.userSelect = "none";
        overlayImg.style.setProperty("-webkit-backface-visibility", "hidden");
        overlay.appendChild(overlayImg);
        document.body.appendChild(overlay);

        await waitForProductImageDecode(overlayImg, parsed.src, 120);
        await nextAnimationFrame();
        await nextAnimationFrame();
        if (didCancel || !overlay) return;

        overlayMotion = overlay.animate(
          [
            { transform: startTransform, opacity: startOpacity },
            { transform: "translate3d(0px, 0px, 0px) scale(1, 1)", opacity: 1 },
          ],
          {
            duration: enterDurationMs,
            easing: isImmersiveEnter ? "cubic-bezier(0.2, 0.88, 0.24, 1)" : "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          },
        );
        clearProductTransitionHold();
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
                    { duration: enterCrossfadeMs, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
                  );
                  fadeOverlay.addEventListener("finish", () => completeTransition(), { once: true });
                  window.setTimeout(() => {
                    completeTransition();
                  }, enterCrossfadeMs + 120);
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
        }, enterDurationMs + ENTER_END_HOLD_MS + enterCrossfadeMs + 420);
      } catch {
        // Ignore malformed transition payloads.
        enterTransitionActiveRef.current = false;
        clearStyles();
        setAreCuesEnabled(true);
      }
    };

    void runTransition();

    window.addEventListener("resize", handleViewportResizeDuringEnter);
    window.visualViewport?.addEventListener("resize", handleViewportResizeDuringEnter);

    return () => {
      didCancel = true;
      window.removeEventListener("resize", handleViewportResizeDuringEnter);
      window.visualViewport?.removeEventListener("resize", handleViewportResizeDuringEnter);
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
      enterTransitionActiveRef.current = false;
      clearStyles();
      setAreCuesEnabled(true);
    };
  }, [hasMeasuredViewport, productId]);

  const mainImageIntrinsicWidth = Math.max(1, Math.round(mainImageAspectRatio * 1000));
  const mainImageIntrinsicHeight = 1000;

  useEffect(() => {
    const handleClosing = () => {
      cuePointerActiveRef.current = false;
      cueTouchRef.current = { active: false, eligible: false, startX: 0, startY: 0 };
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
      const followLerp = isIPadExperience ? 0.22 : 0.18;
      const nextX = current.x + (target.x - current.x) * followLerp;
      const nextY = current.y + (target.y - current.y) * followLerp;
      cueCurrentRef.current = { x: nextX, y: nextY };
      const cueYOffset = isIPadExperience ? -66 : 16;
      node.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) translate3d(-50%, ${cueYOffset}px, 0)`;

      const distance = Math.abs(target.x - nextX) + Math.abs(target.y - nextY);
      const shouldKeepAnimating = isIPadExperience
        ? cueVisibleRef.current || distance > 0.25
        : cuePointerActiveRef.current || distance > 0.25;
      if (shouldKeepAnimating) {
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

    if (isIPadExperience) {
      cueActiveIndexRef.current = nextIndex;
      cueLastSwitchAtRef.current = performance.now();
      setActiveCueIndex(nextIndex);
      setPreviousCueText(null);
      if (cuePrevTextTimerRef.current !== null) {
        window.clearTimeout(cuePrevTextTimerRef.current);
        cuePrevTextTimerRef.current = null;
      }
      return;
    }

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

    const speedNorm = Math.max(0, Math.min(1, speed / (isIPadExperience ? 1.1 : 1.2)));
    const stepDistancePx = isIPadExperience ? 54 - speedNorm * 20 : 50 - speedNorm * 22;
    const cooldownMs = isIPadExperience ? 280 - speedNorm * 140 : 300 - speedNorm * 180;

    if (now - cueLastSwitchAtRef.current < cooldownMs) return;
    if (cueTravelDistanceRef.current < stepDistancePx) return;

    cueTravelDistanceRef.current = cueTravelDistanceRef.current % stepDistancePx;
    const nextIndex = (cueActiveIndexRef.current + 1) % count;
    commitCueIndex(nextIndex);
  };

  const clearCueActivationTimer = () => {
    if (cueActivationTimerRef.current !== null) {
      window.clearTimeout(cueActivationTimerRef.current);
      cueActivationTimerRef.current = null;
    }
  };

  const hideCuePill = () => {
    cuePointerActiveRef.current = false;
    cueTouchRef.current = { active: false, eligible: false, startX: 0, startY: 0 };
    cueVisibleRef.current = false;
    cueTravelDistanceRef.current = 0;
    cueLastMoveRef.current = { t: 0, x: 0, y: 0 };
    clearCueActivationTimer();
    setIsCueVisible(false);
    setPreviousCueText(null);
    if (cuePrevTextTimerRef.current !== null) {
      window.clearTimeout(cuePrevTextTimerRef.current);
      cuePrevTextTimerRef.current = null;
    }
  };

  const updateCueTargetFromTouch = (target: EventTarget & HTMLDivElement, clientX: number, clientY: number) => {
    const rect = target.getBoundingClientRect();
    const x = clampNumber(clientX - rect.left, rect.width * 0.16, rect.width * 0.84);
    const y = clampNumber(clientY - rect.top, rect.height * 0.08, rect.height * 0.88);
    cueTargetRef.current = { x, y };
    queueCueFrame();
    return { x, y };
  };

  const revealCuePill = (anchor: { x: number; y: number }) => {
    clearCueActivationTimer();
    cueVisibleRef.current = true;
    cueCurrentRef.current = anchor;
    cueTargetRef.current = anchor;
    cueTravelDistanceRef.current = 0;
    cueLastMoveRef.current = { t: performance.now(), x: anchor.x, y: anchor.y };
    const initialIndex = cueActiveIndexRef.current % Math.max(resolvedCues.length, 1);
    cueActiveIndexRef.current = initialIndex;
    cueLastSwitchAtRef.current = performance.now();
    setPreviousCueText(null);
    if (cuePrevTextTimerRef.current !== null) {
      window.clearTimeout(cuePrevTextTimerRef.current);
      cuePrevTextTimerRef.current = null;
    }
    setActiveCueIndex(initialIndex);
    setIsCueVisible(true);
    queueCueFrame();
  };

  const handleCueTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isIPadExperience || !areCuesEnabled) return;
    if (event.touches.length !== 1) {
      hideCuePill();
      return;
    }
    const touch = event.touches[0];
    if (!touch) return;
    const anchor = updateCueTargetFromTouch(event.currentTarget, touch.clientX, touch.clientY);
    cueTouchRef.current = {
      active: true,
      eligible: true,
      startX: touch.clientX,
      startY: touch.clientY,
    };
    clearCueActivationTimer();
    cueActivationTimerRef.current = window.setTimeout(() => {
      cueActivationTimerRef.current = null;
      const cueTouch = cueTouchRef.current;
      if (!cueTouch.active || !cueTouch.eligible || !areCuesEnabled || cueVisibleRef.current) return;
      revealCuePill(anchor);
    }, 170);
  };

  const handleCueTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isIPadExperience || !areCuesEnabled) return;
    const touch = event.touches[0];
    if (!touch) return;

    const cueTouch = cueTouchRef.current;
    if (cueTouch.active && cueTouch.eligible && !cueVisibleRef.current) {
      const deltaX = touch.clientX - cueTouch.startX;
      const deltaY = touch.clientY - cueTouch.startY;
      const touchDistance = Math.hypot(deltaX, deltaY);
      if (Math.abs(deltaY) > 18 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
        clearCueActivationTimer();
        cueTouchRef.current = { ...cueTouch, eligible: false };
      } else {
        const anchor = updateCueTargetFromTouch(event.currentTarget, touch.clientX, touch.clientY);
        if (touchDistance >= 3) {
          revealCuePill(anchor);
        }
      }
    }

    if (!cueVisibleRef.current) return;
    event.preventDefault();
    const now = performance.now();
    const next = updateCueTargetFromTouch(event.currentTarget, touch.clientX, touch.clientY);
    const prevMove = cueLastMoveRef.current;
    const dt = Math.max(8, now - prevMove.t);
    const distance = Math.hypot(next.x - prevMove.x, next.y - prevMove.y);
    const speed = distance / dt;
    cueLastMoveRef.current = { t: now, x: next.x, y: next.y };
    advanceCueByMovement(distance, speed, now);
  };

  const handleCueTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isIPadExperience) return;
    if (cueVisibleRef.current) {
      event.preventDefault();
    }
    hideCuePill();
  };
  const resetIpadImageSwipe = () => {
    iPadImageSwipeRef.current = {
      active: false,
      startX: 0,
      startY: 0,
      vertical: false,
    };
  };

  const handleIpadImageSwipeStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isIPadExperience) return;
    if (event.touches.length !== 1) {
      resetIpadImageSwipe();
      return;
    }
    const touch = event.touches[0];
    if (!touch) return;
    iPadImageSwipeRef.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      vertical: false,
    };
  };

  const handleIpadImageSwipeMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isIPadExperience) return;
    const swipe = iPadImageSwipeRef.current;
    if (!swipe.active) return;
    const touch = event.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - swipe.startX;
    const deltaY = touch.clientY - swipe.startY;
    const cueBlockingSwipe =
      activeIpadImageIndex === 0 &&
      (cueVisibleRef.current || (cueTouchRef.current.active && cueTouchRef.current.eligible));

    if (!swipe.vertical) {
      if (
        Math.abs(deltaY) > IPAD_VERTICAL_SWIPE_INTENT_PX &&
        Math.abs(deltaY) > Math.abs(deltaX) * 1.15
      ) {
        swipe.vertical = true;
      } else if (
        Math.abs(deltaX) > IPAD_VERTICAL_SWIPE_INTENT_PX &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.2
      ) {
        resetIpadImageSwipe();
        return;
      }
    }

    if (swipe.vertical || cueBlockingSwipe) {
      event.preventDefault();
    }
  };

  const handleIpadImageSwipeEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isIPadExperience) return;
    const swipe = iPadImageSwipeRef.current;
    if (!swipe.active) return;
    const touch = event.changedTouches[0];
    const deltaX = touch ? touch.clientX - swipe.startX : 0;
    const deltaY = touch ? touch.clientY - swipe.startY : 0;
    const cueBlockingSwipe =
      activeIpadImageIndex === 0 &&
      (cueVisibleRef.current || (cueTouchRef.current.active && cueTouchRef.current.eligible));
    const commitThreshold = cueBlockingSwipe
      ? IPAD_VERTICAL_SWIPE_COMMIT_PX + IPAD_VERTICAL_SWIPE_CUE_BLOCK_EXTRA_PX
      : IPAD_VERTICAL_SWIPE_COMMIT_PX;

    resetIpadImageSwipe();
    if (!swipe.vertical) return;
    if (Math.abs(deltaY) < commitThreshold) return;
    if (Math.abs(deltaX) > IPAD_VERTICAL_SWIPE_MAX_HORIZONTAL_PX) return;
    event.preventDefault();

    const direction = deltaY < 0 ? 1 : -1;
    const nextIndex = activeIpadImageIndex + direction;
    if (nextIndex >= 0 && nextIndex < images.length) {
      setActiveIpadImageIndex(nextIndex);
      hideCuePill();
    }
  };

  useLayoutEffect(() => {
    if (!isIPadExperience) return;

    let frame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const measureDotsTop = () => {
      const stageRect = iPadStageRef.current?.getBoundingClientRect();
      if (!stageRect) return;

      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const stageCenterY = stageRect.top + stageRect.height * 0.5;
      const currentShift = iPadStageUpShiftRef.current;
      const unshiftedCenterY = stageCenterY + currentShift;
      const desiredCenterY = viewportHeight * 0.48;
      const nextShift = Math.round(clampNumber(unshiftedCenterY - desiredCenterY, -220, 220));
      setIPadStageUpShiftPx((current) => (current === nextShift ? current : nextShift));

      const nextTop = Math.round(stageRect.top + stageRect.height * 0.5);
      setIPadDotsTopPx((current) => (current === nextTop ? current : nextTop));
    };
    const scheduleMeasure = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        measureDotsTop();
      });
    };

    // Run once immediately in layout to avoid first-frame reload jump.
    measureDotsTop();
    // Follow with RAF-based measurements for async viewport/layout changes.
    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("scroll", scheduleMeasure);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      if (iPadStageRef.current) resizeObserver.observe(iPadStageRef.current);
      if (firstImageRef.current) resizeObserver.observe(firstImageRef.current);
    }

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("scroll", scheduleMeasure);
      resizeObserver?.disconnect();
    };
  }, [activeIpadImageIndex, isIPadExperience]);

  if (isIPadExperience) {
    const iPadStageHeight = "clamp(360px, 56vh, 620px)";
    const iPadDotsRightInset = "40px";
    return (
      <div ref={railRef} className="w-full max-w-[700px]">
        <div className="relative w-full" style={{ transform: `translate3d(0, ${-iPadStageUpShiftPx}px, 0)` }}>
          <div
            ref={iPadStageRef}
            className="relative mx-auto w-full overflow-visible"
            style={{ height: iPadStageHeight, maxWidth: `${primaryImageMaxWidthPx}px` }}
            onTouchStart={handleIpadImageSwipeStart}
            onTouchMove={handleIpadImageSwipeMove}
            onTouchEnd={handleIpadImageSwipeEnd}
            onTouchCancel={() => {
              resetIpadImageSwipe();
              hideCuePill();
            }}
          >
            <div className="relative h-full w-full overflow-hidden">
              {images.map((entry, index) => {
                const isActiveImage = index === activeIpadImageIndex;
                return (
                  <div
                    key={`${entry.id}-${index}`}
                    className={`absolute inset-0 transition-opacity duration-220 ease-out ${
                      isActiveImage ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                    aria-hidden={!isActiveImage}
                  >
                    <div className="flex h-full w-full items-center justify-center">
                      <div
                        ref={index === 0 ? firstImageRef : undefined}
                        data-pv-main-image-root={index === 0 ? "true" : undefined}
                        data-pv-image-hit="true"
                        className={index === 0 ? "relative flex h-full w-full items-center justify-center" : "relative w-full"}
                        style={{ maxWidth: `${index === 0 ? primaryImageMaxWidthPx : nonPrimaryImageMaxWidthPx}px` }}
                      >
                        <Image
                          data-pv-image-hit="true"
                          src={index === 0 && resolvedMainImageSrc ? resolvedMainImageSrc : entry.src}
                          alt={entry.alt}
                          width={index === 0 ? mainImageIntrinsicWidth : 562}
                          height={index === 0 ? mainImageIntrinsicHeight : 662}
                          priority={index === 0}
                          fetchPriority={index === 0 ? "high" : "auto"}
                          sizes={index === 0 ? "(max-width: 1024px) 86vw, 560px" : "(max-width: 1024px) 82vw, 562px"}
                          className={`pointer-events-none select-none ${
                            index === 0 ? "h-full w-auto max-w-full object-contain" : "h-auto w-full object-cover"
                          }`}
                          draggable={false}
                          onDragStart={(event) => event.preventDefault()}
                        />

                        {index === 0 && activeIpadImageIndex === 0 && resolvedCues.length > 0 ? (
                          <div
                            data-pv-image-hit="true"
                            className="absolute inset-0"
                            onMouseEnter={() => {
                              if (!areCuesEnabled) return;
                              cuePointerActiveRef.current = false;
                            }}
                            onMouseLeave={hideCuePill}
                            onTouchStart={handleCueTouchStart}
                            onTouchMove={handleCueTouchMove}
                            onTouchEnd={handleCueTouchEnd}
                            onTouchCancel={handleCueTouchEnd}
                            onMouseMove={(event) => {
                              if (!areCuesEnabled) return;
                              const rect = event.currentTarget.getBoundingClientRect();
                              const x = event.clientX - rect.left;
                              const y = event.clientY - rect.top;
                              const now = performance.now();
                              const prevMove = cueLastMoveRef.current;
                              const cueZoneTop = rect.height * 0.08;
                              const cueZoneBottom = rect.height * 0.88;
                              const cueZoneLeft = rect.width * 0.16;
                              const cueZoneRight = rect.width * 0.84;
                              const inCueZone =
                                x >= cueZoneLeft &&
                                x <= cueZoneRight &&
                                y >= cueZoneTop &&
                                y <= cueZoneBottom;

                              if (!inCueZone) {
                                hideCuePill();
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
                                  }, 170);
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
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {activeIpadImageIndex === 0 && resolvedCues.length > 0 ? (
              <div className="pointer-events-none absolute inset-0 overflow-visible">
                <span
                  ref={cuePillRef}
                  className={`pointer-events-none absolute left-0 top-0 z-30 inline-flex h-[29px] items-center whitespace-nowrap rounded-[999px] border px-[11px] shadow-[0_0_0_0.5px_rgba(17,17,17,0.22)] transition-opacity duration-180 ease-out ${cuePillToneClass} ${cuePillBorderToneClass} ${
                    isCueVisible && areCuesEnabled ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="relative inline-flex min-w-[1px] items-center">
                    {previousCueText && !isIPadExperience ? (
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
        </div>
        <div
          aria-label="Product image position"
          className="pointer-events-none fixed z-50 flex -translate-y-1/2 flex-col gap-[9px]"
          style={{
            right: iPadDotsRightInset,
            top: iPadDotsTopPx ? `${iPadDotsTopPx}px` : "50vh",
          }}
        >
          {images.map((image, index) => (
            <span
              key={`ipad-dot-${image.id}-${index}`}
              aria-hidden="true"
              className="block rounded-full transition-colors duration-150 ease-out"
              style={{
                width: "6px",
                height: "6px",
                backgroundColor: index === activeIpadImageIndex ? "#6F7381" : "#D8D8DA",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

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
            className="scroll-mt-8"
            style={index === 0 && mainImageTopLiftPx > 0 ? { marginTop: `-${mainImageTopLiftPx}px` } : undefined}
          >
          <div
            ref={index === 0 ? firstImageRef : undefined}
            data-pv-main-image-root={index === 0 ? "true" : undefined}
            data-pv-image-hit="true"
            className="relative w-full lg:mx-auto"
            style={{ maxWidth: `${index === 0 ? primaryImageMaxWidthPx : nonPrimaryImageMaxWidthPx}px` }}
          >
            <Image
              data-pv-image-hit="true"
              src={index === 0 && resolvedMainImageSrc ? resolvedMainImageSrc : entry.src}
              alt={entry.alt}
              width={index === 0 ? mainImageIntrinsicWidth : 562}
              height={index === 0 ? mainImageIntrinsicHeight : 662}
              priority={index === 0}
              fetchPriority={index === 0 ? "high" : "auto"}
              sizes={index === 0 ? "(max-width: 1024px) 86vw, 560px" : "(max-width: 1024px) 82vw, 562px"}
              className={`pointer-events-none select-none h-auto w-full ${
                index === 0
                  ? "max-h-[68vh] object-contain"
                  : "object-cover"
              }`}
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
            />

            {index === 0 && resolvedCues.length > 0 ? (
              <div
                data-pv-image-hit="true"
                className="absolute inset-0"
                onMouseEnter={() => {
                  if (!areCuesEnabled) return;
                  cuePointerActiveRef.current = false;
                }}
                onMouseLeave={hideCuePill}
                onTouchStart={isIPadExperience ? handleCueTouchStart : undefined}
                onTouchMove={isIPadExperience ? handleCueTouchMove : undefined}
                onTouchEnd={isIPadExperience ? handleCueTouchEnd : undefined}
                onTouchCancel={isIPadExperience ? handleCueTouchEnd : undefined}
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
                    hideCuePill();
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
                  className={`pointer-events-none absolute left-0 top-0 z-30 inline-flex h-[29px] items-center whitespace-nowrap rounded-[999px] border px-[11px] shadow-[0_0_0_0.5px_rgba(17,17,17,0.22)] transition-opacity duration-180 ease-out ${cuePillToneClass} ${cuePillBorderToneClass} ${
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
                  className={`inline-flex items-center font-ui text-[13px] leading-5 tracking-[0.02em] text-meta transition-opacity duration-200 motion-safe:[animation:pv-scroll-hint-bob_1.4s_ease-in-out_infinite] ${
                    showScrollHint ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="inline-block leading-none">▾</span>
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
