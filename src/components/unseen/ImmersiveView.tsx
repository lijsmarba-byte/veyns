"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  archiveCapsuleIds,
  archiveCapsuleItems,
  sections,
  type ArchiveCapsuleId,
  type MockCatalogItem,
} from "@/data/mockCatalog";
import { GalleryHoverActions } from "@/components/unseen/GalleryHoverActions";
import {
  nextAnimationFrame,
  showProductTransitionHold,
  waitForProductImageDecode,
  warmProductImage,
} from "@/components/unseen/productImagePreload";
import { MobileFloatingCategoryPill } from "@/components/unseen/MobileFloatingCategoryPill";
import { useViewportMode } from "@/lib/ui/viewportMode";

type ImmersiveViewProps = {
  mode: "gallery" | "archive";
};

type CategoryKey = "OUTER" | "UPPER" | "LOWER" | "SILHOUETTE" | "GROUND" | "ARTIFACTS";
type FocusCategoryKey = CategoryKey | "ALL";
type SlotKey = -2 | -1 | 0 | 1 | 2;

type ReturnFocusPayload = {
  at?: number;
  hideUntil?: number;
  itemId?: string;
};

type ImmersiveStatePayload = {
  at: number;
  capsule?: ArchiveCapsuleId;
  category: FocusCategoryKey;
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
const GALLERY_CATEGORY_KEYS: FocusCategoryKey[] = ["ALL", ...CATEGORY_KEYS];
const SLOT_ORDER: SlotKey[] = [-2, -1, 0, 1, 2];
const RETURN_FOCUS_ITEM_KEY = "unseen:return-focus-item";
const RETURN_FLIGHT_FINISHED_EVENT = "unseen:return-flight-finished";
const RETURN_FLIGHT_FINISHED_KEY = "unseen:return-flight-finished-flag";
const IMMERSIVE_RETURN_STEADY_KEY = "unseen:immersive-return-steady";
const IMMERSIVE_STATE_KEY = "unseen:immersive-state";
const DEFAULT_RETURN_REVEAL_DELAY_MS = 820;
const DEFAULT_VIEWPORT_WIDTH = 1440;
const DEFAULT_SECTION_HEIGHT = 760;
const MOBILE_FOCUS_FULL_STICKY_PX = 162;
const MOBILE_FOCUS_COMPACT_STICKY_PX = 64;
const CATEGORY_NAV_CLOSE_DELAY_MS = 180;
const CATEGORY_NAV_LABEL_SWAP_DELAY_MS = 140;
const CATEGORY_NAV_LABEL_SYNC_SUPPRESS_MS = 260;
const ARCHIVE_ISSUE_NUMBER = "04";
const MOBILE_FOCUS_CARD_TAP_MAX_MOVE_PX = 7;
const DEFAULT_CARD_TAP_MAX_MOVE_PX = 14;
const MOBILE_FOCUS_POST_NAV_OPEN_SUPPRESS_MS = 120;
const POST_DRAG_CARD_CLICK_SUPPRESS_MS = 360;

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

function detectSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome\/|CriOS\/|Chromium\/|Edg\//.test(ua);
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

function getInitialViewportWidth() {
  if (typeof window === "undefined") return DEFAULT_VIEWPORT_WIDTH;
  const visualViewportWidth = window.visualViewport?.width ?? 0;
  return Math.max(window.innerWidth, document.documentElement.clientWidth, visualViewportWidth);
}

function getInitialSectionHeight(isFocusRoute: boolean) {
  if (typeof window === "undefined") return DEFAULT_SECTION_HEIGHT;
  const visualViewportHeight = window.visualViewport?.height ?? 0;
  const visibleViewportHeight = visualViewportHeight > 0 ? visualViewportHeight : window.innerHeight;
  if (isFocusRoute && getInitialViewportWidth() < 768) {
    return Math.round(Math.max(320, visibleViewportHeight - MOBILE_FOCUS_FULL_STICKY_PX));
  }
  return Math.round(visibleViewportHeight || DEFAULT_SECTION_HEIGHT);
}

function getInitialItemsForCategory(
  mode: "gallery" | "archive",
  activeCapsule: ArchiveCapsuleId | null,
  category: FocusCategoryKey,
) {
  if (mode === "archive") {
    return normalizeCarouselItems(archiveCapsuleItems[activeCapsule ?? "main"]);
  }

  if (category === "ALL") {
    return normalizeCarouselItems(sections.flatMap((section) => section.items));
  }

  return normalizeCarouselItems(SECTION_BY_KEY.get(category)?.items ?? []);
}

function readInitialFocusState(mode: "gallery" | "archive", activeCapsule: ArchiveCapsuleId | null) {
  const fallbackCategory: FocusCategoryKey = mode === "gallery" ? "ALL" : CATEGORY_KEYS[0];
  const fallback = {
    category: fallbackCategory,
    focusedTrack: 0,
  };

  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.sessionStorage.getItem(IMMERSIVE_STATE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as ImmersiveStatePayload;
    const isFresh = Date.now() - parsed.at < 30 * 60 * 1000;
    const isSameMode = parsed.mode === mode;
    const isSameCapsule = mode !== "archive" || parsed.capsule === activeCapsule;
    const isKnownCategory =
      mode === "gallery"
        ? GALLERY_CATEGORY_KEYS.includes(parsed.category)
        : CATEGORY_KEYS.includes(parsed.category as CategoryKey);
    if (!isFresh || !isSameMode || !isSameCapsule || !isKnownCategory) return fallback;

    const restoredItems = getInitialItemsForCategory(mode, activeCapsule, parsed.category);
    if (restoredItems.length === 0) return fallback;

    if (Number.isFinite(parsed.focusedTrack)) {
      const storedTrack = Math.trunc(parsed.focusedTrack as number);
      const normalizedStoredIndex = normalizeIndex(storedTrack, restoredItems.length);
      if (restoredItems[normalizedStoredIndex]?.id === parsed.itemId) {
        return {
          category: parsed.category,
          focusedTrack: storedTrack,
        };
      }
    }

    const restoredIndex = restoredItems.findIndex((item) => item.id === parsed.itemId);
    if (restoredIndex >= 0) {
      return {
        category: parsed.category,
        focusedTrack: restoredIndex,
      };
    }
  } catch {
    // Keep fallback state if stored focus payload is malformed.
  }

  return fallback;
}

function normalizeWheelHoverZone(
  zone: "left" | "right" | "top" | "center" | "ring",
): "none" | "left" | "right" | "top" | "center" {
  return zone === "ring" ? "none" : zone;
}

function ActiveCategoryLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-baseline text-ink">
      <span className="font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">The</span>
      <span className="-ml-[1px] font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">&ndash;</span>
      <span className="ml-[2px] font-instrument text-[25px] italic leading-none tracking-[0.01em]">{label}</span>
    </span>
  );
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

