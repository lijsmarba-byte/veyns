"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MockCatalogItem } from "@/data/mockCatalog";
import { World2CategoryNav } from "@/components/unseen/World2CategoryNav";
import { showProductTransitionHold, warmProductImage } from "@/components/unseen/productImagePreload";

export type World2CategoryKey = "OUTER" | "UPPER" | "LOWER" | "SILHOUETTE" | "GROUND" | "ARTIFACTS";

export type World2ViewItem = {
  item: MockCatalogItem;
  categoryKey: World2CategoryKey;
  categoryLabel: string;
};

export type World2ViewProps = {
  items: World2ViewItem[];
  showCategoryNav?: boolean;
  mode?: "gallery" | "archive";
};

type Camera = {
  panX: number;
  panY: number;
  zoom: number;
};

type World2CameraStatePayload = {
  at: number;
  href: string;
  mode: "gallery" | "archive";
  activeCategory: World2CategoryKey | "all";
  camera: Camera;
};

type World2ReturnRevealPayload = {
  at?: number;
  href?: string;
  itemId?: string;
  lockUntil?: number;
  revealAt?: number;
  fadeMs?: number;
};

type World2RenderItem = {
  id: string;
  item: MockCatalogItem;
  x: number;
  y: number;
  size: number;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DUPLICATE_MULTIPLIER = 3;
const TILE_SIZE = 52;
const TILE_STEP = 78;
const MIN_ZOOM = 0.22;
const MAX_ZOOM = 5.5;
const WORLD2_TILE_RENDER_SCALE = MAX_ZOOM;
const ZOOM_WHEEL_STRENGTH = 0.012;
const ZOOM_SMOOTH = 0.42;
const ZOOM_WHEEL_DELTA_LIMIT = 380;
const PAN_WHEEL = 1.0;
const FRICTION = 0.9;
const STOP_VELOCITY = 0.02;
const CAMERA_EPS_PAN = 0.08;
const CAMERA_EPS_ZOOM = 0.0006;
const FIT_PADDING_FACTOR = 0.92;
const DRAG_CLICK_THRESHOLD_PX = 5;
const WORLD2_CAMERA_STATE_KEY = "unseen:world2-camera-state";
const WORLD2_RETURN_CAMERA_KEY = "unseen:world2-return-camera";
const WORLD2_RETURN_REVEAL_KEY = "unseen:world2-return-reveal";
const WORLD2_INITIAL_REVEAL_SEEN_KEY = "unseen:world2-initial-reveal-seen";
const PAN_VISIBLE_MARGIN_MIN = 44;
const PAN_VISIBLE_MARGIN_MAX = 200;
const PAN_VISIBLE_MARGIN_FACTOR = 0.18;
const WORLD2_RENDER_PROFILE = {
  default: {
    initialCount: 144,
    batchSize: 72,
    batchDelayMs: 32,
    revealStaggerMs: 1,
  },
  safari: {
    initialCount: 108,
    batchSize: 54,
    batchDelayMs: 44,
    revealStaggerMs: 2,
  },
};
const WORLD2_EAGER_IMAGE_COUNT = 144;
const WORLD2_RETURN_DECODE_LIMIT_DEFAULT = 46;
const WORLD2_RETURN_DECODE_LIMIT_SAFARI = 34;
const WORLD2_RETURN_DECODE_TIMEOUT_DEFAULT = 360;
const WORLD2_RETURN_DECODE_TIMEOUT_SAFARI = 460;
const WORLD2_PRELOAD_BATCH_SIZE_DEFAULT = 10;
const WORLD2_PRELOAD_BATCH_SIZE_SAFARI = 6;
const WORLD2_PRELOAD_BATCH_DELAY_DEFAULT = 18;
const WORLD2_PRELOAD_BATCH_DELAY_SAFARI = 36;
const CATEGORY_ORDER: World2CategoryKey[] = [
  "OUTER",
  "UPPER",
  "LOWER",
  "SILHOUETTE",
  "GROUND",
  "ARTIFACTS",
];

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return hash >>> 0;
}

function seededNoise(key: string, salt: number) {
  return hashString(`${key}-${salt}`) / 0x100000000;
}

function detectSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome\/|CriOS\/|Chromium\/|Edg\//.test(ua);
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

