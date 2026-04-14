"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  archiveCapsuleIds,
  archiveCapsuleItems,
  sections,
  type ArchiveCapsuleId,
  type MockCatalogItem,
} from "@/data/mockCatalog";
import { GalleryHoverActions } from "@/components/unseen/GalleryHoverActions";

type ImmersiveViewProps = {
  mode: "gallery" | "archive";
};

type CategoryKey = "OUTER" | "UPPER" | "LOWER" | "SILHOUETTE" | "GROUND" | "ARTIFACTS";
type SlotKey = -2 | -1 | 0 | 1 | 2;

type ReturnFocusPayload = {
  at?: number;
  hideUntil?: number;
  itemId?: string;
};

type ImmersiveStatePayload = {
  at: number;
  capsule?: ArchiveCapsuleId;
  category: CategoryKey;
  focusedTrack?: number;
  itemId: string;
  mode: "gallery" | "archive";
};

type CardPresentation = {
  height: number;
  opacity: number;
  scale: number;
  translateX: number;
  width: number;
  zIndex: number;
};

const CATEGORY_KEYS: CategoryKey[] = ["OUTER", "UPPER", "LOWER", "SILHOUETTE", "GROUND", "ARTIFACTS"];
const SLOT_ORDER: SlotKey[] = [-2, -1, 0, 1, 2];
const RETURN_FOCUS_ITEM_KEY = "unseen:return-focus-item";
const RETURN_FLIGHT_FINISHED_EVENT = "unseen:return-flight-finished";
const RETURN_FLIGHT_FINISHED_KEY = "unseen:return-flight-finished-flag";
const IMMERSIVE_STATE_KEY = "unseen:immersive-state";
const DEFAULT_RETURN_REVEAL_DELAY_MS = 820;
const DEFAULT_VIEWPORT_WIDTH = 1440;
const DEFAULT_SECTION_HEIGHT = 760;
const CATEGORY_MENU_OPEN_SETTLE_MS = 32;
const CATEGORY_MENU_CLOSE_DURATION_MS = 320;

const SECTION_BY_KEY = new Map(
  sections.map((section) => [section.key as CategoryKey, section]),
);

type SearchParamsLike = {
  get(name: string): string | null;
};

function normalizeIndex(index: number, size: number) {
  if (size <= 0) return 0;
  return ((index % size) + size) % size;
}

function normalizeCarouselItems(items: MockCatalogItem[], minCount = 5) {
  if (items.length === 0) return items;
  if (items.length >= minCount) return items;

  const looped: MockCatalogItem[] = [];
  for (let i = 0; i < minCount; i += 1) {
    looped.push(items[i % items.length]);
  }
  return looped;
}

function clampNumber(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWheelHoverZone(
  zone: "left" | "right" | "top" | "center" | "ring",
): "none" | "left" | "right" | "top" | "center" {
  return zone === "ring" ? "none" : zone;
}

function isPointerInCenteredHoverZone(
  containerRect: DOMRect,
  clientX: number,
  clientY: number,
) {
  const insetX = containerRect.width * 0.16;
  const insetY = containerRect.height * 0.12;
  const left = containerRect.left + insetX;
  const right = containerRect.right - insetX;
  const top = containerRect.top + insetY;
  const bottom = containerRect.bottom - insetY;

  return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
}

function getContainRect(containerRect: DOMRect, aspectRatio: number) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return containerRect;
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

function getItemNumber(item: MockCatalogItem) {
  const fromIdxLabel = item.idxLabel.match(/\d+/)?.[0];
  if (fromIdxLabel) return fromIdxLabel;
  const fromId = item.id.match(/\d+/)?.[0];
  return fromId ?? "00";
}

function getCapsuleFromParams(searchParams: SearchParamsLike): ArchiveCapsuleId {
  const capsuleParam = searchParams.get("capsule");
  return capsuleParam && archiveCapsuleIds.includes(capsuleParam as ArchiveCapsuleId)
    ? (capsuleParam as ArchiveCapsuleId)
    : "main";
}

function isGridActionEventTarget(target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  const element = target instanceof Element ? target : target.parentElement;
  return Boolean(element?.closest('[data-grid-action-hit="true"]'));
}

function isImmersiveDragExemptTarget(target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  const element = target instanceof Element ? target : target.parentElement;
  return Boolean(element?.closest('[data-immersive-drag-exempt="true"]'));
}

function readReturnFocusDelayPayload() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RETURN_FOCUS_ITEM_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ReturnFocusPayload;
    const isFresh = typeof parsed.at === "number" && Date.now() - parsed.at < 90 * 1000;
    if (!isFresh || !parsed.itemId) return null;

    window.sessionStorage.removeItem(RETURN_FOCUS_ITEM_KEY);

    return {
      itemId: parsed.itemId,
      delayMs:
        typeof parsed.hideUntil === "number"
          ? Math.max(120, Math.min(2000, parsed.hideUntil - Date.now()))
          : DEFAULT_RETURN_REVEAL_DELAY_MS,
    };
  } catch {
    return null;
  }
}

function hasReturnFlightFinishedFlag() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.sessionStorage.getItem(RETURN_FLIGHT_FINISHED_KEY));
  } catch {
    return false;
  }
}

type ImmersiveProductCardProps = {
  isClickable: boolean;
  isDragging: boolean;
  isMotionLocked: boolean;
  hiddenForReturn: boolean;
  item: MockCatalogItem;
  motionEasing: string;
  mode: "gallery" | "archive";
  motionDurationMs: number;
  onCardActivate: (item: MockCatalogItem, imageNode: HTMLDivElement | null, slot: SlotKey) => void;
  onFocusedRefChange?: (node: HTMLDivElement | null) => void;
  onPrefetch: (item: MockCatalogItem) => void;
  presentation: CardPresentation;
  slot: SlotKey;
};

function ImmersiveProductCard({
  isClickable,
  isDragging,
  isMotionLocked,
  hiddenForReturn,
  item,
  motionEasing,
  mode,
  motionDurationMs,
  onCardActivate,
  onFocusedRefChange,
  onPrefetch,
  presentation,
  slot,
}: ImmersiveProductCardProps) {
  const [hoverResetKey, setHoverResetKey] = useState(0);
  const [isFocusedHoverActive, setIsFocusedHoverActive] = useState(false);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const hoverDelayTimerRef = useRef<number | null>(null);
  const isFocused = slot === 0;
  const hasHoverActions = isFocused && isFocusedHoverActive;

  const clearHoverDelay = () => {
    if (hoverDelayTimerRef.current !== null) {
      window.clearTimeout(hoverDelayTimerRef.current);
      hoverDelayTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isFocused) return;
    onFocusedRefChange?.(imageRef.current);
    return () => onFocusedRefChange?.(null);
  }, [isFocused, onFocusedRefChange]);

  useEffect(() => {
    if (isFocused) return;
    clearHoverDelay();
    setIsFocusedHoverActive(false);
  }, [isFocused]);

  useEffect(() => {
    return () => {
      clearHoverDelay();
    };
  }, []);

  return (
    <article
      className={`group/product absolute left-1/2 top-1/2 ${
        isClickable ? "pointer-events-auto" : "pointer-events-none"
      }`}
      onMouseEnter={() => onPrefetch(item)}
      onFocus={() => onPrefetch(item)}
      onMouseLeave={() => {
        clearHoverDelay();
        setIsFocusedHoverActive(false);
        setHoverResetKey((value) => value + 1);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          clearHoverDelay();
          setIsFocusedHoverActive(false);
          setHoverResetKey((value) => value + 1);
        }
      }}
      style={{
        width: `${presentation.width}px`,
        height: `${presentation.height}px`,
        zIndex: presentation.zIndex,
        opacity: hiddenForReturn ? 0 : presentation.opacity,
        transform: `translate(-50%, -50%) translate3d(${presentation.translateX}px, 0px, 0px)`,
        transition: isDragging || isMotionLocked
          ? "none"
          : [
              `transform ${motionDurationMs}ms ${motionEasing}`,
              `width ${Math.max(220, motionDurationMs)}ms ${motionEasing}`,
              `height ${Math.max(220, motionDurationMs)}ms ${motionEasing}`,
              `opacity ${Math.min(240, motionDurationMs)}ms ease-out`,
            ].join(", "),
        willChange: "transform",
      }}
    >
      <div
        ref={imageRef}
        className="relative h-full w-full"
        data-immersive-card="true"
        style={{
          transform: "scale(var(--scale,1))",
          transformOrigin: "center center",
          transition:
            isDragging || isMotionLocked ? "none" : `transform ${motionDurationMs}ms ${motionEasing}`,
          willChange: "transform",
          ["--scale" as any]: String(presentation.scale),
        }}
        onMouseMove={(event) => {
          if (!isFocused) return;
          if (isGridActionEventTarget(event.target)) return;
          const rect = imageRef.current?.getBoundingClientRect();
          if (!rect) return;
          const inZone = isPointerInCenteredHoverZone(rect, event.clientX, event.clientY);

          if (inZone) {
            if (isFocusedHoverActive || hoverDelayTimerRef.current !== null) return;
            hoverDelayTimerRef.current = window.setTimeout(() => {
              setIsFocusedHoverActive(true);
              hoverDelayTimerRef.current = null;
            }, 140);
            return;
          }

          clearHoverDelay();
          if (isFocusedHoverActive) {
            setIsFocusedHoverActive(false);
            setHoverResetKey((value) => value + 1);
          }
        }}
        onClick={(event) => {
          if (isGridActionEventTarget(event.target)) return;
          onCardActivate(item, imageRef.current, slot);
        }}
      >
        <Image
          src={item.imgSrc}
          alt={`${item.brand} ${item.artsyName}`}
          fill
          draggable={false}
          className={`object-contain object-center transition-[filter] duration-150 ease-out ${
            hasHoverActions ? "group-hover/product:blur-[1.8px] group-focus-within/product:blur-[1.8px]" : ""
          }`}
          sizes="(max-width: 768px) 44vw, (max-width: 1024px) 28vw, 20vw"
          priority={false}
        />
        {hasHoverActions ? (
          <GalleryHoverActions
            itemId={item.id}
            mode={mode}
            hoverResetKey={hoverResetKey}
            dropdownDirection="up"
          />
        ) : null}
      </div>
    </article>
  );
}

