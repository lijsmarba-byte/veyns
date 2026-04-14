"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Image from "next/image";
import { ProductActionRow } from "@/components/unseen/ProductActionRow";
import type { MockCatalogItem } from "@/data/mockCatalog";

export type WorldCategoryKey = "OUTER" | "UPPER" | "LOWER" | "SILHOUETTE" | "GROUND" | "ARTIFACTS";

export type WorldViewItem = {
  item: MockCatalogItem;
  categoryKey: WorldCategoryKey;
  categoryLabel: string;
};

type WorldRenderItem = WorldViewItem & {
  displayId: string;
  w: number;
  h: number;
  x0: number;
  y0: number;
  ratio: number;
};

export type WorldViewProps = {
  items: WorldViewItem[];
  mode: "gallery" | "archive";
};

type CameraState = {
  panX: number;
  panY: number;
  zoom: number;
};

const CATEGORY_ORDER: WorldCategoryKey[] = [
  "OUTER",
  "UPPER",
  "LOWER",
  "SILHOUETTE",
  "GROUND",
  "ARTIFACTS",
];

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const WORLD_DUPLICATE_MULTIPLIER = 3;
const DRAG_THRESHOLD_PX = 5;

// Disc layout
const THUMB = 20;
const GAP = 8;
const STEP = THUMB + GAP;

// Motion
const ROT_WHEEL_FACTOR = 0.000065;
const ROT_DRAG_FACTOR = 0.0009;
const ROT_FRICTION = 0.9;

