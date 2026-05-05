"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MockCatalogItem } from "@/data/mockCatalog";
import { World2CategoryNav } from "@/components/unseen/World2CategoryNav";
import { MobileFloatingCategoryPill } from "@/components/unseen/MobileFloatingCategoryPill";
import { showProductTransitionHold, warmProductImage } from "@/components/unseen/productImagePreload";
import { useViewportMode } from "@/lib/ui/viewportMode";

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
const DUPLICATE_MULTIPLIER = 2;
const TILE_SIZE = 52;
const TILE_STEP = 78;
const TILE_SIZE_MOBILE = 58;
const TILE_STEP_MOBILE = 66;
const MIN_ZOOM = 0.22;
const MAX_ZOOM = 5.5;
const WORLD2_TILE_RENDER_SCALE = 3.2;
const ZOOM_WHEEL_STRENGTH = 0.012;
const ZOOM_SMOOTH = 0.42;
const PINCH_ZOOM_MIN_FACTOR = 0.9;
const PINCH_ZOOM_MAX_FACTOR = 1.12;
const ZOOM_WHEEL_DELTA_LIMIT = 380;
const PAN_WHEEL = 1.0;
const FRICTION = 0.93;
const MOBILE_FRICTION = 0.965;
const STOP_VELOCITY = 0.02;
const MOBILE_STOP_VELOCITY = 0.026;
const CAMERA_EPS_PAN = 0.08;
const CAMERA_EPS_ZOOM = 0.0006;
const FIT_PADDING_FACTOR = 0.92;
const DRAG_CLICK_THRESHOLD_PX = 5;
const DRAG_CLICK_THRESHOLD_TOUCH_PX = 2;
const MOBILE_DRAG_REFERENCE_WIDTH = 390;
const MOBILE_DRAG_PAN_GAIN = 1.34;
const MOBILE_DRAG_VELOCITY_GAIN = 1.18;
const MOBILE_DRAG_VELOCITY_BLEND = 0.48;
const MOBILE_DRAG_VELOCITY_MAX = 54;
const MOBILE_CAMERA_SMOOTH_DRAG = 0.48;
const MOBILE_CAMERA_SMOOTH_RELEASE = 0.3;
const MOBILE_CAMERA_SMOOTH_ZOOM = 0.36;
const FRAME_MS = 16.67;
const WORLD2_MOBILE_RENDER_LIMIT = 180;
const WORLD2_TILE_RENDER_SCALE_MOBILE = 3.05;
const WORLD2_TILE_RENDER_SCALE_MOBILE_SAFARI = 3.05;
const WORLD2_TILE_RENDER_SCALE_IPAD = 3.2;
const WORLD2_TILE_RENDER_SCALE_IPAD_SAFARI = 3.2;
const WORLD2_CAMERA_STATE_KEY = "unseen:world2-camera-state";
const WORLD2_RETURN_CAMERA_KEY = "unseen:world2-return-camera";
const WORLD2_RETURN_REVEAL_KEY = "unseen:world2-return-reveal";
const WORLD2_INITIAL_REVEAL_SEEN_KEY = "unseen:world2-initial-reveal-seen";
const PAN_VISIBLE_MARGIN_MIN = 44;
const PAN_VISIBLE_MARGIN_MAX = 200;
const PAN_VISIBLE_MARGIN_FACTOR = 0.18;
const WORLD2_RENDER_PROFILE = {
  default: {
    initialCount: 96,
    batchSize: 48,
    batchDelayMs: 36,
    revealStaggerMs: 1,
  },
  safari: {
    initialCount: 64,
    batchSize: 32,
    batchDelayMs: 56,
    revealStaggerMs: 2,
  },
};
const WORLD2_RENDER_PROFILE_MOBILE = {
  default: {
    initialCount: 56,
    batchSize: 28,
    batchDelayMs: 44,
    revealStaggerMs: 1,
  },
  safari: {
    initialCount: 40,
    batchSize: 20,
    batchDelayMs: 62,
    revealStaggerMs: 2,
  },
};
const WORLD2_EAGER_IMAGE_COUNT = 48;
const WORLD2_EAGER_IMAGE_COUNT_MOBILE = 88;
const WORLD2_EAGER_IMAGE_COUNT_IPAD = 116;
const WORLD2_RETURN_DECODE_LIMIT_DEFAULT = 24;
const WORLD2_RETURN_DECODE_LIMIT_SAFARI = 16;
const WORLD2_RETURN_DECODE_TIMEOUT_DEFAULT = 320;
const WORLD2_RETURN_DECODE_TIMEOUT_SAFARI = 420;
const WORLD2_PRELOAD_BATCH_SIZE_DEFAULT = 10;
const WORLD2_PRELOAD_BATCH_SIZE_SAFARI = 6;
const WORLD2_PRELOAD_BATCH_DELAY_DEFAULT = 18;
const WORLD2_PRELOAD_BATCH_DELAY_SAFARI = 36;
const WORLD2_PRELOAD_SOURCE_CAP_DEFAULT = 120;
const WORLD2_PRELOAD_SOURCE_CAP_SAFARI = 56;
const WORLD2_IMMERSIVE_HEADER_EVENT = "unseen:immersive-header-collapse";
const WORLD2_IMMERSIVE_HEADER_SETTLE_MS = 180;
const WORLD2_IMMERSIVE_HEADER_FULL_TO_MID_ZOOM_RATIO = 1.08;
const WORLD2_IMMERSIVE_HEADER_MID_TO_FULL_ZOOM_RATIO = 1.035;
const WORLD2_IMMERSIVE_HEADER_MID_TO_COMPACT_ZOOM_RATIO = 1.16;
const WORLD2_IMMERSIVE_HEADER_COMPACT_TO_MID_ZOOM_RATIO = 1.42;
const WORLD2_MOBILE_CENTER_LIFT_PX = 38;
const WORLD2_MOBILE_CENTER_LIFT_SAFARI_PX = 22;
const WORLD2_MOBILE_INITIAL_PAN_LIFT_PX = 22;
const WORLD2_MOBILE_INITIAL_PAN_LIFT_SAFARI_PX = 12;
type World2ImmersiveHeaderPhase = "full" | "mid" | "compact";
type World2ImmersiveZoomDirection = "in" | "out";
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

  const styles = window.getComputedStyle(document.documentElement);
  const fixedRaw = styles.getPropertyValue("--immersive-sticky-h");
  const fixedParsed = Number.parseFloat(fixedRaw);
  if (Number.isFinite(fixedParsed) && fixedParsed > 0) return fixedParsed;

  const raw = styles.getPropertyValue("--sticky-h");
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

