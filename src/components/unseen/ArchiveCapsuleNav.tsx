"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface Tab {
  id: string;
  label: string;
}

export const defaultTabs: Tab[] = [
  { id: "main", label: "MAIN CAPSULE" },
  { id: "capsule1", label: "CAPSULE1" },
  { id: "capsule2", label: "CAPSULE2" },
  { id: "capsule3", label: "CAPSULE3" },
];

type ArchiveCapsuleNavProps = {
  tabs?: Tab[];
  targetDividerY?: number;
};

type TabGeometry = {
  containerWidth: number;
  activeLeft: number;
  activeRight: number;
  activeTop: number;
};

type ArchiveTabPaths = {
  fillPath: string;
  strokePath: string;
};

const TAB_HEIGHT = 60;
const TAB_CURVE_HEIGHT = 37;
const TAB_CURVE_OUTSET = 46;
const SVG_X_OVERSCAN = TAB_CURVE_OUTSET + 6;
const DIVIDER_COLOR = "#ECEDEF";
const DIVIDER_SHADOW_COLOR = "rgba(0,0,0,0.045)";
const DIVIDER_SHADOW_OFFSET_Y = 1;
const CURVE_HANDLE_BASE_MAX = 24;
const CURVE_HANDLE_TOP_MAX = 34;
const CURVE_HANDLE_BASE_RATIO = 0.62;
const CURVE_HANDLE_TOP_RATIO = 0.78;

