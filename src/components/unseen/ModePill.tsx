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

  const viewSuffix = useMemo(() => {
    if (pathname?.endsWith("/focus")) return "/focus";
    if (pathname?.endsWith("/immersive")) return "/immersive";
    return "";
  }, [pathname]);

  const routeFor = useCallback(
    (target: "gallery" | "archive") => {
      const base = target === "gallery" ? "/gallery" : "/archive";
      return `${base}${viewSuffix}`;
    },
    [viewSuffix],
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
      ? "bg-[linear-gradient(180deg,#3a2580_0%,#312073_100%)] shadow-[0_0.5px_1px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]"
      : "bg-[linear-gradient(180deg,#151515_0%,#0d0d0d_100%)] shadow-[0_0.5px_1px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.05)]";
  const sliderTranslatePx = selected === "archive" ? 98 : 0;

  return (
    <div
      className="content-stretch relative flex items-center justify-center rounded-[18px] border border-[#F0F0F1] border-solid bg-[#F5F5F6] p-[2px]"
      data-name="Mode Switch"
      data-mode-pill-root="true"
      style={{
        boxShadow: "0 0.5px 1px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div className="pointer-events-none absolute inset-[2px] z-[1]">
        <div
          className={`h-[32px] rounded-[16px] border-[0.5px] border-[#F0F0F1] transition-[transform,background,box-shadow] duration-[540ms] ease-[cubic-bezier(0.22,0.9,0.24,1)] ${sliderClass}`}
          style={{ width: "96px", transform: `translateX(${sliderTranslatePx}px)` }}
        />
      </div>

      <div className="relative z-[2] grid w-[194px] grid-cols-2 gap-[2px]">
        <button
          type="button"
          aria-pressed={selected === "gallery"}
          onClick={() => navigateTo("gallery")}
          onMouseEnter={() => prefetchRoute(routeFor("gallery"))}
          onFocus={() => prefetchRoute(routeFor("gallery"))}
          className="group content-stretch relative flex h-[32px] w-full items-center justify-center overflow-hidden rounded-[16px] bg-transparent px-[10px] outline-none"
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
          onClick={() => navigateTo("archive")}
          onMouseEnter={() => prefetchRoute(routeFor("archive"))}
          onFocus={() => prefetchRoute(routeFor("archive"))}
          className="group content-stretch relative flex h-[32px] w-full items-center justify-center overflow-hidden rounded-[16px] bg-transparent px-[10px] outline-none"
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
