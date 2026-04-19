"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { useSearchParams } from "next/navigation";

type RightCategoryNavProps = {
  sectionKeys: string[];
  sectionIdPrefix?: string;
  className?: string;
};

const DEFAULT_STICKY_HEIGHT_PX = 156;
const CATEGORY_FOCUS_OFFSET_PX = 200;
const SAFARI_SCROLL_SYNC_DEBOUNCE_MS = 60;

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome\/|CriOS\/|Chromium\/|Edg\//.test(ua);
}

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

function FocusCueDisclaimer() {
  return (
    <button
      type="button"
      aria-label="Category cue note"
      className="group/disclaimer relative inline-flex h-[22px] items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
    >
      <span className="relative inline-flex h-[22px] w-max max-w-[22px] items-center overflow-hidden rounded-full bg-ink text-paper transition-[max-width] duration-200 ease-out group-hover/disclaimer:max-w-[238px] group-focus-within/disclaimer:max-w-[238px] motion-reduce:transition-none">
        <span className="absolute left-0 top-0 inline-flex h-[22px] w-[22px] items-center justify-center font-ui text-[11px] font-semibold leading-none text-paper">
          !
        </span>
        <span className="pointer-events-none pl-[26px] pr-[10px] font-ui text-[11px] font-medium leading-none tracking-[-0.03em] whitespace-nowrap text-paper opacity-0 transition-opacity duration-150 ease-out group-hover/disclaimer:opacity-100 group-focus-within/disclaimer:opacity-100 motion-reduce:transition-none">
          Based on broader aesthetic cues
        </span>
      </span>
    </button>
  );
}

