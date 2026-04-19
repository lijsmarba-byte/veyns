"use client";

import { useEffect, useRef, useState, type FocusEvent } from "react";

type World2CategoryNavOption = {
  key: string;
  label: string;
};

type World2CategoryNavProps = {
  options: World2CategoryNavOption[];
  activeKey: string;
  onSelect: (key: string) => void;
  className?: string;
};

const ACTIVE_EDGE_FADE =
  "radial-gradient(ellipse 108% 92% at 50% 50%, rgba(254,254,253,0.9) 0%, rgba(254,254,253,0.52) 58%, rgba(254,254,253,0) 100%)";
const ACTIVE_CORE_FADE =
  "radial-gradient(ellipse 98% 78% at 50% 50%, rgba(254,254,253,0.82) 0%, rgba(254,254,253,0.52) 56%, rgba(254,254,253,0) 100%)";
const ACTIVE_CENTER_FADE =
  "radial-gradient(ellipse 92% 68% at 50% 50%, rgba(254,254,253,0.78) 0%, rgba(254,254,253,0.46) 54%, rgba(254,254,253,0) 100%)";
const ROW_EDGE_FADE =
  "radial-gradient(ellipse 106% 90% at 50% 50%, rgba(254,254,253,0.8) 0%, rgba(254,254,253,0.44) 58%, rgba(254,254,253,0) 100%)";
const ROW_CORE_FADE =
  "radial-gradient(ellipse 96% 76% at 50% 50%, rgba(254,254,253,0.72) 0%, rgba(254,254,253,0.44) 56%, rgba(254,254,253,0) 100%)";
const ROW_CENTER_FADE =
  "radial-gradient(ellipse 90% 66% at 50% 50%, rgba(254,254,253,0.66) 0%, rgba(254,254,253,0.4) 52%, rgba(254,254,253,0) 100%)";

function ActiveCategoryLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-baseline text-ink">
      <span className="font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">The</span>
      <span className="-ml-[1px] font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">
        &ndash;
      </span>
      <span className="ml-[2px] font-instrument text-[25px] italic leading-none tracking-[0.01em]">
        {label}
      </span>
    </span>
  );
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}

