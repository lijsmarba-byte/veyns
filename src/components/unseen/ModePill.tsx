"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type ModePillProps = {
  selected: "gallery" | "archive";
};

export function ModePill({ selected }: ModePillProps) {
  const router = useRouter();
  const pathname = usePathname();
  const prefetchedHrefRef = useRef<Set<string>>(new Set());
  const switchingTargetRef = useRef<"gallery" | "archive" | null>(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

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

  useEffect(() => {
    if (!isSwitchingMode) return;
    const resetTimer = window.setTimeout(() => {
      setIsSwitchingMode(false);
      switchingTargetRef.current = null;
    }, 900);
    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [isSwitchingMode]);

  useEffect(() => {
    if (!isSwitchingMode) return;
    setIsSwitchingMode(false);
    switchingTargetRef.current = null;
  }, [isSwitchingMode, pathname]);

  const navigateTo = useCallback(
    (target: "gallery" | "archive") => {
      if (target === selected) return;
      if (isSwitchingMode) return;
      if (switchingTargetRef.current === target) return;
      const href = routeFor(target);
      switchingTargetRef.current = target;
      setIsSwitchingMode(true);
      prefetchRoute(href);
      router.push(href, { scroll: true });
    },
    [isSwitchingMode, prefetchRoute, routeFor, router, selected],
  );

  const sliderClass =
    selected === "archive"
      ? "bg-[linear-gradient(180deg,#3a2580_0%,#312073_100%)]"
      : "bg-[linear-gradient(180deg,#151515_0%,#0d0d0d_100%)]";
  const sliderTranslatePx = selected === "archive" ? "calc(100% + 2px)" : "0px";

  return (
    <div
      className="content-stretch relative flex items-center justify-center overflow-hidden rounded-full border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] p-[2px]"
      data-name="Mode Switch"
      data-mode-pill-root="true"
    >
      <div className="pointer-events-none absolute inset-[2px] z-[1] overflow-hidden rounded-full">
        <div
          className={`h-[35px] rounded-full transform-gpu will-change-transform transition-[transform,background] duration-[540ms] ease-[cubic-bezier(0.22,0.9,0.24,1)] md:h-[32px] ${sliderClass}`}
          style={{ width: "calc((100% - 2px) / 2)", transform: `translateX(${sliderTranslatePx})` }}
        />
      </div>

      <div className="relative z-[2] grid w-[206px] grid-cols-2 gap-[2px] md:w-[194px]">
        <button
          type="button"
          disabled={isSwitchingMode}
          aria-pressed={selected === "gallery"}
          onClick={() => navigateTo("gallery")}
          onMouseEnter={() => prefetchRoute(routeFor("gallery"))}
          onFocus={() => prefetchRoute(routeFor("gallery"))}
          className="group content-stretch relative flex h-[35px] w-full items-center justify-center overflow-hidden rounded-full bg-transparent px-[11px] outline-none md:h-[32px] md:px-[10px]"
          data-name="Segment Gallery"
        >
          <p
            className={`relative z-10 inline-flex shrink-0 items-baseline gap-[2px] text-right text-[15px] leading-[19px] transition-colors duration-[420ms] md:text-[14px] md:leading-[18px] ${
              selected === "gallery"
                ? "text-[#fefefd]"
                : "text-[#6F7381] group-hover:text-[#5F6471]"
            }`}
          >
            <span className="font-ui font-normal not-italic tracking-[-0.06em]">The-</span>
            <span className="font-instrument font-normal italic tracking-normal">Gallery</span>
          </p>
        </button>

        <button
          type="button"
          disabled={isSwitchingMode}
          aria-pressed={selected === "archive"}
          onClick={() => navigateTo("archive")}
          onMouseEnter={() => prefetchRoute(routeFor("archive"))}
          onFocus={() => prefetchRoute(routeFor("archive"))}
          className="group content-stretch relative flex h-[35px] w-full items-center justify-center overflow-hidden rounded-full bg-transparent px-[11px] outline-none md:h-[32px] md:px-[10px]"
          data-name="Segment Archive"
        >
          <p
            className={`relative z-10 inline-flex shrink-0 items-baseline gap-[2px] text-right text-[15px] leading-[19px] transition-colors duration-[420ms] md:text-[14px] md:leading-[18px] ${
              selected === "archive"
                ? "text-[#fefefd]"
                : "text-[#6F7381] group-hover:text-[#5F6471]"
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