export function RightCategoryNav({
  sectionKeys,
  sectionIdPrefix = "gallery-section-",
  className = "",
}: RightCategoryNavProps) {
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(sectionKeys[0] ?? "");
  const [displayActiveCategory, setDisplayActiveCategory] = useState(sectionKeys[0] ?? "");
  const [isExpanded, setIsExpanded] = useState(false);
  const autoScrollTargetRef = useRef<string | null>(null);
  const closeExpandedTimerRef = useRef<number | null>(null);
  const displaySwapTimerRef = useRef<number | null>(null);
  const suppressDisplaySyncUntilRef = useRef(0);
  const rafSyncRef = useRef<number | null>(null);
  const motionDurationMs = 150;

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
    if (sections.length === 0) return;
    let observer: IntersectionObserver | null = null;
    const useDebouncedScrollSync = isSafariBrowser();
    let scrollDebounceTimer: number | null = null;

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
          const canSyncDisplay = Date.now() >= suppressDisplaySyncUntilRef.current;
          if (!hasReachedTarget) {
            setActiveCategory((prev) => (prev === lockedKey ? prev : lockedKey));
            if (canSyncDisplay) {
              setDisplayActiveCategory((prev) => (prev === lockedKey ? prev : lockedKey));
            }
            return;
          }
          setActiveCategory((prev) => (prev === lockedKey ? prev : lockedKey));
          if (canSyncDisplay) {
            setDisplayActiveCategory((prev) => (prev === lockedKey ? prev : lockedKey));
          }
        }
        autoScrollTargetRef.current = null;
        return;
      }

      let next = nodes[0].key;
      for (const node of nodes) {
        if (node.top <= activationTop) {
          next = node.key;
        }
      }
      setActiveCategory((prev) => (prev === next ? prev : next));
      if (Date.now() >= suppressDisplaySyncUntilRef.current) {
        setDisplayActiveCategory((prev) => (prev === next ? prev : next));
      }
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

    const syncWithRaf = () => {
      if (rafSyncRef.current !== null) return;
      rafSyncRef.current = window.requestAnimationFrame(() => {
        rafSyncRef.current = null;
        const activationTop = getStickyHeightFromCssVar() + CATEGORY_FOCUS_OFFSET_PX;
        resolveActiveFromDom(activationTop);
      });
    };
    const syncWithDebounce = () => {
      if (scrollDebounceTimer !== null) {
        window.clearTimeout(scrollDebounceTimer);
      }
      scrollDebounceTimer = window.setTimeout(() => {
        scrollDebounceTimer = null;
        const activationTop = getStickyHeightFromCssVar() + CATEGORY_FOCUS_OFFSET_PX;
        resolveActiveFromDom(activationTop);
      }, SAFARI_SCROLL_SYNC_DEBOUNCE_MS);
    };

    const releaseAutoScrollLock = () => {
      autoScrollTargetRef.current = null;
      suppressDisplaySyncUntilRef.current = 0;
      if (displaySwapTimerRef.current !== null) {
        window.clearTimeout(displaySwapTimerRef.current);
        displaySwapTimerRef.current = null;
      }
    };

    const handleViewportChange = () => {
      connectObserver();
    };

    connectObserver();
    window.addEventListener("scroll", useDebouncedScrollSync ? syncWithDebounce : syncWithRaf, { passive: true });
    window.addEventListener("wheel", releaseAutoScrollLock, { passive: true });
    window.addEventListener("touchstart", releaseAutoScrollLock, { passive: true });
    window.addEventListener("keydown", releaseAutoScrollLock);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("sticky-height-change", handleViewportChange);

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", useDebouncedScrollSync ? syncWithDebounce : syncWithRaf);
      window.removeEventListener("wheel", releaseAutoScrollLock);
      window.removeEventListener("touchstart", releaseAutoScrollLock);
      window.removeEventListener("keydown", releaseAutoScrollLock);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("sticky-height-change", handleViewportChange);
      if (rafSyncRef.current !== null) {
        window.cancelAnimationFrame(rafSyncRef.current);
        rafSyncRef.current = null;
      }
      if (scrollDebounceTimer !== null) {
        window.clearTimeout(scrollDebounceTimer);
      }
      if (displaySwapTimerRef.current !== null) {
        window.clearTimeout(displaySwapTimerRef.current);
        displaySwapTimerRef.current = null;
      }
    };
  }, [sections]);

  const handleClick = (key: string, id: string) => {
    if (closeExpandedTimerRef.current !== null) {
      window.clearTimeout(closeExpandedTimerRef.current);
      closeExpandedTimerRef.current = null;
    }
    const clickFromExpandedMenu = isExpanded && key !== activeCategory;
    setIsExpanded(false);

    if (displaySwapTimerRef.current !== null) {
      window.clearTimeout(displaySwapTimerRef.current);
      displaySwapTimerRef.current = null;
    }
    if (clickFromExpandedMenu) {
      suppressDisplaySyncUntilRef.current = Date.now() + 260;
      displaySwapTimerRef.current = window.setTimeout(() => {
        setDisplayActiveCategory((prev) => (prev === key ? prev : key));
        displaySwapTimerRef.current = null;
      }, 140);
    } else {
      suppressDisplaySyncUntilRef.current = 0;
      setDisplayActiveCategory((prev) => (prev === key ? prev : key));
    }

    autoScrollTargetRef.current = key;
    setActiveCategory((prev) => (prev === key ? prev : key));
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

  const effectiveExpanded = isExpanded;
  const visualActiveKey = displayActiveCategory || activeCategory;
  const activeSection =
    sections.find((section) => section.key === visualActiveKey) ??
    sections.find((section) => section.key === activeCategory) ??
    sections[0];
  const editParam = searchParams.get("edit") ?? "main";
  const showFocusCueDisclaimer = editParam === "edit1a" && activeSection?.key === "OUTER";
  const activeIndex = Math.max(0, sections.findIndex((section) => section.key === activeCategory));
  const expandedListId = "right-category-expanded-list";
  const expandedRowStepPx = 38;
  const collapsedMarkerHeightPx = 26;
  const expandedMarkerHeightPx = 236;
  const markerLeftInsetPx = 16;
  const markerGapPx = 16;
  const markerWidthPx = 1.5;
  const inactiveTextLeftPx = markerLeftInsetPx + markerGapPx + markerWidthPx;
  const activeMarkerHeight = effectiveExpanded ? expandedMarkerHeightPx : collapsedMarkerHeightPx;
  const markerCenterOffsetPx = effectiveExpanded
    ? Math.round((((sections.length - 1) / 2) - activeIndex) * expandedRowStepPx)
    : 0;

  useEffect(() => {
    return () => {
      if (closeExpandedTimerRef.current !== null) {
        window.clearTimeout(closeExpandedTimerRef.current);
      }
      if (displaySwapTimerRef.current !== null) {
        window.clearTimeout(displaySwapTimerRef.current);
      }
    };
  }, []);

  return (
    <nav
      aria-label="Category navigation"
      aria-expanded={effectiveExpanded}
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
            style={{ left: `${markerLeftInsetPx}px` }}
          >
            <div
              className="pointer-events-auto inline-flex translate-x-[2px] items-center gap-2"
              style={{ marginLeft: `${markerGapPx + markerWidthPx}px` }}
            >
              <button
                type="button"
                aria-expanded={effectiveExpanded}
                aria-controls={expandedListId}
                onClick={() => handleClick(activeSection.key, activeSection.id)}
                className="inline-flex items-center justify-start rounded-md py-[2px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              >
                <ActiveCategoryLabel label={activeSection.label} />
              </button>
              {showFocusCueDisclaimer ? <FocusCueDisclaimer /> : null}
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-1/2 block bg-ink transition-[height,transform] ease-out motion-reduce:transition-none"
              style={{
                width: `${markerWidthPx}px`,
                height: `${activeMarkerHeight}px`,
                transform: `translateY(calc(-50% + ${markerCenterOffsetPx}px))`,
                transitionDuration: `${motionDurationMs}ms`,
              }}
            />
          </div>
        ) : null}

        <ul
          id={expandedListId}
          aria-hidden={!effectiveExpanded}
          className={`absolute inset-0 z-10 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
            effectiveExpanded ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          {sections.map((section, index) => {
            if (section.key === activeCategory) return null;
            const delta = index - activeIndex;
            const offsetY = delta * expandedRowStepPx;

            return (
              <li
                key={section.key}
                className="absolute top-1/2 transition-transform ease-out motion-reduce:transition-none"
                style={{
                  left: `${inactiveTextLeftPx}px`,
                  transform: `translateY(calc(-50% + ${offsetY}px))`,
                  transitionDuration: `${motionDurationMs}ms`,
                }}
              >
                <button
                  type="button"
                  tabIndex={effectiveExpanded ? 0 : -1}
                  onClick={() => handleClick(section.key, section.id)}
                  className="inline-flex items-center justify-start text-left font-ui text-[14px] font-medium leading-5 tracking-[0.02em] text-inactive transition-colors duration-300 ease-out hover:text-meta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
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