export function World2CategoryNav({
  options,
  activeKey,
  onSelect,
  className = "",
}: World2CategoryNavProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const motionDurationMs = 150;

  const normalizedActiveKey = options.some((option) => option.key === activeKey)
    ? activeKey
    : (options[0]?.key ?? "");
  const activeIndex = Math.max(0, options.findIndex((option) => option.key === normalizedActiveKey));
  const activeOption = options[activeIndex];
  const expandedListId = "world2-category-expanded-list";
  const expandedRowStepPx = 38;
  const collapsedMarkerHeightPx = 26;
  const expandedMarkerHeightPx =
    236 + Math.max(0, options.length - 6) * expandedRowStepPx;
  const markerLeftInsetPx = 16;
  const markerGapPx = 16;
  const markerWidthPx = 1.5;
  const inactiveTextLeftPx = markerLeftInsetPx + markerGapPx + markerWidthPx;
  const markerHeightPx = isExpanded ? expandedMarkerHeightPx : collapsedMarkerHeightPx;
  const markerCenterOffsetPx = isExpanded
    ? Math.round((((options.length - 1) / 2) - activeIndex) * expandedRowStepPx)
    : 0;

  const openExpanded = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsExpanded(true);
  };

  const closeExpanded = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      closeTimerRef.current = null;
    }, 180);
  };

  const handleBlurCapture = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (!next || !event.currentTarget.contains(next as Node)) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setIsExpanded(false);
    }
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  if (options.length === 0) return null;

  return (
    <nav
      aria-label="Category navigation"
      className={`group -m-4 hidden select-none p-4 lg:block ${className}`.trim()}
      onMouseEnter={openExpanded}
      onMouseLeave={closeExpanded}
      onFocusCapture={openExpanded}
      onBlurCapture={handleBlurCapture}
    >
      <div className="relative h-[252px] w-[246px] rounded-xl px-4 py-4">
        {activeOption ? (
          <div
            className="pointer-events-none absolute top-1/2 z-20 -translate-y-1/2"
            style={{ left: `${markerLeftInsetPx}px` }}
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={expandedListId}
              onClick={() => onSelect(activeOption.key)}
              className="pointer-events-auto inline-flex translate-x-[2px] items-center justify-start rounded-md py-[2px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              style={{ marginLeft: `${markerGapPx + markerWidthPx}px` }}
            >
              <span className="relative inline-flex items-center">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-y-[14px]"
                  style={{
                    left: "-38px",
                    right: "-24px",
                    background: ACTIVE_EDGE_FADE,
                    filter: "blur(11px)",
                  }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-y-[9px]"
                  style={{
                    left: "-28px",
                    right: "-14px",
                    background: ACTIVE_CORE_FADE,
                    filter: "blur(8px)",
                  }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-y-[5px]"
                  style={{
                    left: "-22px",
                    right: "-7px",
                    background: ACTIVE_CENTER_FADE,
                    filter: "blur(5px)",
                  }}
                />
                <span className="relative z-10">
                  <ActiveCategoryLabel label={activeOption.label} />
                </span>
              </span>
            </button>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-1/2 block bg-ink transition-[height,transform] ease-out motion-reduce:transition-none"
              style={{
                width: `${markerWidthPx}px`,
                height: `${markerHeightPx}px`,
                transform: `translateY(calc(-50% + ${markerCenterOffsetPx}px))`,
                transitionDuration: `${motionDurationMs}ms`,
              }}
            />
          </div>
        ) : null}

        <ul
          id={expandedListId}
          aria-hidden={!isExpanded}
          className={`absolute inset-0 z-10 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
            isExpanded ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {options.map((option, index) => {
            if (option.key === normalizedActiveKey) return null;
            const delta = index - activeIndex;
            const offsetY = delta * expandedRowStepPx;

            return (
              <li
                key={option.key}
                className="absolute top-1/2 transition-transform ease-out motion-reduce:transition-none"
                style={{
                  left: `${inactiveTextLeftPx}px`,
                  transform: `translateY(calc(-50% + ${offsetY}px))`,
                  transitionDuration: `${motionDurationMs}ms`,
                }}
              >
                <button
                  type="button"
                  tabIndex={isExpanded ? 0 : -1}
                  onClick={() => onSelect(option.key)}
                  className="relative z-10 inline-flex items-center justify-start text-left font-ui text-[14px] font-medium leading-5 tracking-[0.02em] text-inactive transition-colors duration-300 ease-out hover:text-meta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                >
                  <span className="relative inline-flex items-center px-[3px] py-[1px]">
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute -inset-x-[20px] -inset-y-[12px] transition-opacity duration-200 ${
                        isExpanded ? "opacity-100" : "opacity-0"
                      }`}
                      style={{
                        background: ROW_EDGE_FADE,
                        filter: "blur(10px)",
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute -inset-x-[12px] -inset-y-[8px] transition-opacity duration-200 ${
                        isExpanded ? "opacity-100" : "opacity-0"
                      }`}
                      style={{
                        background: ROW_CORE_FADE,
                        filter: "blur(7px)",
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute -inset-x-[6px] -inset-y-[4px] transition-opacity duration-200 ${
                        isExpanded ? "opacity-100" : "opacity-0"
                      }`}
                      style={{
                        background: ROW_CENTER_FADE,
                        filter: "blur(4px)",
                      }}
                    />
                    <span className="relative z-10">
                      {toTitleCase(option.label)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {activeOption ? (
          <span className="sr-only">{`Active category: ${activeOption.label}`}</span>
        ) : null}
      </div>
    </nav>
  );
}
