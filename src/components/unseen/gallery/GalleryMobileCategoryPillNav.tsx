"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MobileFloatingCategoryPill } from "@/components/unseen/MobileFloatingCategoryPill";
import type { MockCatalogSection } from "@/data/mockCatalog";

type GalleryMobileCategoryPillNavProps = {
  sections: MockCatalogSection[];
  sectionIdPrefix?: string;
};

const DEFAULT_STICKY_HEIGHT_PX = 156;
const CATEGORY_FOCUS_OFFSET_PX_MOBILE = 120;
const CATEGORY_SEPARATOR_CENTER_OFFSET_PX = 90;
const FIRST_SECTION_PRODUCT_TOP_OFFSET_PX = 28;
const CATEGORY_SCROLL_LOCK_MS = 1800;

function getStickyHeightFromCssVar() {
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue("--sticky-h");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_STICKY_HEIGHT_PX;
}

function getStickyDividerCenterY() {
  return getStickyHeightFromCssVar();
}

function getMaxScrollY() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

export function GalleryMobileCategoryPillNav({
  sections,
  sectionIdPrefix = "gallery-section-",
}: GalleryMobileCategoryPillNavProps) {
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(sections[0]?.key ?? "");
  const autoScrollTargetRef = useRef<string | null>(null);
  const autoScrollResetTimerRef = useRef<number | null>(null);
  const rafSyncRef = useRef<number | null>(null);

  const options = useMemo(
    () => sections.map((section) => ({ key: section.key, label: section.title })),
    [sections],
  );

  const resolveSectionId = useCallback(
    (key: string) => `${sectionIdPrefix}${key.toLowerCase()}`,
    [sectionIdPrefix],
  );

  useEffect(() => {
    if (!sections.length) return;
    let observer: IntersectionObserver | null = null;

    const resolveActiveFromDom = (activationTop: number) => {
      const nodes = sections
        .map((section) => {
          const element = document.getElementById(resolveSectionId(section.key));
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { key: section.key, top: rect.top };
        })
        .filter((node): node is { key: string; top: number } => node !== null);

      if (nodes.length === 0) return;

      const lockedTarget = autoScrollTargetRef.current;
      if (lockedTarget) {
        const lockedNode = nodes.find((node) => node.key === lockedTarget);
        if (lockedNode) {
          setActiveCategory((prev) => (prev === lockedTarget ? prev : lockedTarget));
          if (Math.abs(lockedNode.top - activationTop) <= 36) {
            autoScrollTargetRef.current = null;
            if (autoScrollResetTimerRef.current !== null) {
              window.clearTimeout(autoScrollResetTimerRef.current);
              autoScrollResetTimerRef.current = null;
            }
          }
          return;
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
      observer?.disconnect();
      const activationTop = getStickyHeightFromCssVar() + CATEGORY_FOCUS_OFFSET_PX_MOBILE;

      observer = new IntersectionObserver(
        () => {
          resolveActiveFromDom(activationTop);
        },
        {
          root: null,
          rootMargin: `-${activationTop}px 0px -60% 0px`,
          threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        },
      );

      for (const section of sections) {
        const element = document.getElementById(resolveSectionId(section.key));
        if (element) observer.observe(element);
      }

      resolveActiveFromDom(activationTop);
    };

    const syncWithRaf = () => {
      if (rafSyncRef.current !== null) return;
      rafSyncRef.current = window.requestAnimationFrame(() => {
        rafSyncRef.current = null;
        const activationTop = getStickyHeightFromCssVar() + CATEGORY_FOCUS_OFFSET_PX_MOBILE;
        resolveActiveFromDom(activationTop);
      });
    };

    const releaseAutoScrollLock = () => {
      autoScrollTargetRef.current = null;
      if (autoScrollResetTimerRef.current !== null) {
        window.clearTimeout(autoScrollResetTimerRef.current);
        autoScrollResetTimerRef.current = null;
      }
    };

    connectObserver();
    window.addEventListener("scroll", syncWithRaf, { passive: true });
    window.addEventListener("wheel", releaseAutoScrollLock, { passive: true });
    window.addEventListener("touchstart", releaseAutoScrollLock, { passive: true });
    window.addEventListener("keydown", releaseAutoScrollLock);
    window.addEventListener("resize", connectObserver);
    window.addEventListener("sticky-height-change", connectObserver);

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", syncWithRaf);
      window.removeEventListener("wheel", releaseAutoScrollLock);
      window.removeEventListener("touchstart", releaseAutoScrollLock);
      window.removeEventListener("keydown", releaseAutoScrollLock);
      window.removeEventListener("resize", connectObserver);
      window.removeEventListener("sticky-height-change", connectObserver);
      if (autoScrollResetTimerRef.current !== null) {
        window.clearTimeout(autoScrollResetTimerRef.current);
        autoScrollResetTimerRef.current = null;
      }
      if (rafSyncRef.current !== null) {
        window.cancelAnimationFrame(rafSyncRef.current);
        rafSyncRef.current = null;
      }
    };
  }, [resolveSectionId, sections]);

  if (options.length === 0) return null;

  const normalizedActiveCategory = options.some((option) => option.key === activeCategory)
    ? activeCategory
    : options[0].key;
  const showFocusCue = searchParams.get("edit") === "edit1a" && normalizedActiveCategory === "OUTER";

  return (
    <MobileFloatingCategoryPill
      ariaLabel="Gallery categories"
      enableDragSnap
      options={options}
      activeKey={normalizedActiveCategory}
      focusCueLabel={showFocusCue ? "Based on broader aesthetic cues" : undefined}
      onSelect={(key) => {
        autoScrollTargetRef.current = key;
        setActiveCategory((prev) => (prev === key ? prev : key));
        if (autoScrollResetTimerRef.current !== null) {
          window.clearTimeout(autoScrollResetTimerRef.current);
        }
        autoScrollResetTimerRef.current = window.setTimeout(() => {
          autoScrollTargetRef.current = null;
          autoScrollResetTimerRef.current = null;
        }, 1800);

        const target = document.getElementById(resolveSectionId(key));
        if (!target) return;

        const sectionIndex = sections.findIndex((section) => section.key === key);
        const sectionTop = window.scrollY + target.getBoundingClientRect().top;
        const dividerCenterY = getStickyDividerCenterY();
        const targetViewportTop =
          sectionIndex > 0
            ? dividerCenterY + CATEGORY_SEPARATOR_CENTER_OFFSET_PX
            : dividerCenterY + FIRST_SECTION_PRODUCT_TOP_OFFSET_PX;
        const targetY = Math.min(
          Math.max(0, sectionTop - targetViewportTop),
          getMaxScrollY(),
        );

        window.dispatchEvent(
          new CustomEvent("unseen:mobile-category-scroll-anchor", {
            detail: { targetY, durationMs: CATEGORY_SCROLL_LOCK_MS },
          }),
        );
        window.scrollTo({ top: targetY, left: 0, behavior: "smooth" });
      }}
    />
  );
}