function buildSunflowerItems(
  items: World2ViewItem[],
  {
    tileSize = TILE_SIZE,
    tileStep = TILE_STEP,
  }: {
    tileSize?: number;
    tileStep?: number;
  } = {},
) {
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
          size: tileSize,
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
    const r = tileStep * Math.sqrt(i + 1);
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
    radius: maxR + tileSize * 0.5,
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
  eagerImageCount,
  entry,
  index,
  isSafari,
  renderScale,
  onItemWarm,
  onItemClick,
}: {
  animateReveal: boolean;
  eagerImageCount: number;
  entry: World2RenderItem;
  index: number;
  isSafari: boolean;
  renderScale: number;
  onItemWarm: (entry: World2RenderItem) => void;
  onItemClick: (entry: World2RenderItem, imageNode: HTMLElement | null) => void;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(false);
  const [isImageReady, setIsImageReady] = useState(!animateReveal);
  const highResolutionSize = entry.size * renderScale;
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
          transform: `translate3d(-50%, -50%, 0) scale(${1 / renderScale})`,
          transformOrigin: "center",
          willChange: "transform",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- native img keeps deep-zoom detail crisp in this dense canvas */}
        <img
          ref={imageRef}
          src={entry.item.imgSrc}
          alt=""
          className={`h-full w-full max-w-none pointer-events-none select-none object-contain ${
            animateReveal ? "transition-opacity duration-100 ease-out" : ""
          }`}
          style={{
            backfaceVisibility: "hidden",
            imageRendering: "auto",
            opacity: isImageReady ? 1 : 0,
            WebkitBackfaceVisibility: "hidden",
          }}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          loading={isSafari || index < eagerImageCount ? "eager" : "lazy"}
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
  const interactionCommitRafRef = useRef<number | null>(null);
  const pendingInteractionCameraRef = useRef<Camera | null>(null);
  const suppressClickRef = useRef(false);
  const cameraRef = useRef<Camera>({ panX: 0, panY: 0, zoom: 1 });
  const targetCameraRef = useRef<Camera>({ panX: 0, panY: 0, zoom: 1 });
  const layoutRadiusRef = useRef(1);
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const persistCameraPayloadRef = useRef<World2CameraStatePayload | null>(null);
  const persistCameraTimerRef = useRef<number | null>(null);
  const immersiveHeaderBaseZoomRef = useRef(MIN_ZOOM);
  const immersiveHeaderSettleTimerRef = useRef<number | null>(null);
  const immersiveHeaderZoomDirectionRef = useRef<World2ImmersiveZoomDirection>("in");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSafariBrowser] = useState(() => detectSafariBrowser());
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const { isIPadExperience, isMobileExperience } = useViewportMode();
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
  const renderProfile = useMemo(() => {
    if (isMobileViewport) {
      return isSafariBrowser ? WORLD2_RENDER_PROFILE_MOBILE.safari : WORLD2_RENDER_PROFILE_MOBILE.default;
    }
    return isSafariBrowser ? WORLD2_RENDER_PROFILE.safari : WORLD2_RENDER_PROFILE.default;
  }, [isMobileViewport, isSafariBrowser]);
  const tileRenderScale = useMemo(() => {
    if (!isMobileViewport) return WORLD2_TILE_RENDER_SCALE;
    if (isIPadExperience) {
      return isSafariBrowser ? WORLD2_TILE_RENDER_SCALE_IPAD_SAFARI : WORLD2_TILE_RENDER_SCALE_IPAD;
    }
    return isSafariBrowser ? WORLD2_TILE_RENDER_SCALE_MOBILE_SAFARI : WORLD2_TILE_RENDER_SCALE_MOBILE;
  }, [isIPadExperience, isMobileViewport, isSafariBrowser]);
  const eagerImageCount = useMemo(() => {
    if (!isMobileViewport) return WORLD2_EAGER_IMAGE_COUNT;
    if (isIPadExperience) return WORLD2_EAGER_IMAGE_COUNT_IPAD;
    return WORLD2_EAGER_IMAGE_COUNT_MOBILE;
  }, [isIPadExperience, isMobileViewport]);
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
  const immersiveHeaderPhaseRef = useRef<World2ImmersiveHeaderPhase>("full");
  const dragRef = useRef<{
    active: boolean;
    captured: boolean;
    pointerId: number | null;
    pointerType: string | null;
    moved: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastT: number;
  }>({
    active: false,
    captured: false,
    pointerId: null,
    pointerType: null,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
  });
  const pinchRef = useRef<{
    active: boolean;
    lastDistance: number;
  }>({
    active: false,
    lastDistance: 0,
  });
  const commitInteractionCamera = useCallback(() => {
    if (interactionCommitRafRef.current !== null) return;
    interactionCommitRafRef.current = window.requestAnimationFrame(() => {
      interactionCommitRafRef.current = null;
      const pendingCamera = pendingInteractionCameraRef.current;
      if (!pendingCamera) return;
      pendingInteractionCameraRef.current = null;
      setCamera(pendingCamera);
    });
  }, []);

  const applyDirectCamera = useCallback((nextCamera: Camera) => {
    cameraRef.current = nextCamera;
    targetCameraRef.current = nextCamera;
    pendingInteractionCameraRef.current = nextCamera;
    commitInteractionCamera();
  }, [commitInteractionCamera]);

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
      const friction = isMobileViewport ? MOBILE_FRICTION : FRICTION;
      const stopVelocity = isMobileViewport ? MOBILE_STOP_VELOCITY : STOP_VELOCITY;
      const panSmooth = isMobileViewport
        ? isDragging
          ? MOBILE_CAMERA_SMOOTH_DRAG
          : MOBILE_CAMERA_SMOOTH_RELEASE
        : ZOOM_SMOOTH;
      const zoomSmooth = isMobileViewport ? MOBILE_CAMERA_SMOOTH_ZOOM : ZOOM_SMOOTH;

      if (!isDragging) {
        velocityRef.current.x *= friction;
        velocityRef.current.y *= friction;
        if (Math.abs(velocityRef.current.x) < stopVelocity) velocityRef.current.x = 0;
        if (Math.abs(velocityRef.current.y) < stopVelocity) velocityRef.current.y = 0;
        target.panX += velocityRef.current.x;
        target.panY += velocityRef.current.y;
      }
      const clampedTarget = clampPanInFrame(target.panX, target.panY, target.zoom);
      target.panX = clampedTarget.panX;
      target.panY = clampedTarget.panY;

      const next: Camera = {
        panX: current.panX + (target.panX - current.panX) * panSmooth,
        panY: current.panY + (target.panY - current.panY) * panSmooth,
        zoom: current.zoom + (target.zoom - current.zoom) * zoomSmooth,
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
  }, [isMobileViewport, isReturnInteractionLocked]);

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

  const layout = useMemo(
    () =>
      buildSunflowerItems(visibleItems, {
        tileSize: isMobileViewport ? TILE_SIZE_MOBILE : TILE_SIZE,
        tileStep: isMobileViewport ? TILE_STEP_MOBILE : TILE_STEP,
      }),
    [isMobileViewport, visibleItems],
  );
  const renderedItems = useMemo(() => {
    const mobileCap = isMobileViewport ? WORLD2_MOBILE_RENDER_LIMIT : layout.items.length;
    return layout.items.slice(0, Math.min(renderLimit, layout.items.length, mobileCap));
  }, [isMobileViewport, layout.items, renderLimit]);
  const preloadImageSources = useMemo(() => {
    const seen = new Set<string>();
    const sourceCap = isSafariBrowser ? WORLD2_PRELOAD_SOURCE_CAP_SAFARI : WORLD2_PRELOAD_SOURCE_CAP_DEFAULT;
    return layout.items.reduce<string[]>((sources, entry) => {
      if (sources.length >= sourceCap) return sources;
      const src = entry.item.imgSrc.trim();
      if (!src || seen.has(src)) return sources;
      seen.add(src);
      sources.push(src);
      return sources;
    }, []);
  }, [isSafariBrowser, layout.items]);
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
  const setImmersiveHeaderPhase = useCallback((phase: World2ImmersiveHeaderPhase) => {
    if (immersiveHeaderPhaseRef.current === phase) return;
    immersiveHeaderPhaseRef.current = phase;
    window.dispatchEvent(
      new CustomEvent(WORLD2_IMMERSIVE_HEADER_EVENT, {
        detail: { collapsed: phase === "compact", phase },
      }),
    );
  }, []);

  const syncImmersiveHeaderToSettledZoom = useCallback(
    (nextZoom: number, direction: World2ImmersiveZoomDirection) => {
      if (!isMobileViewport) return;
      if (!Number.isFinite(nextZoom) || nextZoom <= 0) return;

      const baseZoom = Math.max(MIN_ZOOM, immersiveHeaderBaseZoomRef.current || MIN_ZOOM);
      const fullToMidZoom = baseZoom * WORLD2_IMMERSIVE_HEADER_FULL_TO_MID_ZOOM_RATIO;
      const midToFullZoom = baseZoom * WORLD2_IMMERSIVE_HEADER_MID_TO_FULL_ZOOM_RATIO;
      const midToCompactZoom = baseZoom * WORLD2_IMMERSIVE_HEADER_MID_TO_COMPACT_ZOOM_RATIO;
      const compactToMidZoom = baseZoom * WORLD2_IMMERSIVE_HEADER_COMPACT_TO_MID_ZOOM_RATIO;
      const currentPhase = immersiveHeaderPhaseRef.current;
      const nextPhase =
        currentPhase === "compact"
          ? direction === "out" && nextZoom <= compactToMidZoom
            ? "mid"
            : "compact"
          : currentPhase === "mid"
            ? direction === "out" && nextZoom <= midToFullZoom
              ? "full"
              : direction === "in" && nextZoom >= midToCompactZoom
                ? "compact"
                : "mid"
            : direction === "in" && nextZoom >= fullToMidZoom
              ? "mid"
              : "full";

      setImmersiveHeaderPhase(nextPhase);
    },
    [isMobileViewport, setImmersiveHeaderPhase],
  );

  const scheduleImmersiveHeaderZoomSettle = useCallback((direction: World2ImmersiveZoomDirection) => {
    if (!isMobileViewport) return;
    immersiveHeaderZoomDirectionRef.current = direction;
    if (immersiveHeaderSettleTimerRef.current !== null) {
      window.clearTimeout(immersiveHeaderSettleTimerRef.current);
    }

    immersiveHeaderSettleTimerRef.current = window.setTimeout(() => {
      immersiveHeaderSettleTimerRef.current = null;
      syncImmersiveHeaderToSettledZoom(targetCameraRef.current.zoom, immersiveHeaderZoomDirectionRef.current);
    }, WORLD2_IMMERSIVE_HEADER_SETTLE_MS);
  }, [isMobileViewport, syncImmersiveHeaderToSettledZoom]);

  useEffect(() => {
    const syncMobileViewport = () => {
      const vvWidth = window.visualViewport?.width ?? 0;
      const width = Math.max(window.innerWidth, document.documentElement.clientWidth, vvWidth);
      setIsMobileViewport(width <= 760 || isIPadExperience);
    };

    syncMobileViewport();
    window.addEventListener("resize", syncMobileViewport);
    window.visualViewport?.addEventListener("resize", syncMobileViewport);
    return () => {
      window.removeEventListener("resize", syncMobileViewport);
      window.visualViewport?.removeEventListener("resize", syncMobileViewport);
    };
  }, [isIPadExperience]);

  useEffect(() => {
    layoutRadiusRef.current = layout.radius;
  }, [layout.radius]);

  useEffect(() => {
    if (!isMobileViewport) return;
    immersiveHeaderBaseZoomRef.current = Math.max(MIN_ZOOM, targetCameraRef.current.zoom || MIN_ZOOM);
    setImmersiveHeaderPhase("full");
  }, [isMobileViewport, setImmersiveHeaderPhase]);

  useEffect(() => {
    if (!isMobileViewport) return;
    return () => {
      if (immersiveHeaderSettleTimerRef.current !== null) {
        window.clearTimeout(immersiveHeaderSettleTimerRef.current);
        immersiveHeaderSettleTimerRef.current = null;
      }
      setImmersiveHeaderPhase("full");
    };
  }, [isMobileViewport, setImmersiveHeaderPhase]);

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
    immersiveHeaderBaseZoomRef.current = zoom;
    const mobileInitialPanLiftPx = isSafariBrowser
      ? WORLD2_MOBILE_INITIAL_PAN_LIFT_SAFARI_PX
      : WORLD2_MOBILE_INITIAL_PAN_LIFT_PX;
    const clampedPan = clampPanToBounds(
      0,
      isMobileViewport ? -mobileInitialPanLiftPx : 0,
      zoom,
    );
    const fitted = { panX: clampedPan.panX, panY: clampedPan.panY, zoom };
    velocityRef.current = { x: 0, y: 0 };
    cameraRef.current = fitted;
    targetCameraRef.current = fitted;
    setCamera(fitted);
    setIsCameraReady(true);
  }, [clampPanToBounds, isMobileViewport, isSafariBrowser, layout.radius]);

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

  const zoomAtPointDirect = useCallback((clientX: number, clientY: number, factor: number) => {
    if (isReturnInteractionLocked) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const { centerX: cx, centerY: cy } = getContentViewportFrame(container);

    const current = cameraRef.current;
    const wx = (sx - (cx + current.panX)) / current.zoom;
    const wy = (sy - (cy + current.panY)) / current.zoom;
    const zoom = clamp(MIN_ZOOM, current.zoom * factor, MAX_ZOOM);
    const panX = sx - cx - wx * zoom;
    const panY = sy - cy - wy * zoom;
    const clampedPan = clampPanToBounds(panX, panY, zoom);
    applyDirectCamera({ panX: clampedPan.panX, panY: clampedPan.panY, zoom });
  }, [applyDirectCamera, clampPanToBounds, isReturnInteractionLocked]);

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
    dragRef.current.pointerType = null;
    dragRef.current.moved = false;
    dragRef.current.lastT = 0;
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
        scheduleImmersiveHeaderZoomSettle(factor >= 1 ? "in" : "out");
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
      dragRef.current.pointerType = "mouse";
      dragRef.current.moved = false;
      dragRef.current.startX = event.clientX;
      dragRef.current.startY = event.clientY;
      dragRef.current.lastX = event.clientX;
      dragRef.current.lastY = event.clientY;
      dragRef.current.lastT = performance.now();
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
  }, [
    clampPanToBounds,
    isMobileViewport,
    isReturnInteractionLocked,
    scheduleImmersiveHeaderZoomSettle,
    startAnimation,
    zoomAtPoint,
  ]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isReturnInteractionLocked) {
      event.preventDefault();
      return;
    }
    if (pinchRef.current.active) return;
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
    dragRef.current.pointerType = event.pointerType;
    dragRef.current.moved = false;
    dragRef.current.startX = event.clientX;
    dragRef.current.startY = event.clientY;
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;
    dragRef.current.lastT = performance.now();
    velocityRef.current = { x: 0, y: 0 };
    draggingRef.current = false;
    setDragging(false);
  }, [isReturnInteractionLocked]);

  const applyDragMove = useCallback((clientX: number, clientY: number, pointerId: number | null) => {
    if (pinchRef.current.active) return;
    const drag = dragRef.current;
    if (!drag.active) return;
    if (pointerId !== null && drag.pointerId !== null && drag.pointerId !== pointerId) return;

    const movedDistance = Math.hypot(clientX - drag.startX, clientY - drag.startY);
    const moveThresholdPx =
      isMobileViewport && drag.pointerId !== null ? DRAG_CLICK_THRESHOLD_TOUCH_PX : DRAG_CLICK_THRESHOLD_PX;
    if (!drag.moved && movedDistance > moveThresholdPx) {
      drag.moved = true;
      draggingRef.current = true;
      setDragging(true);
    }
    if (!drag.moved) {
      return;
    }

    const now = performance.now();
    const rawDx = clientX - drag.lastX;
    const rawDy = clientY - drag.lastY;
    const elapsedMs = drag.lastT > 0 ? clamp(8, now - drag.lastT, 48) : FRAME_MS;
    const isMobileTouchDrag = isMobileViewport && drag.pointerType === "touch";
    const target = targetCameraRef.current;
    const container = containerRef.current;
    const frameWidth = container ? getContentViewportFrame(container).width : MOBILE_DRAG_REFERENCE_WIDTH;
    const screenGain = isMobileTouchDrag
      ? clamp(0.94, MOBILE_DRAG_REFERENCE_WIDTH / Math.max(frameWidth, 1), 1.16)
      : 1;
    const baseZoom = Math.max(MIN_ZOOM, immersiveHeaderBaseZoomRef.current || MIN_ZOOM);
    const zoomGain = isMobileTouchDrag
      ? clamp(0.96, 1 + (target.zoom / baseZoom - 1) * 0.1, 1.34)
      : 1;
    const panGain = isMobileTouchDrag ? MOBILE_DRAG_PAN_GAIN * screenGain * zoomGain : 1;
    const dx = rawDx * panGain;
    const dy = rawDy * panGain;
    drag.lastX = clientX;
    drag.lastY = clientY;
    drag.lastT = now;
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
    if (isMobileTouchDrag) {
      startAnimation();
    } else {
      // Keep desktop drag start/move immediate; inertia still runs after pointer up.
      applyDirectCamera(nextTarget);
    }
    const previousVelocity = velocityRef.current;
    if (isMobileTouchDrag) {
      const velocityScale = (FRAME_MS / elapsedMs) * MOBILE_DRAG_VELOCITY_GAIN;
      const nextVelocityX = clamp(-MOBILE_DRAG_VELOCITY_MAX, dx * velocityScale, MOBILE_DRAG_VELOCITY_MAX);
      const nextVelocityY = clamp(-MOBILE_DRAG_VELOCITY_MAX, dy * velocityScale, MOBILE_DRAG_VELOCITY_MAX);
      velocityRef.current = {
        x: previousVelocity.x * MOBILE_DRAG_VELOCITY_BLEND + nextVelocityX * (1 - MOBILE_DRAG_VELOCITY_BLEND),
        y: previousVelocity.y * MOBILE_DRAG_VELOCITY_BLEND + nextVelocityY * (1 - MOBILE_DRAG_VELOCITY_BLEND),
      };
    } else {
      velocityRef.current = {
        x: previousVelocity.x * 0.35 + dx * 0.65,
        y: previousVelocity.y * 0.35 + dy * 0.65,
      };
    }
  }, [applyDirectCamera, clampPanToBounds, isMobileViewport, startAnimation]);

  const finishDrag = useCallback((pointerId: number | null) => {
    const drag = dragRef.current;
    if (!drag.active) return false;
    if (pointerId !== null && drag.pointerId !== null && drag.pointerId !== pointerId) return false;

    const hadCapture = drag.captured;
    drag.active = false;
    drag.pointerId = null;
    drag.pointerType = null;
    if (drag.moved) {
      suppressClickRef.current = true;
      window.requestAnimationFrame(() => {
        suppressClickRef.current = false;
      });
    }
    drag.moved = false;
    drag.captured = false;
    drag.lastT = 0;
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
    if (pinchRef.current.active) {
      event.preventDefault();
      return;
    }
    applyDragMove(event.clientX, event.clientY, event.pointerId);
  }, [applyDragMove, isReturnInteractionLocked]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pinchRef.current.active) return;
    const hadCapture = finishDrag(event.pointerId);
    if (hadCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [finishDrag]);

  const getTouchDistance = (touches: ReactTouchEvent<HTMLDivElement>["touches"]) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const getTouchMidpoint = (touches: ReactTouchEvent<HTMLDivElement>["touches"]) => ({
    x: (touches[0].clientX + touches[1].clientX) * 0.5,
    y: (touches[0].clientY + touches[1].clientY) * 0.5,
  });

  const handleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (isReturnInteractionLocked) {
      event.preventDefault();
      return;
    }
    if (event.touches.length < 2) return;

    const distance = getTouchDistance(event.touches);
    if (distance <= 0) return;

    hasInteractedRef.current = true;
    finishDrag(null);
    pinchRef.current.active = true;
    pinchRef.current.lastDistance = distance;
    event.preventDefault();
  }, [finishDrag, isReturnInteractionLocked]);

  const handleTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (!pinchRef.current.active) return;
    if (isReturnInteractionLocked) {
      event.preventDefault();
      return;
    }
    if (event.touches.length < 2) {
      pinchRef.current.active = false;
      pinchRef.current.lastDistance = 0;
      return;
    }

    const distance = getTouchDistance(event.touches);
    const lastDistance = pinchRef.current.lastDistance;
    if (distance <= 0 || lastDistance <= 0) return;

    const factor = clamp(PINCH_ZOOM_MIN_FACTOR, distance / lastDistance, PINCH_ZOOM_MAX_FACTOR);
    const midpoint = getTouchMidpoint(event.touches);
    zoomAtPointDirect(midpoint.x, midpoint.y, factor);
    if (isMobileViewport) {
      scheduleImmersiveHeaderZoomSettle(factor >= 1 ? "in" : "out");
    }
    pinchRef.current.lastDistance = distance;
    event.preventDefault();
  }, [isMobileViewport, isReturnInteractionLocked, scheduleImmersiveHeaderZoomSettle, zoomAtPointDirect]);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current.active = false;
    pinchRef.current.lastDistance = 0;
    scheduleImmersiveHeaderZoomSettle(immersiveHeaderZoomDirectionRef.current);
  }, [scheduleImmersiveHeaderZoomSettle]);

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
      if (interactionCommitRafRef.current !== null) {
        window.cancelAnimationFrame(interactionCommitRafRef.current);
      }
      if (immersiveHeaderSettleTimerRef.current !== null) {
        window.clearTimeout(immersiveHeaderSettleTimerRef.current);
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
    if (!isMobileExperience) {
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
    } else {
      try {
        window.sessionStorage.removeItem("unseen:product-view-transition");
        window.sessionStorage.removeItem("unseen:product-view-text-transition");
        window.sessionStorage.removeItem("unseen:return-focus-item");
        window.sessionStorage.removeItem("unseen:return-flight-finished-flag");
        document.getElementById("unseen-product-transition-source-hold")?.remove();
      } catch {
        // Transition is optional; ignore storage failures.
      }
    }

    if (!isMobileExperience && containerRect) {
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

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        router.push(productViewHref);
      });
    });
  }, [
    backHref,
    buildProductViewHref,
    currentHref,
    effectiveActiveCategory,
    isMobileExperience,
    isReturnInteractionLocked,
    mode,
    router,
  ]);

  const centerX = "50%";
  const mobileCenterLiftPx = isSafariBrowser ? WORLD2_MOBILE_CENTER_LIFT_SAFARI_PX : WORLD2_MOBILE_CENTER_LIFT_PX;
  const centerY = isMobileViewport
    ? `calc(var(--immersive-sticky-h, var(--sticky-h)) + (100% - var(--immersive-sticky-h, var(--sticky-h))) / 2 - ${mobileCenterLiftPx}px)`
    : "calc(var(--sticky-h) + (100% - var(--sticky-h)) / 2)";

  if (items.length === 0 || visibleItems.length === 0) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center md:min-h-[420px]">
        <p className="text-[14px] font-medium tracking-[0.03em] text-meta">No items available.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-immersive-zoom-zone="true"
      className="relative h-full min-h-0 w-full overflow-x-hidden overflow-y-visible md:min-h-[420px] md:overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
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
      {showCategoryNav && !isMobileViewport ? (
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

      {showCategoryNav && isMobileViewport ? (
        <MobileFloatingCategoryPill
          ariaLabel="Immersive categories"
          options={navOptions}
          activeKey={effectiveActiveCategory}
          focusCueLabel={
            mode === "gallery" && editParam === "edit1a" && effectiveActiveCategory === "OUTER"
              ? "Based on broader aesthetic cues"
              : undefined
          }
          onSelect={(key) => {
            if (isReturnInteractionLocked) return;
            setActiveCategory(key as World2CategoryKey | "all");
            hasInteractedRef.current = false;
          }}
        />
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
            eagerImageCount={eagerImageCount}
            entry={entry}
            index={index}
            isSafari={isSafariBrowser}
            renderScale={tileRenderScale}
            onItemWarm={warmProductTransition}
            onItemClick={handleItemClick}
          />
        ))}
      </div>

    </div>
  );
}
