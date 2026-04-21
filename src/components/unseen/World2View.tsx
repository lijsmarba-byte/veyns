"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MockCatalogItem } from "@/data/mockCatalog";
import { World2CategoryNav } from "@/components/unseen/World2CategoryNav";

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
const PAN_VISIBLE_MARGIN_MIN = 44;
const PAN_VISIBLE_MARGIN_MAX = 200;
const PAN_VISIBLE_MARGIN_FACTOR = 0.18;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dragging, setDragging] = useState(false);
  const [camera, setCamera] = useState<Camera>({ panX: 0, panY: 0, zoom: 1 });
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isReturnRevealReady, setIsReturnRevealReady] = useState(false);
  const [isReturnInteractionReady, setIsReturnInteractionReady] = useState(false);
  const isReturnInteractionLocked = !isReturnInteractionReady;
  const [returnRevealFadeMs, setReturnRevealFadeMs] = useState(220);
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

  useLayoutEffect(() => {
    let revealTimerId: number | null = null;
    let interactionTimerId: number | null = null;
    setIsReturnRevealReady(false);
    setIsReturnInteractionReady(false);

    const scheduleReady = (revealDelayMs: number, interactionDelayMs: number, fadeMs: number) => {
      const safeFade = Math.min(480, Math.max(120, fadeMs));
      window.requestAnimationFrame(() => {
        setReturnRevealFadeMs(safeFade);
      });

      if (revealDelayMs <= 0) {
        window.requestAnimationFrame(() => {
          setIsReturnRevealReady(true);
        });
      } else {
        revealTimerId = window.setTimeout(() => {
          setIsReturnRevealReady(true);
        }, revealDelayMs);
      }

      if (interactionDelayMs <= 0) {
        window.requestAnimationFrame(() => {
          setIsReturnInteractionReady(true);
        });
      } else {
        interactionTimerId = window.setTimeout(() => {
          setIsReturnInteractionReady(true);
        }, interactionDelayMs);
      }
    };

    try {
      const raw = window.sessionStorage.getItem(WORLD2_RETURN_REVEAL_KEY);
      if (!raw) {
        scheduleReady(0, 0, 220);
        return () => {
          if (revealTimerId !== null) window.clearTimeout(revealTimerId);
          if (interactionTimerId !== null) window.clearTimeout(interactionTimerId);
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
        scheduleReady(0, 0, 220);
      } else {
        scheduleReady(revealDelayMs, interactionDelayMs, fadeMs);
      }
      window.sessionStorage.removeItem(WORLD2_RETURN_REVEAL_KEY);
    } catch {
      scheduleReady(0, 0, 220);
    }

    return () => {
      if (revealTimerId !== null) window.clearTimeout(revealTimerId);
      if (interactionTimerId !== null) window.clearTimeout(interactionTimerId);
    };
  }, [currentHref]);

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
    try {
      const payload: World2CameraStatePayload = {
        at: Date.now(),
        href: currentHref,
        mode,
        activeCategory: effectiveActiveCategory,
        camera: targetCameraRef.current,
      };
      window.sessionStorage.setItem(WORLD2_CAMERA_STATE_KEY, JSON.stringify(payload));
    } catch {
      // Optional restore convenience only.
    }
  }, [camera, currentHref, effectiveActiveCategory, isCameraReady, mode]);

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

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
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

    hasInteractedRef.current = true;
    dragRef.current.active = true;
    dragRef.current.captured = false;
    dragRef.current.pointerId = event.pointerId;
    dragRef.current.moved = false;
    dragRef.current.startX = event.clientX;
    dragRef.current.startY = event.clientY;
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;
    velocityRef.current = { x: 0, y: 0 };
    draggingRef.current = true;
    setDragging(true);
  }, [isReturnInteractionLocked]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isReturnInteractionLocked) {
      event.preventDefault();
      return;
    }
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const movedDistance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moved && movedDistance > DRAG_CLICK_THRESHOLD_PX) {
      drag.moved = true;
      if (!drag.captured) {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.captured = true;
      }
    }
    if (!drag.moved) {
      return;
    }

    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
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
  }, [clampPanToBounds, isReturnInteractionLocked]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isReturnInteractionLocked) {
      event.preventDefault();
      return;
    }
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

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
    startAnimation();
    if (hadCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [isReturnInteractionLocked, startAnimation]);

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

    router.push(productViewHref);
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
          style={{ top: "calc(var(--sticky-h) + (var(--viewport-h) - var(--sticky-h)) / 2 - 32px)" }}
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
          transform: `translate3d(${camera.panX}px, ${camera.panY}px, 0)`,
          transformOrigin: "0 0",
          willChange: "transform",
          opacity: isCameraReady && isReturnRevealReady ? 1 : 0,
          transition: `opacity ${returnRevealFadeMs}ms ease-out`,
        }}
      >
        {layout.items.map((entry, index) => (
          <button
            key={entry.id}
            className="absolute overflow-hidden"
            style={{
              left: entry.x * camera.zoom - (entry.size * camera.zoom) * 0.5,
              top: entry.y * camera.zoom - (entry.size * camera.zoom) * 0.5,
              width: entry.size * camera.zoom,
              height: entry.size * camera.zoom,
              pointerEvents: "auto",
              cursor: "pointer",
            }}
            type="button"
            aria-label={`${entry.item.brand} ${entry.item.artsyName}`}
            onClick={(event) => {
              event.stopPropagation();
              handleItemClick(entry, event.currentTarget);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- native img keeps deep-zoom detail crisp in this dense canvas */}
            <img
              src={entry.item.imgSrc}
              alt={`${entry.item.brand} ${entry.item.artsyName}`}
              className="h-full w-full object-contain"
              draggable={false}
              loading={index < 20 ? "eager" : "lazy"}
              decoding="async"
            />
          </button>
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