function toTitleCase(value: string) {
  if (!value) return value;
  return value
    .trim()
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToPixel(value: number) {
  return Math.round(value);
}

function buildArchiveTabPaths(
  containerWidth: number,
  activeLeft: number,
  activeRight: number,
  targetDividerY: number,
  activeTop: number,
): ArchiveTabPaths {
  const baselineY = roundToPixel(Math.max(1, targetDividerY - activeTop));
  const topY = roundToPixel(Math.max(1, baselineY - TAB_CURVE_HEIGHT));
  const minX = roundToPixel(-SVG_X_OVERSCAN);
  const maxX = roundToPixel(containerWidth + SVG_X_OVERSCAN);
  const clampedActiveLeft = clamp(activeLeft, 0.5, containerWidth - 0.5);
  const clampedActiveRight = clamp(activeRight, clampedActiveLeft + 1, containerWidth - 0.5);
  const leftBase = clamp(clampedActiveLeft - TAB_CURVE_OUTSET, minX, maxX);
  const rightBase = clamp(clampedActiveRight + TAB_CURVE_OUTSET, minX, maxX);
  const leftSpan = Math.max(1, clampedActiveLeft - leftBase);
  const rightSpan = Math.max(1, rightBase - clampedActiveRight);
  const leftHandleBase = Math.min(CURVE_HANDLE_BASE_MAX, leftSpan * CURVE_HANDLE_BASE_RATIO);
  const leftHandleTop = Math.min(CURVE_HANDLE_TOP_MAX, leftSpan * CURVE_HANDLE_TOP_RATIO);
  const rightHandleTop = Math.min(CURVE_HANDLE_TOP_MAX, rightSpan * CURVE_HANDLE_TOP_RATIO);
  const rightHandleBase = Math.min(CURVE_HANDLE_BASE_MAX, rightSpan * CURVE_HANDLE_BASE_RATIO);
  const rightStrokeEdge = maxX;

  const fillPath = [
    `M ${leftBase} ${baselineY}`,
    `C ${leftBase + leftHandleBase} ${baselineY}, ${clampedActiveLeft - leftHandleTop} ${topY}, ${clampedActiveLeft} ${topY}`,
    `L ${clampedActiveRight} ${topY}`,
    `C ${clampedActiveRight + rightHandleTop} ${topY}, ${rightBase - rightHandleBase} ${baselineY}, ${rightBase} ${baselineY}`,
    `L ${leftBase} ${baselineY}`,
    "Z",
  ].join(" ");

  const strokePath = [
    `M ${minX} ${baselineY}`,
    `L ${leftBase} ${baselineY}`,
    `C ${leftBase + leftHandleBase} ${baselineY}, ${clampedActiveLeft - leftHandleTop} ${topY}, ${clampedActiveLeft} ${topY}`,
    `L ${clampedActiveRight} ${topY}`,
    `C ${clampedActiveRight + rightHandleTop} ${topY}, ${rightBase - rightHandleBase} ${baselineY}, ${rightBase} ${baselineY}`,
    `L ${rightStrokeEdge} ${baselineY}`,
  ].join(" ");

  return { fillPath, strokePath };
}

export function ArchiveCapsuleNav({ tabs = defaultTabs, targetDividerY = 50 }: ArchiveCapsuleNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tabGeometry, setTabGeometry] = useState<TabGeometry | null>(null);
  const svgIdPrefix = useId().replace(/:/g, "");
  const defaultTab = tabs[0]?.id ?? "";
  const capsuleParam = searchParams.get("capsule");
  const resolvedActiveTab = capsuleParam && tabs.some((tab) => tab.id === capsuleParam)
    ? capsuleParam
    : defaultTab;

  const setActiveTab = (tabId: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (tabId === defaultTab) {
      nextParams.delete("capsule");
    } else {
      nextParams.set("capsule", tabId);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frameId = 0;

    const measure = () => {
      const activeButton = buttonRefs.current[resolvedActiveTab];
      if (!activeButton) return;

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeButton.getBoundingClientRect();
      const maxWidth = Math.max(1, Math.round(containerRect.width));
      const nextGeometry: TabGeometry = {
        containerWidth: maxWidth,
        activeLeft: roundToPixel(clamp(activeRect.left - containerRect.left, 1, maxWidth - 1)),
        activeRight: roundToPixel(clamp(activeRect.right - containerRect.left, 1, maxWidth - 1)),
        activeTop: roundToPixel(Math.max(0, activeRect.top - containerRect.top)),
      };

      setTabGeometry((current) => {
        if (
          current &&
          current.containerWidth === nextGeometry.containerWidth &&
          current.activeLeft === nextGeometry.activeLeft &&
          current.activeRight === nextGeometry.activeRight &&
          current.activeTop === nextGeometry.activeTop
        ) {
          return current;
        }
        return nextGeometry;
      });
    };

    const queueMeasure = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measure);
    };

    queueMeasure();

    const observer = new ResizeObserver(queueMeasure);
    observer.observe(container);
    const activeButton = buttonRefs.current[resolvedActiveTab];
    if (activeButton) observer.observe(activeButton);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [resolvedActiveTab, tabs]);

  const tabPaths = useMemo(() => {
    if (!tabGeometry) return null;
    return buildArchiveTabPaths(
      tabGeometry.containerWidth,
      tabGeometry.activeLeft,
      tabGeometry.activeRight,
      targetDividerY,
      tabGeometry.activeTop,
    );
  }, [tabGeometry, targetDividerY]);

  const fillGradientId = `${svgIdPrefix}-archive-tab-fill`;

  return (
    <div ref={containerRef} className="relative z-30 w-full" data-archive-capsule-nav="true">
      {tabGeometry && tabPaths ? (
        <svg
          className="pointer-events-none absolute left-0 z-10 overflow-visible"
          style={{ top: `${tabGeometry.activeTop}px`, left: `${-SVG_X_OVERSCAN}px` }}
          width={tabGeometry.containerWidth + SVG_X_OVERSCAN * 2}
          height={TAB_HEIGHT}
          viewBox={`${-SVG_X_OVERSCAN} 0 ${tabGeometry.containerWidth + SVG_X_OVERSCAN * 2} ${TAB_HEIGHT}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={fillGradientId}
              x1="0"
              y1="0"
              x2="0"
              y2={String(TAB_HEIGHT)}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#F7F7F8" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#F9F9FA" stopOpacity="0.78" />
              <stop offset="74%" stopColor="#FCFCFC" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#FEFEFD" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          <path d={tabPaths.fillPath} fill={`url(#${fillGradientId})`} />
          <path
            d={tabPaths.strokePath}
            fill="none"
            stroke={DIVIDER_SHADOW_COLOR}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            transform={`translate(0 ${DIVIDER_SHADOW_OFFSET_Y})`}
          />
          <path
            d={tabPaths.strokePath}
            fill="none"
            stroke={DIVIDER_COLOR}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}

      <div className="relative z-20 flex h-12 items-end gap-8 pl-[25px] pr-0">
        {tabs.map((tab) => {
          const isActive = resolvedActiveTab === tab.id;

          return (
            <button
              key={tab.id}
              ref={(node) => {
                buttonRefs.current[tab.id] = node;
              }}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative h-10 px-[11px] font-ui text-[14px] tracking-[0.02em] outline-none transition-none ${
                isActive
                  ? "font-semibold text-[#2f216f]"
                  : "font-medium text-inactive hover:text-meta"
              }`}
              style={{
                zIndex: isActive ? 30 : 20,
              }}
            >
              <span className="relative z-40">{toTitleCase(tab.label)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
