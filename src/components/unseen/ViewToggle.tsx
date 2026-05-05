import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useViewportMode } from "@/lib/ui/viewportMode";

type ViewToggleProps = {
  mode: "gallery" | "archive";
  view: "grid" | "focus" | "immersive";
  archiveActiveItemCount?: number;
  archiveCapsuleId?: string | null;
};

const ARCHIVE_MIN_IMMERSIVE_ITEMS = 5;
const IMMERSIVE_STATE_KEY = "unseen:immersive-state";
const WORLD2_CAMERA_STATE_KEY = "unseen:world2-camera-state";
const WORLD2_RETURN_CAMERA_KEY = "unseen:world2-return-camera";
const WORLD2_RETURN_REVEAL_KEY = "unseen:world2-return-reveal";
const VIEW_TOGGLE_OPEN_KEY = "unseen:view-toggle-open";
const VIEW_TOGGLE_HOVER_CLOSE_MS = 180;
const VIEW_TOGGLE_COLLAPSE_TRANSITION_CLASS =
  "duration-[200ms] ease-[cubic-bezier(0.22,0.82,0.28,1)]";
const VIEW_TOGGLE_NAV_DELAY_MS = 90;
const VIEW_TOGGLE_MOBILE_NAV_DELAY_MS = 60;
const VIEW_TOGGLE_MOBILE_LOCK_HINT_MS = 1800;

type ToggleGlyphVariant = "grid" | "focus" | "immersive";

type ToggleGlyphProps = {
  isMobile?: boolean;
  variant: ToggleGlyphVariant;
};

const IMMERSIVE_DOTS = [
  { cx: 12, cy: 4.8, r: 2.1 },
  { cx: 7.05, cy: 7.05, r: 2.1 },
  { cx: 16.95, cy: 7.05, r: 2.1 },
  { cx: 4.8, cy: 12, r: 2.1 },
  { cx: 12, cy: 12, r: 2.1 },
  { cx: 19.2, cy: 12, r: 2.1 },
  { cx: 7.05, cy: 16.95, r: 2.1 },
  { cx: 16.95, cy: 16.95, r: 2.1 },
  { cx: 12, cy: 19.2, r: 2.1 },
];

