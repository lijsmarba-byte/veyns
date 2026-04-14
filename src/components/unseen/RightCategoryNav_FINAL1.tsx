"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";

type RightCategoryNavProps = {
  sectionKeys: string[];
  sectionIdPrefix?: string;
  className?: string;
};

const DEFAULT_STICKY_HEIGHT_PX = 156;
const CATEGORY_FOCUS_OFFSET_PX = 200;

function getStickyHeightFromCssVar() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--sticky-h").trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_STICKY_HEIGHT_PX;
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}

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

export function RightCategoryNav({
  sectionKeys,
  sectionIdPrefix = "gallery-section-",
  className = "",
}: RightCategoryNavProps) {
  const [activeCategory, setActiveCategory] = useState(sectionKeys[0] ?? "");
  const [visualActiveCategory, setVisualActiveCategory] = useState(sectionKeys[0] ?? "");
  const [isLabelTransitioning, setIsLabelTransitioning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [motionDurationMs, setMotionDurationMs] = useState(300);
  const autoScrollTargetRef = useRef<string | null>(null);
  const autoScrollResetTimerRef = useRef<number | null>(null);
  const closeExpandedTimerRef = useRef<number | null>(null);
  const pendingObservedKeyRef = useRef<string | null>(null);
  const pendingObservedTimerRef = useRef<number | null>(null);
  const labelSwapTimerRef = useRef<number | null>(null);
  const labelSettleTimerRef = useRef<number | null>(null);
  const activeCategoryRef = useRef(activeCategory);

  const sections = useMemo(
    () =>
      sectionKeys.map((key) => ({
        key,
        id: `${sectionIdPrefix}${key.toLowerCase()}`,
        label: toTitleCase(key),
      })),
    [sectionIdPrefix, sectionKeys],
  );

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  useEffect(() => {
    if (sections.length === 0) return;
    let observer: IntersectionObserver | null = null;

    const resolveActiveFromDom = (activationTop: number) => {
      const nodes = sections
        .map((section) => {
          const element = document.getElementById(section.id);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { key: section.key, top: rect.top };
        })
        .filter((node): node is { key: string; top: number } => node !== null);

      if (nodes.length === 0) return;

      const lockedKey = autoScrollTargetRef.current;
      if (lockedKey) {
        const lockedNode = nodes.find((node) => node.key === lockedKey);
        if (lockedNode) {
          const hasReachedTarget = Math.abs(lockedNode.top - activationTop) <= 36;
          if (!hasReachedTarget) {
            setActiveCategory((prev) => (prev === lockedKey ? prev : lockedKey));
            return;
          }
          setActiveCategory((prev) => (prev === lockedKey ? prev : lockedKey));
        }
        autoScrollTargetRef.current = null;
        if (autoScrollResetTimerRef.current !== null) {
          window.clearTimeout(autoScrollResetTimerRef.current);
          autoScrollResetTimerRef.current = null;
        }
        if (pendingObservedTimerRef.current !== null) {
          window.clearTimeout(pendingObservedTimerRef.current);
          pendingObservedTimerRef.current = null;
        }
        pendingObservedKeyRef.current = null;
        return;
      }

      let next = nodes[0].key;
      for (const node of nodes) {
        if (node.top <= activationTop) {
          next = node.key;
        }
      }
      if (activeCategoryRef.current === next) {
        if (pendingObservedTimerRef.current !== null) {
          window.clearTimeout(pendingObservedTimerRef.current);
          pendingObservedTimerRef.current = null;
        }
        pendingObservedKeyRef.current = null;
        return;
      }
      if (pendingObservedKeyRef.current === next) return;
      if (pendingObservedTimerRef.current !== null) {
        window.clearTimeout(pendingObservedTimerRef.current);
      }
      pendingObservedKeyRef.current = next;
      pendingObservedTimerRef.current = window.setTimeout(() => {
        setActiveCategory((prev) => (prev === next ? prev : next));
        pendingObservedKeyRef.current = null;
        pendingObservedTimerRef.current = null;
      }, 120);
    };

    const connectObserver = () => {
      const activationTop = getStickyHeightFromCssVar() + CATEGORY_FOCUS_OFFSET_PX;
      observer?.disconnect();
      observer = new IntersectionObserver(
        () => {
          resolveActiveFromDom(activationTop);
        },
        {
          root: null,
          rootMargin: `-${activationTop}px 0px -55% 0px`,
          threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        },
      );

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) observer.observe(element);
      }

      resolveActiveFromDom(activationTop);
    };

    const handleViewportChange = () => {
      connectObserver();
    };

    connectObserver();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("sticky-height-change", handleViewportChange);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("sticky-height-change", handleViewportChange);
      if (autoScrollResetTimerRef.current !== null) {
        window.clearTimeout(autoScrollResetTimerRef.current);
        autoScrollResetTimerRef.current = null;
      }
      if (pendingObservedTimerRef.current !== null) {
        window.clearTimeout(pendingObservedTimerRef.current);
        pendingObservedTimerRef.current = null;
      }
    };
  }, [sections]);

  const handleClick = (key: string, id: string) => {
    if (closeExpandedTimerRef.current !== null) {
      window.clearTimeout(closeExpandedTimerRef.current);
      closeExpandedTimerRef.current = null;
    }
    setIsExpanded(false);

    autoScrollTargetRef.current = key;
    if (pendingObservedTimerRef.current !== null) {
      window.clearTimeout(pendingObservedTimerRef.current);
      pendingObservedTimerRef.current = null;
    }
    pendingObservedKeyRef.current = null;
    if (autoScrollResetTimerRef.current !== null) {
      window.clearTimeout(autoScrollResetTimerRef.current);
    }
    autoScrollResetTimerRef.current = window.setTimeout(() => {
      autoScrollTargetRef.current = null;
      autoScrollResetTimerRef.current = null;
    }, 1800);

    setActiveCategory((prev) => (prev === key ? prev : key));
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (visualActiveCategory === activeCategory) return;
    if (labelSwapTimerRef.current !== null) {
      window.clearTimeout(labelSwapTimerRef.current);
    }
    if (labelSettleTimerRef.current !== null) {
      window.clearTimeout(labelSettleTimerRef.current);
    }

    setIsLabelTransitioning(true);
    labelSwapTimerRef.current = window.setTimeout(() => {
      setVisualActiveCategory(activeCategory);
      labelSwapTimerRef.current = null;
    }, 110);
    labelSettleTimerRef.current = window.setTimeout(() => {
      setIsLabelTransitioning(false);
      labelSettleTimerRef.current = null;
    }, 260);
  }, [activeCategory, visualActiveCategory]);

  const handleBlurCapture = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (!next || !event.currentTarget.contains(next as Node)) {
      if (closeExpandedTimerRef.current !== null) {
        window.clearTimeout(closeExpandedTimerRef.current);
        closeExpandedTimerRef.current = null;
      }
      setIsExpanded(false);
    }
  };

  const openExpanded = () => {
    if (closeExpandedTimerRef.current !== null) {
      window.clearTimeout(closeExpandedTimerRef.current);
      closeExpandedTimerRef.current = null;
    }
    setIsExpanded(true);
  };

  const closeExpanded = () => {
    if (closeExpandedTimerRef.current !== null) {
      window.clearTimeout(closeExpandedTimerRef.current);
    }
    closeExpandedTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      closeExpandedTimerRef.current = null;
    }, 180);
  };

  const activeSection = sections.find((section) => section.key === visualActiveCategory) ?? sections[0];
  const activeActionSection = sections.find((section) => section.key === activeCategory) ?? sections[0];
  const activeIndex = Math.max(0, sections.findIndex((section) => section.key === visualActiveCategory));
  const expandedListId = "right-category-expanded-list";
  const expandedRowStepPx = 38;
  const collapsedMarkerHeightPx = 26;
  const expandedMarkerHeightPx = 236;
  const markerRightInsetPx = 16;
  const markerGapPx = 16;
  const markerWidthPx = 1;
  const inactiveTextRightPx = markerRightInsetPx + markerGapPx + markerWidthPx;
  const activeMarkerHeight = isExpanded ? expandedMarkerHeightPx : collapsedMarkerHeightPx;
  const markerCenterOffsetPx = isExpanded
    ? Math.round((((sections.length - 1) / 2) - activeIndex) * expandedRowStepPx)
    : 0;

  const previousActiveIndexRef = useRef(activeIndex);

  useEffect(() => {
    const delta = Math.abs(activeIndex - previousActiveIndexRef.current);
    setMotionDurationMs(Math.min(900, 280 + delta * 130));
    previousActiveIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    return () => {
      if (closeExpandedTimerRef.current !== null) {
        window.clearTimeout(closeExpandedTimerRef.current);
      }
      if (pendingObservedTimerRef.current !== null) {
        window.clearTimeout(pendingObservedTimerRef.current);
      }
      if (labelSwapTimerRef.current !== null) {
        window.clearTimeout(labelSwapTimerRef.current);
      }
      if (labelSettleTimerRef.current !== null) {
        window.clearTimeout(labelSettleTimerRef.current);
      }
    };
  }, []);

  return (
    <nav
      aria-label="Category navigation"
      aria-expanded={isExpanded}
      className={`group -m-4 hidden select-none p-4 lg:block ${className}`.trim()}
      onMouseEnter={openExpanded}
      onMouseLeave={closeExpanded}
      onFocusCapture={openExpanded}
      onBlurCapture={handleBlurCapture}
    >
      <div className="relative h-[252px] w-[246px] rounded-xl px-4 py-4">
        {activeSection ? (
          <div
            className="pointer-events-none absolute top-1/2 z-20 -translate-y-1/2"
            style={{ right: `${markerRightInsetPx}px` }}
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={expandedListId}
              onClick={() => handleClick(activeActionSection.key, activeActionSection.id)}
              className={`pointer-events-auto inline-flex translate-x-[2px] items-center justify-end rounded-md py-[2px] text-right transition-[opacity,transform] duration-220 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
                isLabelTransitioning ? "translate-y-[1px] opacity-75" : "translate-y-0 opacity-100"
              }`}
              style={{ marginRight: `${markerGapPx + markerWidthPx}px` }}
            >
              <ActiveCategoryLabel label={activeSection.label} />
            </button>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-1/2 block w-px bg-ink transition-[height,transform] ease-out motion-reduce:transition-none"
              style={{
                height: `${activeMarkerHeight}px`,
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
            isExpanded ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          {sections.map((section, index) => {
            if (section.key === visualActiveCategory) return null;
            const delta = index - activeIndex;
            const offsetY = delta * expandedRowStepPx;

            return (
              <li
                key={section.key}
                className="absolute top-1/2 transition-transform ease-out motion-reduce:transition-none"
                style={{
                  right: `${inactiveTextRightPx}px`,
                  transform: `translateY(calc(-50% + ${offsetY}px))`,
                  transitionDuration: `${motionDurationMs}ms`,
                }}
              >
                <button
                  type="button"
                  tabIndex={isExpanded ? 0 : -1}
                  onClick={() => handleClick(section.key, section.id)}
                  className="inline-flex items-center justify-end text-right font-ui text-[14px] font-medium leading-5 tracking-[0.02em] text-inactive transition-colors duration-300 ease-out hover:text-meta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                >
                  <span>{section.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {activeSection ? (
          <span className="sr-only">{`Active category: ${activeSection.label}`}</span>
        ) : null}
      </div>
    </nav>
  );
}
