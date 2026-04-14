"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";

type RightCategoryNavProps = {
  sectionKeys: string[];
  sectionIdPrefix?: string;
  className?: string;
};

const DEFAULT_STICKY_HEIGHT_PX = 156;
const CATEGORY_FOCUS_OFFSET_PX = 170;

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
      <span className="font-ui text-[22px] font-normal leading-none tracking-[-0.06em]">The</span>
      <span className="-ml-[1px] font-ui text-[22px] font-normal leading-none tracking-[-0.06em]">
        &ndash;
      </span>
      <span className="ml-[2px] font-instrument text-[22px] italic leading-none tracking-[0.01em]">
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
  const [isExpanded, setIsExpanded] = useState(false);
  const autoScrollTargetRef = useRef<string | null>(null);
  const autoScrollResetTimerRef = useRef<number | null>(null);

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
            setActiveCategory(lockedKey);
            return;
          }
        }
        autoScrollTargetRef.current = null;
        if (autoScrollResetTimerRef.current !== null) {
          window.clearTimeout(autoScrollResetTimerRef.current);
          autoScrollResetTimerRef.current = null;
        }
      }

      let next = nodes[0].key;
      for (const node of nodes) {
        if (node.top <= activationTop) {
          next = node.key;
        }
      }
      setActiveCategory((prev) => (prev === next ? prev : next));
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
    };
  }, [sections]);

  const handleClick = (key: string, id: string) => {
    autoScrollTargetRef.current = key;
    if (autoScrollResetTimerRef.current !== null) {
      window.clearTimeout(autoScrollResetTimerRef.current);
    }
    autoScrollResetTimerRef.current = window.setTimeout(() => {
      autoScrollTargetRef.current = null;
      autoScrollResetTimerRef.current = null;
    }, 1400);

    setActiveCategory(key);
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleBlurCapture = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (!next || !event.currentTarget.contains(next as Node)) {
      setIsExpanded(false);
    }
  };

  const activeSection = sections.find((section) => section.key === activeCategory) ?? sections[0];
  const expandedListId = "right-category-expanded-list";

  return (
    <nav
      aria-label="Category navigation"
      aria-expanded={isExpanded}
      className={`group hidden select-none lg:block ${className}`.trim()}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onFocusCapture={() => setIsExpanded(true)}
      onBlurCapture={handleBlurCapture}
    >
      <div className="relative w-[246px] rounded-xl px-4 py-4">
        <ul
          id={expandedListId}
          className={`flex min-w-[210px] flex-col items-end ${isExpanded ? "gap-[6px]" : "gap-0"}`}
          aria-expanded={isExpanded}
        >
          {sections.map((section) => {
            const isActive = activeCategory === section.key;

            return (
              <li
                key={section.key}
                className={`relative flex w-full items-center justify-end transition-[height] duration-200 ease-out motion-reduce:transition-none ${
                  isActive ? "h-[40px]" : isExpanded ? "h-[28px]" : "h-[16px]"
                }`}
              >
                <div className="ml-auto inline-flex min-w-[170px] items-center justify-end">
                  {isActive ? (
                    <button
                      type="button"
                      onClick={() => handleClick(section.key, section.id)}
                      className="inline-flex translate-x-[2px] items-center justify-end rounded-md py-[2px] text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    >
                      <ActiveCategoryLabel label={section.label} />
                    </button>
                  ) : (
                    <>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute right-[2px] h-px w-[14px] bg-[#c6cbd5] transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                          isExpanded ? "opacity-0" : "opacity-100"
                        }`}
                      />
                      <button
                        type="button"
                        tabIndex={isExpanded ? 0 : -1}
                        onClick={() => handleClick(section.key, section.id)}
                        className={`relative inline-flex items-center justify-end text-right font-ui text-[14px] font-medium leading-5 tracking-[0.02em] text-inactive transition-opacity duration-200 ease-out motion-reduce:transition-none hover:text-meta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
                          isExpanded
                            ? "opacity-100 pointer-events-auto"
                            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                        }`}
                      >
                        <span>{section.label}</span>
                      </button>
                    </>
                  )}
                </div>
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