function readStickyHeight() {
  if (typeof window === "undefined") return 0;

  const raw = window.getComputedStyle(document.documentElement).getPropertyValue("--sticky-h");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getContentViewportFrame(container: HTMLDivElement) {
  const width = container.clientWidth;
  const fullHeight = container.clientHeight;
  const stickyHeight = Math.min(Math.max(0, fullHeight - 1), readStickyHeight());
  const height = Math.max(1, fullHeight - stickyHeight);

  return {
    centerX: width * 0.5,
    centerY: stickyHeight + height * 0.5,
    height,
    stickyHeight,
    width,
  };
}

function buildSunflowerItems(items: World2ViewItem[]) {
  const expanded = items
    .flatMap((entry, itemIndex) =>
      Array.from({ length: DUPLICATE_MULTIPLIER }, (_, copyIndex) => {
        const imageSrc = typeof entry.item.imgSrc === "string" ? entry.item.imgSrc.trim() : "";
        if (!imageSrc) return null;

        const baseId = entry.item.id || `world2-item-${itemIndex}`;
        const id = `${baseId}__world2__${copyIndex + 1}`;
        return {
          id,
          item: {
            ...entry.item,
            imgSrc: imageSrc,
          },
          x: 0,
          y: 0,
          size: TILE_SIZE,
        };
      }).filter((value): value is World2RenderItem => Boolean(value)),
    )
    .sort((a, b) => {
      const da = seededNoise(a.id, 1901);
      const db = seededNoise(b.id, 1901);
      if (da !== db) return da - db;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

  const n = expanded.length;
  const theta0 = seededNoise("world2", 221) * Math.PI * 2;
  let sumX = 0;
  let sumY = 0;
  let maxR = 0;

  for (let i = 0; i < n; i += 1) {
    const r = TILE_STEP * Math.sqrt(i + 1);
    const theta = theta0 + i * GOLDEN_ANGLE;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    expanded[i].x = x;
    expanded[i].y = y;
    sumX += x;
    sumY += y;
  }

  const meanX = sumX / Math.max(1, n);
  const meanY = sumY / Math.max(1, n);

  for (let i = 0; i < n; i += 1) {
    const shiftedX = expanded[i].x - meanX;
    const shiftedY = expanded[i].y - meanY;
    expanded[i].x = shiftedX;
    expanded[i].y = shiftedY;
    maxR = Math.max(maxR, Math.hypot(shiftedX, shiftedY));
  }

  return {
    items: expanded,
    radius: maxR + TILE_SIZE * 0.5,
  };
}

function getPrioritizedReturnImageSources({
  camera,
  container,
  itemId,
  limit,
  renderedItems,
}: {
  camera: Camera;
  container: HTMLDivElement | null;
  itemId?: string;
  limit: number;
  renderedItems: World2RenderItem[];
}) {
  const seen = new Set<string>();
  const sources: string[] = [];
  const pushSource = (src: string | null | undefined) => {
    const safeSrc = typeof src === "string" ? src.trim() : "";
    if (!safeSrc || seen.has(safeSrc)) return;
    seen.add(safeSrc);
    sources.push(safeSrc);
  };

  if (itemId) {
    const returningItem = renderedItems.find((entry) => entry.item.id === itemId);
    pushSource(returningItem?.item.imgSrc);
  }

  if (!container) {
    renderedItems.slice(0, limit).forEach((entry) => pushSource(entry.item.imgSrc));
    return sources;
  }

  const frame = getContentViewportFrame(container);
  const viewportCenterX = frame.width * 0.5;
  const viewportCenterY = frame.stickyHeight + frame.height * 0.5;
  const margin = Math.max(180, Math.min(frame.width, frame.height) * 0.22);
  const projectedItems = renderedItems
    .map((entry, index) => {
      const screenX = viewportCenterX + camera.panX + entry.x * camera.zoom;
      const screenY = viewportCenterY + camera.panY + entry.y * camera.zoom;
      const screenSize = entry.size * camera.zoom;
      const isNearViewport =
        screenX + screenSize * 0.5 >= -margin &&
        screenX - screenSize * 0.5 <= frame.width + margin &&
        screenY + screenSize * 0.5 >= -margin &&
        screenY - screenSize * 0.5 <= frame.stickyHeight + frame.height + margin;
      const distanceToCenter = Math.hypot(screenX - viewportCenterX, screenY - viewportCenterY);
      return { distanceToCenter, entry, index, isNearViewport };
    })
    .filter((entry) => entry.isNearViewport)
    .sort((a, b) => a.distanceToCenter - b.distanceToCenter || a.index - b.index);

  projectedItems.slice(0, limit).forEach(({ entry }) => pushSource(entry.item.imgSrc));

  if (sources.length < Math.min(limit, 12)) {
    renderedItems.slice(0, limit).forEach((entry) => pushSource(entry.item.imgSrc));
  }

  return sources.slice(0, limit);
}

const World2ItemButton = memo(function World2ItemButton({
  animateReveal,
  entry,
  index,
  isSafari,
  onItemWarm,
  onItemClick,
}: {
  animateReveal: boolean;
  entry: World2RenderItem;
  index: number;
  isSafari: boolean;
  onItemWarm: (entry: World2RenderItem) => void;
  onItemClick: (entry: World2RenderItem, imageNode: HTMLElement | null) => void;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(false);
  const [isImageReady, setIsImageReady] = useState(!animateReveal);
  const highResolutionSize = entry.size * WORLD2_TILE_RENDER_SCALE;
  const revealStaggerMs = isSafari
    ? Math.round(seededNoise(entry.id, 391) * WORLD2_RENDER_PROFILE.safari.revealStaggerMs * 6)
    : Math.round(seededNoise(entry.id, 391) * WORLD2_RENDER_PROFILE.default.revealStaggerMs * 5);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!animateReveal) {
      setIsImageReady(true);
      return;
    }

    setIsImageReady(false);
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    const image = imageRef.current;
    if (!image?.complete) return;

    revealTimerRef.current = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsImageReady(true);
      revealTimerRef.current = null;
    }, revealStaggerMs);

    return () => {
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [animateReveal, entry.item.imgSrc, revealStaggerMs]);

  const revealImage = useCallback((image: HTMLImageElement) => {
    if (!animateReveal) {
      setIsImageReady(true);
      return;
    }

    const completeReveal = () => {
      if (!isMountedRef.current) return;
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }
      revealTimerRef.current = window.setTimeout(() => {
        if (!isMountedRef.current) return;
        setIsImageReady(true);
        revealTimerRef.current = null;
      }, revealStaggerMs);
    };

    if (!isSafari && typeof image.decode === "function") {
      image.decode().then(completeReveal).catch(completeReveal);
      return;
    }

    completeReveal();
  }, [animateReveal, isSafari, revealStaggerMs]);

  return (
    <button
      className="absolute overflow-visible"
      style={{
        left: 0,
        top: 0,
        width: entry.size,
        height: entry.size,
        transform: `translate3d(${entry.x - entry.size * 0.5}px, ${entry.y - entry.size * 0.5}px, 0)`,
        pointerEvents: "auto",
        cursor: "pointer",
      }}
      type="button"
      aria-label={`${entry.item.brand} ${entry.item.artsyName}`}
      onPointerEnter={() => onItemWarm(entry)}
      onPointerDown={() => onItemWarm(entry)}
      onFocus={() => onItemWarm(entry)}
      onClick={(event) => {
        event.stopPropagation();
        onItemClick(entry, event.currentTarget);
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 block"
        style={{
          width: highResolutionSize,
          height: highResolutionSize,
          transform: `translate3d(-50%, -50%, 0) scale(${1 / WORLD2_TILE_RENDER_SCALE})`,
          transformOrigin: "center",
          willChange: "transform",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- native img keeps deep-zoom detail crisp in this dense canvas */}
        <img
          ref={imageRef}
          src={entry.item.imgSrc}
          alt=""
          className={`h-full w-full max-w-none object-contain ${
            animateReveal ? "transition-opacity duration-100 ease-out" : ""
          }`}
          style={{
            backfaceVisibility: "hidden",
            imageRendering: "auto",
            opacity: isImageReady ? 1 : 0,
            WebkitBackfaceVisibility: "hidden",
          }}
          draggable={false}
          loading={isSafari || index < WORLD2_EAGER_IMAGE_COUNT ? "eager" : "lazy"}
          decoding="async"
          onLoad={(event) => revealImage(event.currentTarget)}
          onError={() => setIsImageReady(true)}
        />
      </span>
    </button>
  );
});

export function World2View({
  items,
  showCategoryNav = true,
  mode = "gallery",
}: World2ViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const cameraRef = useRef<Camera>({ panX: 0, panY: 0, zoom: 1 });
  const targetCameraRef = useRef<Camera>({ panX: 0, panY: 0, zoom: 1 });
  const layoutRadiusRef = useRef(1);
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const persistCameraPayloadRef = useRef<World2CameraStatePayload | null>(null);
  const persistCameraTimerRef = useRef<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSafariBrowser] = useState(() => detectSafariBrowser());
  const [animateInitialReveal] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const isProductReturn = Boolean(
        window.sessionStorage.getItem(WORLD2_RETURN_REVEAL_KEY) ||
          window.sessionStorage.getItem(WORLD2_RETURN_CAMERA_KEY),
      );
      if (isProductReturn) return false;
      if (window.sessionStorage.getItem(WORLD2_INITIAL_REVEAL_SEEN_KEY)) return false;
      window.sessionStorage.setItem(WORLD2_INITIAL_REVEAL_SEEN_KEY, "1");
      return true;
    } catch {
      return false;
    }
  });
  const renderProfile = isSafariBrowser ? WORLD2_RENDER_PROFILE.safari : WORLD2_RENDER_PROFILE.default;
  const [dragging, setDragging] = useState(false);
  const [camera, setCamera] = useState<Camera>({ panX: 0, panY: 0, zoom: 1 });
  const [renderLimit, setRenderLimit] = useState(() =>
    animateInitialReveal ? renderProfile.initialCount : Number.MAX_SAFE_INTEGER,
  );
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isReturnRevealReady, setIsReturnRevealReady] = useState(false);
  const [, setIsReturnInteractionReady] = useState(false);
  const isReturnInteractionLocked = false;
  const [returnRevealFadeMs, setReturnRevealFadeMs] = useState(120);
  const [activeCategory, setActiveCategory] = useState<World2CategoryKey | "all">("all");
  const pendingRestoreCameraRef = useRef<Camera | null>(null);
  const restoreActiveCategoryRef = useRef<World2CategoryKey | "all" | null>(null);
  const hasAppliedInitialRestoreRef = useRef(false);
  const restoreInFlightRef = useRef(false);
  const hasInteractedRef = useRef(false);
  const dragRef = useRef<{
    active: boolean;
    captured: boolean;
    pointerId: number | null;
    moved: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  }>({
    active: false,
    captured: false,
    pointerId: null,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  const startAnimation = useCallback(() => {
    if (isReturnInteractionLocked) return;
    if (frameRef.current !== null) return;

    const tick = () => {
      const clampPanInFrame = (panX: number, panY: number, zoom: number) => {
        const container = containerRef.current;
        if (!container) return { panX, panY };
        const { width, height } = getContentViewportFrame(container);
        if (width < 2 || height < 2) return { panX, panY };

        const screenRadius = Math.max(1, layoutRadiusRef.current * zoom);
        const margin = Math.min(
          PAN_VISIBLE_MARGIN_MAX,
          Math.max(PAN_VISIBLE_MARGIN_MIN, Math.min(width, height) * PAN_VISIBLE_MARGIN_FACTOR),
        );
        const maxPanX = width * 0.5 - margin + screenRadius;
        const minPanX = -width * 0.5 + margin - screenRadius;
        const maxPanY = height * 0.5 - margin + screenRadius;
        const minPanY = -height * 0.5 + margin - screenRadius;
        return {
          panX: clamp(minPanX, panX, maxPanX),
          panY: clamp(minPanY, panY, maxPanY),
        };
      };

      const current = cameraRef.current;
      const target = targetCameraRef.current;
      const isDragging = draggingRef.current;

      if (!isDragging) {
        velocityRef.current.x *= FRICTION;
        velocityRef.current.y *= FRICTION;
        if (Math.abs(velocityRef.current.x) < STOP_VELOCITY) velocityRef.current.x = 0;
        if (Math.abs(velocityRef.current.y) < STOP_VELOCITY) velocityRef.current.y = 0;
        target.panX += velocityRef.current.x;
        target.panY += velocityRef.current.y;
      }
      const clampedTarget = clampPanInFrame(target.panX, target.panY, target.zoom);
      target.panX = clampedTarget.panX;
      target.panY = clampedTarget.panY;

      const next: Camera = {
        panX: current.panX + (target.panX - current.panX) * ZOOM_SMOOTH,
        panY: current.panY + (target.panY - current.panY) * ZOOM_SMOOTH,
        zoom: current.zoom + (target.zoom - current.zoom) * ZOOM_SMOOTH,
      };
      const clampedNext = clampPanInFrame(next.panX, next.panY, next.zoom);
      next.panX = clampedNext.panX;
      next.panY = clampedNext.panY;

      cameraRef.current = next;
      setCamera(next);

      const panSettled =
        Math.abs(target.panX - next.panX) < CAMERA_EPS_PAN &&
        Math.abs(target.panY - next.panY) < CAMERA_EPS_PAN;
      const zoomSettled = Math.abs(target.zoom - next.zoom) < CAMERA_EPS_ZOOM;
      const inertiaSettled = velocityRef.current.x === 0 && velocityRef.current.y === 0;

      if (panSettled && zoomSettled && inertiaSettled && !isDragging) {
        const snapped = { ...target };
        cameraRef.current = snapped;
        setCamera(snapped);
        frameRef.current = null;
        return;
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
  }, [isReturnInteractionLocked]);

  const categoryMeta = useMemo(() => {
    const map = new Map<World2CategoryKey, { count: number; label: string }>();
    items.forEach((entry) => {
      const prev = map.get(entry.categoryKey) ?? { count: 0, label: entry.categoryLabel };
      prev.count += 1;
      map.set(entry.categoryKey, prev);
    });

    return CATEGORY_ORDER
      .map((key) => ({ key, ...(map.get(key) ?? { count: 0, label: key }) }))
      .filter((entry) => entry.count > 0);
  }, [items]);

  const normalizedActiveCategory = useMemo(
    () =>
      activeCategory === "all" || categoryMeta.some((entry) => entry.key === activeCategory)
        ? activeCategory
        : "all",
    [activeCategory, categoryMeta],
  );
  const effectiveActiveCategory = showCategoryNav ? normalizedActiveCategory : "all";

  const visibleItems = useMemo(
    () =>
      effectiveActiveCategory === "all"
        ? items
        : items.filter((entry) => entry.categoryKey === effectiveActiveCategory),
    [effectiveActiveCategory, items],
  );

  const layout = useMemo(() => buildSunflowerItems(visibleItems), [visibleItems]);
  const renderedItems = useMemo(
    () => layout.items.slice(0, Math.min(renderLimit, layout.items.length)),
    [layout.items, renderLimit],
  );
  const preloadImageSources = useMemo(() => {
    const seen = new Set<string>();
    return layout.items.reduce<string[]>((sources, entry) => {
      const src = entry.item.imgSrc.trim();
      if (!src || seen.has(src)) return sources;
      seen.add(src);
      sources.push(src);
      return sources;
    }, []);
  }, [layout.items]);
  const navOptions = useMemo(
    () => [
      { key: "all", label: "All" },
      ...categoryMeta.map((entry) => ({ key: entry.key, label: entry.label })),
    ],
    [categoryMeta],
  );
  const editParam = searchParams.get("edit");
  const queryString = searchParams.toString();
  const currentHref = queryString ? `${pathname}?${queryString}` : pathname;
  const backHref = currentHref;

  useEffect(() => {
    layoutRadiusRef.current = layout.radius;
  }, [layout.radius]);

  useEffect(() => {
    setRenderLimit(
      animateInitialReveal
        ? Math.min(renderProfile.initialCount, layout.items.length)
        : layout.items.length,
    );
  }, [animateInitialReveal, layout.items.length, renderProfile.initialCount]);

  useEffect(() => {
    if (!animateInitialReveal) return;
    if (renderLimit >= layout.items.length) return;

    const timerId = window.setTimeout(() => {
      setRenderLimit((currentLimit) =>
        Math.min(currentLimit + renderProfile.batchSize, layout.items.length),
      );
    }, renderProfile.batchDelayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [animateInitialReveal, layout.items.length, renderLimit, renderProfile.batchDelayMs, renderProfile.batchSize]);

  useEffect(() => {
    if (preloadImageSources.length === 0) return;

    let cancelled = false;
    let sourceIndex = 0;
    let timerId: number | null = null;
    const pendingImages: HTMLImageElement[] = [];
    const batchSize = isSafariBrowser
      ? WORLD2_PRELOAD_BATCH_SIZE_SAFARI
      : WORLD2_PRELOAD_BATCH_SIZE_DEFAULT;
    const batchDelay = isSafariBrowser
      ? WORLD2_PRELOAD_BATCH_DELAY_SAFARI
      : WORLD2_PRELOAD_BATCH_DELAY_DEFAULT;

    const preloadBatch = () => {
      if (cancelled) return;

      const endIndex = Math.min(sourceIndex + batchSize, preloadImageSources.length);
      for (; sourceIndex < endIndex; sourceIndex += 1) {
        const image = new window.Image();
        image.decoding = "async";
        image.loading = "eager";
        image.src = preloadImageSources[sourceIndex];
        pendingImages.push(image);
      }

      if (sourceIndex < preloadImageSources.length) {
        timerId = window.setTimeout(preloadBatch, batchDelay);
      }
    };

    timerId = window.setTimeout(preloadBatch, 0);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      pendingImages.length = 0;
    };
  }, [isSafariBrowser, preloadImageSources]);

  useLayoutEffect(() => {
    let revealTimerId: number | null = null;
    let interactionTimerId: number | null = null;
    let decodeTimeoutId: number | null = null;
    let cancelled = false;
    setIsReturnRevealReady(false);
    setIsReturnInteractionReady(false);

    const scheduleReady = (
      revealDelayMs: number,
      interactionDelayMs: number,
      fadeMs: number,
      decodeSources: string[] = [],
    ) => {
      const safeFade = Math.min(680, Math.max(120, fadeMs));
      window.requestAnimationFrame(() => {
        setReturnRevealFadeMs(safeFade);
      });

      const markRevealReady = () => {
        if (cancelled) return;
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          setIsReturnRevealReady(true);
        });
      };

      const startRevealGate = () => {
        const uniqueSources = Array.from(new Set(decodeSources.map((src) => src.trim()).filter(Boolean)));
        if (uniqueSources.length === 0) {
          markRevealReady();
          return;
        }

        let didFinish = false;
        const finish = () => {
          if (didFinish) return;
          didFinish = true;
          if (decodeTimeoutId !== null) {
            window.clearTimeout(decodeTimeoutId);
            decodeTimeoutId = null;
          }
          markRevealReady();
        };
        decodeTimeoutId = window.setTimeout(
          finish,
          isSafariBrowser ? WORLD2_RETURN_DECODE_TIMEOUT_SAFARI : WORLD2_RETURN_DECODE_TIMEOUT_DEFAULT,
        );
        Promise.all(uniqueSources.map((src) => warmProductImage(src))).then(finish).catch(finish);
      };

      revealTimerId = window.setTimeout(startRevealGate, Math.max(0, revealDelayMs));

      if (interactionDelayMs <= 0) {
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          setIsReturnInteractionReady(true);
        });
      } else {
        interactionTimerId = window.setTimeout(() => {
          if (cancelled) return;
          setIsReturnInteractionReady(true);
        }, interactionDelayMs);
      }
    };

    try {
      const raw = window.sessionStorage.getItem(WORLD2_RETURN_REVEAL_KEY);
      if (!raw) {
        scheduleReady(0, 0, 120);
        return () => {
          cancelled = true;
          if (revealTimerId !== null) window.clearTimeout(revealTimerId);
          if (interactionTimerId !== null) window.clearTimeout(interactionTimerId);
          if (decodeTimeoutId !== null) window.clearTimeout(decodeTimeoutId);
        };
      }
      const parsed = JSON.parse(raw) as World2ReturnRevealPayload;
      const payloadPath = typeof parsed.href === "string" ? parsed.href.split("?")[0] : "";
      const currentPath = currentHref.split("?")[0];
      const isFresh = typeof parsed.at === "number" && Date.now() - parsed.at < 5 * 60 * 1000;
      const revealAt = typeof parsed.revealAt === "number" ? parsed.revealAt : Date.now();
      const lockUntil = typeof parsed.lockUntil === "number" ? parsed.lockUntil : revealAt;
      const revealDelayMs = Math.max(0, revealAt - Date.now());
      const interactionDelayMs = Math.max(0, lockUntil - Date.now());
      const fadeMs = typeof parsed.fadeMs === "number" ? parsed.fadeMs : 220;
      if (!isFresh || payloadPath !== currentPath) {
        scheduleReady(0, 0, 120);
      } else {
        let returnCamera: Camera | null = null;
        try {
          const cameraRaw = window.sessionStorage.getItem(WORLD2_RETURN_CAMERA_KEY);
          if (cameraRaw) {
            const cameraPayload = JSON.parse(cameraRaw) as World2CameraStatePayload;
            const cameraPayloadPath = typeof cameraPayload.href === "string" ? cameraPayload.href.split("?")[0] : "";
            const isCameraFresh = typeof cameraPayload.at === "number" && Date.now() - cameraPayload.at < 30 * 60 * 1000;
            if (
              isCameraFresh &&
              cameraPayload.mode === mode &&
              cameraPayloadPath === currentPath &&
              cameraPayload.camera &&
              Number.isFinite(cameraPayload.camera.panX) &&
              Number.isFinite(cameraPayload.camera.panY) &&
              Number.isFinite(cameraPayload.camera.zoom)
            ) {
              returnCamera = cameraPayload.camera;
            }
          }
        } catch {
          returnCamera = null;
        }
        const returnDecodeLimit = isSafariBrowser
          ? WORLD2_RETURN_DECODE_LIMIT_SAFARI
          : WORLD2_RETURN_DECODE_LIMIT_DEFAULT;
        const decodeSources = getPrioritizedReturnImageSources({
          camera: returnCamera ?? cameraRef.current,
          container: containerRef.current,
          itemId: parsed.itemId,
          limit: returnDecodeLimit,
          renderedItems: layout.items,
        });
        scheduleReady(revealDelayMs, interactionDelayMs, fadeMs, decodeSources);
      }
      window.sessionStorage.removeItem(WORLD2_RETURN_REVEAL_KEY);
    } catch {
      scheduleReady(0, 0, 120);
    }

    return () => {
      cancelled = true;
      if (revealTimerId !== null) window.clearTimeout(revealTimerId);
      if (interactionTimerId !== null) window.clearTimeout(interactionTimerId);
      if (decodeTimeoutId !== null) window.clearTimeout(decodeTimeoutId);
    };
  }, [currentHref, isSafariBrowser, layout.items, mode]);

  const buildProductViewHref = useCallback((entry: World2RenderItem) => {
    const nextParams = new URLSearchParams({
      item: entry.item.id,
      mode,
      back: backHref,
      img: entry.item.imgSrc,
    });

    if (editParam) {
      nextParams.set("edit", editParam);
    }

    return `/product-view?${nextParams.toString()}`;
  }, [backHref, editParam, mode]);

  const warmProductTransition = useCallback((entry: World2RenderItem) => {
    const productViewHref = buildProductViewHref(entry);
    void warmProductImage(entry.item.imgSrc);
    router.prefetch(productViewHref);
  }, [buildProductViewHref, router]);

  const clampPanToBounds = useCallback((panX: number, panY: number, zoom: number) => {
    const container = containerRef.current;
    if (!container) return { panX, panY };

    const { width, height } = getContentViewportFrame(container);
    if (width < 2 || height < 2) return { panX, panY };

    const screenRadius = Math.max(1, layout.radius * zoom);
    const margin = Math.min(
      PAN_VISIBLE_MARGIN_MAX,
      Math.max(PAN_VISIBLE_MARGIN_MIN, Math.min(width, height) * PAN_VISIBLE_MARGIN_FACTOR),
    );

    const maxPanX = width * 0.5 - margin + screenRadius;
    const minPanX = -width * 0.5 + margin - screenRadius;
    const maxPanY = height * 0.5 - margin + screenRadius;
    const minPanY = -height * 0.5 + margin - screenRadius;

    return {
      panX: clamp(minPanX, panX, maxPanX),
      panY: clamp(minPanY, panY, maxPanY),
    };
  }, [layout.radius]);

  const fitToViewport = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { width, height } = getContentViewportFrame(container);
    if (width < 2 || height < 2) return;

    const fitZoom = FIT_PADDING_FACTOR * Math.min(width, height) / (2 * Math.max(layout.radius, 1));
    const zoom = clamp(MIN_ZOOM, fitZoom, MAX_ZOOM);
    const clampedPan = clampPanToBounds(0, 0, zoom);
    const fitted = { panX: clampedPan.panX, panY: clampedPan.panY, zoom };
    velocityRef.current = { x: 0, y: 0 };
    cameraRef.current = fitted;
    targetCameraRef.current = fitted;
    setCamera(fitted);
    setIsCameraReady(true);
  }, [clampPanToBounds, layout.radius]);

  useLayoutEffect(() => {
    if (hasAppliedInitialRestoreRef.current) return;
    hasAppliedInitialRestoreRef.current = true;
    try {
      const returnRaw = window.sessionStorage.getItem(WORLD2_RETURN_CAMERA_KEY);
      if (!returnRaw) return;
      const raw = returnRaw;
      const parsed = JSON.parse(raw) as World2CameraStatePayload;
      const isFresh = typeof parsed.at === "number" && Date.now() - parsed.at < 30 * 60 * 1000;
      const sameMode = parsed.mode === mode;
      const currentPath = currentHref.split("?")[0];
      const payloadPath = typeof parsed.href === "string" ? parsed.href.split("?")[0] : "";
      if (!isFresh || !sameMode || payloadPath !== currentPath) return;
      if (
        !parsed.camera ||
        !Number.isFinite(parsed.camera.panX) ||
        !Number.isFinite(parsed.camera.panY) ||
        !Number.isFinite(parsed.camera.zoom)
      ) {
        return;
      }

      const restoredCategory =
        parsed.activeCategory === "all" || CATEGORY_ORDER.includes(parsed.activeCategory)
          ? parsed.activeCategory
          : "all";

      const restoredCamera = {
        panX: parsed.camera.panX,
        panY: parsed.camera.panY,
        zoom: clamp(MIN_ZOOM, parsed.camera.zoom, MAX_ZOOM),
      };
      const clampedRestoredPan = clampPanToBounds(
        restoredCamera.panX,
        restoredCamera.panY,
        restoredCamera.zoom,
      );
      restoredCamera.panX = clampedRestoredPan.panX;
      restoredCamera.panY = clampedRestoredPan.panY;

      pendingRestoreCameraRef.current = restoredCamera;
      restoreActiveCategoryRef.current = restoredCategory;
      restoreInFlightRef.current = true;
      hasInteractedRef.current = true;
      velocityRef.current = { x: 0, y: 0 };
      cameraRef.current = restoredCamera;
      targetCameraRef.current = restoredCamera;
      window.requestAnimationFrame(() => {
        setCamera(restoredCamera);
        setIsCameraReady(true);
        restoreInFlightRef.current = false;
        if (activeCategory !== restoredCategory) {
          setActiveCategory(restoredCategory);
        }
      });
      window.sessionStorage.removeItem(WORLD2_RETURN_CAMERA_KEY);
    } catch {
      // Optional restore convenience only.
    }
  }, [activeCategory, clampPanToBounds, currentHref, mode]);

  useLayoutEffect(() => {
    const restoredCamera = pendingRestoreCameraRef.current;
    if (!restoredCamera) return;
    const targetCategory = restoreActiveCategoryRef.current ?? "all";
    if (effectiveActiveCategory !== targetCategory) return;

    pendingRestoreCameraRef.current = null;
    restoreActiveCategoryRef.current = null;
    velocityRef.current = { x: 0, y: 0 };
    cameraRef.current = restoredCamera;
    targetCameraRef.current = restoredCamera;
    setCamera(restoredCamera);
    setIsCameraReady(true);
  }, [effectiveActiveCategory]);

  useLayoutEffect(() => {
    if (!isCameraReady && !restoreInFlightRef.current) {
      fitToViewport();
    }
  }, [fitToViewport, isCameraReady]);

  useEffect(() => {
    if (!isCameraReady) return;

    persistCameraPayloadRef.current = {
      at: Date.now(),
      href: currentHref,
      mode,
      activeCategory: effectiveActiveCategory,
      camera: targetCameraRef.current,
    };

    if (persistCameraTimerRef.current !== null) return;

    persistCameraTimerRef.current = window.setTimeout(() => {
      persistCameraTimerRef.current = null;
      const payload = persistCameraPayloadRef.current;
      if (!payload) return;

      try {
        window.sessionStorage.setItem(WORLD2_CAMERA_STATE_KEY, JSON.stringify(payload));
      } catch {
        // Optional restore convenience only.
      }
    }, 180);
  }, [camera, currentHref, effectiveActiveCategory, isCameraReady, mode]);

  useEffect(
    () => () => {
      if (persistCameraTimerRef.current !== null) {
        window.clearTimeout(persistCameraTimerRef.current);
        persistCameraTimerRef.current = null;
      }

      const payload = persistCameraPayloadRef.current;
      if (!payload) return;

      try {
        window.sessionStorage.setItem(WORLD2_CAMERA_STATE_KEY, JSON.stringify(payload));
      } catch {
        // Optional restore convenience only.
      }
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (!hasInteractedRef.current) {
        fitToViewport();
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [fitToViewport]);

  useEffect(() => {
    if (!hasInteractedRef.current) {
      fitToViewport();
    }
  }, [fitToViewport, effectiveActiveCategory]);

  const zoomAtPoint = useCallback((clientX: number, clientY: number, factor: number) => {
    if (isReturnInteractionLocked) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const { centerX: cx, centerY: cy } = getContentViewportFrame(container);

    const target = targetCameraRef.current;
    const wx = (sx - (cx + target.panX)) / target.zoom;
    const wy = (sy - (cy + target.panY)) / target.zoom;
    const zoom = clamp(MIN_ZOOM, target.zoom * factor, MAX_ZOOM);
    const panX = sx - cx - wx * zoom;
    const panY = sy - cy - wy * zoom;
    const clampedPan = clampPanToBounds(panX, panY, zoom);
    targetCameraRef.current = { panX: clampedPan.panX, panY: clampedPan.panY, zoom };
    startAnimation();
  }, [clampPanToBounds, isReturnInteractionLocked, startAnimation]);

  const zoomAtCenter = useCallback((factor: number) => {
    if (isReturnInteractionLocked) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { centerX, centerY } = getContentViewportFrame(container);
    zoomAtPoint(rect.left + centerX, rect.top + centerY, factor);
  }, [isReturnInteractionLocked, zoomAtPoint]);

  useEffect(() => {
    if (!isReturnInteractionLocked) return;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    velocityRef.current = { x: 0, y: 0 };
    draggingRef.current = false;
    setDragging(false);
    dragRef.current.active = false;
    dragRef.current.captured = false;
    dragRef.current.pointerId = null;
    dragRef.current.moved = false;
    targetCameraRef.current = cameraRef.current;
  }, [isReturnInteractionLocked]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      if (isReturnInteractionLocked) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      hasInteractedRef.current = true;

      if (event.ctrlKey || event.metaKey) {
        const dy = clamp(-ZOOM_WHEEL_DELTA_LIMIT, event.deltaY, ZOOM_WHEEL_DELTA_LIMIT);
        const factor = Math.exp(-dy * ZOOM_WHEEL_STRENGTH);
        zoomAtPoint(event.clientX, event.clientY, factor);
        return;
      }

      const deltaModeFactor = event.deltaMode === 1 ? 16 : 1;
      const panFactor = PAN_WHEEL * deltaModeFactor;
      const target = targetCameraRef.current;
      const nextPan = clampPanToBounds(
        target.panX - event.deltaX * panFactor,
        target.panY - event.deltaY * panFactor,
        target.zoom,
      );
      targetCameraRef.current = {
        ...target,
        panX: nextPan.panX,
        panY: nextPan.panY,
      };
      startAnimation();
    };

    const beginMouseDrag = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-world2-control="true"]')) return;

      event.preventDefault();
      hasInteractedRef.current = true;
      dragRef.current.active = true;
      dragRef.current.captured = false;
      dragRef.current.pointerId = null;
      dragRef.current.moved = false;
      dragRef.current.startX = event.clientX;
      dragRef.current.startY = event.clientY;
      dragRef.current.lastX = event.clientX;
      dragRef.current.lastY = event.clientY;
      velocityRef.current = { x: 0, y: 0 };
      draggingRef.current = false;
      setDragging(false);
    };

    container.addEventListener("mousedown", beginMouseDrag, { capture: true });
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("mousedown", beginMouseDrag, { capture: true });
      container.removeEventListener("wheel", handleWheel);
    };
  }, [clampPanToBounds, isReturnInteractionLocked, startAnimation, zoomAtPoint]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isReturnInteractionLocked) {
      event.preventDefault();
      return;
    }
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-world2-control="true"]')) return;

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    hasInteractedRef.current = true;
    dragRef.current.active = true;
    dragRef.current.captured = true;
    dragRef.current.pointerId = event.pointerId;
    dragRef.current.moved = false;
    dragRef.current.startX = event.clientX;
    dragRef.current.startY = event.clientY;
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;
    velocityRef.current = { x: 0, y: 0 };
    draggingRef.current = false;
    setDragging(false);
  }, [isReturnInteractionLocked]);

  const applyDragMove = useCallback((clientX: number, clientY: number, pointerId: number | null) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    if (pointerId !== null && drag.pointerId !== null && drag.pointerId !== pointerId) return;

    const movedDistance = Math.hypot(clientX - drag.startX, clientY - drag.startY);
    if (!drag.moved && movedDistance > DRAG_CLICK_THRESHOLD_PX) {
      drag.moved = true;
      draggingRef.current = true;
      setDragging(true);
    }
    if (!drag.moved) {
      return;
    }

    const dx = clientX - drag.lastX;
    const dy = clientY - drag.lastY;
    drag.lastX = clientX;
    drag.lastY = clientY;
    const target = targetCameraRef.current;
    const nextPan = clampPanToBounds(
      target.panX + dx,
      target.panY + dy,
      target.zoom,
    );
    const nextTarget = {
      ...target,
      panX: nextPan.panX,
      panY: nextPan.panY,
    };
    targetCameraRef.current = nextTarget;
    // Keep drag start/move immediate; inertia still runs after pointer up.
    cameraRef.current = nextTarget;
    setCamera(nextTarget);
    velocityRef.current = { x: dx, y: dy };
  }, [clampPanToBounds]);

  const finishDrag = useCallback((pointerId: number | null) => {
    const drag = dragRef.current;
    if (!drag.active) return false;
    if (pointerId !== null && drag.pointerId !== null && drag.pointerId !== pointerId) return false;

    const hadCapture = drag.captured;
    drag.active = false;
    drag.pointerId = null;
    if (drag.moved) {
      suppressClickRef.current = true;
      window.requestAnimationFrame(() => {
        suppressClickRef.current = false;
      });
    }
    drag.moved = false;
    drag.captured = false;
    draggingRef.current = false;
    setDragging(false);
    if (!isReturnInteractionLocked) {
      startAnimation();
    }
    return hadCapture;
  }, [isReturnInteractionLocked, startAnimation]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isReturnInteractionLocked) {
      event.preventDefault();
      return;
    }
    applyDragMove(event.clientX, event.clientY, event.pointerId);
  }, [applyDragMove, isReturnInteractionLocked]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const hadCapture = finishDrag(event.pointerId);
    if (hadCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [finishDrag]);

  useEffect(() => {
    const resetDragState = () => {
      finishDrag(null);
    };
    const handleWindowPointerMove = (event: PointerEvent) => {
      applyDragMove(event.clientX, event.clientY, event.pointerId);
    };
    const handleWindowPointerUp = (event: PointerEvent) => {
      finishDrag(event.pointerId);
    };
    const handleWindowMouseMove = (event: MouseEvent) => {
      applyDragMove(event.clientX, event.clientY, null);
    };
    const handleWindowMouseUp = () => {
      finishDrag(null);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("blur", resetDragState);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("blur", resetDragState);
    };
  }, [applyDragMove, finishDrag]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const handleItemClick = useCallback((entry: World2RenderItem, imageNode: HTMLElement | null) => {
    if (isReturnInteractionLocked) return;
    if (suppressClickRef.current) return;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    velocityRef.current = { x: 0, y: 0 };
    targetCameraRef.current = cameraRef.current;

    const productViewHref = buildProductViewHref(entry);
    router.prefetch(productViewHref);

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
    showProductTransitionHold(imageNode, entry.item.imgSrc, aspectRatio, entry.item.id);

    if (sourceRect) {
      try {
        window.sessionStorage.setItem(
          "unseen:product-view-transition",
          JSON.stringify({
            itemId: entry.item.id,
            src: entry.item.imgSrc,
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

    if (containerRect) {
      try {
        window.sessionStorage.setItem(
          "unseen:product-view-text-transition",
          JSON.stringify({
            itemId: entry.item.id,
            left: containerRect.left,
            top: containerRect.top,
            width: containerRect.width,
            height: containerRect.height,
            at: Date.now(),
          }),
        );
      } catch {
        // Transition is optional; ignore storage failures.
      }
    }

    try {
      const cameraPayload: World2CameraStatePayload = {
        at: Date.now(),
        href: currentHref,
        mode,
        activeCategory: effectiveActiveCategory,
        camera: cameraRef.current,
      };
      window.sessionStorage.setItem(WORLD2_CAMERA_STATE_KEY, JSON.stringify(cameraPayload));
      window.sessionStorage.setItem(WORLD2_RETURN_CAMERA_KEY, JSON.stringify(cameraPayload));
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

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        router.push(productViewHref);
      });
    });
  }, [backHref, buildProductViewHref, currentHref, effectiveActiveCategory, isReturnInteractionLocked, mode, router]);

  const centerX = "50%";
  const centerY = "calc(var(--sticky-h) + (100% - var(--sticky-h)) / 2)";

  if (items.length === 0 || visibleItems.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] w-full items-center justify-center">
        <p className="text-[14px] font-medium tracking-[0.03em] text-meta">No items available.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[420px] w-full overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        cursor: dragging ? "grabbing" : "grab",
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {isReturnInteractionLocked ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[60] touch-none"
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
      {showCategoryNav ? (
        <div
          data-world2-control="true"
          className="pointer-events-none fixed left-5 z-40 hidden -translate-y-1/2 lg:block"
          style={{ top: "var(--gallery-category-nav-top)" }}
        >
          <div className="pointer-events-auto">
            <World2CategoryNav
              options={navOptions}
              activeKey={effectiveActiveCategory}
              onSelect={(key) => {
                if (isReturnInteractionLocked) return;
                setActiveCategory(key as World2CategoryKey | "all");
                hasInteractedRef.current = false;
              }}
            />
          </div>
        </div>
      ) : null}

      <div
        className="absolute left-0 top-0"
        style={{
          left: centerX,
          top: centerY,
          transform: `translate3d(${camera.panX}px, ${camera.panY}px, 0) scale(${camera.zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
          opacity: isCameraReady && isReturnRevealReady ? 1 : 0,
          transition: `opacity ${returnRevealFadeMs}ms ease-out`,
        }}
      >
        {renderedItems.map((entry, index) => (
          <World2ItemButton
            key={entry.id}
            animateReveal={animateInitialReveal}
            entry={entry}
            index={index}
            isSafari={isSafariBrowser}
            onItemWarm={warmProductTransition}
            onItemClick={handleItemClick}
          />
        ))}
      </div>

      <div data-world2-control="true" className="pointer-events-none absolute right-4 top-4 z-10">
        <button
          type="button"
          className="pointer-events-auto mb-2 h-8 w-8 rounded-full bg-paper/95 text-[20px] leading-none text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
          onClick={(event) => {
            if (isReturnInteractionLocked) return;
            event.stopPropagation();
            hasInteractedRef.current = true;
            zoomAtCenter(1.35);
          }}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="pointer-events-auto block h-8 w-8 rounded-full bg-paper/95 text-[20px] leading-none text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
          onClick={(event) => {
            if (isReturnInteractionLocked) return;
            event.stopPropagation();
            hasInteractedRef.current = true;
            zoomAtCenter(1 / 1.35);
          }}
          aria-label="Zoom out"
        >
          -
        </button>
      </div>
    </div>
  );
}
