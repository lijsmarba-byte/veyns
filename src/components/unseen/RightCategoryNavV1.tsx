"use client";

import { useEffect, useMemo, useState } from "react";

type RightCategoryNavProps = {
  sectionKeys: string[];
  sectionIdPrefix?: string;
  className?: string;
};

const DEFAULT_STICKY_HEIGHT_PX = 156;

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

export function RightCategoryNav({
  sectionKeys,
  sectionIdPrefix = "gallery-section-",
  className = "",
}: RightCategoryNavProps) {
  const [activeCategory, setActiveCategory] = useState(sectionKeys[0] ?? "");

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

      let next = nodes[0].key;
      for (const node of nodes) {
        if (node.top <= activationTop) {
          next = node.key;
        }
      }
      setActiveCategory(next);
    };

    const connectObserver = () => {
      const activationTop = getStickyHeightFromCssVar() + 20;
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
    };
  }, [sections]);

  const handleClick = (key: string, id: string) => {
    setActiveCategory(key);
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label="Category navigation"
      className={`hidden lg:block ${className}`.trim()}
    >
      <ul className="flex min-w-[132px] flex-col gap-[11px]">
        {sections.map((section) => {
          const isActive = activeCategory === section.key;
          return (
            <li key={section.key}>
              <button
                type="button"
                onClick={() => handleClick(section.key, section.id)}
                className={`inline-flex w-full items-center justify-end text-right font-ui text-[14px] leading-5 tracking-[0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
                  isActive ? "font-medium text-ink" : "font-medium text-inactive hover:text-meta"
                }`}
              >
                <span>{section.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