function ToggleGlyph({ isMobile = false, variant }: ToggleGlyphProps) {
  const glyphFrameClass = isMobile
    ? "inline-flex h-[21px] w-[21px] items-center justify-center"
    : "inline-flex h-[20px] w-[20px] items-center justify-center";
  const compactGlyphClass = isMobile ? "h-[18px] w-[18px]" : "h-[17px] w-[17px]";
  const immersiveGlyphClass = isMobile ? "h-[21px] w-[21px]" : "h-[20px] w-[20px]";

  if (variant === "grid") {
    return (
      <span aria-hidden="true" className={glyphFrameClass}>
        <svg viewBox="0 0 16 16" className={`${compactGlyphClass} shrink-0 fill-current`}>
          <circle cx="4.5" cy="4.5" r="2.05" />
          <circle cx="11.5" cy="4.5" r="2.05" />
          <circle cx="4.5" cy="11.5" r="2.05" />
          <circle cx="11.5" cy="11.5" r="2.05" />
        </svg>
      </span>
    );
  }

  if (variant === "focus") {
    return (
      <span aria-hidden="true" className={glyphFrameClass}>
        <svg viewBox="0 0 16 16" className={`${compactGlyphClass} shrink-0 overflow-hidden fill-current`}>
          <circle cx="8" cy="0" r="2.0" />
          <circle cx="8" cy="8" r="2.2" />
          <circle cx="8" cy="16" r="2.0" />
        </svg>
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={glyphFrameClass}>
      <svg viewBox="0 0 24 24" className={`${immersiveGlyphClass} shrink-0 fill-current`}>
        {IMMERSIVE_DOTS.map((dot, index) => (
          <circle key={`${index}-${dot.cx}-${dot.cy}-${dot.r}`} cx={dot.cx} cy={dot.cy} r={dot.r} />
        ))}
      </svg>
    </span>
  );
}

export function ViewToggle({ mode, view, archiveActiveItemCount, archiveCapsuleId }: ViewToggleProps) {
  const router = useRouter();
  const { isIPadExperience, isMobileExperience } = useViewportMode();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingGlyphVariant, setPendingGlyphVariant] = useState<ToggleGlyphVariant | null>(null);
  const [isMobileViewHandoffPending, setIsMobileViewHandoffPending] = useState(false);
  const [mobileLockHintTarget, setMobileLockHintTarget] = useState<ToggleGlyphVariant | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const navTimerRef = useRef<number | null>(null);
  const mobileHandoffTimerRef = useRef<number | null>(null);
  const mobileLockHintTimerRef = useRef<number | null>(null);

  const archiveCapsuleQuery =
    mode === "archive" && archiveCapsuleId ? `?capsule=${encodeURIComponent(archiveCapsuleId)}` : "";
  const gridHref = mode === "gallery" ? "/gallery" : `/archive${archiveCapsuleQuery}`;
  const focusHref = mode === "gallery" ? "/gallery/focus" : `/archive/focus${archiveCapsuleQuery}`;
  const immersiveHref = mode === "gallery" ? "/gallery/immersive" : `/archive/immersive${archiveCapsuleQuery}`;
  const isArchiveImmersiveLocked =
    mode === "archive" && (archiveActiveItemCount ?? 0) < ARCHIVE_MIN_IMMERSIVE_ITEMS;
  const lockHintText = `Save at least ${ARCHIVE_MIN_IMMERSIVE_ITEMS} items`;
  const isTouchLockHintMode = isMobileExperience || isIPadExperience;
  const shouldResetFocusStateOnEntry = view !== "focus";
  const shouldResetImmersiveStateOnEntry = view !== "immersive";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setIsOpen(window.sessionStorage.getItem(VIEW_TOGGLE_OPEN_KEY) === "1");
    } catch {
      setIsOpen(false);
    }
  }, []);

  const activeGlyphVariant = useMemo<ToggleGlyphVariant>(() => {
    if (view === "grid") return "grid";
    if (view === "focus") return "focus";
    return "immersive";
  }, [view]);
  const displayedGlyphVariant = pendingGlyphVariant ?? activeGlyphVariant;

  useEffect(() => {
    setPendingGlyphVariant(null);
  }, [activeGlyphVariant]);

  const handleFocusEntry = () => {
    if (!shouldResetFocusStateOnEntry || typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(IMMERSIVE_STATE_KEY);
    } catch {
      // Ignore storage failures and continue navigation.
    }
  };

  const handleImmersiveEntry = () => {
    if (!shouldResetImmersiveStateOnEntry || typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(WORLD2_CAMERA_STATE_KEY);
      window.sessionStorage.removeItem(WORLD2_RETURN_CAMERA_KEY);
      window.sessionStorage.removeItem(WORLD2_RETURN_REVEAL_KEY);
    } catch {
      // Ignore storage failures and continue navigation.
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (isOpen) {
        window.sessionStorage.setItem(VIEW_TOGGLE_OPEN_KEY, "1");
      } else {
        window.sessionStorage.removeItem(VIEW_TOGGLE_OPEN_KEY);
      }
    } catch {
      // Ignore storage failures.
    }
  }, [isOpen, view, mode, archiveCapsuleId]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current?.contains(target)) {
        setIsOpen(false);
        setMobileLockHintTarget(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setMobileLockHintTarget(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (navTimerRef.current !== null) {
        window.clearTimeout(navTimerRef.current);
        navTimerRef.current = null;
      }
      if (mobileLockHintTimerRef.current !== null) {
        window.clearTimeout(mobileLockHintTimerRef.current);
        mobileLockHintTimerRef.current = null;
      }
    };
  }, []);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const scheduleClose = () => {
    if (!isOpen) return;
    if (closeTimerRef.current !== null) return;
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setIsOpen(false);
    }, VIEW_TOGGLE_HOVER_CLOSE_MS);
  };

  const handleRootMouseLeave = (event: ReactMouseEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && rootRef.current?.contains(nextTarget)) return;
    scheduleClose();
  };

  const closeMenuImmediately = () => {
    cancelScheduledClose();
    setIsOpen(false);
    setMobileLockHintTarget(null);
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(VIEW_TOGGLE_OPEN_KEY);
    } catch {
      // Ignore storage failures.
    }
  };

  const navigateWithSmoothClose =
    (href: string, targetGlyphVariant: ToggleGlyphVariant, onBeforeNavigate?: () => void) =>
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onBeforeNavigate?.();
      setPendingGlyphVariant(targetGlyphVariant);
      closeMenuImmediately();
      if (navTimerRef.current !== null) {
        window.clearTimeout(navTimerRef.current);
      }
      if (isMobileExperience) {
        if (mobileHandoffTimerRef.current !== null) {
          window.clearTimeout(mobileHandoffTimerRef.current);
        }
        setIsMobileViewHandoffPending(true);
      }
      navTimerRef.current = window.setTimeout(() => {
        navTimerRef.current = null;
        router.push(href, { scroll: isMobileExperience && href.includes("/focus") });
      }, isMobileExperience ? VIEW_TOGGLE_MOBILE_NAV_DELAY_MS : VIEW_TOGGLE_NAV_DELAY_MS);
    };

  const showMobileLockHint = (targetGlyphVariant: ToggleGlyphVariant) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!isTouchLockHintMode) return;
    event.preventDefault();
    event.stopPropagation();
    setMobileLockHintTarget(targetGlyphVariant);
    if (mobileLockHintTimerRef.current !== null) {
      window.clearTimeout(mobileLockHintTimerRef.current);
    }
    mobileLockHintTimerRef.current = window.setTimeout(() => {
      mobileLockHintTimerRef.current = null;
      setMobileLockHintTarget(null);
    }, VIEW_TOGGLE_MOBILE_LOCK_HINT_MS);
  };

  useEffect(() => {
    if (!isMobileViewHandoffPending) return;
    mobileHandoffTimerRef.current = window.setTimeout(() => {
      mobileHandoffTimerRef.current = null;
      setIsMobileViewHandoffPending(false);
    }, 360);
    return () => {
      if (mobileHandoffTimerRef.current !== null) {
        window.clearTimeout(mobileHandoffTimerRef.current);
        mobileHandoffTimerRef.current = null;
      }
    };
  }, [activeGlyphVariant, isMobileViewHandoffPending]);

  const optionBaseClass = isMobileExperience
    ? "inline-flex h-[35px] min-h-[35px] w-[35px] min-w-[35px] shrink-0 items-center justify-center rounded-full leading-none transition-colors duration-150 focus-visible:outline-none"
    : "inline-flex h-[33px] min-h-[33px] w-[33px] min-w-[33px] shrink-0 items-center justify-center rounded-full leading-none transition-colors duration-150 focus-visible:outline-none";
  const optionActiveClass = "text-ink";
  const optionInactiveClass = "text-[#6F7381] hover:text-ink focus-visible:text-ink";
  const collapsedButtonClass = isMobileExperience
    ? "inline-flex h-[35px] w-[35px] items-center justify-center rounded-full border-[0.5px] border-transparent bg-transparent text-meta transition-[border-color,background,color,box-shadow,opacity,transform]"
    : "inline-flex h-[33px] w-[33px] items-center justify-center rounded-full border-[0.5px] border-transparent bg-transparent text-meta transition-[border-color,background,color,box-shadow,opacity,transform]";
  const expandedPillClass = isMobileExperience
    ? "inline-flex h-[35px] min-h-[35px] items-center gap-[2px] rounded-[999px] bg-[#F5F5F6] px-[3px] leading-none shadow-[inset_0_0_0_0.5px_#F0F0F1,0_0.5px_1px_rgba(0,0,0,0.05)]"
    : "inline-flex h-[33px] min-h-[33px] items-center gap-[2px] rounded-[999px] bg-[#F5F5F6] px-[3px] leading-none shadow-[inset_0_0_0_0.5px_#F0F0F1,0_0.5px_1px_rgba(0,0,0,0.05)]";
  const lockedOptionWrapperClass = isMobileExperience
    ? "group relative inline-flex h-[35px] w-[35px] items-center justify-center rounded-full text-[#6F7381]"
    : "group relative inline-flex h-[33px] w-[33px] items-center justify-center rounded-full text-[#6F7381]";
  const lockedOptionInnerClass = isMobileExperience
    ? "inline-flex h-[35px] w-[35px] items-center justify-center rounded-full border-0 bg-transparent p-0 text-current transition-colors group-hover:text-ink group-focus-within:text-ink"
    : "inline-flex h-[33px] w-[33px] items-center justify-center rounded-full border-0 bg-transparent p-0 text-current transition-colors group-hover:text-ink group-focus-within:text-ink";
  const lockedHintBaseClass =
    "pointer-events-none absolute right-full top-full z-20 mt-[8px] mr-[-42px] inline-flex h-[29px] w-max max-w-none items-center justify-center whitespace-nowrap rounded-[999px] border border-accent bg-accent px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out";
  const lockedHintVisibilityClass = (targetGlyphVariant: ToggleGlyphVariant) =>
    isTouchLockHintMode
      ? mobileLockHintTarget === targetGlyphVariant
        ? "translate-y-0 opacity-100"
        : "translate-y-1 opacity-0"
      : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100";

  return (
    <div
      ref={rootRef}
      onMouseEnter={cancelScheduledClose}
      onMouseLeave={handleRootMouseLeave}
      className="relative isolate inline-flex items-center"
    >
      <button
        type="button"
        aria-label={isOpen ? "Close view options" : "Open view options"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className={`${collapsedButtonClass} ${VIEW_TOGGLE_COLLAPSE_TRANSITION_CLASS} ${
          isOpen
            ? isMobileExperience
              ? "pointer-events-none translate-y-0 scale-100 opacity-0"
              : "pointer-events-none -translate-y-[2px] scale-95 opacity-0"
            : isMobileViewHandoffPending
              ? "pointer-events-none translate-y-0 scale-100 opacity-0"
              : "translate-y-0 scale-100 opacity-100 hover:border-[#F0F0F1] hover:bg-[#F5F5F6] hover:text-[#5F6471] hover:shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]"
        }`}
      >
        <ToggleGlyph isMobile={isMobileExperience} variant={displayedGlyphVariant} />
      </button>

      <div
        className={`absolute right-0 top-1/2 z-20 -translate-y-1/2 transform-gpu transition-[opacity,transform] ${VIEW_TOGGLE_COLLAPSE_TRANSITION_CLASS} ${
          isOpen ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-[8px] opacity-0"
        }`}
      >
        <div className={expandedPillClass}>
          <Link
            href={gridHref}
            scroll={false}
            onClick={navigateWithSmoothClose(gridHref, "grid")}
            aria-label="Grid view"
            className={`${optionBaseClass} ${view === "grid" ? optionActiveClass : optionInactiveClass}`}
          >
            <ToggleGlyph isMobile={isMobileExperience} variant="grid" />
          </Link>

          {isArchiveImmersiveLocked ? (
            <div className={lockedOptionWrapperClass}>
              <button
                type="button"
                aria-disabled="true"
                aria-label={`Focus view unavailable. ${lockHintText}`}
                tabIndex={isTouchLockHintMode ? 0 : -1}
                onMouseDown={(event) => {
                  if (!isTouchLockHintMode) event.preventDefault();
                }}
                onClick={showMobileLockHint("focus")}
                className={lockedOptionInnerClass}
              >
                <ToggleGlyph isMobile={isMobileExperience} variant="focus" />
              </button>
              <span
                className={`${lockedHintBaseClass} ${lockedHintVisibilityClass("focus")}`}
                aria-hidden="true"
              >
                {lockHintText}
              </span>
            </div>
          ) : (
            <Link
              href={focusHref}
              scroll={false}
              onClick={navigateWithSmoothClose(focusHref, "focus", handleFocusEntry)}
              aria-label="Focus view"
              className={`${optionBaseClass} ${view === "focus" ? optionActiveClass : optionInactiveClass}`}
            >
              <ToggleGlyph isMobile={isMobileExperience} variant="focus" />
            </Link>
          )}

          {mode === "gallery" ? (
            <Link
              href={immersiveHref}
              scroll={false}
              onClick={navigateWithSmoothClose(immersiveHref, "immersive", handleImmersiveEntry)}
              aria-label="Immersive view"
              className={`${optionBaseClass} ${view === "immersive" ? optionActiveClass : optionInactiveClass}`}
            >
              <ToggleGlyph isMobile={isMobileExperience} variant="immersive" />
            </Link>
          ) : isArchiveImmersiveLocked ? (
            <div className={lockedOptionWrapperClass}>
              <button
                type="button"
                aria-disabled="true"
                aria-label={`Immersive view unavailable. ${lockHintText}`}
                tabIndex={isTouchLockHintMode ? 0 : -1}
                onMouseDown={(event) => {
                  if (!isTouchLockHintMode) event.preventDefault();
                }}
                onClick={showMobileLockHint("immersive")}
                className={lockedOptionInnerClass}
              >
                <ToggleGlyph isMobile={isMobileExperience} variant="immersive" />
              </button>
              <span
                className={`${lockedHintBaseClass} ${lockedHintVisibilityClass("immersive")}`}
                aria-hidden="true"
              >
                {lockHintText}
              </span>
            </div>
          ) : (
            <Link
              href={immersiveHref}
              scroll={false}
              onClick={navigateWithSmoothClose(immersiveHref, "immersive", handleImmersiveEntry)}
              aria-label="Immersive view"
              className={`${optionBaseClass} ${view === "immersive" ? optionActiveClass : optionInactiveClass}`}
            >
              <ToggleGlyph isMobile={isMobileExperience} variant="immersive" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
