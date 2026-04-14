"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type ModePillProps = {
  selected: "gallery" | "archive";
};

export function ModePill({ selected }: ModePillProps) {
  const router = useRouter();
  const pathname = usePathname();
  const prefetchedHrefRef = useRef<Set<string>>(new Set());

  const immersiveSuffix = useMemo(() => (pathname?.endsWith("/immersive") ? "/immersive" : ""), [pathname]);

  const routeFor = useCallback(
    (target: "gallery" | "archive") => {
      const base = target === "gallery" ? "/gallery" : "/archive";
      return `${base}${immersiveSuffix}`;
    },
    [immersiveSuffix],
  );

  const prefetchRoute = useCallback(
    (href: string) => {
      if (prefetchedHrefRef.current.has(href)) return;
      prefetchedHrefRef.current.add(href);
      router.prefetch(href);
    },
    [router],
  );

  useEffect(() => {
    prefetchRoute(routeFor("gallery"));
    prefetchRoute(routeFor("archive"));
  }, [prefetchRoute, routeFor]);

  const navigateTo = useCallback(
    (target: "gallery" | "archive") => {
      if (target === selected) return;
      const href = routeFor(target);
      prefetchRoute(href);
      router.push(href, { scroll: true });
    },
    [prefetchRoute, routeFor, router, selected],
  );

  const sliderClass =
    selected === "archive"
      ? "translate-x-[calc(100%+2px)] bg-[linear-gradient(180deg,#3a2580_0%,#312073_100%)] shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]"
      : "translate-x-0 bg-[linear-gradient(180deg,#151515_0%,#0d0d0d_100%)] shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]";

  return (
    <div
      data-show-around-target="mode-switch"
      className="content-stretch relative flex items-center justify-center rounded-[18px] border border-line border-solid bg-[#F5F5F6] p-[2px]"
      data-name="Mode Switch"
      style={{
        boxShadow: `
          0 1px 2px rgba(0, 0, 0, 0.04),
          inset 0 1px 0 rgba(255, 255, 255, 0.4),
          inset 0 -1px 0 rgba(0, 0, 0, 0.02)
        `,
      }}
    >
      <div className="pointer-events-none absolute inset-[2px] z-[1]">
        <div
          className={`h-[32px] w-[calc((100%-2px)/2)] rounded-[16px] transition-[transform,background,box-shadow] duration-[540ms] ease-[cubic-bezier(0.22,0.9,0.24,1)] ${sliderClass}`}
        />
      </div>

      <div className="relative z-[2] grid grid-cols-2 gap-[2px]">
        <button
          type="button"
          aria-pressed={selected === "gallery"}
          data-show-around-target="gallery-segment"
          onClick={() => navigateTo("gallery")}
          onMouseEnter={() => prefetchRoute(routeFor("gallery"))}
          onFocus={() => prefetchRoute(routeFor("gallery"))}
          className="group content-stretch relative flex h-[32px] min-w-[90px] items-center justify-center overflow-hidden rounded-[16px] bg-transparent px-[20px] outline-none"
          data-name="Segment Gallery"
        >
          <p
            className={`relative z-10 inline-flex shrink-0 items-baseline gap-[2px] text-right text-[14px] leading-[18px] transition-colors duration-[420ms] ${
              selected === "gallery"
                ? "text-[#fefefd]"
                : "text-[#888894] group-hover:text-[#5F6471]"
            }`}
          >
            <span className="font-ui font-normal not-italic tracking-[-0.06em]">The-</span>
            <span className="font-instrument font-normal italic tracking-normal">Gallery</span>
          </p>
        </button>

        <button
          type="button"
          aria-pressed={selected === "archive"}
          data-show-around-target="archive-segment"
          onClick={() => navigateTo("archive")}
          onMouseEnter={() => prefetchRoute(routeFor("archive"))}
          onFocus={() => prefetchRoute(routeFor("archive"))}
          className="group content-stretch relative flex h-[32px] min-w-[90px] items-center justify-center overflow-hidden rounded-[16px] bg-transparent px-[20px] outline-none"
          data-name="Segment Archive"
        >
          <p
            className={`relative z-10 inline-flex shrink-0 items-baseline gap-[2px] text-right text-[14px] leading-[18px] transition-colors duration-[420ms] ${
              selected === "archive"
                ? "text-[#fefefd]"
                : "text-[#888894] group-hover:text-[#5F6471]"
            }`}
          >
            <span className="font-ui font-normal not-italic tracking-[-0.06em]">The-</span>
            <span className="font-instrument font-normal italic tracking-normal">Archive</span>
          </p>
        </button>
      </div>
    </div>
  );
}