export function ImmersiveView({ mode }: ImmersiveViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusLabelRef = useRef<HTMLParagraphElement | null>(null);
  const focusedImageRef = useRef<HTMLDivElement | null>(null);
  const categoryCloseTimerRef = useRef<number | null>(null);
  const categoryMenuPhaseTimerRef = useRef<number | null>(null);
  const categorySettleTimerRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const rowStageRef = useRef<HTMLDivElement | null>(null);
  const rowWheelAccumulatorRef = useRef(0);
  const rowWheelPendingDirectionRef = useRef<0 | -1 | 1>(0);
  const rowWheelRafRef = useRef<number | null>(null);
  const rowWheelLastStepAtRef = useRef(0);
  const rowWheelNavLockUntilRef = useRef(0);
  const rowWheelLastDirectionRef = useRef<0 | -1 | 1>(0);
  const dragProgressRef = useRef(0);
  const dragProgressRafRef = useRef<number | null>(null);
  const rowDragRef = useRef({
    active: false,
    accumX: 0,
    lastT: 0,
    lastVelocityX: 0,
    lastX: 0,
    moved: false,
    pointerId: -1,
    startAt: 0,
  });
  const suppressCardClickUntilRef = useRef(0);
  const navLockUntilRef = useRef(0);
  const lastRapidNavAtRef = useRef(0);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const hoveredWheelZoneRef = useRef<"none" | "left" | "right" | "top" | "center">("none");
  const wheelDragRef = useRef({
    accum: 0,
    active: false,
    didRotate: false,
    lastAngle: 0,
    lastStepAt: 0,
  });
  const didInitialStateRestoreRef = useRef(false);
  const wasMenuOpenRef = useRef(false);

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(CATEGORY_KEYS[0]);
  const [renderCategory, setRenderCategory] = useState<CategoryKey>(CATEGORY_KEYS[0]);
  const [categoryTransitionPhase, setCategoryTransitionPhase] = useState<"idle" | "out" | "in">("idle");
  const [focusedTrack, setFocusedTrack] = useState(0);
  const [motionDurationMs, setMotionDurationMs] = useState(380);
  const [motionEasing, setMotionEasing] = useState("cubic-bezier(0.22, 1, 0.36, 1)");
  const [dragProgress, setDragProgress] = useState(0);
  const [isRowDragging, setIsRowDragging] = useState(false);
  const [stageCenterOffsetPx, setStageCenterOffsetPx] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(DEFAULT_VIEWPORT_WIDTH);
  const [sectionHeight, setSectionHeight] = useState(DEFAULT_SECTION_HEIGHT);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [categoryMenuPhase, setCategoryMenuPhase] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const [hoveredWheelZone, setHoveredWheelZone] = useState<"none" | "left" | "right" | "top" | "center">("none");
  const [returnImageState, setReturnImageState] = useState(() => {
    const returnPayload = readReturnFocusDelayPayload();
    if (!returnPayload?.itemId) {
      return {
        delayMs: 0,
        freezeLane: false,
        hiddenItemId: null,
      };
    }

    return {
      hiddenItemId: returnPayload.itemId,
      delayMs: returnPayload.delayMs,
      freezeLane: true,
    };
  });

  const queryString = searchParams.toString();
  const editParam = searchParams.get("edit");
  const activeCapsule = mode === "archive" ? getCapsuleFromParams(searchParams) : null;
  const hasCategoryMenu = mode === "gallery";

  useEffect(() => {
    dragProgressRef.current = dragProgress;
  }, [dragProgress]);

  useEffect(() => {
    return () => {
      if (categoryCloseTimerRef.current !== null) {
        window.clearTimeout(categoryCloseTimerRef.current);
      }
      if (categoryMenuPhaseTimerRef.current !== null) {
        window.clearTimeout(categoryMenuPhaseTimerRef.current);
      }
      if (categorySettleTimerRef.current !== null) {
        window.clearTimeout(categorySettleTimerRef.current);
      }
      if (dragProgressRafRef.current !== null) {
        cancelAnimationFrame(dragProgressRafRef.current);
      }
      if (rowWheelRafRef.current !== null) {
        cancelAnimationFrame(rowWheelRafRef.current);
      }
    };
  }, []);

  const itemsByCategory = useMemo(() => {
    const bucket = CATEGORY_KEYS.reduce<Record<CategoryKey, MockCatalogItem[]>>(
      (acc, key) => ({ ...acc, [key]: [] }),
      {
        OUTER: [],
        UPPER: [],
        LOWER: [],
        SILHOUETTE: [],
        GROUND: [],
        ARTIFACTS: [],
      },
    );

    if (mode === "gallery") {
      sections.forEach((section) => {
        const key = section.key as CategoryKey;
        bucket[key] = normalizeCarouselItems(section.items);
      });
      return bucket;
    }

    // Archive immersive uses one continuous lane (no category selection).
    const capsuleItems = archiveCapsuleItems[activeCapsule ?? "main"];
    bucket.OUTER = normalizeCarouselItems(capsuleItems);

    return bucket;
  }, [activeCapsule, mode]);

  const categoryEntries = useMemo(
    () =>
      CATEGORY_KEYS.map((key) => ({
        key,
        label: SECTION_BY_KEY.get(key)?.title ?? key,
        items: itemsByCategory[key],
      })),
    [itemsByCategory],
  );

  const firstCategoryWithItems =
    categoryEntries.find((entry) => entry.items.length > 0)?.key ?? CATEGORY_KEYS[0];

  useLayoutEffect(() => {
    if (didInitialStateRestoreRef.current) return;
    didInitialStateRestoreRef.current = true;

    let restored = false;

    try {
      const raw = window.sessionStorage.getItem(IMMERSIVE_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ImmersiveStatePayload;
        const isFresh = Date.now() - parsed.at < 30 * 60 * 1000;
        const isSameMode = parsed.mode === mode;
        const isSameCapsule = mode !== "archive" || parsed.capsule === activeCapsule;

        if (isFresh && isSameMode && isSameCapsule && CATEGORY_KEYS.includes(parsed.category)) {
          const restoredCategoryItems = itemsByCategory[parsed.category];
          const hasStoredTrack = Number.isFinite(parsed.focusedTrack);
          if (hasStoredTrack && restoredCategoryItems.length > 0) {
            const storedTrack = Math.trunc(parsed.focusedTrack as number);
            const normalizedStoredIndex = normalizeIndex(storedTrack, restoredCategoryItems.length);
            if (restoredCategoryItems[normalizedStoredIndex]?.id === parsed.itemId) {
              setSelectedCategory(parsed.category);
              setRenderCategory(parsed.category);
              setFocusedTrack(storedTrack);
              restored = true;
            }
          }

          if (!restored) {
            const restoredIndex = restoredCategoryItems.findIndex((item) => item.id === parsed.itemId);
            if (restoredIndex >= 0) {
              setSelectedCategory(parsed.category);
              setRenderCategory(parsed.category);
              setFocusedTrack(restoredIndex);
              restored = true;
            }
          }
        }
      }
    } catch {
      // Keep default state if payload is malformed.
    }

    if (!restored) {
      setSelectedCategory(firstCategoryWithItems);
      setRenderCategory(firstCategoryWithItems);
      setFocusedTrack(0);
    }
  }, [activeCapsule, firstCategoryWithItems, itemsByCategory, mode]);

  useEffect(() => {
    if (!returnImageState.hiddenItemId) return;
    let isRevealed = false;
    const revealItem = () => {
      if (isRevealed) return;
      isRevealed = true;
      setReturnImageState((current) =>
        current.hiddenItemId
          ? {
              ...current,
              hiddenItemId: null,
            }
          : current,
      );
    };

    const timer = window.setTimeout(revealItem, returnImageState.delayMs || DEFAULT_RETURN_REVEAL_DELAY_MS);
    const handleFlightFinished = () => {
      revealItem();
    };
    window.addEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);

    try {
      if (window.sessionStorage.getItem(RETURN_FLIGHT_FINISHED_KEY)) {
        revealItem();
      }
    } catch {
      // Keep timer fallback when storage is unavailable.
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);
    };
  }, [returnImageState.delayMs, returnImageState.hiddenItemId]);

  useEffect(() => {
    if (!returnImageState.freezeLane) return;

    const releaseLaneFreeze = () => {
      setReturnImageState((current) =>
        current.freezeLane
          ? {
              ...current,
              freezeLane: false,
            }
          : current,
      );
    };

    if (hasReturnFlightFinishedFlag()) {
      const rafId = window.requestAnimationFrame(releaseLaneFreeze);
      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }

    const safetyTimer = window.setTimeout(
      releaseLaneFreeze,
      Math.max(DEFAULT_RETURN_REVEAL_DELAY_MS, returnImageState.delayMs) + 900,
    );
    const handleFlightFinished = () => {
      releaseLaneFreeze();
    };
    window.addEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);

    return () => {
      window.clearTimeout(safetyTimer);
      window.removeEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);
    };
  }, [returnImageState.delayMs, returnImageState.freezeLane]);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const lockScrollY = window.scrollY;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevHtmlOverscrollX = html.style.overscrollBehaviorX;
    const prevBodyOverscrollX = body.style.overscrollBehaviorX;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;
    const prevBodyWidth = body.style.width;
    const prevBodyPaddingRight = body.style.paddingRight;

    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const currentBodyPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    html.style.overscrollBehaviorX = "none";
    body.style.overscrollBehaviorX = "none";
    body.style.position = "fixed";
    body.style.top = `-${lockScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${currentBodyPaddingRight + scrollbarWidth}px`;
    }

    const preventPageScroll = (event: WheelEvent) => {
      event.preventDefault();
    };
    const preventTouchScroll = (event: TouchEvent) => {
      event.preventDefault();
    };
    const preventScrollKeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === " "
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener("wheel", preventPageScroll, {
      passive: false,
      capture: true,
    });
    window.addEventListener("touchmove", preventTouchScroll, {
      passive: false,
      capture: true,
    });
    window.addEventListener("keydown", preventScrollKeys, {
      capture: true,
    });

    return () => {
      window.removeEventListener("wheel", preventPageScroll, true);
      window.removeEventListener("touchmove", preventTouchScroll, true);
      window.removeEventListener("keydown", preventScrollKeys, true);
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
      html.style.overscrollBehaviorX = prevHtmlOverscrollX;
      body.style.overscrollBehaviorX = prevBodyOverscrollX;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      body.style.width = prevBodyWidth;
      body.style.paddingRight = prevBodyPaddingRight;
      window.scrollTo(0, lockScrollY);
    };
  }, []);

  useLayoutEffect(() => {
    const updateViewportWidth = () => {
      const viewportW = Math.max(window.innerWidth, document.documentElement.clientWidth);
      const stageWidth = rowStageRef.current?.getBoundingClientRect().width;
      const stageRect = rowStageRef.current?.getBoundingClientRect();
      if (stageRect) {
        const stageCenterX = stageRect.left + stageRect.width / 2;
        setStageCenterOffsetPx(stageCenterX - viewportW / 2);
      } else {
        setStageCenterOffsetPx(0);
      }
      if (stageWidth && stageWidth > 0) {
        setViewportWidth(stageWidth);
      } else {
        setViewportWidth(viewportW);
      }

      const sectionRect = sectionRef.current?.getBoundingClientRect();
      if (sectionRect?.height && sectionRect.height > 0) {
        setSectionHeight(sectionRect.height);
      }
    };
    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);

    return () => {
      window.removeEventListener("resize", updateViewportWidth);
    };
  }, []);

  useEffect(() => {
    const renderCategoryItems = itemsByCategory[renderCategory] ?? [];
    if (renderCategoryItems.length > 0) return;

    setSelectedCategory(firstCategoryWithItems);
    setRenderCategory(firstCategoryWithItems);
    setFocusedTrack(0);
    setCategoryTransitionPhase("idle");
  }, [firstCategoryWithItems, itemsByCategory, renderCategory]);

  const activeItems = itemsByCategory[renderCategory] ?? [];

  const slotPresentationByKey = useMemo(() => {
    const vw = viewportWidth > 0 ? viewportWidth : 1440;
    const focusWidth = clampNumber(166, vw * 0.18, 269);
    const focusHeight = clampNumber(230, vw * 0.29, 361);
    const sideWidth = clampNumber(110, vw * 0.12, 180);
    const sideHeight = clampNumber(163, vw * 0.19, 254);

    // Left/right edge cards should be about half cut at the viewport boundaries.
    const edgeInsetPx = clampNumber(0, vw * 0.002, 3);
    const leftReach = clampNumber(0, vw / 2 + stageCenterOffsetPx, vw);
    const rightReach = clampNumber(0, vw / 2 - stageCenterOffsetPx, vw);
    const farLeftCenter = Math.max(0, leftReach - edgeInsetPx);
    const farRightCenter = Math.max(0, rightReach - edgeInsetPx);
    const nearLeftCenter = farLeftCenter * 0.56;
    const nearRightCenter = farRightCenter * 0.56;

    return {
      [-2]: {
        width: sideWidth,
        height: sideHeight,
        translateX: -farLeftCenter,
        zIndex: 10,
        opacity: 1,
        scale: 1,
      },
      [-1]: {
        width: sideWidth,
        height: sideHeight,
        translateX: -nearLeftCenter,
        zIndex: 20,
        opacity: 1,
        scale: 1,
      },
      [0]: {
        width: focusWidth,
        height: focusHeight,
        translateX: 0,
        zIndex: 40,
        opacity: 1,
        scale: 1,
      },
      [1]: {
        width: sideWidth,
        height: sideHeight,
        translateX: nearRightCenter,
        zIndex: 20,
        opacity: 1,
        scale: 1,
      },
      [2]: {
        width: sideWidth,
        height: sideHeight,
        translateX: farRightCenter,
        zIndex: 10,
        opacity: 1,
        scale: 1,
      },
    } satisfies Record<SlotKey, CardPresentation>;
  }, [stageCenterOffsetPx, viewportWidth]);

  const edgeFadeWidth = useMemo(() => {
    const vw = viewportWidth > 0 ? viewportWidth : 1440;
    return clampNumber(16, vw * 0.022, 34);
  }, [viewportWidth]);

  const verticalGapPx = useMemo(() => {
    const vw = viewportWidth > 0 ? viewportWidth : 1440;
    return Math.round(clampNumber(10, (vw / 1400) * 20, 20));
  }, [viewportWidth]);

  const baseRowTopPadPx = useMemo(() => {
    const vw = viewportWidth > 0 ? viewportWidth : 1440;
    const shrinkProgress = clampNumber(0, (1400 - vw) / 700, 1);
    // Allow up to 80% upward shift as viewport narrows.
    return Math.round(30 - 24 * shrinkProgress);
  }, [viewportWidth]);

  const wheelMetrics = useMemo(() => {
    const vh = sectionHeight > 0 ? sectionHeight : 760;
    const heightProgress = clampNumber(0, (vh - 760) / 360, 1);
    return {
      menuOffsetPx: Math.round(clampNumber(6, 6 + heightProgress * 4, 10)),
      sizePx: Math.round(clampNumber(143, 143 + heightProgress * 8, 151)),
      bottomPadPx: Math.round(clampNumber(31, 31 + heightProgress * 14, 45)),
    };
  }, [sectionHeight]);
  const wheelSizePx = wheelMetrics.sizePx;
  const wheelBottomPadPx = wheelMetrics.bottomPadPx;
  const wheelDockBottomPx = wheelBottomPadPx + 24;
  const wheelMenuTopPx = (wheelSizePx - 79) / 4;

  const rowHeightPx = useMemo(
    () => Math.max(247, Math.round(slotPresentationByKey[0].height + 48)),
    [slotPresentationByKey],
  );

  const layoutLane = useMemo(() => {
    const infoRowLineHeightPx = 20; // from text leading-5
    const minGapPx = 10;
    const staticGapPx = 14;
    const largeScaleGapGrow = clampNumber(0, (viewportWidth - 1700) / 700, 1) * 8;
    const desiredGapPx = staticGapPx + largeScaleGapGrow;
    const desiredLaneHeightPx = infoRowLineHeightPx + desiredGapPx * 2;
    const wheelTop = sectionHeight - wheelDockBottomPx - wheelSizePx;
    const baseFocusHeight = slotPresentationByKey[0].height;

    const focusBottomFromTop = (rowTop: number, focusHeight: number) =>
      rowTop + 8 + rowHeightPx / 2 + focusHeight / 2;

    // Keep spacing constant first by solving row-top against the desired lane height.
    const maxRowTopForDesiredLane =
      wheelTop - desiredLaneHeightPx - (8 + rowHeightPx / 2 + baseFocusHeight / 2);
    const resolvedRowTopPadPx = Math.max(0, Math.min(baseRowTopPadPx, maxRowTopForDesiredLane));

    // If the lane is still too tight, scale product cards down before breaking the ordering.
    const maxScaledFocusHalf =
      wheelTop - resolvedRowTopPadPx - 8 - rowHeightPx / 2 - desiredLaneHeightPx;
    const maxScaledFocusHeight = Math.max(1, maxScaledFocusHalf * 2);
    const cardScale = clampNumber(0.72, maxScaledFocusHeight / Math.max(1, baseFocusHeight), 1);
    const resolvedFocusBottom = focusBottomFromTop(resolvedRowTopPadPx, baseFocusHeight * cardScale);
    const laneSpaceExcludingText = wheelTop - resolvedFocusBottom - infoRowLineHeightPx;
    const equalGapPx = laneSpaceExcludingText / 2;
    const hideWheel = equalGapPx < 8;
    const resolvedGapPx = hideWheel ? Math.max(minGapPx, desiredGapPx) : Math.max(minGapPx, equalGapPx);

    return {
      cardScale,
      hideWheel,
      infoRowCenterPx: Math.round(resolvedFocusBottom + resolvedGapPx + infoRowLineHeightPx / 2),
      rowTopPadPx: Math.round(resolvedRowTopPadPx),
    };
  }, [
    baseRowTopPadPx,
    rowHeightPx,
    sectionHeight,
    slotPresentationByKey,
    viewportWidth,
    wheelDockBottomPx,
    wheelSizePx,
  ]);

  useEffect(() => {
    if (!hasCategoryMenu) {
      setIsMenuOpen(false);
      return;
    }
    if (!layoutLane.hideWheel) return;
    setIsMenuOpen(false);
  }, [hasCategoryMenu, layoutLane.hideWheel]);

  useEffect(() => {
    if (categoryMenuPhaseTimerRef.current !== null) {
      window.clearTimeout(categoryMenuPhaseTimerRef.current);
      categoryMenuPhaseTimerRef.current = null;
    }

    if (!hasCategoryMenu || layoutLane.hideWheel) {
      wasMenuOpenRef.current = false;
      setCategoryMenuPhase("closed");
      return;
    }

    const wasMenuOpen = wasMenuOpenRef.current;
    wasMenuOpenRef.current = isMenuOpen;

    if (isMenuOpen) {
      setCategoryMenuPhase("opening");
      categoryMenuPhaseTimerRef.current = window.setTimeout(() => {
        setCategoryMenuPhase("open");
        categoryMenuPhaseTimerRef.current = null;
      }, CATEGORY_MENU_OPEN_SETTLE_MS);
      return;
    }

    if (wasMenuOpen) {
      setCategoryMenuPhase("closing");
      categoryMenuPhaseTimerRef.current = window.setTimeout(() => {
        setCategoryMenuPhase("closed");
        categoryMenuPhaseTimerRef.current = null;
      }, CATEGORY_MENU_CLOSE_DURATION_MS);
      return;
    }

    setCategoryMenuPhase("closed");
  }, [hasCategoryMenu, isMenuOpen, layoutLane.hideWheel]);

  const getInterpolatedPresentation = useCallback(
    (slot: number) => {
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const interpolate = (left: SlotKey, right: SlotKey, t: number): CardPresentation => {
        const lp = slotPresentationByKey[left];
        const rp = slotPresentationByKey[right];
        return {
          width: lerp(lp.width, rp.width, t) * layoutLane.cardScale,
          height: lerp(lp.height, rp.height, t) * layoutLane.cardScale,
          translateX: lerp(lp.translateX, rp.translateX, t),
          zIndex: Math.round(lerp(lp.zIndex, rp.zIndex, t)),
          opacity: lerp(lp.opacity, rp.opacity, t),
          scale: lerp(lp.scale, rp.scale, t),
        };
      };
      const extrapolate = (anchor: SlotKey, neighbor: SlotKey, t: number): CardPresentation => {
        const ap = slotPresentationByKey[anchor];
        const np = slotPresentationByKey[neighbor];
        const blend = (a: number, b: number) => a + (a - b) * t;
        return {
          width: blend(ap.width, np.width) * layoutLane.cardScale,
          height: blend(ap.height, np.height) * layoutLane.cardScale,
          translateX: blend(ap.translateX, np.translateX),
          zIndex: Math.round(blend(ap.zIndex, np.zIndex)),
          opacity: blend(ap.opacity, np.opacity),
          scale: blend(ap.scale, np.scale),
        };
      };

      if (slot <= -2) return extrapolate(-2, -1, Math.abs(slot + 2));
      if (slot >= 2) return extrapolate(2, 1, Math.abs(slot - 2));
      if (slot < -1) return interpolate(-2, -1, slot + 2);
      if (slot < 0) return interpolate(-1, 0, slot + 1);
      if (slot < 1) return interpolate(0, 1, slot);
      return interpolate(1, 2, slot - 1);
    },
    [layoutLane.cardScale, slotPresentationByKey],
  );

  const focusedItem =
    activeItems.length > 0 ? activeItems[normalizeIndex(focusedTrack, activeItems.length)] : null;

  useEffect(() => {
    if (!focusedItem) return;
    try {
      const payload: ImmersiveStatePayload = {
        at: Date.now(),
        mode,
        capsule: activeCapsule ?? undefined,
        category: renderCategory,
        focusedTrack,
        itemId: focusedItem.id,
      };
      window.sessionStorage.setItem(IMMERSIVE_STATE_KEY, JSON.stringify(payload));
    } catch {
      // Optional restore convenience only.
    }
  }, [activeCapsule, focusedItem, focusedTrack, mode, renderCategory]);

  const pathname = usePathname();
  const backHref = queryString ? `${pathname}?${queryString}` : pathname;

  const buildProductViewHref = useCallback(
    (item: MockCatalogItem) => {
      const nextParams = new URLSearchParams({
        item: item.id,
        mode,
        back: backHref,
        img: item.imgSrc,
      });

      if (editParam) {
        nextParams.set("edit", editParam);
      }

      return `/product-view?${nextParams.toString()}`;
    },
    [backHref, editParam, mode],
  );

  const prefetchItem = useCallback(
    (item: MockCatalogItem) => {
      router.prefetch(buildProductViewHref(item));
    },
    [buildProductViewHref, router],
  );

  useEffect(() => {
    if (!focusedItem) return;
    prefetchItem(focusedItem);
  }, [focusedItem, prefetchItem]);

  const openProductView = useCallback(
    (item: MockCatalogItem, imageNode: HTMLDivElement | null) => {
      prefetchItem(item);

      const imgEl = imageNode?.querySelector("img") as HTMLImageElement | null;
      const containerRect = imageNode?.getBoundingClientRect() ?? null;
      const imgRect = imgEl?.getBoundingClientRect() ?? null;
      const aspectRatio =
        imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0
          ? imgEl.naturalWidth / imgEl.naturalHeight
          : undefined;
      const containRect =
        containerRect && aspectRatio ? getContainRect(containerRect, aspectRatio) : null;
      const sourceRect = containRect ?? imgRect ?? containerRect;

      if (sourceRect) {
        try {
          window.sessionStorage.setItem(
            "unseen:product-view-transition",
            JSON.stringify({
              itemId: item.id,
              src: item.imgSrc,
              left: sourceRect.left,
              top: sourceRect.top,
              width: sourceRect.width,
              height: sourceRect.height,
              aspectRatio,
              at: Date.now(),
            }),
          );
        } catch {
          // Transition is optional; ignore storage failures.
        }
      }

      const textRect = focusLabelRef.current?.getBoundingClientRect();
      if (textRect) {
        try {
          window.sessionStorage.setItem(
            "unseen:product-view-text-transition",
            JSON.stringify({
              itemId: item.id,
              left: textRect.left,
              top: textRect.top,
              width: textRect.width,
              height: textRect.height,
              at: Date.now(),
            }),
          );
        } catch {
          // Transition is optional; ignore storage failures.
        }
      }

      try {
        const payload: ImmersiveStatePayload = {
          at: Date.now(),
          mode,
          capsule: activeCapsule ?? undefined,
          category: renderCategory,
          focusedTrack,
          itemId: item.id,
        };
        window.sessionStorage.setItem(IMMERSIVE_STATE_KEY, JSON.stringify(payload));
      } catch {
        // Optional restore convenience only.
      }

      try {
        window.sessionStorage.setItem(
          "unseen:return-scroll",
          JSON.stringify({
            at: Date.now(),
            backHref,
            scrollY: window.scrollY,
          }),
        );
      } catch {
        // Ignore storage failures.
      }

      router.push(buildProductViewHref(item));
    },
    [activeCapsule, backHref, buildProductViewHref, focusedTrack, mode, prefetchItem, renderCategory, router],
  );

  const navigateBy = useCallback(
    (delta: number, velocity = 1, mode: "default" | "rapid" = "default") => {
      if (activeItems.length <= 1 || delta === 0) return;
      const now = performance.now();
      if (mode === "default" && now < navLockUntilRef.current) return;
      setIsRowDragging(false);
      if (dragProgressRafRef.current !== null) {
        cancelAnimationFrame(dragProgressRafRef.current);
        dragProgressRafRef.current = null;
      }
      dragProgressRef.current = 0;
      setDragProgress(0);
      setMotionEasing(
        mode === "rapid" ? "cubic-bezier(0.16, 0.92, 0.2, 1)" : "cubic-bezier(0.2, 0.9, 0.24, 1)",
      );
      const steps = Math.max(1, Math.round(Math.abs(delta)));
      const direction = delta > 0 ? 1 : -1;
      const isBurst = mode === "rapid" && now - lastRapidNavAtRef.current < 260;
      const duration = Math.round(
        mode === "rapid"
          ? clampNumber(320, 560 - velocity * 90 - (steps - 1) * 26 - (isBurst ? 80 : 0), 560)
          : clampNumber(620, 860 - velocity * 85 - (steps - 1) * 20, 860),
      );
      setMotionDurationMs(duration);
      setFocusedTrack((current) => current + direction * steps);
      if (mode === "rapid") {
        lastRapidNavAtRef.current = now;
        navLockUntilRef.current = now + 90;
      } else {
        navLockUntilRef.current = now + duration * 0.9;
      }
    },
    [activeItems.length],
  );

  const selectCategory = useCallback((category: CategoryKey) => {
    if (categoryCloseTimerRef.current !== null) {
      window.clearTimeout(categoryCloseTimerRef.current);
      categoryCloseTimerRef.current = null;
    }
    if (categorySettleTimerRef.current !== null) {
      window.clearTimeout(categorySettleTimerRef.current);
      categorySettleTimerRef.current = null;
    }

    if (category === renderCategory) {
      setSelectedCategory(category);
      categoryCloseTimerRef.current = window.setTimeout(() => {
        setIsMenuOpen(false);
        categoryCloseTimerRef.current = null;
      }, 220);
      return;
    }

    setSelectedCategory(category);
    setCategoryTransitionPhase("out");
    setMotionDurationMs(480);
    setMotionEasing("cubic-bezier(0.2, 0.88, 0.28, 1)");

    categorySettleTimerRef.current = window.setTimeout(() => {
      setRenderCategory(category);
      setFocusedTrack(0);
      setDragProgress(0);
      dragProgressRef.current = 0;
      setCategoryTransitionPhase("in");
      categorySettleTimerRef.current = window.setTimeout(() => {
        setCategoryTransitionPhase("idle");
        categorySettleTimerRef.current = null;
      }, 340);
    }, 210);

    categoryCloseTimerRef.current = window.setTimeout(() => {
      setIsMenuOpen(false);
      categoryCloseTimerRef.current = null;
    }, 300);
  }, [renderCategory]);

  const handleRowWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (activeItems.length <= 1) return;
      if (isGridActionEventTarget(event.target)) return;

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      // Horizontal trackpad gestures should follow the same path as horizontal mouse wheel.
      const hasHorizontalIntent = absX >= 0.6 && absX >= absY * 0.55;
      const primaryDelta = hasHorizontalIntent ? event.deltaX : event.deltaY;
      if (Math.abs(primaryDelta) < 1.2) return;

      event.preventDefault();
      const normalizedDelta =
        event.deltaMode === 1
          ? primaryDelta * 14
          : event.deltaMode === 2
            ? primaryDelta * 120
            : primaryDelta;
      const dampedDelta = clampNumber(-52, normalizedDelta, 52);
      rowWheelAccumulatorRef.current += dampedDelta;
      const threshold = 170;
      const wheelIntensity = clampNumber(0.7, Math.abs(normalizedDelta) / 26, 2.8);
      rowWheelPendingDirectionRef.current = rowWheelAccumulatorRef.current > 0 ? 1 : -1;
      if (rowWheelRafRef.current !== null) return;

      rowWheelRafRef.current = requestAnimationFrame(() => {
        rowWheelRafRef.current = null;
        const now = performance.now();
        const direction = rowWheelPendingDirectionRef.current;
        const isDirectionFlip =
          rowWheelLastDirectionRef.current !== 0 && direction !== 0 && direction !== rowWheelLastDirectionRef.current;

        if (isDirectionFlip) {
          rowWheelLastStepAtRef.current = 0;
          rowWheelNavLockUntilRef.current = 0;
        }

        if (Math.abs(rowWheelAccumulatorRef.current) < threshold || direction === 0) return;
        const stepCooldownMs = Math.round(clampNumber(90, 220 - wheelIntensity * 60, 220));
        if (now - rowWheelLastStepAtRef.current < stepCooldownMs) return;
        if (!isDirectionFlip && now < rowWheelNavLockUntilRef.current) return;

        const navMode = isDirectionFlip || wheelIntensity > 1.2 ? "rapid" : "default";
        navigateBy(direction, isDirectionFlip ? Math.max(1.6, wheelIntensity) : wheelIntensity, navMode);
        rowWheelAccumulatorRef.current -= direction * threshold;
        rowWheelLastStepAtRef.current = now;
        rowWheelNavLockUntilRef.current = isDirectionFlip
          ? now + 28
          : now + Math.round(clampNumber(90, 240 - wheelIntensity * 70, 240));
        rowWheelLastDirectionRef.current = direction;
      });
    },
    [activeItems.length, navigateBy],
  );

  const handleRowPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activeItems.length <= 1) return;
      if (isGridActionEventTarget(event.target)) return;
      if (isImmersiveDragExemptTarget(event.target)) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);

      rowDragRef.current.active = true;
      rowDragRef.current.pointerId = event.pointerId;
      rowDragRef.current.lastX = event.clientX;
      rowDragRef.current.lastT = performance.now();
      rowDragRef.current.startAt = performance.now();
      rowDragRef.current.accumX = 0;
      rowDragRef.current.lastVelocityX = 0;
      rowDragRef.current.moved = false;
      dragProgressRef.current = 0;
      if (dragProgressRafRef.current !== null) {
        cancelAnimationFrame(dragProgressRafRef.current);
        dragProgressRafRef.current = null;
      }
      setIsRowDragging(true);
      setDragProgress(0);
    },
    [activeItems.length],
  );

  const handleRowPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = rowDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      const now = performance.now();
      const dx = event.clientX - drag.lastX;
      const dt = Math.max(1, now - drag.lastT);
      drag.lastVelocityX = dx / dt;
      drag.lastX = event.clientX;
      drag.lastT = now;
      drag.accumX += dx;

      if (Math.abs(drag.accumX) > 18) {
        drag.moved = true;
      }

      const holdLatencyMs = 220;
      const earlyDragAllowancePx = 56;
      if (now - drag.startAt < holdLatencyMs && Math.abs(drag.accumX) < earlyDragAllowancePx) {
        return;
      }

      // Scrub-only during drag; commit decision is made on release for calmer behavior.
      const scrubDistancePx = 320;
      const targetProgress = clampNumber(-4.8, drag.accumX / scrubDistancePx, 4.8);
      const current = dragProgressRef.current;
      const easedNext = current + (targetProgress - current) * 0.24;
      const maxStepPerFrame = 0.42;
      dragProgressRef.current = clampNumber(
        -4.8,
        current + clampNumber(-maxStepPerFrame, easedNext - current, maxStepPerFrame),
        4.8,
      );

      if (dragProgressRafRef.current === null) {
        dragProgressRafRef.current = requestAnimationFrame(() => {
          dragProgressRafRef.current = null;
          setDragProgress(dragProgressRef.current);
        });
      }
    },
    [],
  );

  const finishRowDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = rowDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      drag.active = false;
      if (dragProgressRafRef.current !== null) {
        cancelAnimationFrame(dragProgressRafRef.current);
        dragProgressRafRef.current = null;
      }

      const absDrag = Math.abs(drag.accumX);
      if (absDrag < 18) {
        setIsRowDragging(false);
        dragProgressRef.current = 0;
        setDragProgress(0);
        const clickTarget = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>('[data-immersive-card="true"]');
        if (clickTarget) {
          // Pointer capture can swallow native child click; forward tap intent explicitly.
          requestAnimationFrame(() => {
            clickTarget.click();
          });
        }
        drag.pointerId = -1;
        drag.accumX = 0;
        drag.lastVelocityX = 0;
        drag.moved = false;
        drag.startAt = 0;
        return;
      }

      if (drag.moved) {
        suppressCardClickUntilRef.current = Date.now() + 280;
      }

      const scrubDistancePx = 320;
      const releaseProgress = clampNumber(-4.8, drag.accumX / scrubDistancePx, 4.8);
      const snapShift = Math.round(releaseProgress);
      const shouldCommit = snapShift !== 0 && activeItems.length > 1;

      if (shouldCommit) {
        const velocity = Math.abs(drag.lastVelocityX);
        const commitDuration = Math.round(clampNumber(460, 700 - velocity * 100, 700));
        setMotionDurationMs(commitDuration);
        setMotionEasing("cubic-bezier(0.16, 0.92, 0.2, 1)");

        // Keep continuity at release: keep residual phase after index snap, then settle to center.
        const residual = releaseProgress - snapShift;
        dragProgressRef.current = residual;
        setDragProgress(residual);
        setFocusedTrack((current) => current - snapShift);
        setIsRowDragging(false);
        requestAnimationFrame(() => {
          dragProgressRef.current = 0;
          setDragProgress(0);
        });
      } else {
        const settleDuration = Math.round(clampNumber(400, 620 - Math.abs(drag.lastVelocityX) * 80, 620));
        setMotionDurationMs(settleDuration);
        setMotionEasing("cubic-bezier(0.2, 0.88, 0.28, 1)");
        setIsRowDragging(false);
        dragProgressRef.current = 0;
        setDragProgress(0);
      }

      drag.pointerId = -1;
      drag.accumX = 0;
      drag.lastVelocityX = 0;
      drag.moved = false;
      drag.startAt = 0;
    },
    [activeItems.length],
  );

  const getWheelAngle = useCallback((clientX: number, clientY: number) => {
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
    return (angle + 360) % 360;
  }, []);

  const classifyWheelZone = useCallback((clientX: number, clientY: number) => {
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return "ring" as const;

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const distance = Math.hypot(dx, dy);

    const centerRadius = rect.width * 0.2;
    if (distance <= centerRadius) return "center" as const;

    const angle = getWheelAngle(clientX, clientY);
    const isRight = angle >= 330 || angle <= 30;
    const isTop = angle > 40 && angle < 140;
    const isLeft = angle >= 150 && angle <= 210;

    if (isLeft) return "left" as const;
    if (isRight) return "right" as const;
    if (isTop) return "top" as const;
    return "ring" as const;
  }, [getWheelAngle]);

  const updateHoveredWheelZone = useCallback(
    (nextZone: "none" | "left" | "right" | "top" | "center") => {
      if (hoveredWheelZoneRef.current === nextZone) return;
      hoveredWheelZoneRef.current = nextZone;
      setHoveredWheelZone(nextZone);
    },
    [],
  );

  const handleWheelPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      wheelDragRef.current.active = true;
      wheelDragRef.current.lastAngle = getWheelAngle(event.clientX, event.clientY);
      wheelDragRef.current.accum = 0;
      wheelDragRef.current.didRotate = false;
      wheelDragRef.current.lastStepAt = 0;
      updateHoveredWheelZone(normalizeWheelHoverZone(classifyWheelZone(event.clientX, event.clientY)));
    },
    [classifyWheelZone, getWheelAngle, updateHoveredWheelZone],
  );

  const handleWheelPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      updateHoveredWheelZone(normalizeWheelHoverZone(classifyWheelZone(event.clientX, event.clientY)));
      if (!wheelDragRef.current.active) return;

      const now = performance.now();
      const nextAngle = getWheelAngle(event.clientX, event.clientY);
      let delta = nextAngle - wheelDragRef.current.lastAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      wheelDragRef.current.lastAngle = nextAngle;
      wheelDragRef.current.accum += delta;

      const stepDeg = 18;
      if (
        Math.abs(wheelDragRef.current.accum) >= stepDeg &&
        now - wheelDragRef.current.lastStepAt >= 90
      ) {
        const direction = wheelDragRef.current.accum > 0 ? 1 : -1;
        navigateBy(direction, 1.9, "rapid");
        wheelDragRef.current.accum -= direction * stepDeg;
        wheelDragRef.current.didRotate = true;
        wheelDragRef.current.lastStepAt = now;
      }
    },
    [classifyWheelZone, getWheelAngle, navigateBy, updateHoveredWheelZone],
  );

  const openFocused = useCallback(() => {
    if (!focusedItem) return;
    openProductView(focusedItem, focusedImageRef.current);
  }, [focusedItem, openProductView]);
  const handleFocusedImageRef = useCallback((node: HTMLDivElement | null) => {
    focusedImageRef.current = node;
  }, []);
  const handleCardActivate = useCallback(
    (item: MockCatalogItem, imageNode: HTMLDivElement | null, slot: SlotKey) => {
      if (Date.now() < suppressCardClickUntilRef.current) return;
      if (slot !== 0) {
        if (activeItems.length <= 1) return;
        navigateBy(slot < 0 ? -1 : 1, 1.35, "rapid");
        return;
      }
      openProductView(item, imageNode);
    },
    [activeItems.length, navigateBy, openProductView],
  );
  const handleWheelPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!wheelDragRef.current.active) return;
      wheelDragRef.current.active = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      updateHoveredWheelZone(normalizeWheelHoverZone(classifyWheelZone(event.clientX, event.clientY)));

      if (wheelDragRef.current.didRotate) {
        wheelDragRef.current.accum = 0;
        wheelDragRef.current.didRotate = false;
        wheelDragRef.current.lastStepAt = 0;
        return;
      }

      const zone = classifyWheelZone(event.clientX, event.clientY);
      if (zone === "left") navigateBy(-1, 1.5, "rapid");
      if (zone === "right") navigateBy(1, 1.5, "rapid");
      if (hasCategoryMenu && zone === "top") setIsMenuOpen((current) => !current);
      if (zone === "center") openFocused();
    },
    [classifyWheelZone, hasCategoryMenu, navigateBy, openFocused, updateHoveredWheelZone],
  );

  const handleWheelPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (wheelDragRef.current.active && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      wheelDragRef.current.active = false;
      wheelDragRef.current.accum = 0;
      wheelDragRef.current.didRotate = false;
      wheelDragRef.current.lastStepAt = 0;
      updateHoveredWheelZone("none");
    },
    [updateHoveredWheelZone],
  );

  useEffect(() => {
    const handleGlobalImmersiveKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateBy(-1, 1.5, "rapid");
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateBy(1, 1.5, "rapid");
      }
      if (event.key === "ArrowUp" && hasCategoryMenu) {
        event.preventDefault();
        setIsMenuOpen((current) => !current);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        openFocused();
      }
    };

    window.addEventListener("keydown", handleGlobalImmersiveKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalImmersiveKeyDown);
    };
  }, [hasCategoryMenu, navigateBy, openFocused]);

  const visibleSlots = useMemo(() => {
    if (activeItems.length === 0) return [];

    const integerDragShift = dragProgress >= 0 ? Math.floor(dragProgress) : Math.ceil(dragProgress);
    const seenByItemId = new Map<string, number>();
    return SLOT_ORDER.map((slot) => {
      const virtualIndex = focusedTrack + slot - integerDragShift;
      const itemIndex = normalizeIndex(virtualIndex, activeItems.length);
      const item = activeItems[itemIndex];
      const seenCount = seenByItemId.get(item.id) ?? 0;
      seenByItemId.set(item.id, seenCount + 1);
      return {
        instanceKey: `${virtualIndex}#${item.id}#${seenCount}`,
        slot,
        item,
      };
    });
  }, [activeItems, dragProgress, focusedTrack]);

  const focusedItemNumber = focusedItem ? getItemNumber(focusedItem) : "00";
  const focusedBrandClass = mode === "archive" ? "text-accent" : "text-ink";
  const activeCategoryPillClass =
    "border-[#181818] bg-[linear-gradient(180deg,#2A2A2A_0%,#121212_100%)] font-medium text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.14)]";
  const wheelBackground = "radial-gradient(circle at 32% 28%, #2f2f2f 0%, #171717 54%, #0e0e0e 100%)";
  const isReturnLaneFrozen = returnImageState.freezeLane;
  const isCategoryMenuVisible = categoryMenuPhase !== "closed";
  const activeCategoryMenuIndex = Math.max(
    0,
    categoryEntries.findIndex((entry) => entry.key === selectedCategory),
  );

  const wheelCenterClass =
    mode === "archive"
      ? hoveredWheelZone === "center"
        ? "scale-[1.04] border-[#18132F] bg-[#24204A] shadow-[inset_0_2px_0_rgba(255,255,255,0.07),0_4px_12px_rgba(10,8,24,0.3)]"
        : "scale-100 border-[#120F25] bg-[#1A1536] shadow-[inset_0_2px_0_rgba(255,255,255,0.04)]"
      : hoveredWheelZone === "center"
        ? "scale-[1.04] border-black/90 bg-[#303030] shadow-[inset_0_2px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.24)]"
        : "scale-100 border-black/90 bg-[#1b1b1b] shadow-[inset_0_2px_0_rgba(255,255,255,0.04)]";

  return (
    <section
      ref={sectionRef}
      className={`relative mx-auto flex w-full max-w-[1333px] select-none flex-col items-center px-6 pb-6 sm:px-10 ${
        isRowDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        height: "calc(var(--viewport-h) - var(--sticky-h))",
        minHeight: "calc(var(--viewport-h) - var(--sticky-h))",
        paddingTop: `${layoutLane.rowTopPadPx}px`,
        paddingBottom: layoutLane.hideWheel
          ? `${verticalGapPx}px`
          : `${wheelSizePx + wheelDockBottomPx + verticalGapPx}px`,
      }}
      onWheel={(event) => {
        event.preventDefault();
      }}
      onDragStart={(event) => {
        event.preventDefault();
      }}
    >
      <div
        className="flex w-full flex-col items-center transition-[transform,opacity] will-change-[transform,opacity]"
        style={{
          opacity: categoryTransitionPhase === "out" ? 0.56 : 1,
          transform:
            categoryTransitionPhase === "out"
              ? "translate3d(0px, 7px, 0px) scale(0.995)"
              : "translate3d(0px, 0px, 0px) scale(1)",
          transitionDuration: categoryTransitionPhase === "out" ? "320ms" : "760ms",
          transitionTimingFunction:
            categoryTransitionPhase === "out"
              ? "cubic-bezier(0.22, 0.84, 0.28, 1)"
              : "cubic-bezier(0.2, 0.88, 0.28, 1)",
        }}
      >
        <div
          ref={rowStageRef}
          className="relative mt-[8px] w-[calc(100dvw+6px)] max-w-none overflow-x-hidden overflow-y-visible"
          style={{
            height: `${rowHeightPx}px`,
            marginLeft: "calc(50% - 50dvw - 3px)",
            marginRight: "calc(50% - 50dvw - 3px)",
            touchAction: "pan-x",
            willChange: "transform",
          }}
          onPointerDown={handleRowPointerDown}
          onPointerMove={handleRowPointerMove}
          onPointerUp={finishRowDrag}
          onPointerCancel={finishRowDrag}
          onWheel={handleRowWheel}
        >
          {visibleSlots.map(({ instanceKey, slot, item }) => (
            <ImmersiveProductCard
              key={instanceKey}
              isClickable={Math.abs(slot) <= 2}
              isDragging={isRowDragging}
              isMotionLocked={isReturnLaneFrozen}
              hiddenForReturn={slot === 0 && returnImageState.hiddenItemId === item.id}
              item={item}
              motionEasing={motionEasing}
              mode={mode}
              motionDurationMs={isRowDragging ? 0 : motionDurationMs}
              slot={slot}
              presentation={getInterpolatedPresentation(
                slot + (dragProgress - (dragProgress >= 0 ? Math.floor(dragProgress) : Math.ceil(dragProgress))),
              )}
              onCardActivate={handleCardActivate}
              onPrefetch={prefetchItem}
              onFocusedRefChange={slot === 0 ? handleFocusedImageRef : undefined}
            />
          ))}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-50 bg-gradient-to-r from-paper/26 via-paper/10 to-transparent"
            style={{ width: `${edgeFadeWidth}px` }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-50 bg-gradient-to-l from-paper/26 via-paper/10 to-transparent"
            style={{ width: `${edgeFadeWidth}px` }}
          />
        </div>

      </div>

      {focusedItem ? (
        <div
          className="pointer-events-none absolute left-1/2 w-full max-w-[760px] -translate-x-1/2 -translate-y-1/2 px-6 sm:px-10"
          style={{ top: `${layoutLane.infoRowCenterPx}px` }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center font-ui text-[14px] font-medium leading-5 tracking-[0.02em] text-meta">
            <p ref={focusLabelRef} className="justify-self-end pr-[42px] text-meta">
              <span aria-hidden="true">|</span>
              <span className="px-[2px]">{focusedItemNumber}</span>
              <span aria-hidden="true">|</span>
            </p>
            <p className={`justify-self-center text-center ${focusedBrandClass}`}>{focusedItem.brand}</p>
            <p className="justify-self-start pl-[42px] text-meta">{focusedItem.price}</p>
          </div>
        </div>
      ) : null}

      {!layoutLane.hideWheel ? (
      <div
        className="fixed z-[90] flex -translate-x-1/2 flex-col items-center"
        style={{
          left: "50dvw",
          bottom: `${wheelDockBottomPx}px`,
        }}
      >
        {hasCategoryMenu && isCategoryMenuVisible ? (
          <div
            className={`absolute left-1/2 z-[92] flex w-fit max-w-[min(88vw,680px)] -translate-x-1/2 flex-nowrap items-center justify-center gap-0 overflow-hidden rounded-[16px] border border-line bg-[#F5F5F6] px-[2px] py-[2px] backdrop-blur-[6px] transition-[opacity,transform,filter,clip-path] ${
              categoryMenuPhase === "open"
                ? "pointer-events-auto translate-y-0 scale-100 opacity-100 blur-0"
                : categoryMenuPhase === "opening"
                  ? "pointer-events-none translate-y-[18px] scale-x-[0.84] scale-y-[0.72] opacity-0 blur-[8px]"
                  : "pointer-events-none translate-y-[8px] scale-[0.985] opacity-0 blur-[2px]"
            } relative`}
            style={{
              bottom: `calc(100% + ${Math.max(3, wheelMetrics.menuOffsetPx - 3)}px)`,
              transformOrigin: "center calc(100% + 14px)",
              transitionDuration:
                categoryMenuPhase === "closing" ? `${CATEGORY_MENU_CLOSE_DURATION_MS}ms` : "560ms",
              transitionTimingFunction:
                categoryMenuPhase === "closing"
                  ? "cubic-bezier(0.16, 0.82, 0.22, 1)"
                  : "cubic-bezier(0.2, 0.88, 0.28, 1)",
              clipPath:
                categoryMenuPhase === "open"
                  ? "inset(0% 0% 0% 0% round 16px)"
                  : categoryMenuPhase === "opening"
                    ? "inset(26% 4% 0% 4% round 14px)"
                    : "inset(18% 3% 0% 3% round 14px)",
              boxShadow: `
                0 1px 2px rgba(0, 0, 0, 0.04),
                inset 0 1px 0 rgba(255, 255, 255, 0.4),
                inset 0 -1px 0 rgba(0, 0, 0, 0.02)
              `,
              willChange: "transform, opacity, filter, clip-path",
            }}
            data-immersive-drag-exempt="true"
            aria-label="Immersive categories"
          >
            {categoryEntries.map((entry, index) => {
              const isActive = entry.key === selectedCategory;
              const isDisabled = entry.items.length === 0;
              const distanceFromActive = Math.abs(index - activeCategoryMenuIndex);
              const closeHoldMs = 0;
              const closeShiftY = 6;
              const closeShiftX = 0;
              const closeScale = 0.985;
              const pillMotionStyle =
                categoryMenuPhase === "open"
                  ? {
                      opacity: 1,
                      filter: "blur(0px)",
                      transform: "translate3d(0, 0, 0) scale(1)",
                      transitionDelay: "0ms",
                      transitionDuration: "420ms",
                      transitionTimingFunction: "cubic-bezier(0.2, 0.88, 0.28, 1)",
                      willChange: "transform, opacity, filter",
                    }
                  : categoryMenuPhase === "opening"
                    ? {
                        opacity: 0,
                        filter: "blur(4px)",
                        transform: `translate3d(0, ${8 + distanceFromActive * 2}px, 0) scale(${
                          0.9 - Math.min(0.05, distanceFromActive * 0.01)
                        })`,
                        transitionDelay: `${index * 22}ms`,
                        transitionDuration: "520ms",
                        transitionTimingFunction: "cubic-bezier(0.18, 0.92, 0.28, 1)",
                        willChange: "transform, opacity, filter",
                      }
                    : {
                        opacity: 0,
                        filter: "blur(1px)",
                        transform: `translate3d(${closeShiftX}px, ${closeShiftY}px, 0) scale(${closeScale})`,
                        transitionDelay: `${closeHoldMs}ms`,
                        transitionDuration: `${CATEGORY_MENU_CLOSE_DURATION_MS}ms`,
                        transitionTimingFunction: "cubic-bezier(0.24, 0.82, 0.3, 1)",
                        willChange: "transform, opacity, filter",
                      };
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => {
                    if (isDisabled) return;
                    selectCategory(entry.key);
                  }}
                  disabled={isDisabled}
                  className={`relative z-[1] h-[27px] rounded-full border px-[11px] font-ui text-[10px] font-medium uppercase tracking-[0.05em] transition-[color,background-color,border-color,box-shadow,transform,opacity,filter] ${
                    isActive
                      ? activeCategoryPillClass
                      : isDisabled
                        ? "cursor-not-allowed border-transparent bg-transparent text-inactive/80"
                        : "border-transparent bg-transparent text-meta hover:bg-[rgba(255,255,255,0.78)] hover:text-ink"
                  }`}
                  style={pillMotionStyle}
                  aria-current={isActive ? "true" : "false"}
                >
                  {entry.key}
                </button>
              );
            })}
          </div>
        ) : null}
        <div
          ref={wheelRef}
          role="application"
          tabIndex={0}
          aria-label="Immersive clickwheel"
          data-immersive-drag-exempt="true"
          className="relative cursor-default touch-none select-none rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.12)] outline-none"
          style={{
            width: `${wheelSizePx}px`,
            height: `${wheelSizePx}px`,
            background: wheelBackground,
          }}
          onPointerDown={handleWheelPointerDown}
          onPointerMove={handleWheelPointerMove}
          onPointerUp={handleWheelPointerUp}
          onPointerCancel={handleWheelPointerCancel}
          onPointerLeave={() => updateHoveredWheelZone("none")}
        >
          {hasCategoryMenu ? (
            <button
              type="button"
              aria-label={isMenuOpen ? "Close categories menu" : "Open categories menu"}
              aria-expanded={isMenuOpen}
              className={`absolute left-1/2 flex h-[12px] min-w-[28px] -translate-x-1/2 items-center justify-center rounded-full px-2 py-[2px] font-ui text-[9px] font-medium uppercase tracking-[0.1em] text-white transition-[transform,opacity] duration-220 ease-out focus-visible:outline-none ${
                hoveredWheelZone === "top"
                  ? "scale-[1.09] opacity-100 -translate-y-[1px]"
                  : "scale-100 opacity-90"
              }`}
              style={{ top: `${wheelMenuTopPx}px` }}
              onMouseEnter={() => updateHoveredWheelZone("top")}
              onFocus={() => updateHoveredWheelZone("top")}
              onMouseLeave={() => updateHoveredWheelZone("none")}
              onBlur={() => updateHoveredWheelZone("none")}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
              }}
              onPointerCancel={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                setIsMenuOpen((current) => !current);
              }}
            >
              <span className="relative block h-[12px] min-w-[28px] overflow-hidden">
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-220 ${
                    isMenuOpen
                      ? "translate-y-[-10px] opacity-0"
                      : "translate-y-0 opacity-100"
                  }`}
                >
                  menu
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-220 ${
                    isMenuOpen
                      ? "translate-y-0 opacity-100"
                      : "translate-y-[10px] opacity-0"
                  }`}
                >
                  <span className="relative block h-[12px] w-[15px] translate-y-px">
                    <span className="absolute left-0 top-1/2 block h-[1.5px] w-[15px] -translate-y-1/2 rotate-45 rounded-full bg-white" />
                    <span className="absolute left-0 top-1/2 block h-[1.5px] w-[15px] -translate-y-1/2 -rotate-45 rounded-full bg-white" />
                  </span>
                </span>
              </span>
            </button>
          ) : null}
          <span
            className={`pointer-events-none absolute left-[16px] top-0 bottom-0 my-auto flex h-6 items-center transition-[transform,opacity] duration-220 ease-out ${
              hoveredWheelZone === "left" ? "scale-110 opacity-100" : "scale-100 opacity-85"
            }`}
          >
            <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true" className="fill-white">
              <polygon points="8,1 2,5 8,9" />
              <polygon points="16,1 10,5 16,9" />
            </svg>
          </span>
          <span
            className={`pointer-events-none absolute right-[16px] top-0 bottom-0 my-auto flex h-6 items-center transition-[transform,opacity] duration-220 ease-out ${
              hoveredWheelZone === "right" ? "scale-110 opacity-100" : "scale-100 opacity-85"
            }`}
          >
            <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true" className="fill-white">
              <polygon points="2,1 8,5 2,9" />
              <polygon points="10,1 16,5 10,9" />
            </svg>
          </span>

          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 m-auto h-[55px] w-[55px] rounded-full border transition-[background-color,border-color,transform,box-shadow] duration-260 ease-out ${wheelCenterClass}`}
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {SECTION_BY_KEY.get(renderCategory)?.title ?? renderCategory}
          {focusedItem ? `, item ${focusedItemNumber}` : ""}
        </p>
      </div>
      ) : null}
    </section>
  );
}
