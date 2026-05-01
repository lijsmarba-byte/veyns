import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";

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
const VIEW_TOGGLE_HOVER_CLOSE_MS = 260;
const VIEW_TOGGLE_COLLAPSE_TRANSITION_CLASS =
  "duration-[240ms] ease-[cubic-bezier(0.22,0.75,0.28,1)]";
const VIEW_TOGGLE_NAV_DELAY_MS = 210;

type ToggleGlyphVariant = "grid" | "focus" | "immersive";

type ToggleGlyphProps = {
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

function ToggleGlyph({ variant }: ToggleGlyphProps) {
  if (variant === "grid") {
    return (
      <span aria-hidden="true" className="inline-flex h-[17px] w-[17px] items-center justify-center">
        <svg viewBox="0 0 16 16" className="h-[17px] w-[17px] fill-current">
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
      <span aria-hidden="true" className="inline-flex h-[17px] w-[17px] items-center justify-center">
        <svg viewBox="0 0 16 16" className="h-[17px] w-[17px] fill-current">
          <circle cx="8" cy="0" r="2.0" />
          <circle cx="8" cy="8" r="2.2" />
          <circle cx="8" cy="16" r="2.0" />
        </svg>
      </span>
    );
  }

  return (
    <span aria-hidden="true" className="inline-flex h-[20px] w-[20px] items-center justify-center">
      <svg viewBox="0 0 24 24" className="h-[20px] w-[20px] fill-current">
        {IMMERSIVE_DOTS.map((dot, index) => (
          <circle key={`${index}-${dot.cx}-${dot.cy}-${dot.r}`} cx={dot.cx} cy={dot.cy} r={dot.r} />
        ))}
      </svg>
    </span>
  );
}

export function ViewToggle({ mode, view, archiveActiveItemCount, archiveCapsuleId }: ViewToggleProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(VIEW_TOGGLE_OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const navTimerRef = useRef<number | null>(null);

  const archiveCapsuleQuery =
    mode === "archive" && archiveCapsuleId ? `?capsule=${encodeURIComponent(archiveCapsuleId)}` : "";
  const gridHref = mode === "gallery" ? "/gallery" : `/archive${archiveCapsuleQuery}`;
  const focusHref = mode === "gallery" ? "/gallery/focus" : `/archive/focus${archiveCapsuleQuery}`;
  const immersiveHref = mode === "gallery" ? "/gallery/immersive" : `/archive/immersive${archiveCapsuleQuery}`;
  const isArchiveImmersiveLocked =
    mode === "archive" && (archiveActiveItemCount ?? 0) < ARCHIVE_MIN_IMMERSIVE_ITEMS;
  const lockHintText = `Save at least ${ARCHIVE_MIN_IMMERSIVE_ITEMS} items`;
  const shouldResetFocusStateOnEntry = view !== "focus";
  const shouldResetImmersiveStateOnEntry = view !== "immersive";

  const activeGlyphVariant = useMemo<ToggleGlyphVariant>(() => {
    if (view === "grid") return "grid";
    if (view === "focus") return "focus";
    return "immersive";
  }, [view]);

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
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
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
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(VIEW_TOGGLE_OPEN_KEY);
    } catch {
      // Ignore storage failures.
    }
  };

  const navigateWithSmoothClose =
    (href: string, onBeforeNavigate?: () => void) => (event: ReactMouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onBeforeNavigate?.();
      closeMenuImmediately();
      if (navTimerRef.current !== null) {
        window.clearTimeout(navTimerRef.current);
      }
      navTimerRef.current = window.setTimeout(() => {
        navTimerRef.current = null;
        router.push(href, { scroll: false });
      }, VIEW_TOGGLE_NAV_DELAY_MS);
    };

  const optionBaseClass =
    "inline-flex h-[33px] w-[33px] items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none";
  const optionActiveClass = "text-ink";
  const optionInactiveClass = "text-[#6F7381] hover:text-ink focus-visible:text-ink";

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
        className={`inline-flex h-[33px] w-[33px] items-center justify-center rounded-full border-[0.5px] border-transparent bg-transparent text-meta transition-[border-color,background,color,box-shadow,opacity,transform] ${VIEW_TOGGLE_COLLAPSE_TRANSITION_CLASS} ${
          isOpen
            ? "pointer-events-none -translate-y-[2px] scale-95 opacity-0"
            : "translate-y-0 scale-100 opacity-100 hover:border-[#F0F0F1] hover:bg-[#F5F5F6] hover:text-[#5F6471] hover:shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]"
        }`}
      >
        <ToggleGlyph variant={activeGlyphVariant} />
      </button>

      <div
        className={`absolute right-0 top-1/2 z-20 -translate-y-1/2 transition-all ${VIEW_TOGGLE_COLLAPSE_TRANSITION_CLASS} ${
          isOpen ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-[8px] opacity-0"
        }`}
      >
        <div className="inline-flex h-[33px] items-center gap-[2px] rounded-[999px] bg-[#F5F5F6] px-[3px] shadow-[inset_0_0_0_0.5px_#F0F0F1,0_0.5px_1px_rgba(0,0,0,0.05)]">
          <Link
            href={gridHref}
            scroll={false}
            onClick={navigateWithSmoothClose(gridHref)}
            aria-label="Grid view"
            className={`${optionBaseClass} ${view === "grid" ? optionActiveClass : optionInactiveClass}`}
          >
            <ToggleGlyph variant="grid" />
          </Link>

          {isArchiveImmersiveLocked ? (
            <div className="group relative inline-flex h-[33px] w-[33px] items-center justify-center rounded-full text-[#6F7381]">
              <span
                aria-disabled="true"
                className="inline-flex h-[33px] w-[33px] items-center justify-center rounded-full transition-colors group-hover:text-ink group-focus-within:text-ink"
              >
                <ToggleGlyph variant="focus" />
              </span>
              <span
                className="pointer-events-none absolute right-full top-full z-20 mt-[8px] mr-[-42px] inline-flex h-[29px] w-max max-w-none translate-y-1 items-center justify-center whitespace-nowrap rounded-[999px] border border-accent bg-accent px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                aria-hidden="true"
              >
                {lockHintText}
              </span>
            </div>
          ) : (
            <Link
              href={focusHref}
              scroll={false}
              onClick={navigateWithSmoothClose(focusHref, handleFocusEntry)}
              aria-label="Focus view"
              className={`${optionBaseClass} ${view === "focus" ? optionActiveClass : optionInactiveClass}`}
            >
              <ToggleGlyph variant="focus" />
            </Link>
          )}

          {mode === "gallery" ? (
            <Link
              href={immersiveHref}
              scroll={false}
              onClick={navigateWithSmoothClose(immersiveHref, handleImmersiveEntry)}
              aria-label="Immersive view"
              className={`${optionBaseClass} ${view === "immersive" ? optionActiveClass : optionInactiveClass}`}
            >
              <ToggleGlyph variant="immersive" />
            </Link>
          ) : isArchiveImmersiveLocked ? (
            <div className="group relative inline-flex h-[33px] w-[33px] items-center justify-center rounded-full text-[#6F7381]">
              <span
                aria-disabled="true"
                className="inline-flex h-[33px] w-[33px] items-center justify-center rounded-full transition-colors group-hover:text-ink group-focus-within:text-ink"
              >
                <ToggleGlyph variant="immersive" />
              </span>
              <span
                className="pointer-events-none absolute right-full top-full z-20 mt-[8px] mr-[-42px] inline-flex h-[29px] w-max max-w-none translate-y-1 items-center justify-center whitespace-nowrap rounded-[999px] border border-accent bg-accent px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                aria-hidden="true"
              >
                {lockHintText}
              </span>
            </div>
          ) : (
            <Link
              href={immersiveHref}
              scroll={false}
              onClick={navigateWithSmoothClose(immersiveHref, handleImmersiveEntry)}
              aria-label="Immersive view"
              className={`${optionBaseClass} ${view === "immersive" ? optionActiveClass : optionInactiveClass}`}
            >
              <ToggleGlyph variant="immersive" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