// Camera smoothing
const CAMERA_SMOOTH = 0.18;
const CAMERA_EPS_PAN = 0.08;
const CAMERA_EPS_ZOOM = 0.0006;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 4.0;

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(a: number, b: number, x: number) {
  const t = clamp(0, (x - a) / (b - a), 1);
  return t * t * (3 - 2 * t);
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

function formatPipeLabel(label: string) {
  return label.replace(/^\[/, "").replace(/\]$/, "");
}

function buildRenderableItems(items: WorldViewItem[]) {
  const expanded = items
    .flatMap((entry) =>
      Array.from({ length: WORLD_DUPLICATE_MULTIPLIER }, (_, copyIndex) => {
        const displayId = `${entry.item.id}__${entry.categoryKey}__w${copyIndex + 1}`;
        return {
          ...entry,
          displayId,
          w: THUMB,
          h: THUMB,
          x0: 0,
          y0: 0,
          ratio: 0,
        };
      }),
    )
    .sort((a, b) => {
      const da = seededNoise(a.displayId, 909);
      const db = seededNoise(b.displayId, 909);
      if (da !== db) return da - db;
      if (a.displayId < b.displayId) return -1;
      if (a.displayId > b.displayId) return 1;
      return 0;
    });

  const n = expanded.length;
  const theta0 = seededNoise("world-seed", 331) * Math.PI * 2;
  const radius = STEP * Math.sqrt(Math.max(1, n));
  let sumX = 0;
  let sumY = 0;

  for (let i = 0; i < n; i += 1) {
    const t = (i + 0.5) / Math.max(1, n);
    const r = radius * Math.sqrt(t);
    const theta = theta0 + i * GOLDEN_ANGLE;
    const x0 = r * Math.cos(theta);
    const y0 = r * Math.sin(theta);
    expanded[i].x0 = x0;
    expanded[i].y0 = y0;
    sumX += x0;
    sumY += y0;
  }

  const meanX = sumX / Math.max(1, n);
  const meanY = sumY / Math.max(1, n);

  for (let i = 0; i < n; i += 1) {
    expanded[i].x0 -= meanX;
    expanded[i].y0 -= meanY;
    expanded[i].ratio = clamp(0, Math.hypot(expanded[i].x0, expanded[i].y0) / Math.max(1, radius), 1);
  }

  return {
    items: expanded,
    radius,
  };
}

type WorldProductModalProps = {
  entry: WorldRenderItem | null;
  mode: "gallery" | "archive";
  onClose: () => void;
  visible: boolean;
};

function WorldProductModal({ entry, mode, onClose, visible }: WorldProductModalProps) {
  useEffect(() => {
    if (!visible) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, visible]);

  if (!entry) return null;

  const titleToneClass = mode === "archive" ? "text-accent" : "text-ink";

  return (
    <div
      className={`fixed inset-0 z-[180] flex items-center justify-center p-4 transition-opacity duration-300 sm:p-8 ${
        visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(245, 243, 240, 0.86)",
        fontFamily: "\"DM Sans\", var(--font-ui-sans), sans-serif",
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`relative w-full max-w-[1720px] overflow-auto rounded-[8px] border border-[#ececef] bg-[#fefefd] transition-all duration-400 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-[16px] scale-[0.985] opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.item.brand} ${entry.item.artsyName}`}
        style={{ maxHeight: "min(92vh, 980px)" }}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-10 p-1 text-[30px] font-normal leading-none tracking-[0.02em] text-meta transition-colors hover:text-ink"
          aria-label="Close product detail"
          type="button"
        >
          ×
        </button>

        <section data-pv-shell="true" className="relative w-full px-8 py-12 sm:px-12 md:px-16 lg:px-20">
          <div className="grid grid-cols-1 gap-12 lg:min-h-[640px] lg:grid-cols-[minmax(360px,620px)_minmax(420px,1fr)] lg:items-start lg:gap-20">
            <div className="pt-2">
              <h2 className={`inline-flex w-full max-w-[560px] items-center justify-start text-left text-[28px] leading-none ${titleToneClass}`}>
                <span className={`inline-flex items-center text-[25px] font-normal tracking-[-0.05em] ${titleToneClass}`}>
                  <span aria-hidden="true" className="text-[24px] leading-none">|</span>
                  <span className="px-[2px]">{formatPipeLabel(entry.item.idxLabel)}</span>
                  <span aria-hidden="true" className="text-[24px] leading-none">|</span>
                </span>
                <span className={`-ml-[2px] px-[2px] text-[25px] font-normal tracking-[-0.05em] ${titleToneClass}`}>–</span>
                <span className="ml-[1px] font-instrument italic tracking-[0.01em]">{entry.item.artsyName}</span>
              </h2>

              <div className="mt-20 flex w-full max-w-[560px] flex-col gap-10">
                <div className="flex w-full items-center justify-between text-[14px] font-medium leading-5 tracking-[0.02em] text-meta">
                  <p>{entry.item.brand}</p>
                  <p className="text-right">{entry.item.price}</p>
                </div>

                <p className="text-left text-[14px] font-normal leading-8 tracking-[0.02em] text-ink">
                  {entry.item.artsyDesc}
                </p>

                <div>
                  <ProductActionRow itemId={entry.item.id} mode={mode} editId={null} />
                </div>
              </div>
            </div>

            <div className="relative flex min-h-[380px] items-start justify-center lg:min-h-[560px]">
              <Image
                src={entry.item.imgSrc}
                alt={`${entry.item.brand} ${entry.item.artsyName}`}
                width={1120}
                height={740}
                className="h-auto w-full max-w-[880px] object-contain"
                sizes="(max-width: 1024px) 86vw, 52vw"
                priority
                draggable={false}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function WorldView({ items, mode }: WorldViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldLayerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const frameRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  const camRef = useRef<CameraState>({ panX: 0, panY: 0, zoom: 1 });
  const camTargetRef = useRef<CameraState>({ panX: 0, panY: 0, zoom: 1 });
  const phaseRef = useRef(0);
  const velocityRef = useRef(0);
  const hasInteractedRef = useRef(false);

  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
  });

  const closeTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const [dragging, setDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [modalEntry, setModalEntry] = useState<WorldRenderItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<WorldCategoryKey | "all">("all");

  const categoryMeta = useMemo(() => {
    const map = new Map<WorldCategoryKey, { count: number; label: string }>();
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

  const visibleItems = useMemo(
    () =>
      normalizedActiveCategory === "all"
        ? items
        : items.filter((entry) => entry.categoryKey === normalizedActiveCategory),
    [items, normalizedActiveCategory],
  );

  const layout = useMemo(() => buildRenderableItems(visibleItems), [visibleItems]);

  const applyLayerTransform = useCallback(() => {
    const container = containerRef.current;
    const layer = worldLayerRef.current;
    if (!container || !layer) return;

    const cx = container.clientWidth * 0.5;
    const cy = container.clientHeight * 0.5;
    const cam = camRef.current;

    layer.style.transform = `translate3d(${cx + cam.panX}px, ${cy + cam.panY}px, 0) scale(${cam.zoom})`;
  }, []);

  const renderPositions = useCallback(() => {
    const count = layout.items.length;
    const phase = phaseRef.current;
    const cos = Math.cos(phase);
    const sin = Math.sin(phase);

    for (let i = 0; i < count; i += 1) {
      const entry = layout.items[i];
      const element = itemRefs.current[i];
      if (!element) continue;

      const x = entry.x0 * cos - entry.y0 * sin;
      const y = entry.x0 * sin + entry.y0 * cos;

      const isFocused = focusedId === entry.displayId;
      const isHovered = hoveredId === entry.displayId;
      const focusFade = focusedId && !isFocused ? 0.55 : 1;
      const fade = 1 - smoothstep(0.78, 1.0, entry.ratio) * 0.7;
      const opacity = clamp(0.15, fade * focusFade, 1);

      let z = 1000 - Math.round(entry.ratio * 800) + (isFocused ? 2000 : 0);
      if (isHovered) z += 1200;

      element.style.transform = `translate3d(${x - entry.w * 0.5}px, ${y - entry.h * 0.5}px, 0)`;
      element.style.opacity = String(opacity);
      element.style.zIndex = String(z);
    }
  }, [focusedId, hoveredId, layout.items]);

  const startAnimation = useCallback(() => {
    if (frameRef.current !== null) return;

    const tick = (ts: number) => {
      const lastTs = lastTsRef.current || ts;
      const dt = clamp(0.3, (ts - lastTs) / 16.6667, 2.4);
      lastTsRef.current = ts;

      velocityRef.current *= Math.pow(ROT_FRICTION, dt);
      if (Math.abs(velocityRef.current) < 0.00001) velocityRef.current = 0;
      phaseRef.current += velocityRef.current * dt;

      const cam = camRef.current;
      const target = camTargetRef.current;
      cam.panX += (target.panX - cam.panX) * CAMERA_SMOOTH;
      cam.panY += (target.panY - cam.panY) * CAMERA_SMOOTH;
      cam.zoom += (target.zoom - cam.zoom) * CAMERA_SMOOTH;

      applyLayerTransform();
      renderPositions();

      const camSettled =
        Math.abs(target.panX - cam.panX) < CAMERA_EPS_PAN &&
        Math.abs(target.panY - cam.panY) < CAMERA_EPS_PAN &&
        Math.abs(target.zoom - cam.zoom) < CAMERA_EPS_ZOOM;
      const rotSettled = Math.abs(velocityRef.current) < 0.00001;

      if (camSettled && rotSettled) {
        camRef.current = { ...target };
        applyLayerTransform();
        renderPositions();
        frameRef.current = null;
        return;
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
  }, [applyLayerTransform, renderPositions]);

  const fitToViewport = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w < 2 || h < 2) return;

    const fitZoom =
      0.92 * Math.min(w, h) / (2 * (layout.radius + THUMB));

    const zoom = clamp(MIN_ZOOM, fitZoom, MAX_ZOOM);
    const fitted = { panX: 0, panY: 0, zoom };
    camRef.current = fitted;
    camTargetRef.current = fitted;
    velocityRef.current = 0;

    applyLayerTransform();
    renderPositions();
  }, [applyLayerTransform, layout.radius, renderPositions]);

  useLayoutEffect(() => {
    applyLayerTransform();
    renderPositions();
  }, [applyLayerTransform, renderPositions]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (!hasInteractedRef.current) fitToViewport();
      else {
        applyLayerTransform();
        renderPositions();
      }
    });

    observer.observe(container);
    const raf = window.requestAnimationFrame(() => {
      if (!hasInteractedRef.current) fitToViewport();
      else {
        applyLayerTransform();
        renderPositions();
      }
    });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, [applyLayerTransform, fitToViewport, renderPositions]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (modalVisible) return;

      hasInteractedRef.current = true;
      const target = camTargetRef.current;

      if (event.ctrlKey || event.metaKey) {
        const rect = container.getBoundingClientRect();
        const sx = event.clientX - rect.left;
        const sy = event.clientY - rect.top;
        const cx = container.clientWidth * 0.5;
        const cy = container.clientHeight * 0.5;

        const wx = (sx - (cx + target.panX)) / target.zoom;
        const wy = (sy - (cy + target.panY)) / target.zoom;

        const factor = Math.exp(-event.deltaY * CAMERA_ZOOM_WHEEL_STRENGTH);
        const zoomTarget = clamp(MIN_ZOOM, target.zoom * factor, MAX_ZOOM);

        target.zoom = zoomTarget;
        target.panX = sx - cx - wx * zoomTarget;
        target.panY = sy - cy - wy * zoomTarget;
      } else {
        const delta = event.deltaY + event.deltaX * 0.6;
        velocityRef.current += delta * ROT_WHEEL_FACTOR;
      }

      startAnimation();
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [modalVisible, startAnimation]);

  const handleMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || modalVisible) return;

    hasInteractedRef.current = true;
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
    };
  }, [modalVisible]);

  useEffect(() => {
    const handleWindowMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag.active || modalVisible) return;

      const dxStart = event.clientX - drag.startX;
      const dyStart = event.clientY - drag.startY;

      if (!drag.moved) {
        if (Math.hypot(dxStart, dyStart) <= DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        setDragging(true);
      }

      const dx = event.clientX - drag.lastX;
      drag.lastX = event.clientX;

      velocityRef.current += -dx * ROT_DRAG_FACTOR;
      startAnimation();
    };

    const handleWindowMouseUp = () => {
      const drag = dragRef.current;
      if (!drag.active) return;

      drag.active = false;
      setDragging(false);

      if (drag.moved) {
        suppressClickRef.current = true;
        window.requestAnimationFrame(() => {
          suppressClickRef.current = false;
        });
      }

      drag.moved = false;
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [modalVisible, startAnimation]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  const handleCategoryChange = useCallback((next: WorldCategoryKey | "all") => {
    setHoveredId(null);
    setFocusedId(null);
    setModalVisible(false);
    setModalEntry(null);
    setActiveCategory(next);
    hasInteractedRef.current = false;
  }, []);

  const handleItemClick = useCallback((entry: WorldRenderItem) => {
    if (suppressClickRef.current || modalVisible) return;

    setFocusedId(entry.displayId);

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    setModalEntry(entry);
    closeTimerRef.current = window.setTimeout(() => {
      setModalVisible(true);
      closeTimerRef.current = null;
    }, 80);
  }, [modalVisible]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setFocusedId(null);

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setModalEntry(null);
      closeTimerRef.current = null;
    }, 260);
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] w-full items-center justify-center">
        <p className="text-[14px] font-medium tracking-[0.03em] text-meta">No items available.</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative h-full min-h-0 w-full">
        <aside className="pointer-events-auto absolute left-3 top-3 z-20 w-[150px]">
          <nav className="sticky top-[calc(var(--sticky-h)+24px)] flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleCategoryChange("all")}
              className={`text-left font-ui text-[12px] font-medium uppercase tracking-[0.12em] transition-colors ${
                normalizedActiveCategory === "all" ? "text-ink" : "text-meta hover:text-ink"
              }`}
            >
              All ({items.length * WORLD_DUPLICATE_MULTIPLIER})
            </button>
            {categoryMeta.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => handleCategoryChange(entry.key)}
                className={`text-left font-ui text-[12px] font-medium uppercase tracking-[0.12em] transition-colors ${
                  normalizedActiveCategory === entry.key ? "text-ink" : "text-meta hover:text-ink"
                }`}
              >
                {entry.label} ({entry.count * WORLD_DUPLICATE_MULTIPLIER})
              </button>
            ))}
          </nav>
        </aside>

        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          className="relative h-full min-h-[420px] w-full overflow-hidden"
          style={{
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
            fontFamily: "\"DM Sans\", var(--font-ui-sans), sans-serif",
          }}
        >
          <div
            ref={worldLayerRef}
            className="absolute left-0 top-0"
            style={{ transformOrigin: "0 0", willChange: "transform" }}
          >
            {layout.items.map((entry, index) => (
              <button
                key={entry.displayId}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                aria-label={`${entry.item.brand} ${entry.item.artsyName}`}
                className="absolute relative overflow-hidden"
                style={{
                  left: 0,
                  top: 0,
                  width: entry.w,
                  height: entry.h,
                  cursor: "pointer",
                  transition: "opacity 140ms ease",
                }}
                onMouseEnter={() => setHoveredId(entry.displayId)}
                onMouseLeave={() => setHoveredId((prev) => (prev === entry.displayId ? null : prev))}
                onClick={(event) => {
                  event.stopPropagation();
                  handleItemClick(entry);
                }}
              >
                <Image
                  src={entry.item.imgSrc}
                  alt={`${entry.item.brand} ${entry.item.artsyName}`}
                  fill
                  className="object-contain"
                  draggable={false}
                  sizes="22px"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <WorldProductModal entry={modalEntry} mode={mode} visible={modalVisible} onClose={handleCloseModal} />
    </>
  );
}
