"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useViewportMode } from "@/lib/ui/viewportMode";

type EditTab = {
  id: string;
  label: string;
};

const defaultTabs: EditTab[] = [
  { id: "main", label: "MAIN EDIT" },
  { id: "edit1a", label: "EDIT1" },
  { id: "edit1b", label: "EDIT1" },
  { id: "edit1c", label: "EDIT1" },
];
const MOBILE_PLUS_GLYPH_SHIFT_PX = 2;
const ACTIVE_UNDERLINE_TOP_PX = 39;
const MOBILE_NAV_FADE_START_RATIO = 0.6;
const MOBILE_NAV_FADE_MASK = "linear-gradient(to right, black 0%, black 60%, transparent 100%)";
const MOBILE_IMMERSIVE_UNDERLINE_TRANSITION =
  "left 280ms cubic-bezier(0.2,0.78,0.22,1), width 280ms cubic-bezier(0.2,0.78,0.22,1), opacity 220ms ease-out";
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function snapToDevicePixel(value: number): number {
  if (typeof window === "undefined") return value;
  const dpr = window.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}

type GalleryEditNavProps = {
  tabs?: EditTab[];
  tone?: "gallery" | "archive";
  queryKey?: string;
  smoothUnderline?: boolean;
  onCreateAction?: () => void;
  onReviewAction?: () => void;
};