function getLoadedImageAspectRatio(image: HTMLImageElement | null) {
  return image && image.naturalWidth > 0 && image.naturalHeight > 0
    ? image.naturalWidth / image.naturalHeight
    : undefined;
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

function isImmersiveCardTarget(target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  const element = target instanceof Element ? target : target.parentElement;
  return Boolean(element?.closest('[data-immersive-card="true"]'));
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

function readImmersiveReturnSteadyFlag() {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(IMMERSIVE_RETURN_STEADY_KEY);
    if (!raw) return false;
    window.sessionStorage.removeItem(IMMERSIVE_RETURN_STEADY_KEY);
    window.sessionStorage.removeItem(RETURN_FOCUS_ITEM_KEY);
    const parsed = JSON.parse(raw) as { at?: number };
    return typeof parsed.at === "number" && Date.now() - parsed.at < 5000;
  } catch {
    return false;
  }
}

type ImmersiveProductCardProps = {
  baseCardHeight: number;
  baseCardWidth: number;
  enableHoverActions: boolean;
  enableEdgeEntryAnimation: boolean;
  focusLiftPx: number;
  isClickable: boolean;
  isDragging: boolean;
  isMotionLocked: boolean;
  hiddenForReturn: boolean;
  item: MockCatalogItem;
  loadImageEagerly: boolean;
  motionEasing: string;
  mode: "gallery" | "archive";
  motionDurationMs: number;
  onCardActivate: (item: MockCatalogItem, imageNode: HTMLDivElement | null, slot: SlotKey) => void;
  onFocusedRefChange?: (node: HTMLDivElement | null) => void;
  onPrefetch: (item: MockCatalogItem) => void;
  presentation: CardPresentation;
  slot: SlotKey;
  useFixedTransformSizing: boolean;
};

function ImmersiveProductCard({
  baseCardHeight,
  baseCardWidth,
  enableHoverActions,
  enableEdgeEntryAnimation,
  focusLiftPx,
  isClickable,
  isDragging,
  isMotionLocked,
  hiddenForReturn,
  item,
  loadImageEagerly,
  motionEasing,
  mode,
  motionDurationMs,
  onCardActivate,
  onFocusedRefChange,
  onPrefetch,
  presentation,
  slot,
  useFixedTransformSizing,
}: ImmersiveProductCardProps) {
  const [hoverResetKey, setHoverResetKey] = useState(0);
  const [isFocusedHoverActive, setIsFocusedHoverActive] = useState(false);
  const imageRef = useRef<HTMLDivElement | null>(null);
  const hoverDelayTimerRef = useRef<number | null>(null);
  const isFocused = slot === 0;
  const hasHoverActions = enableHoverActions && isFocused && isFocusedHoverActive;
  const centeredLiftY = isFocused ? -focusLiftPx : 0;
  const shouldAnimateEdgeEntry = enableEdgeEntryAnimation && Math.abs(slot) === 2;
  const [edgeEntryProgress, setEdgeEntryProgress] = useState(shouldAnimateEdgeEntry ? 0 : 1);
  const edgeEntryDelayMs = shouldAnimateEdgeEntry ? Math.round(motionDurationMs * 0.52) : 0;
  const edgeEntryDurationMs = shouldAnimateEdgeEntry
    ? Math.max(160, Math.round(motionDurationMs * 0.48))
    : motionDurationMs;
  const transformDurationMs = shouldAnimateEdgeEntry ? edgeEntryDurationMs : motionDurationMs;
  const opacityDurationMs = shouldAnimateEdgeEntry
    ? edgeEntryDurationMs
    : Math.min(240, motionDurationMs);

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

  useEffect(() => {
    if (edgeEntryProgress >= 1) return;
    const timer = window.setTimeout(() => {
      setEdgeEntryProgress(1);
    }, Math.max(16, edgeEntryDelayMs));
    return () => window.clearTimeout(timer);
  }, [edgeEntryDelayMs, edgeEntryProgress]);

  const edgeEntryOffsetPx =
    shouldAnimateEdgeEntry ? (slot < 0 ? -56 : 56) * (1 - edgeEntryProgress) : 0;
  const resolvedOpacity = (hiddenForReturn ? 0 : presentation.opacity) * edgeEntryProgress;
  const renderedWidth = Math.round(useFixedTransformSizing ? baseCardWidth : presentation.width);
  const renderedHeight = Math.round(useFixedTransformSizing ? baseCardHeight : presentation.height);
  const fixedSizeScale = useFixedTransformSizing
    ? Math.min(
        presentation.width / Math.max(1, baseCardWidth),
        presentation.height / Math.max(1, baseCardHeight),
      )
    : 1;
  const translateYPx = presentation.translateX + centeredLiftY + edgeEntryOffsetPx;
  const resolvedTranslateYPx = isDragging ? translateYPx : Math.round(translateYPx);
  const imageScale = Math.abs(presentation.scale - 1) < 0.001 ? 1 : presentation.scale;
  const cardTransform = `translate(-50%, -50%) translate3d(0px, ${resolvedTranslateYPx}px, 0px)${
    useFixedTransformSizing ? ` scale(${fixedSizeScale})` : ""
  }`;
  const cardTransition = isDragging || isMotionLocked
    ? "none"
    : useFixedTransformSizing
      ? [
          `transform ${transformDurationMs}ms ${motionEasing}`,
          `opacity ${opacityDurationMs}ms ease-out`,
        ].join(", ")
      : [
          `transform ${transformDurationMs}ms ${motionEasing}`,
          `width ${Math.max(220, motionDurationMs)}ms ${motionEasing}`,
          `height ${Math.max(220, motionDurationMs)}ms ${motionEasing}`,
          `opacity ${opacityDurationMs}ms ease-out`,
        ].join(", ");

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
        width: `${renderedWidth}px`,
        height: `${renderedHeight}px`,
        zIndex: presentation.zIndex,
        opacity: resolvedOpacity,
        transform: cardTransform,
        transition: cardTransition,
        willChange: isDragging || isMotionLocked ? "transform" : "auto",
      }}
    >
      <div
        ref={imageRef}
        className="relative h-full w-full"
        data-immersive-card="true"
        style={{
          transform: imageScale === 1 ? undefined : "scale(var(--scale,1))",
          transformOrigin: "center center",
          transition:
            imageScale === 1 || isDragging || isMotionLocked
              ? "none"
              : `transform ${motionDurationMs}ms ${motionEasing}`,
          willChange: imageScale === 1 ? "auto" : "transform",
          ["--scale" as any]: String(imageScale),
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
        {/* eslint-disable-next-line @next/next/no-img-element -- native img matches World2 transparent PNG rendering in Chrome */}
        <img
          src={item.imgSrc}
          alt={`${item.brand} ${item.artsyName}`}
          draggable={false}
          className={`pointer-events-none select-none absolute inset-0 h-full w-full object-contain object-center transition-[filter] duration-150 ease-out ${
            hasHoverActions && !useFixedTransformSizing
              ? "group-hover/product:blur-[1.8px] group-focus-within/product:blur-[1.8px]"
              : ""
          }`}
          loading={isFocused || loadImageEagerly ? "eager" : "lazy"}
          decoding="async"
          onDragStart={(event) => event.preventDefault()}
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isIPadExperience, isMobileExperience } = useViewportMode();
  const queryString = searchParams.toString();
  const editParam = searchParams.get("edit");
  const activeCapsule = mode === "archive" ? getCapsuleFromParams(searchParams) : null;
  const isVerticalFlow = true;
  const isFocusRoute = pathname.endsWith("/focus");
  const focusLabelRef = useRef<HTMLParagraphElement | null>(null);
  const focusedImageRef = useRef<HTMLDivElement | null>(null);
  const isOpeningProductRef = useRef(false);
  const categoryCloseTimerRef = useRef<number | null>(null);
  const categorySettleTimerRef = useRef<number | null>(null);
  const categoryDisplaySwapTimerRef = useRef<number | null>(null);
  const suppressCategoryDisplaySyncUntilRef = useRef(0);
  const categoryHoverSuppressPointRef = useRef<{ x: number; y: number } | null>(null);
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
    startClientX: 0,
    startClientY: 0,
    startAt: 0,
    totalMovementPx: 0,
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
  const focusHeaderCollapsedRef = useRef(false);
  const mobileFocusHeaderCollapsedRef = useRef(false);
  const initialFocusState = useMemo(() => readInitialFocusState(mode, activeCapsule), [activeCapsule, mode]);

  const [selectedCategory, setSelectedCategory] = useState<FocusCategoryKey>(initialFocusState.category);
  const [displayCategory, setDisplayCategory] = useState<FocusCategoryKey>(initialFocusState.category);
  const [renderCategory, setRenderCategory] = useState<FocusCategoryKey>(initialFocusState.category);
  const [isCategoryNavExpanded, setIsCategoryNavExpanded] = useState(false);
  const [categoryTransitionPhase, setCategoryTransitionPhase] = useState<"idle" | "out" | "in">("idle");
  const [focusedTrack, setFocusedTrack] = useState(initialFocusState.focusedTrack);
  const [motionDurationMs, setMotionDurationMs] = useState(380);
  const [motionEasing, setMotionEasing] = useState("cubic-bezier(0.22, 1, 0.36, 1)");
  const [dragProgress, setDragProgress] = useState(0);
  const [isRowDragging, setIsRowDragging] = useState(false);
  const [stageCenterOffsetPx, setStageCenterOffsetPx] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => getInitialViewportWidth());
  const [sectionHeight, setSectionHeight] = useState(() => getInitialSectionHeight(isFocusRoute));
  const [hasCompletedInitialCardMount, setHasCompletedInitialCardMount] = useState(false);
  const [suppressReturnEntryAnimation, setSuppressReturnEntryAnimation] = useState(() => readImmersiveReturnSteadyFlag());
  const [hoveredWheelZone, setHoveredWheelZone] = useState<"none" | "left" | "right" | "top" | "center">("none");
  const [isSafariBrowser, setIsSafariBrowser] = useState(false);
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
  const isReturnInteractionLocked = returnImageState.freezeLane;
  const isReturnLaneFrozen = isReturnInteractionLocked;

  const isMobileFocusViewport = viewportWidth < 768;
  const usesMobileFocusTapZones = isFocusRoute && isMobileFocusViewport;
  const setFocusHeaderCollapsed = useCallback(
    (collapsed: boolean) => {
      if (!isVerticalFlow) return;
      mobileFocusHeaderCollapsedRef.current = collapsed;
      if (focusHeaderCollapsedRef.current === collapsed) return;
      focusHeaderCollapsedRef.current = collapsed;
      window.dispatchEvent(new CustomEvent("unseen:focus-header-collapse", { detail: { collapsed } }));
    },
    [isVerticalFlow],
  );

  useEffect(() => {
    if (!isVerticalFlow) return;
    focusHeaderCollapsedRef.current = false;
    mobileFocusHeaderCollapsedRef.current = false;
    window.dispatchEvent(new CustomEvent("unseen:focus-header-collapse", { detail: { collapsed: false } }));
    return () => {
      focusHeaderCollapsedRef.current = false;
      mobileFocusHeaderCollapsedRef.current = false;
      window.dispatchEvent(new CustomEvent("unseen:focus-header-collapse", { detail: { collapsed: false } }));
    };
  }, [isVerticalFlow]);

  useEffect(() => {
    dragProgressRef.current = dragProgress;
  }, [dragProgress]);

  useEffect(() => {
    return () => {
      if (categoryCloseTimerRef.current !== null) {
        window.clearTimeout(categoryCloseTimerRef.current);
      }
      if (categorySettleTimerRef.current !== null) {
        window.clearTimeout(categorySettleTimerRef.current);
      }
      if (categoryDisplaySwapTimerRef.current !== null) {
        window.clearTimeout(categoryDisplaySwapTimerRef.current);
      }
      if (dragProgressRafRef.current !== null) {
        cancelAnimationFrame(dragProgressRafRef.current);
      }
      if (rowWheelRafRef.current !== null) {
        cancelAnimationFrame(rowWheelRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setHasCompletedInitialCardMount(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!suppressReturnEntryAnimation) return;
    const timer = window.setTimeout(() => {
      setSuppressReturnEntryAnimation(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [suppressReturnEntryAnimation]);

  useEffect(() => {
    setIsSafariBrowser(detectSafariBrowser());
  }, []);

  const itemsByCategory = useMemo(() => {
    const bucket = GALLERY_CATEGORY_KEYS.reduce<Record<FocusCategoryKey, MockCatalogItem[]>>(
      (acc, key) => ({ ...acc, [key]: [] }),
      {
        ALL: [],
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
      bucket.ALL = normalizeCarouselItems(sections.flatMap((section) => section.items));
      return bucket;
    }

    // Archive immersive uses one continuous lane (no category selection).
    const capsuleItems = archiveCapsuleItems[activeCapsule ?? "main"];
    bucket.OUTER = normalizeCarouselItems(capsuleItems);

    return bucket;
  }, [activeCapsule, mode]);

  const categoryEntries = useMemo(() => {
    if (mode === "gallery") {
      return GALLERY_CATEGORY_KEYS.map((key) => ({
        key,
        label: key === "ALL" ? "All" : (SECTION_BY_KEY.get(key)?.title ?? key),
        items: itemsByCategory[key],
      }));
    }

    return CATEGORY_KEYS.map((key) => ({
      key,
      label: SECTION_BY_KEY.get(key)?.title ?? key,
      items: itemsByCategory[key],
    }));
  }, [itemsByCategory, mode]);

  const firstCategoryWithItems =
    categoryEntries.find((entry) => entry.items.length > 0)?.key ?? (mode === "gallery" ? "ALL" : CATEGORY_KEYS[0]);

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

        if (
          isFresh &&
          isSameMode &&
          isSameCapsule &&
          categoryEntries.some((entry) => entry.key === parsed.category)
        ) {
          const restoredCategoryItems = itemsByCategory[parsed.category];
          const hasStoredTrack = Number.isFinite(parsed.focusedTrack);
          if (hasStoredTrack && restoredCategoryItems.length > 0) {
            const storedTrack = Math.trunc(parsed.focusedTrack as number);
            const normalizedStoredIndex = normalizeIndex(storedTrack, restoredCategoryItems.length);
            if (restoredCategoryItems[normalizedStoredIndex]?.id === parsed.itemId) {
              setSelectedCategory(parsed.category);
              setDisplayCategory(parsed.category);
              setRenderCategory(parsed.category);
              setFocusedTrack(storedTrack);
              restored = true;
            }
          }

          if (!restored) {
            const restoredIndex = restoredCategoryItems.findIndex((item) => item.id === parsed.itemId);
            if (restoredIndex >= 0) {
              setSelectedCategory(parsed.category);
              setDisplayCategory(parsed.category);
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
      setDisplayCategory(firstCategoryWithItems);
      setRenderCategory(firstCategoryWithItems);
      setFocusedTrack(0);
    }
  }, [activeCapsule, categoryEntries, firstCategoryWithItems, itemsByCategory, mode]);

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

    return () => {
      window.clearTimeout(timer);
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

    const isInsideStickyEditNav = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('[data-gallery-edit-nav="true"]'));

    const preventPageScroll = (event: WheelEvent) => {
      if (isInsideStickyEditNav(event.target)) return;
      event.preventDefault();
    };
    const preventTouchScroll = (event: TouchEvent) => {
      if (isInsideStickyEditNav(event.target)) return;
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

    const scrollBlockOptions = { passive: false, capture: true } as const;
    const keyBlockOptions = { capture: true } as const;

    window.addEventListener("wheel", preventPageScroll, scrollBlockOptions);
    window.addEventListener("touchmove", preventTouchScroll, scrollBlockOptions);
    window.addEventListener("keydown", preventScrollKeys, keyBlockOptions);

    return () => {
      window.removeEventListener("wheel", preventPageScroll, scrollBlockOptions);
      window.removeEventListener("touchmove", preventTouchScroll, scrollBlockOptions);
      window.removeEventListener("keydown", preventScrollKeys, keyBlockOptions);
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
  }, [mode]);

  useLayoutEffect(() => {
    const isSafariMobileViewport = detectSafariBrowser() && window.matchMedia("(max-width: 767px)").matches;
    const updateViewportWidth = () => {
      const visualViewportWidth = window.visualViewport?.width ?? 0;
      const visualViewportHeight = window.visualViewport?.height ?? 0;
      const viewportW = Math.max(window.innerWidth, document.documentElement.clientWidth, visualViewportWidth);
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
        const isMobileFocusViewport = isFocusRoute && viewportW < 768;
        const visibleViewportHeight = visualViewportHeight > 0 ? visualViewportHeight : window.innerHeight;
        const mobileFocusStickyHeight = mobileFocusHeaderCollapsedRef.current
          ? MOBILE_FOCUS_COMPACT_STICKY_PX
          : MOBILE_FOCUS_FULL_STICKY_PX;
        const visibleSectionHeight =
          isMobileFocusViewport && visibleViewportHeight > 0
            ? Math.max(320, visibleViewportHeight - mobileFocusStickyHeight)
            : sectionRect.height;
        const nextSectionHeight = Math.round(visibleSectionHeight);
        setSectionHeight((current) => (current === nextSectionHeight ? current : nextSectionHeight));
      } else if (visualViewportHeight > 0) {
        const nextSectionHeight = Math.round(visualViewportHeight);
        setSectionHeight((current) => (current === nextSectionHeight ? current : nextSectionHeight));
      }
    };
    updateViewportWidth();
    const sectionObserver = new ResizeObserver(() => updateViewportWidth());
    if (sectionRef.current) {
      sectionObserver.observe(sectionRef.current);
    }
    const handleViewportResize = () => updateViewportWidth();
    window.addEventListener("resize", handleViewportResize);
    window.addEventListener("sticky-height-change", handleViewportResize);
    if (!isSafariMobileViewport) {
      window.visualViewport?.addEventListener("resize", handleViewportResize);
    }

    return () => {
      sectionObserver.disconnect();
      window.removeEventListener("resize", handleViewportResize);
      window.removeEventListener("sticky-height-change", handleViewportResize);
      if (!isSafariMobileViewport) {
        window.visualViewport?.removeEventListener("resize", handleViewportResize);
      }
    };
  }, [isFocusRoute]);

  useEffect(() => {
    const renderCategoryItems = itemsByCategory[renderCategory] ?? [];
    if (renderCategoryItems.length > 0) return;

    setSelectedCategory(firstCategoryWithItems);
    setDisplayCategory(firstCategoryWithItems);
    setRenderCategory(firstCategoryWithItems);
    setFocusedTrack(0);
    setCategoryTransitionPhase("idle");
  }, [firstCategoryWithItems, itemsByCategory, renderCategory]);

  const activeItems = itemsByCategory[renderCategory] ?? [];
  const gallerySideFadeProgress = isVerticalFlow ? clampNumber(0, (590 - sectionHeight) / 140, 1) : 0;
  const gallerySideOpacity = 1 - gallerySideFadeProgress * 0.65;
  const hideGallerySideSlots = isVerticalFlow && sectionHeight < 450;
  const hideGalleryMetaForSpace = isVerticalFlow && sectionHeight < 500;
  const galleryMetaRowHeightPx = 72;
  const galleryMetaGapPx = usesMobileFocusTapZones ? 22 : 7;
  const galleryRowHeightPx = useMemo(() => {
    if (!isVerticalFlow) return 0;
    const vh = sectionHeight > 0 ? sectionHeight : DEFAULT_SECTION_HEIGHT;
    return Math.round(Math.max(320, vh));
  }, [isVerticalFlow, sectionHeight]);

  const slotPresentationByKey = useMemo(() => {
    const vw = viewportWidth > 0 ? viewportWidth : 1440;
    const largeViewportGrowthPx = Math.max(0, vw - 1700);
    const focusWidthBase = clampNumber(166, vw * 0.18, 269 + largeViewportGrowthPx * 0.04);
    const focusHeightBase = clampNumber(230, vw * 0.29, 361 + largeViewportGrowthPx * 0.055);
    const focusWidth = focusWidthBase * 1.12;
    const focusHeight = focusHeightBase * 1.12;
    const sideWidth = clampNumber(110, vw * 0.12, 180 + largeViewportGrowthPx * 0.026);
    const sideHeight = clampNumber(163, vw * 0.19, 254 + largeViewportGrowthPx * 0.04);

    if (isVerticalFlow) {
      // Rotate the same immersive spacing logic to vertical axis.
      const laneHeight = galleryRowHeightPx > 0 ? galleryRowHeightPx : 520;
      if (isFocusRoute && vw < 768) {
        const mobileFocusWidth = clampNumber(230, vw * 0.64, 286);
        const mobileFocusHeight = clampNumber(300, laneHeight * 0.455, 352);
        const mobileSideWidth = clampNumber(108, vw * 0.34, 148);
        const mobileSideHeight = clampNumber(142, laneHeight * 0.218, 190);
        const visibleCropPx = clampNumber(42, laneHeight * 0.076, 58);
        const nearCenter = laneHeight / 2 + mobileSideHeight / 2 - visibleCropPx;
        const farCenter = nearCenter + mobileSideHeight * 0.62;

        return {
          [-2]: {
            width: mobileSideWidth,
            height: mobileSideHeight,
            translateX: -farCenter,
            zIndex: 10,
            opacity: gallerySideOpacity * 0.22,
            scale: 1,
          },
          [-1]: {
            width: mobileSideWidth,
            height: mobileSideHeight,
            translateX: -nearCenter,
            zIndex: 20,
            opacity: gallerySideOpacity,
            scale: 1,
          },
          [0]: {
            width: mobileFocusWidth,
            height: mobileFocusHeight,
            translateX: 0,
            zIndex: 40,
            opacity: 1,
            scale: 1,
          },
          [1]: {
            width: mobileSideWidth,
            height: mobileSideHeight,
            translateX: nearCenter,
            zIndex: 20,
            opacity: gallerySideOpacity,
            scale: 1,
          },
          [2]: {
            width: mobileSideWidth,
            height: mobileSideHeight,
            translateX: farCenter,
            zIndex: 10,
            opacity: gallerySideOpacity * 0.22,
            scale: 1,
          },
        } satisfies Record<SlotKey, CardPresentation>;
      }

      const focusWidth = clampNumber(210, focusWidthBase * 1.48, 405 + largeViewportGrowthPx * 0.05);
      const focusHeight = clampNumber(292, focusHeightBase * 1.48, 561 + largeViewportGrowthPx * 0.065);
      const heightPressure = clampNumber(0, (620 - sectionHeight) / 220, 1);
      const minGapPx = Math.round(58 + heightPressure * 14);
      const laneHalfPx = Math.max(0, laneHeight / 2 - 4);
      const mobileFocusBottomOverscanPx =
        isFocusRoute && vw < 768 ? Math.round(clampNumber(8, laneHeight * 0.018, 16)) : 0;
      const maxCombinedHeight = Math.max(1, (laneHalfPx - minGapPx) * 2);
      const combinedHeight = focusHeight + sideHeight;
      const compactScale = clampNumber(0.58, maxCombinedHeight / Math.max(1, combinedHeight), 1);
      const compactFocusWidth = focusWidth * compactScale;
      const compactFocusHeight = focusHeight * compactScale;
      const compactSideWidth = sideWidth * compactScale;
      const compactSideHeight = sideHeight * compactScale;
      const requiredNearCenter = (compactFocusHeight + compactSideHeight) / 2 + minGapPx;
      const farClusterCenter = clampNumber(
        requiredNearCenter + compactSideHeight * 0.58,
        laneHalfPx * 0.98,
        laneHalfPx + compactSideHeight * 0.16,
      );
      const nearTopCenter = clampNumber(
        requiredNearCenter,
        farClusterCenter,
        farClusterCenter,
      );

      return {
        [-2]: {
          width: compactSideWidth,
          height: compactSideHeight,
          translateX: -farClusterCenter,
          zIndex: 10,
          opacity: gallerySideOpacity * 0.7,
          scale: 1,
        },
        [-1]: {
          width: compactSideWidth,
          height: compactSideHeight,
          translateX: -nearTopCenter,
          zIndex: 20,
          opacity: gallerySideOpacity,
          scale: 1,
        },
        [0]: {
          width: compactFocusWidth,
          height: compactFocusHeight,
          translateX: 0,
          zIndex: 40,
          opacity: 1,
          scale: 1,
        },
        [1]: {
          width: compactSideWidth,
          height: compactSideHeight,
          translateX: nearTopCenter + mobileFocusBottomOverscanPx,
          zIndex: 20,
          opacity: gallerySideOpacity,
          scale: 1,
        },
        [2]: {
          width: compactSideWidth,
          height: compactSideHeight,
          translateX: farClusterCenter + mobileFocusBottomOverscanPx * 1.12,
          zIndex: 10,
          opacity: gallerySideOpacity * 0.7,
          scale: 1,
        },
      } satisfies Record<SlotKey, CardPresentation>;
    }

    // Archive keeps horizontal left/right edge anchoring.
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
  }, [
    galleryRowHeightPx,
    gallerySideOpacity,
    isFocusRoute,
    isVerticalFlow,
    sectionHeight,
    stageCenterOffsetPx,
    viewportWidth,
  ]);

  const edgeFadeWidth = useMemo(() => {
    const vw = viewportWidth > 0 ? viewportWidth : 1440;
    return clampNumber(16, vw * 0.022, 34);
  }, [viewportWidth]);
  const verticalEdgeFadeHeightPx = useMemo(() => Math.max(10, Math.round(edgeFadeWidth * 0.52)), [edgeFadeWidth]);

  const verticalGapPx = useMemo(() => {
    const vw = viewportWidth > 0 ? viewportWidth : 1440;
    return Math.round(clampNumber(10, (vw / 1400) * 20, 20));
  }, [viewportWidth]);

  const baseRowTopPadPx = useMemo(() => {
    if (isVerticalFlow) {
      // Anchor vertical gallery lane directly under divider.
      return 0;
    }
    const vw = viewportWidth > 0 ? viewportWidth : 1440;
    const vh = sectionHeight > 0 ? sectionHeight : DEFAULT_SECTION_HEIGHT;
    const shrinkProgress = clampNumber(0, (1400 - vw) / 700, 1);
    const tallViewportGrowthPx = Math.max(0, vh - 820) * 0.16;
    const wideViewportGrowthPx = Math.max(0, vw - 1700) * 0.03;
    return Math.round(30 - 24 * shrinkProgress + tallViewportGrowthPx + wideViewportGrowthPx);
  }, [isVerticalFlow, sectionHeight, viewportWidth]);

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

  const rowHeightPx = useMemo(() => {
    if (isVerticalFlow) {
      return galleryRowHeightPx;
    }
    return Math.max(247, Math.round(slotPresentationByKey[0].height + 48));
  }, [galleryRowHeightPx, isVerticalFlow, slotPresentationByKey]);

  const layoutLane = useMemo(() => {
    if (isVerticalFlow) {
      const resolvedRowTopPadPx = baseRowTopPadPx;
      const stageCenterPx = resolvedRowTopPadPx + rowHeightPx / 2;
      const focusBottomPx = stageCenterPx + slotPresentationByKey[0].height / 2;
      const nearBottomTopPx =
        stageCenterPx + slotPresentationByKey[1].translateX - slotPresentationByKey[1].height / 2;
      const minInfoCenterPx = focusBottomPx + 4 + galleryMetaRowHeightPx / 2;
      const maxInfoCenterPx = nearBottomTopPx - 8 - galleryMetaRowHeightPx / 2;
      const preferredInfoCenterPx = focusBottomPx + galleryMetaGapPx + galleryMetaRowHeightPx / 2;
      const infoRowCenterPx =
        maxInfoCenterPx > minInfoCenterPx
          ? clampNumber(minInfoCenterPx, preferredInfoCenterPx, maxInfoCenterPx)
          : minInfoCenterPx;

      return {
        cardScale: 1,
        hideWheel: true,
        infoRowCenterPx: Math.round(infoRowCenterPx),
        rowTopPadPx: Math.round(resolvedRowTopPadPx),
      };
    }

    const infoRowLineHeightPx = galleryMetaRowHeightPx;
    const minGapPx = 8;
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
    const tightenedGapPx = Math.max(minGapPx, resolvedGapPx - 6);

    return {
      cardScale,
      hideWheel,
      infoRowCenterPx: Math.round(resolvedFocusBottom + tightenedGapPx + infoRowLineHeightPx / 2),
      rowTopPadPx: Math.round(resolvedRowTopPadPx),
    };
  }, [
    baseRowTopPadPx,
    galleryMetaGapPx,
    galleryMetaRowHeightPx,
    rowHeightPx,
    sectionHeight,
    slotPresentationByKey,
    viewportWidth,
    wheelDockBottomPx,
    wheelSizePx,
    isVerticalFlow,
  ]);
  const hideArchiveWheel = mode === "archive" && (layoutLane.hideWheel || isVerticalFlow);
  const dividerAlignedTopInsetCss = "var(--sticky-h)";
  const safariCardBaseSize = useMemo(
    () => ({
      height: slotPresentationByKey[0].height * layoutLane.cardScale,
      width: slotPresentationByKey[0].width * layoutLane.cardScale,
    }),
    [layoutLane.cardScale, slotPresentationByKey],
  );

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
      void warmProductImage(item.imgSrc);
      router.prefetch(buildProductViewHref(item));
    },
    [buildProductViewHref, router],
  );

  useEffect(() => {
    if (!focusedItem) return;
    prefetchItem(focusedItem);
  }, [focusedItem, prefetchItem]);

  const openProductView = useCallback(
    async (item: MockCatalogItem, imageNode: HTMLDivElement | null) => {
      if (isOpeningProductRef.current) return;
      isOpeningProductRef.current = true;
      let didScheduleNavigation = false;

      prefetchItem(item);

      const imgEl = imageNode?.querySelector("img") as HTMLImageElement | null;
      if (!isMobileExperience) {
        await waitForProductImageDecode(imgEl, item.imgSrc, 180);
        await nextAnimationFrame();
        if (!imageNode?.isConnected) {
          isOpeningProductRef.current = false;
          return;
        }

        const containerRect = imageNode?.getBoundingClientRect() ?? null;
        const imgRect = imgEl?.getBoundingClientRect() ?? null;
        const aspectRatio = getLoadedImageAspectRatio(imgEl);
        const containRect =
          containerRect && aspectRatio ? getContainRect(containerRect, aspectRatio) : null;
        const sourceRect = containRect ?? imgRect ?? containerRect;
        showProductTransitionHold(imageNode, item.imgSrc, aspectRatio, item.id);

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
      } else {
        if (!imageNode?.isConnected) {
          isOpeningProductRef.current = false;
          return;
        }
        try {
          window.sessionStorage.removeItem("unseen:product-view-transition");
          window.sessionStorage.removeItem("unseen:product-view-text-transition");
          window.sessionStorage.removeItem("unseen:return-focus-item");
          window.sessionStorage.removeItem("unseen:return-flight-finished-flag");
          document.getElementById("unseen-product-transition-source-hold")?.remove();
        } catch {
          // Optional cleanup failure is non-blocking.
        }
      }

      if (!isMobileExperience && focusLabelRef.current) {
        const textRect = focusLabelRef.current.getBoundingClientRect();
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
        if (!isMobileExperience) {
          window.sessionStorage.setItem(
            "unseen:return-scroll",
            JSON.stringify({
              at: Date.now(),
              backHref,
              scrollY: window.scrollY,
            }),
          );
        } else {
          window.sessionStorage.removeItem("unseen:return-scroll");
        }
      } catch {
        // Ignore storage failures.
      }

      const productViewHref = buildProductViewHref(item);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          didScheduleNavigation = true;
          router.push(productViewHref);
        });
      });
      window.setTimeout(() => {
        if (!didScheduleNavigation) {
          isOpeningProductRef.current = false;
        }
      }, 420);
    },
    [activeCapsule, backHref, buildProductViewHref, focusedTrack, isMobileExperience, mode, prefetchItem, renderCategory, router],
  );

  const navigateBy = useCallback(
    (delta: number, velocity = 1, mode: "default" | "rapid" = "default", syncFocusHeader = true) => {
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
        usesMobileFocusTapZones
          ? mode === "rapid"
            ? "cubic-bezier(0.18, 0.84, 0.24, 1)"
            : "cubic-bezier(0.22, 0.86, 0.26, 1)"
          : mode === "rapid"
            ? "cubic-bezier(0.16, 0.92, 0.2, 1)"
            : "cubic-bezier(0.2, 0.9, 0.24, 1)",
      );
      const steps = Math.max(1, Math.round(Math.abs(delta)));
      const direction = delta > 0 ? 1 : -1;
      if (isVerticalFlow && syncFocusHeader) {
        setFocusHeaderCollapsed(direction > 0);
      }
      const isBurst = mode === "rapid" && now - lastRapidNavAtRef.current < 260;
      const duration = Math.round(
        isVerticalFlow
          ? mode === "rapid"
            ? usesMobileFocusTapZones
              ? clampNumber(210, 410 - velocity * 70 - (steps - 1) * 18 - (isBurst ? 42 : 0), 410)
              : clampNumber(210, 420 - velocity * 80 - (steps - 1) * 22 - (isBurst ? 70 : 0), 420)
            : usesMobileFocusTapZones
              ? clampNumber(290, 510 - velocity * 58 - (steps - 1) * 14, 510)
              : clampNumber(320, 560 - velocity * 70 - (steps - 1) * 18, 560)
          : mode === "rapid"
            ? clampNumber(320, 560 - velocity * 90 - (steps - 1) * 26 - (isBurst ? 80 : 0), 560)
            : clampNumber(620, 860 - velocity * 85 - (steps - 1) * 20, 860),
      );
      if (usesMobileFocusTapZones) {
        suppressCardClickUntilRef.current = Date.now() + duration + MOBILE_FOCUS_POST_NAV_OPEN_SUPPRESS_MS;
      }
      setMotionDurationMs(duration);
      setFocusedTrack((current) => current + direction * steps);
      if (mode === "rapid") {
        lastRapidNavAtRef.current = now;
        navLockUntilRef.current = now + (isVerticalFlow ? (usesMobileFocusTapZones ? 30 : 56) : 90);
      } else {
        navLockUntilRef.current = now + duration * (isVerticalFlow ? (usesMobileFocusTapZones ? 0.5 : 0.72) : 0.9);
      }
    },
    [activeItems.length, isVerticalFlow, setFocusHeaderCollapsed, usesMobileFocusTapZones],
  );

  const selectCategory = useCallback(
    (category: FocusCategoryKey, clickPoint?: { x: number; y: number }) => {
      if (isReturnInteractionLocked) return;
      if (categoryCloseTimerRef.current !== null) {
        window.clearTimeout(categoryCloseTimerRef.current);
        categoryCloseTimerRef.current = null;
      }
      if (categorySettleTimerRef.current !== null) {
        window.clearTimeout(categorySettleTimerRef.current);
        categorySettleTimerRef.current = null;
      }
      if (categoryDisplaySwapTimerRef.current !== null) {
        window.clearTimeout(categoryDisplaySwapTimerRef.current);
        categoryDisplaySwapTimerRef.current = null;
      }

      const clickFromExpandedNav = isCategoryNavExpanded && category !== selectedCategory;
      categoryHoverSuppressPointRef.current = clickPoint ?? null;
      setIsCategoryNavExpanded(false);

      if (clickFromExpandedNav) {
        suppressCategoryDisplaySyncUntilRef.current = Date.now() + CATEGORY_NAV_LABEL_SYNC_SUPPRESS_MS;
        categoryDisplaySwapTimerRef.current = window.setTimeout(() => {
          setDisplayCategory((prev) => (prev === category ? prev : category));
          categoryDisplaySwapTimerRef.current = null;
        }, CATEGORY_NAV_LABEL_SWAP_DELAY_MS);
      } else {
        suppressCategoryDisplaySyncUntilRef.current = 0;
        setDisplayCategory((prev) => (prev === category ? prev : category));
      }

      setSelectedCategory(category);
      if (category === renderCategory) return;

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
    },
    [isCategoryNavExpanded, isReturnInteractionLocked, renderCategory, selectedCategory],
  );

  const openCategoryNav = useCallback(() => {
    if (mode !== "gallery") return;
    if (categoryHoverSuppressPointRef.current) return;
    if (categoryCloseTimerRef.current !== null) {
      window.clearTimeout(categoryCloseTimerRef.current);
      categoryCloseTimerRef.current = null;
    }
    setIsCategoryNavExpanded(true);
  }, [mode]);

  const closeCategoryNav = useCallback(() => {
    categoryHoverSuppressPointRef.current = null;
    if (categoryCloseTimerRef.current !== null) {
      window.clearTimeout(categoryCloseTimerRef.current);
    }
    categoryCloseTimerRef.current = window.setTimeout(() => {
      setIsCategoryNavExpanded(false);
      categoryCloseTimerRef.current = null;
    }, CATEGORY_NAV_CLOSE_DELAY_MS);
  }, []);

  const handleCategoryNavPointerMove = useCallback((event: MouseEvent<HTMLElement>) => {
    const suppressPoint = categoryHoverSuppressPointRef.current;
    if (!suppressPoint) return;

    const distance = Math.hypot(event.clientX - suppressPoint.x, event.clientY - suppressPoint.y);
    if (distance < 6) return;
    categoryHoverSuppressPointRef.current = null;
    openCategoryNav();
  }, [openCategoryNav]);

  const handleCategoryNavBlurCapture = useCallback((event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (!next || !event.currentTarget.contains(next as Node)) {
      closeCategoryNav();
    }
  }, [closeCategoryNav]);

  const handleRowWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (isReturnInteractionLocked) return;
      if (activeItems.length <= 1) return;
      if (isGridActionEventTarget(event.target)) return;

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      const hasHorizontalIntent = absX >= 0.6 && absX >= absY * 0.55;
      const hasVerticalIntent = absY >= 0.6 && absY >= absX * 0.55;
      const primaryDelta = isVerticalFlow
        ? hasVerticalIntent
          ? event.deltaY
          : event.deltaX
        : hasHorizontalIntent
          ? event.deltaX
          : event.deltaY;
      const minDelta = usesMobileFocusTapZones ? 0.7 : 1.2;
      if (Math.abs(primaryDelta) < minDelta) return;
      if (isVerticalFlow) {
        setFocusHeaderCollapsed(primaryDelta > 0);
      }

      event.preventDefault();
      const normalizedDelta =
        event.deltaMode === 1
          ? primaryDelta * 14
          : event.deltaMode === 2
            ? primaryDelta * 120
            : primaryDelta;
      const dampedDelta = usesMobileFocusTapZones
        ? clampNumber(-68, normalizedDelta, 68)
        : clampNumber(-52, normalizedDelta, 52);
      rowWheelAccumulatorRef.current += dampedDelta;
      const threshold = isVerticalFlow ? (usesMobileFocusTapZones ? 40 : 56) : 170;
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
        const stepCooldownMs = isVerticalFlow
          ? usesMobileFocusTapZones
            ? Math.round(clampNumber(16, 70 - wheelIntensity * 24, 78))
            : Math.round(clampNumber(28, 96 - wheelIntensity * 28, 104))
          : Math.round(clampNumber(90, 220 - wheelIntensity * 60, 220));
        if (now - rowWheelLastStepAtRef.current < stepCooldownMs) return;
        if (!isDirectionFlip && now < rowWheelNavLockUntilRef.current) return;

        const navMode = isDirectionFlip || wheelIntensity > (usesMobileFocusTapZones ? 0.95 : 1.2) ? "rapid" : "default";
        navigateBy(direction, isDirectionFlip ? Math.max(1.6, wheelIntensity) : wheelIntensity, navMode);
        rowWheelAccumulatorRef.current -= direction * threshold;
        rowWheelLastStepAtRef.current = now;
        rowWheelNavLockUntilRef.current = isDirectionFlip
          ? now + (isVerticalFlow ? (usesMobileFocusTapZones ? 4 : 8) : 28)
          : now +
              (isVerticalFlow
                ? usesMobileFocusTapZones
                  ? Math.round(clampNumber(18, 74 - wheelIntensity * 24, 82))
                  : Math.round(clampNumber(30, 110 - wheelIntensity * 30, 120))
                : Math.round(clampNumber(90, 240 - wheelIntensity * 70, 240)));
        rowWheelLastDirectionRef.current = direction;
      });
    },
    [activeItems.length, isReturnInteractionLocked, isVerticalFlow, navigateBy, setFocusHeaderCollapsed, usesMobileFocusTapZones],
  );

  const handleRowPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (isReturnInteractionLocked) return;
      if (activeItems.length <= 1) return;
      if (isGridActionEventTarget(event.target)) return;
      if (isImmersiveDragExemptTarget(event.target)) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const primaryPointer = isVerticalFlow ? event.clientY : event.clientX;

      rowDragRef.current.active = true;
      rowDragRef.current.pointerId = event.pointerId;
      rowDragRef.current.lastX = primaryPointer;
      rowDragRef.current.lastT = performance.now();
      rowDragRef.current.startAt = performance.now();
      rowDragRef.current.accumX = 0;
      rowDragRef.current.lastVelocityX = 0;
      rowDragRef.current.moved = false;
      rowDragRef.current.startClientX = event.clientX;
      rowDragRef.current.startClientY = event.clientY;
      dragProgressRef.current = 0;
      rowDragRef.current.totalMovementPx = 0;
      if (dragProgressRafRef.current !== null) {
        cancelAnimationFrame(dragProgressRafRef.current);
        dragProgressRafRef.current = null;
      }
      setIsRowDragging(true);
      setDragProgress(0);
    },
    [activeItems.length, isReturnInteractionLocked, isVerticalFlow],
  );

  const handleRowPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (isReturnInteractionLocked) return;
      const drag = rowDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      event.preventDefault();

      const now = performance.now();
      const primaryPointer = isVerticalFlow ? event.clientY : event.clientX;
      const dx = primaryPointer - drag.lastX;
      const dt = Math.max(1, now - drag.lastT);
      drag.lastVelocityX = dx / dt;
      drag.lastX = primaryPointer;
      drag.lastT = now;
      drag.accumX += dx;
      drag.totalMovementPx = Math.max(
        drag.totalMovementPx,
        Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY),
      );

      if (
        Math.abs(drag.accumX) > 18 ||
        drag.totalMovementPx > (usesMobileFocusTapZones ? MOBILE_FOCUS_CARD_TAP_MAX_MOVE_PX : DEFAULT_CARD_TAP_MAX_MOVE_PX)
      ) {
        drag.moved = true;
      }
      if (isVerticalFlow && Math.abs(drag.accumX) > 8) {
        setFocusHeaderCollapsed(drag.accumX < 0);
      }

      const holdLatencyMs = isVerticalFlow ? (usesMobileFocusTapZones ? 8 : 30) : 220;
      const earlyDragAllowancePx = isVerticalFlow ? (usesMobileFocusTapZones ? 10 : 18) : 56;
      if (now - drag.startAt < holdLatencyMs && Math.abs(drag.accumX) < earlyDragAllowancePx) {
        return;
      }

      // Scrub-only during drag; commit decision is made on release for calmer behavior.
      const scrubDistancePx = isVerticalFlow ? (usesMobileFocusTapZones ? 220 : 260) : 320;
      const targetProgress = clampNumber(-4.8, drag.accumX / scrubDistancePx, 4.8);
      const current = dragProgressRef.current;
      const easedNext = current + (targetProgress - current) * (isVerticalFlow ? (usesMobileFocusTapZones ? 0.36 : 0.34) : 0.24);
      const maxStepPerFrame = isVerticalFlow ? (usesMobileFocusTapZones ? 0.64 : 0.72) : 0.42;
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
    [isReturnInteractionLocked, isVerticalFlow, setFocusHeaderCollapsed, usesMobileFocusTapZones],
  );

  const finishRowDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (isReturnInteractionLocked) return;
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
      const totalMovementPx = Math.max(
        drag.totalMovementPx,
        Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY),
      );
      const cleanTapMaxMovePx = usesMobileFocusTapZones
        ? MOBILE_FOCUS_CARD_TAP_MAX_MOVE_PX
        : DEFAULT_CARD_TAP_MAX_MOVE_PX;
      if (absDrag < 18) {
        setIsRowDragging(false);
        dragProgressRef.current = 0;
        setDragProgress(0);
        const clickTarget =
          totalMovementPx <= cleanTapMaxMovePx
            ? document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>('[data-immersive-card="true"]')
            : null;
        if (clickTarget) {
          // Pointer capture can swallow native child click; forward tap intent explicitly.
          requestAnimationFrame(() => {
            clickTarget.click();
          });
        } else if (totalMovementPx > cleanTapMaxMovePx) {
          suppressCardClickUntilRef.current = Date.now() + POST_DRAG_CARD_CLICK_SUPPRESS_MS;
        }
        drag.pointerId = -1;
        drag.accumX = 0;
        drag.lastVelocityX = 0;
        drag.moved = false;
        drag.startClientX = 0;
        drag.startClientY = 0;
        drag.startAt = 0;
        drag.totalMovementPx = 0;
        return;
      }

      if (drag.moved) {
        suppressCardClickUntilRef.current = Date.now() + POST_DRAG_CARD_CLICK_SUPPRESS_MS;
      }

      const scrubDistancePx = isVerticalFlow ? (usesMobileFocusTapZones ? 220 : 260) : 320;
      const releaseProgress = clampNumber(-4.8, drag.accumX / scrubDistancePx, 4.8);
      if (isVerticalFlow && Math.abs(releaseProgress) > 0.04) {
        setFocusHeaderCollapsed(releaseProgress < 0);
      }
      const snapShift = usesMobileFocusTapZones
        ? Math.abs(releaseProgress) >= 0.32
          ? Math.sign(releaseProgress)
          : 0
        : Math.round(releaseProgress);
      const shouldCommit = snapShift !== 0 && activeItems.length > 1;

      if (shouldCommit) {
        const velocity = Math.abs(drag.lastVelocityX);
        const commitDuration = isVerticalFlow
          ? usesMobileFocusTapZones
            ? Math.round(clampNumber(230, 440 - velocity * 74, 460))
            : Math.round(clampNumber(250, 500 - velocity * 80, 520))
          : Math.round(clampNumber(460, 700 - velocity * 100, 700));
        setMotionDurationMs(commitDuration);
        setMotionEasing(usesMobileFocusTapZones ? "cubic-bezier(0.18, 0.84, 0.24, 1)" : "cubic-bezier(0.16, 0.92, 0.2, 1)");

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
        const settleDuration = isVerticalFlow
          ? usesMobileFocusTapZones
            ? Math.round(clampNumber(210, 340 - Math.abs(drag.lastVelocityX) * 54, 360))
            : Math.round(clampNumber(220, 360 - Math.abs(drag.lastVelocityX) * 60, 380))
          : Math.round(clampNumber(400, 620 - Math.abs(drag.lastVelocityX) * 80, 620));
        setMotionDurationMs(settleDuration);
        setMotionEasing(usesMobileFocusTapZones ? "cubic-bezier(0.22, 0.86, 0.26, 1)" : "cubic-bezier(0.2, 0.88, 0.28, 1)");
        setIsRowDragging(false);
        dragProgressRef.current = 0;
        setDragProgress(0);
      }

      drag.pointerId = -1;
      drag.accumX = 0;
      drag.lastVelocityX = 0;
      drag.moved = false;
      drag.startClientX = 0;
      drag.startClientY = 0;
      drag.startAt = 0;
      drag.totalMovementPx = 0;
    },
    [activeItems.length, isReturnInteractionLocked, isVerticalFlow, setFocusHeaderCollapsed, usesMobileFocusTapZones],
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

  useEffect(() => {
    if (!isReturnInteractionLocked) return;
    if (rowWheelRafRef.current !== null) {
      cancelAnimationFrame(rowWheelRafRef.current);
      rowWheelRafRef.current = null;
    }
    rowWheelAccumulatorRef.current = 0;
    rowWheelPendingDirectionRef.current = 0;
    rowDragRef.current.active = false;
    rowDragRef.current.pointerId = -1;
    rowDragRef.current.accumX = 0;
    rowDragRef.current.lastVelocityX = 0;
    rowDragRef.current.moved = false;
    rowDragRef.current.startClientX = 0;
    rowDragRef.current.startClientY = 0;
    rowDragRef.current.totalMovementPx = 0;
    dragProgressRef.current = 0;
    setDragProgress(0);
    setIsRowDragging(false);
    wheelDragRef.current.active = false;
    wheelDragRef.current.accum = 0;
    wheelDragRef.current.didRotate = false;
    wheelDragRef.current.lastStepAt = 0;
    updateHoveredWheelZone("none");
  }, [isReturnInteractionLocked, updateHoveredWheelZone]);

  const handleWheelPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isReturnInteractionLocked) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      wheelDragRef.current.active = true;
      wheelDragRef.current.lastAngle = getWheelAngle(event.clientX, event.clientY);
      wheelDragRef.current.accum = 0;
      wheelDragRef.current.didRotate = false;
      wheelDragRef.current.lastStepAt = 0;
      updateHoveredWheelZone(normalizeWheelHoverZone(classifyWheelZone(event.clientX, event.clientY)));
    },
    [classifyWheelZone, getWheelAngle, isReturnInteractionLocked, updateHoveredWheelZone],
  );

  const handleWheelPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isReturnInteractionLocked) return;
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
    [classifyWheelZone, getWheelAngle, isReturnInteractionLocked, navigateBy, updateHoveredWheelZone],
  );

  const openFocused = useCallback(() => {
    if (isReturnInteractionLocked) return;
    if (!focusedItem) return;
    openProductView(focusedItem, focusedImageRef.current);
  }, [focusedItem, isReturnInteractionLocked, openProductView]);
  const handleFocusedImageRef = useCallback((node: HTMLDivElement | null) => {
    focusedImageRef.current = node;
  }, []);
  const handleCardActivate = useCallback(
    (item: MockCatalogItem, imageNode: HTMLDivElement | null, slot: SlotKey) => {
      if (isReturnInteractionLocked) return;
      if (Date.now() < suppressCardClickUntilRef.current) return;
      if (slot !== 0) {
        if (activeItems.length <= 1) return;
        navigateBy(slot < 0 ? -1 : 1, 1.35, "rapid", !usesMobileFocusTapZones);
        return;
      }
      openProductView(item, imageNode);
    },
    [activeItems.length, isReturnInteractionLocked, navigateBy, openProductView, usesMobileFocusTapZones],
  );
  const handleWheelPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isReturnInteractionLocked) return;
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
      if (zone === "center") openFocused();
    },
    [classifyWheelZone, isReturnInteractionLocked, navigateBy, openFocused, updateHoveredWheelZone],
  );

  const handleRowBackgroundTap = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!isVerticalFlow) return;
      if (isReturnInteractionLocked) return;
      if (activeItems.length <= 1) return;
      if (Date.now() < suppressCardClickUntilRef.current) return;
      if (isGridActionEventTarget(event.target)) return;
      if (isImmersiveDragExemptTarget(event.target)) return;
      if (isImmersiveCardTarget(event.target)) return;

      const stageRect = rowStageRef.current?.getBoundingClientRect();
      if (!stageRect) return;
      const centerX = stageRect.left + stageRect.width / 2;
      const direction = event.clientX >= centerX ? 1 : -1;
      navigateBy(direction, 1.45, "rapid");
    },
    [activeItems.length, isReturnInteractionLocked, isVerticalFlow, navigateBy],
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

      if (isReturnInteractionLocked) {
        if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "Enter"
        ) {
          event.preventDefault();
        }
        return;
      }

      if (isVerticalFlow) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          navigateBy(-1, 1.5, "rapid");
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          navigateBy(1, 1.5, "rapid");
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          navigateBy(-1, 1.5, "rapid");
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          navigateBy(1, 1.5, "rapid");
        }
      } else {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          navigateBy(-1, 1.5, "rapid");
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          navigateBy(1, 1.5, "rapid");
        }
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
  }, [isReturnInteractionLocked, isVerticalFlow, navigateBy, openFocused]);

  const visibleSlots = useMemo(() => {
    if (activeItems.length === 0) return [];

    const integerDragShift = dragProgress >= 0 ? Math.floor(dragProgress) : Math.ceil(dragProgress);
    const slotOrder = isVerticalFlow
      ? hideGallerySideSlots
        ? ([0] as const)
        : isFocusRoute && isMobileFocusViewport
          ? SLOT_ORDER
          : ([-1, 0, 1] as const)
      : SLOT_ORDER;
    const seenByItemId = new Map<string, number>();
    return slotOrder.map((slot) => {
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
  }, [
    activeItems,
    dragProgress,
    focusedTrack,
    hideGallerySideSlots,
    isFocusRoute,
    isMobileFocusViewport,
    isVerticalFlow,
  ]);

  const focusedItemNumber = focusedItem ? getItemNumber(focusedItem) : "00";
  const focusedIdLabel =
    mode === "archive" ? `Issue ${ARCHIVE_ISSUE_NUMBER} | ${focusedItemNumber}` : focusedItemNumber;
  const focusedBrandClass = mode === "archive" ? "text-accent" : "text-ink";
  const focusedMetaMaxWidthPx = isVerticalFlow ? 500 : 440;
  const focusedMetaHorizontalPaddingClass = isVerticalFlow ? "px-3 sm:px-4" : "px-0";
  const focusLiftPx = useMemo(
    () => {
      const verticalFocusLiftBoostPx = isVerticalFlow ? 10 : 0;
      const maxFocusLiftPx = isVerticalFlow ? 40 : 28;
      return Math.round(clampNumber(8, rowHeightPx * 0.05 + verticalFocusLiftBoostPx, maxFocusLiftPx));
    },
    [isVerticalFlow, rowHeightPx],
  );
  const showGalleryCategoryNav = mode === "gallery";
  const isTouchExpandCategoryNav = isIPadExperience;
  const visualCategory = displayCategory || selectedCategory;
  const activeCategoryEntry =
    categoryEntries.find((entry) => entry.key === visualCategory) ??
    categoryEntries.find((entry) => entry.key === selectedCategory) ??
    categoryEntries[0];
  const activeCategoryIndex = Math.max(
    0,
    categoryEntries.findIndex((entry) => entry.key === (activeCategoryEntry?.key ?? selectedCategory)),
  );
  const expandedRowStepPx = 38;
  const collapsedMarkerHeightPx = 26;
  const expandedMarkerHeightPx =
    collapsedMarkerHeightPx + Math.max(0, categoryEntries.length - 1) * expandedRowStepPx + 20;
  const markerLeftInsetPx = 16;
  const markerGapPx = 16;
  const markerWidthPx = 1.5;
  const inactiveTextLeftPx = markerLeftInsetPx + markerGapPx + markerWidthPx;
  const activeMarkerHeight = isCategoryNavExpanded ? expandedMarkerHeightPx : collapsedMarkerHeightPx;
  const activeMarkerScale = activeMarkerHeight / expandedMarkerHeightPx;
  const markerCenterOffsetPx = isCategoryNavExpanded
    ? Math.round((((categoryEntries.length - 1) / 2) - activeCategoryIndex) * expandedRowStepPx)
    : 0;
  const galleryNavHasHeight = sectionHeight >= 360;
  const hideGalleryNavForSpace = !galleryNavHasHeight || sectionHeight < 500;
  const expandedCategoryEntries = categoryEntries
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => entry.key !== activeCategoryEntry?.key);
  const mobileVerticalBottomRelaxPx = useMemo(() => {
    if (!isVerticalFlow) return 0;
    const vh = sectionHeight > 0 ? sectionHeight : DEFAULT_SECTION_HEIGHT;
    return Math.round(clampNumber(18, vh * 0.055, 44));
  }, [isVerticalFlow, sectionHeight]);
  const sectionHeightCss = `calc(var(--viewport-h) - ${dividerAlignedTopInsetCss} + var(--mobile-safe-bottom))`;

  const wheelBackground = "radial-gradient(circle at 32% 28%, #2f2f2f 0%, #171717 54%, #0e0e0e 100%)";
  const wheelCenterClass =
    hoveredWheelZone === "center"
      ? "scale-[1.04] border-[#18132F] bg-[#24204A] shadow-[inset_0_2px_0_rgba(255,255,255,0.07),0_4px_12px_rgba(10,8,24,0.3)]"
      : "scale-100 border-[#120F25] bg-[#1A1536] shadow-[inset_0_2px_0_rgba(255,255,255,0.04)]";

  useEffect(() => {
    if (!hideGalleryNavForSpace) return;
    if (!isCategoryNavExpanded) return;
    setIsCategoryNavExpanded(false);
  }, [hideGalleryNavForSpace, isCategoryNavExpanded]);

  return (
    <section
      ref={sectionRef}
      data-immersive-zoom-zone="true"
      className="relative mx-auto flex w-full max-w-[1333px] select-none flex-col items-center px-6 pb-0 sm:px-10 md:pb-6"
      style={{
        height: sectionHeightCss,
        minHeight: sectionHeightCss,
        paddingTop: `${layoutLane.rowTopPadPx}px`,
        paddingBottom:
          isVerticalFlow
            ? `${isFocusRoute && isMobileFocusViewport ? 0 : isMobileFocusViewport ? mobileVerticalBottomRelaxPx : 0}px`
            : hideArchiveWheel
              ? `${verticalGapPx}px`
              : `${wheelSizePx + wheelDockBottomPx + verticalGapPx}px`,
        touchAction: "auto",
      }}
      onWheel={(event) => {
        event.preventDefault();
      }}
      onDragStart={(event) => {
        event.preventDefault();
      }}
      onClick={usesMobileFocusTapZones ? handleRowBackgroundTap : undefined}
    >
      {isReturnInteractionLocked ? (
        <div
          aria-hidden="true"
          className="fixed inset-x-0 bottom-0 z-[120] touch-none"
          style={{ top: dividerAlignedTopInsetCss }}
          onWheel={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onTouchStart={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onTouchMove={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerMove={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        />
      ) : null}
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
          className={`relative ${isVerticalFlow ? "mt-0" : "mt-[8px]"} w-[calc(var(--viewport-w)+6px)] max-w-none ${
            isVerticalFlow
              ? isMobileFocusViewport
                ? "overflow-x-visible overflow-y-visible"
                : "overflow-x-visible overflow-y-hidden"
              : "overflow-x-hidden overflow-y-visible"
          }`}
          style={{
            height: `${rowHeightPx}px`,
            marginLeft: "calc(50% - var(--viewport-half-w) - 3px)",
            marginRight: "calc(50% - var(--viewport-half-w) - 3px)",
            touchAction: "auto",
            willChange: "transform",
          }}
          onWheel={handleRowWheel}
          onPointerDown={isVerticalFlow ? handleRowPointerDown : undefined}
          onPointerMove={isVerticalFlow ? handleRowPointerMove : undefined}
          onPointerUp={isVerticalFlow ? finishRowDrag : undefined}
          onPointerCancel={isVerticalFlow ? finishRowDrag : undefined}
          onClick={usesMobileFocusTapZones ? undefined : handleRowBackgroundTap}
          onContextMenu={(event) => {
            if (!isVerticalFlow) return;
            event.preventDefault();
            if (isReturnInteractionLocked) return;
            if (activeItems.length <= 1) return;
            navigateBy(1, 1.45, "rapid");
          }}
        >
          {visibleSlots.map(({ instanceKey, slot, item }) => (
            <ImmersiveProductCard
              key={instanceKey}
              baseCardHeight={safariCardBaseSize.height}
              baseCardWidth={safariCardBaseSize.width}
              enableHoverActions
              enableEdgeEntryAnimation={hasCompletedInitialCardMount && !suppressReturnEntryAnimation}
              isClickable={Math.abs(slot) <= 2 && !isReturnInteractionLocked}
              isDragging={isRowDragging}
              isMotionLocked={isReturnLaneFrozen}
              hiddenForReturn={slot === 0 && returnImageState.hiddenItemId === item.id}
              item={item}
              loadImageEagerly={suppressReturnEntryAnimation}
              focusLiftPx={focusLiftPx}
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
              useFixedTransformSizing={isSafariBrowser && !usesMobileFocusTapZones}
            />
          ))}
          {isVerticalFlow ? (
            <>
              {!isMobileFocusViewport ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 z-50 bg-gradient-to-b from-paper/12 via-paper/4 to-transparent"
                  style={{ height: `${verticalEdgeFadeHeightPx}px` }}
                />
              ) : null}
              {!isMobileFocusViewport ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-50 bg-gradient-to-t from-paper/26 via-paper/10 to-transparent"
                  style={{ height: `${verticalEdgeFadeHeightPx}px` }}
                />
              ) : null}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

      </div>

      {focusedItem ? (
        <div
          className={`pointer-events-none absolute left-1/2 w-full -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 ease-out ${focusedMetaHorizontalPaddingClass} ${
            hideGalleryMetaForSpace ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden={hideGalleryMetaForSpace}
          style={{
            top: `${layoutLane.infoRowCenterPx - focusLiftPx}px`,
            maxWidth: `${focusedMetaMaxWidthPx}px`,
          }}
        >
          <div className="mx-auto flex w-full flex-col items-center gap-[3px] text-center text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
            <p
              ref={focusLabelRef}
              className="inline-flex h-[22px] items-center justify-center font-ui text-meta"
            >
              <span aria-hidden="true">|</span>
              <span className="px-[2px]">{focusedIdLabel}</span>
              <span aria-hidden="true">|</span>
            </p>
            <p
              className={`inline-flex h-[22px] items-center justify-center text-center font-ui ${focusedBrandClass}`}
            >
              {focusedItem.brand}
            </p>
            <p className="inline-flex h-[22px] items-center justify-center font-ui text-meta">
              {focusedItem.price}
            </p>
          </div>
        </div>
      ) : null}

      {showGalleryCategoryNav ? (
        <div
          data-gallery-immersive-left-nav="true"
          className="pointer-events-none fixed left-5 z-40 hidden -translate-y-1/2 lg:block"
          style={{
            top: "var(--gallery-category-nav-top)",
          }}
        >
          <nav
            aria-label="Immersive category navigation"
            data-immersive-drag-exempt="true"
            className={`-m-4 select-none p-4 transition-opacity duration-200 ease-out ${
              hideGalleryNavForSpace ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
            }`}
            onMouseEnter={openCategoryNav}
            onMouseMove={handleCategoryNavPointerMove}
            onMouseLeave={closeCategoryNav}
            onFocusCapture={isTouchExpandCategoryNav ? undefined : openCategoryNav}
            onBlurCapture={handleCategoryNavBlurCapture}
          >
            <div className="relative h-[252px] w-[246px] rounded-xl px-4 py-4">
              {activeCategoryEntry ? (
                <div
                  className="pointer-events-none absolute top-1/2 z-20 -translate-y-1/2"
                  style={{ left: `${markerLeftInsetPx}px` }}
                >
                  <div
                    className="pointer-events-auto inline-flex translate-x-[2px] items-center"
                    style={{ marginLeft: `${markerGapPx + markerWidthPx}px` }}
                  >
                    <button
                      type="button"
                      aria-expanded={isCategoryNavExpanded}
                      onClick={(event) => {
                        if (isReturnInteractionLocked) return;
                        if (isTouchExpandCategoryNav) {
                          if (isCategoryNavExpanded) {
                            categoryHoverSuppressPointRef.current = null;
                            setIsCategoryNavExpanded(false);
                          } else {
                            openCategoryNav();
                          }
                          return;
                        }
                        selectCategory(activeCategoryEntry.key, { x: event.clientX, y: event.clientY });
                      }}
                      data-nav-active-anchor="true"
                      className="inline-flex items-center justify-start rounded-md py-[2px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    >
                      <ActiveCategoryLabel label={activeCategoryEntry.label} />
                    </button>
                  </div>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 top-1/2 flex items-center transition-transform duration-150 ease-out"
                    style={{
                      width: `${markerWidthPx}px`,
                      height: `${expandedMarkerHeightPx}px`,
                      transform: `translateY(calc(-50% + ${markerCenterOffsetPx}px))`,
                      willChange: "transform",
                    }}
                  >
                    <span
                      className="block origin-center bg-ink transition-transform duration-150 ease-out"
                      style={{
                        width: `${markerWidthPx}px`,
                        height: `${expandedMarkerHeightPx}px`,
                        transform: `scaleY(${activeMarkerScale})`,
                        willChange: "transform",
                      }}
                    />
                  </span>
                </div>
              ) : null}

              <ul
                aria-hidden={!isCategoryNavExpanded}
                className={`absolute inset-0 z-10 transition-opacity duration-200 ease-out ${
                  isCategoryNavExpanded ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                {expandedCategoryEntries.map((entry) => {
                  const isDisabled = entry.items.length === 0;
                  const offsetY = (entry.index - activeCategoryIndex) * expandedRowStepPx;

                  return (
                    <li
                      key={entry.key}
                      className="absolute top-1/2 transition-transform duration-150 ease-out"
                      style={{
                        left: `${inactiveTextLeftPx}px`,
                        transform: `translateY(calc(-50% + ${offsetY}px))`,
                      }}
                    >
                      <button
                        type="button"
                        tabIndex={isCategoryNavExpanded ? 0 : -1}
                        disabled={isDisabled}
                        onClick={(event) => {
                          if (isReturnInteractionLocked || isDisabled) return;
                          selectCategory(entry.key, { x: event.clientX, y: event.clientY });
                        }}
                        className={`inline-flex items-center justify-start text-left font-ui text-[14px] font-medium leading-5 tracking-[0.02em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
                          isDisabled ? "cursor-not-allowed text-inactive/80" : "text-inactive hover:text-meta"
                        }`}
                      >
                        <span>{entry.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </div>
      ) : null}

      {showGalleryCategoryNav ? (
        <MobileFloatingCategoryPill
          ariaLabel="Focus categories"
          enableDragSnap
          options={categoryEntries.map((entry) => ({
            key: entry.key,
            label: entry.label,
            disabled: entry.items.length === 0,
          }))}
          activeKey={selectedCategory}
          focusCueLabel={
            mode === "gallery" && editParam === "edit1a" && selectedCategory === "OUTER"
              ? "Based on broader aesthetic cues"
              : undefined
          }
          onSelect={(key) => {
            const targetEntry = categoryEntries.find((entry) => entry.key === key);
            if (!targetEntry || targetEntry.items.length === 0) return;
            selectCategory(targetEntry.key);
          }}
        />
      ) : null}

      {!hideArchiveWheel && mode === "archive" && !isVerticalFlow ? (
        <div
          className="fixed z-[90] flex -translate-x-1/2 flex-col items-center"
          style={{
            left: "calc(var(--viewport-w) / 2)",
            bottom: `${wheelDockBottomPx}px`,
          }}
        >
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
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {renderCategory === "ALL" ? "All" : (SECTION_BY_KEY.get(renderCategory)?.title ?? renderCategory)}
        {focusedItem ? `, item ${focusedItemNumber}` : ""}
      </p>
    </section>
  );
}