function toTitleCase(value: string) {
  if (!value) return value;
  return value
    .trim()
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

export function GalleryEditNav({
  tabs = defaultTabs,
  tone = "gallery",
  queryKey = "edit",
  smoothUnderline = false,
  onCreateAction,
  onReviewAction,
}: GalleryEditNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobileExperience } = useViewportMode();
  const [isMobileAddOpen, setIsMobileAddOpen] = useState(false);
  const [hasMobileOverflowRight, setHasMobileOverflowRight] = useState(false);
  const [mobileTabFullyVisible, setMobileTabFullyVisible] = useState<Record<string, boolean>>({});
  const mobileRootRef = useRef<HTMLDivElement | null>(null);
  const desktopRootRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const mobilePlusRef = useRef<HTMLButtonElement | null>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [mobileTrayPos, setMobileTrayPos] = useState<{ left: number; top: number } | null>(null);
  const [activeUnderlineStyle, setActiveUnderlineStyle] = useState<{ left: number; width: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragDetectedRef = useRef(false);
  const editParam = searchParams.get(queryKey);
  const defaultTab = tabs[0]?.id ?? "main";
  const resolvedActiveTab = editParam && tabs.some((tab) => tab.id === editParam)
    ? editParam
    : defaultTab;

  const setActiveTab = (tabId: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (tabId === defaultTab) {
      nextParams.delete(queryKey);
    } else {
      nextParams.set(queryKey, tabId);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const handleMobilePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    touchStartRef.current = { x: event.clientX, y: event.clientY };
    dragDetectedRef.current = false;
  };

  const handleMobilePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    const start = touchStartRef.current;
    if (!start) return;
    const deltaX = Math.abs(event.clientX - start.x);
    const deltaY = Math.abs(event.clientY - start.y);
    if (deltaX + deltaY > 10) {
      dragDetectedRef.current = true;
    }
  };

  const handleMobilePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    touchStartRef.current = null;
    window.setTimeout(() => {
      dragDetectedRef.current = false;
    }, 40);
  };

  const handleTabClick = (tabId: string) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (isMobileExperience && dragDetectedRef.current) {
      event.preventDefault();
      return;
    }
    if (isMobileExperience && mobileTabFullyVisible[tabId] === false) {
      event.preventDefault();
      return;
    }
    setIsMobileAddOpen(false);
    setActiveTab(tabId);
  };

  useEffect(() => {
    if (!isMobileExperience) return;
    const scrollNode = mobileScrollRef.current;
    if (!scrollNode) return;

    const syncRightOverflow = () => {
      const maxScrollLeft = Math.max(0, scrollNode.scrollWidth - scrollNode.clientWidth);
      const clampedScrollLeft = Math.min(Math.max(scrollNode.scrollLeft, 0), maxScrollLeft);
      const remainingRight = maxScrollLeft - clampedScrollLeft;
      const hasRightOverflow = remainingRight > 1;
      setHasMobileOverflowRight((prev) => (prev ? remainingRight > 1.5 : remainingRight > 6));

      const scrollRect = scrollNode.getBoundingClientRect();
      const rightFadeWidthPx = !isMobileAddOpen && hasRightOverflow
        ? scrollRect.width * (1 - MOBILE_NAV_FADE_START_RATIO)
        : 0;
      const visibleLeft = scrollRect.left + 0.5;
      const visibleRight = scrollRect.right - rightFadeWidthPx - 0.5;

      const nextVisibility: Record<string, boolean> = {};
      for (const tab of tabs) {
        const buttonNode = tabButtonRefs.current[tab.id];
        if (!buttonNode) {
          nextVisibility[tab.id] = true;
          continue;
        }
        const rect = buttonNode.getBoundingClientRect();
        nextVisibility[tab.id] = rect.left >= visibleLeft && rect.right <= visibleRight;
      }

      setMobileTabFullyVisible((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(nextVisibility);
        if (prevKeys.length !== nextKeys.length) return nextVisibility;
        for (const key of nextKeys) {
          if (prev[key] !== nextVisibility[key]) return nextVisibility;
        }
        return prev;
      });
    };

    syncRightOverflow();
    scrollNode.addEventListener("scroll", syncRightOverflow, { passive: true });
    window.addEventListener("resize", syncRightOverflow);
    window.visualViewport?.addEventListener("resize", syncRightOverflow);

    return () => {
      scrollNode.removeEventListener("scroll", syncRightOverflow);
      window.removeEventListener("resize", syncRightOverflow);
      window.visualViewport?.removeEventListener("resize", syncRightOverflow);
    };
  }, [isMobileAddOpen, isMobileExperience, tabs]);

  useEffect(() => {
    if (!isMobileExperience || !isMobileAddOpen) return;

    const syncTrayPosition = () => {
      const rootRect = mobileRootRef.current?.getBoundingClientRect();
      const plusRect = mobilePlusRef.current?.getBoundingClientRect();
      if (!rootRect || !plusRect) return;
      setMobileTrayPos({
        left: plusRect.left - rootRect.left - 6,
        top: plusRect.top - rootRect.top + plusRect.height / 2 - MOBILE_PLUS_GLYPH_SHIFT_PX,
      });
    };

    syncTrayPosition();
    const scrollNode = mobileScrollRef.current;
    scrollNode?.addEventListener("scroll", syncTrayPosition, { passive: true });
    window.addEventListener("resize", syncTrayPosition);
    window.visualViewport?.addEventListener("resize", syncTrayPosition);

    return () => {
      scrollNode?.removeEventListener("scroll", syncTrayPosition);
      window.removeEventListener("resize", syncTrayPosition);
      window.visualViewport?.removeEventListener("resize", syncTrayPosition);
    };
  }, [isMobileAddOpen, isMobileExperience]);

  useBrowserLayoutEffect(() => {
    let scheduledRaf: number | null = null;

    const syncUnderline = () => {
      const rootNode = isMobileExperience ? mobileRootRef.current : desktopRootRef.current;
      const scrollNode = mobileScrollRef.current;
      const activeButtonNode = tabButtonRefs.current[resolvedActiveTab];

      if (!(rootNode && activeButtonNode)) {
        setActiveUnderlineStyle(null);
        return;
      }

      if (isMobileExperience && scrollNode) {
        setActiveUnderlineStyle({
          left: snapToDevicePixel(activeButtonNode.offsetLeft),
          width: snapToDevicePixel(activeButtonNode.offsetWidth),
        });
        return;
      }

      const rootRect = rootNode.getBoundingClientRect();
      const activeButtonRect = activeButtonNode.getBoundingClientRect();
      setActiveUnderlineStyle({
        left: snapToDevicePixel(activeButtonRect.left - rootRect.left),
        width: snapToDevicePixel(activeButtonRect.width),
      });
    };

    const scheduleUnderlineSync = () => {
      if (scheduledRaf !== null) return;
      scheduledRaf = window.requestAnimationFrame(() => {
        scheduledRaf = null;
        syncUnderline();
      });
    };

    let raf1 = 0;
    let raf2 = 0;
    syncUnderline();
    raf1 = window.requestAnimationFrame(() => {
      syncUnderline();
      raf2 = window.requestAnimationFrame(syncUnderline);
    });

    window.addEventListener("resize", scheduleUnderlineSync);
    window.visualViewport?.addEventListener("resize", scheduleUnderlineSync);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      if (scheduledRaf !== null) window.cancelAnimationFrame(scheduledRaf);
      window.removeEventListener("resize", scheduleUnderlineSync);
      window.visualViewport?.removeEventListener("resize", scheduleUnderlineSync);
    };
  }, [isMobileExperience, resolvedActiveTab, tabs.length]);

  useEffect(() => {
    if (!isMobileExperience || !isMobileAddOpen) return;

    const closeIfOutside = (target: EventTarget | null) => {
      const rootNode = mobileRootRef.current;
      if (!rootNode) return;
      if (target instanceof Node && rootNode.contains(target)) return;
      setIsMobileAddOpen(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      closeIfOutside(event.target);
    };

    const handleTouchStart = (event: TouchEvent) => {
      closeIfOutside(event.target);
    };

    const handleWindowScroll = () => {
      setIsMobileAddOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("touchstart", handleTouchStart, true);
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("touchstart", handleTouchStart, true);
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, [isMobileAddOpen, isMobileExperience]);

  const showTrailingAddSlot = tone === "gallery";

  if (isMobileExperience) {
    return (
      <div
        ref={mobileRootRef}
        className="relative z-20 h-[42px] w-[min(90vw,276px)]"
        data-gallery-edit-nav="true"
      >
        <div
          ref={mobileScrollRef}
          className={`no-scrollbar relative flex h-full items-start gap-[31px] overflow-y-visible px-[2px] pr-2 ${
            isMobileAddOpen ? "overflow-x-hidden touch-none" : "overflow-x-auto touch-pan-x"
          }`}
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
            marginLeft: "calc(-1 * (var(--mobile-safe-left) + 16px))",
            width: "calc(100% + var(--mobile-safe-left) + 16px)",
            paddingLeft: "calc(var(--mobile-safe-left) + 18px)",
            scrollPaddingLeft: "calc(var(--mobile-safe-left) + 18px)",
            WebkitMaskImage: isMobileAddOpen || !hasMobileOverflowRight
              ? "none"
              : MOBILE_NAV_FADE_MASK,
            maskImage: isMobileAddOpen || !hasMobileOverflowRight
              ? "none"
              : MOBILE_NAV_FADE_MASK,
          }}
          onPointerDown={handleMobilePointerDown}
          onPointerMove={handleMobilePointerMove}
          onPointerUp={handleMobilePointerEnd}
          onPointerCancel={handleMobilePointerEnd}
        >
          {tabs.map((tab) => {
            const isFullyVisible = mobileTabFullyVisible[tab.id] ?? true;
            return (
              <button
                ref={(node) => {
                  tabButtonRefs.current[tab.id] = node;
                }}
                key={tab.id}
                type="button"
                onClick={handleTabClick(tab.id)}
                aria-disabled={!isFullyVisible}
                className={`group font-ui relative inline-flex h-10 shrink-0 items-center whitespace-nowrap px-0 text-[14px] leading-5 tracking-[0.28px] transition-colors ${
                  isFullyVisible ? "" : "pointer-events-none"
                }`}
              >
                <span aria-hidden="true" className="invisible font-semibold">
                  {toTitleCase(tab.label)}
                </span>
                <span
                  className={`absolute inset-0 inline-flex -translate-y-[1.5px] items-center ${
                    resolvedActiveTab === tab.id
                      ? tone === "archive"
                        ? "font-semibold text-accent"
                        : "font-semibold text-ink"
                      : "font-medium text-inactive transition-colors group-hover:text-meta"
                  }`}
                >
                  {toTitleCase(tab.label)}
                </span>
              </button>
            );
          })}

          {showTrailingAddSlot ? (
            <button
              ref={mobilePlusRef}
              type="button"
              onClick={() => setIsMobileAddOpen((open) => !open)}
              aria-label={isMobileAddOpen ? "Close edit actions" : "Open edit actions"}
              className="font-ui ml-[-8px] inline-flex h-10 shrink-0 items-center whitespace-nowrap text-[20px] font-normal leading-5 tracking-[0.02em] text-inactive transition-colors duration-150 hover:text-meta focus-visible:outline-none focus-visible:text-meta"
            >
              <span aria-hidden="true" className="relative top-[-2px] inline-block">
                {isMobileAddOpen ? "−" : "+"}
              </span>
            </button>
          ) : null}

          {activeUnderlineStyle ? (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute z-[18] h-[1.5px] ${
                smoothUnderline ? "will-change-[left,width,opacity]" : ""
              } ${
                tone === "archive" ? "bg-accent" : "bg-black"
              }`}
              style={{
                left: `${activeUnderlineStyle.left}px`,
                width: `${activeUnderlineStyle.width}px`,
                top: `${ACTIVE_UNDERLINE_TOP_PX}px`,
                opacity: 1,
                transition: smoothUnderline ? MOBILE_IMMERSIVE_UNDERLINE_TRANSITION : undefined,
                transform: "translateZ(0)",
                WebkitTransform: "translateZ(0)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            />
          ) : null}
        </div>

        {showTrailingAddSlot && mobileTrayPos ? (
          <div
            className={`absolute z-[120] transition-all duration-220 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
              isMobileAddOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
            style={{
              left: `${mobileTrayPos.left}px`,
              top: `${mobileTrayPos.top}px`,
              transform: "translate(-100%, -50%)",
            }}
          >
            <div className="inline-flex h-[35px] items-center gap-[5px]">
              <button
                type="button"
                onClick={() => {
                  setIsMobileAddOpen(false);
                  onCreateAction?.();
                }}
                className="inline-flex h-[35px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:text-ink"
              >
                create
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMobileAddOpen(false);
                  onReviewAction?.();
                }}
                className="inline-flex h-[35px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:text-ink"
              >
                review
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={desktopRootRef} className="relative z-20 flex h-12 w-max items-end gap-[47px]" data-gallery-edit-nav="true">
      {tabs.map((tab) => (
        <button
          ref={(node) => {
            tabButtonRefs.current[tab.id] = node;
          }}
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          className="group font-ui relative inline-flex h-10 items-center whitespace-nowrap px-0 text-[14px] leading-5 tracking-[0.28px] transition-colors"
        >
          <span aria-hidden="true" className="invisible font-semibold">
            {toTitleCase(tab.label)}
          </span>
          <span
            className={`absolute inset-0 inline-flex items-center ${
              resolvedActiveTab === tab.id
                ? tone === "archive"
                  ? "font-semibold text-accent after:absolute after:bottom-[-3px] after:left-0 after:h-[1.5px] after:w-full after:bg-accent after:content-['']"
                  : "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-[1.5px] after:w-full after:bg-black after:content-['']"
                : "font-medium text-inactive transition-colors group-hover:text-meta"
            }`}
          >
            {toTitleCase(tab.label)}
          </span>
        </button>
      ))}
    </div>
  );
}
