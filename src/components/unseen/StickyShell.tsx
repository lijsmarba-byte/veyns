"use client";

import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ModePill } from "@/components/unseen/ModePill";
import { GalleryEditNav } from "@/components/unseen/GalleryEditNav";
import { ViewToggle } from "@/components/unseen/ViewToggle";
import { StickyHeightSync } from "@/components/unseen/StickyHeightSync";
import { mockUsers } from "@/data/mockUsers";

type StickyMode = "gallery" | "archive";

type StickyShellProps = {
  mode: StickyMode;
  view: "grid" | "focus" | "immersive";
  issueNumber?: string;
  archiveActiveItemCount?: number;
};

type OverlaySurface = "profile" | "settings" | "feedback" | "about";
type ProfileOverlayTab = "signature" | "reference-sets" | "quiet-constraints";

const quickMenuItems: Array<{ id: OverlaySurface; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "settings", label: "Settings" },
  { id: "feedback", label: "Feedback" },
  { id: "about", label: "About" },
];

const quickMenuSocialSymbols = [
  { id: "instagram", label: "Instagram", src: "/logos/icons8-instagram.svg", href: "https://www.instagram.com/cenoir.co" },
  { id: "tiktok", label: "TikTok", src: "/logos/icons8-tiktok.svg", href: "https://www.tiktok.com/@cenoir_co" },
  { id: "substack", label: "Substack", src: "/logos/icons8-substack.svg", href: "https://substack.com/" },
  { id: "pinterest", label: "Pinterest", src: "/logos/icons8-pinterest.svg", href: "https://www.pinterest.com/" },
];

const profileOverlayTabs: Array<{ id: ProfileOverlayTab; label: string }> = [
  { id: "signature", label: "Signature" },
  { id: "reference-sets", label: "References" },
  { id: "quiet-constraints", label: "Constraints" },
];

const archiveCapsuleTabs = [
  { id: "main", label: "MAIN CAPSULE" },
  { id: "capsule1", label: "CAPSULE1" },
  { id: "capsule2", label: "CAPSULE2" },
  { id: "capsule3", label: "CAPSULE3" },
];

const MODE_SWITCH_TOP_PX = 17;
const MODE_SWITCH_HEIGHT_PX = 34;
const TITLE_BLOCK_TOP_PX = 59;
const TITLE_BLOCK_HEIGHT_PX = 45;
const TITLE_TEXT_SIZE_PX = 30;
const GALLERY_STICKY_BACKDROP_HEIGHT_PX = 189;
const ARCHIVE_STICKY_BACKDROP_HEIGHT_PX = 188;
const GALLERY_STICKY_STACK_HEIGHT_PX = 203;
const ARCHIVE_STICKY_STACK_HEIGHT_PX = 188;
const DIVIDER_COLOR = "#F0F0F1";
const DIVIDER_SHADOW = "0 0.5px 0.8px rgba(0,0,0,0.012)";
const QUICK_MENU_RAIL_WIDTH_CSS = "min(202px, calc(100vw - 28px))";
const COMPACT_MENU_RAIL_WIDTH_CSS = "min(202px, 42vw)";
const COMPACT_MENU_CONTENT_WIDTH_CSS = "min(680px, calc(100vw - min(202px, 42vw) - 28px))";
const COMPACT_MENU_SHEET_WIDTH_CSS = `calc(${COMPACT_MENU_CONTENT_WIDTH_CSS} + ${COMPACT_MENU_RAIL_WIDTH_CSS})`;
const PROFILE_MENU_CONTENT_WIDTH_CSS = "calc(100vw - 82px)";
const MENU_RAIL_CONTENT_LEFT_CLASS = "pl-9 md:pl-[52px]";
const MENU_RAIL_CONTENT_RIGHT_CLASS = "pr-4 md:pr-10";
const MENU_TRANSITION_MS = 650;
const MENU_TRANSITION_DURATION_CSS = `${MENU_TRANSITION_MS}ms`;
const MENU_OPEN_EASING_CSS = "cubic-bezier(0.19,1,0.22,1)";
const MENU_CLOSE_EASING_CSS = "cubic-bezier(0.33,0,0.67,1)";
const QUICK_MENU_TRANSITION_MS = MENU_TRANSITION_MS;
const COMPACT_OVERLAY_TRANSITION_MS = MENU_TRANSITION_MS;
const COMPACT_OVERLAY_RAIL_EXIT_OVERLAP_MS = 120;
const HOVER_CLOSE_GRACE_MS = 480;
const HOVER_CLOSE_BUFFER_PX = 44;
const PROFILE_HOVER_CLOSE_GRACE_MS = 180;
const PROFILE_HOVER_CLOSE_BUFFER_PX = 16;
const MENU_OPEN_TRANSITION_CLASS = "duration-[650ms] ease-[cubic-bezier(0.19,1,0.22,1)]";
const MENU_CLOSE_TRANSITION_CLASS = "duration-[650ms] ease-[cubic-bezier(0.33,0,0.67,1)]";
const MENU_ICON_LINE_WIDTH_PX = 18;
const MENU_ICON_BOX_HEIGHT_PX = 14;
const MENU_ICON_CENTER_Y_PX = MENU_ICON_BOX_HEIGHT_PX / 2;
const MENU_ICON_HALF_GAP_PX = 3;
const MENU_ICON_STROKE_PX = 1.5;
const MENU_ICON_STROKE_SAFARI_PX = 1.5;
const MENU_ICON_MORPH_OPEN_MS = 720;
const MENU_ICON_MORPH_CLOSE_MS = 220;
const EDIT_ACTION_MENU_TRANSITION_CLASS = "duration-[240ms] ease-[cubic-bezier(0.22,0.75,0.28,1)]";

function formatCalibrationMonth(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function StickyShell({
  mode,
  view,
  issueNumber = "04",
  archiveActiveItemCount,
}: StickyShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [quickMenuPhase, setQuickMenuPhase] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const [compactOverlayPhase, setCompactOverlayPhase] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const [compactOverlayOrigin, setCompactOverlayOrigin] = useState<"menu" | "edge">("edge");
  const [compactContentPhase, setCompactContentPhase] = useState<"entering" | "open">("open");
  const [isCompactOverlayRailClosing, setIsCompactOverlayRailClosing] = useState(false);
  const [activeOverlaySurface, setActiveOverlaySurface] = useState<OverlaySurface | null>(null);
  const [activeProfileOverlayTab, setActiveProfileOverlayTab] = useState<ProfileOverlayTab>("signature");
  const [profileOverlayEditFlow, setProfileOverlayEditFlow] = useState<"create" | null>(null);
  const [isEditActionMenuOpen, setIsEditActionMenuOpen] = useState(false);
  const activeProfileUser = mockUsers[0] ?? null;
  const fallbackIssueNumber = Number(issueNumber);
  const resolvedIssueNumber =
    activeProfileUser?.userId ?? (Number.isFinite(fallbackIssueNumber) ? fallbackIssueNumber : 0);
  const activeIssueNumber = String(resolvedIssueNumber).padStart(2, "0");
  const profileUserIdLabel = String(activeProfileUser?.userId ?? 0).padStart(3, "0");
  const profileCalibrationLabel = formatCalibrationMonth(activeProfileUser?.lastCalibrationDate);
  const archiveOwnerName = activeProfileUser?.name?.trim() || "User";
  const isGallery = mode === "gallery";
  const archiveCapsuleId = !isGallery ? searchParams.get("capsule") : null;
  const headerColorClass = isGallery ? "text-ink" : "text-accent";
  const menuActiveColorClass = isGallery ? "text-ink" : "text-accent";
  const menuHoverColorClass = isGallery ? "hover:text-ink" : "hover:text-accent";
  const hoverLabelPrefix = isGallery ? "New-" : "Saved-";
  const hoverLabelWord = "Items";
  const titleTextTopPx = TITLE_BLOCK_TOP_PX + (TITLE_BLOCK_HEIGHT_PX - TITLE_TEXT_SIZE_PX);
  const modeSwitchBottomPx = MODE_SWITCH_TOP_PX + MODE_SWITCH_HEIGHT_PX;
  const lowerNavLiftPx = Math.max(0, titleTextTopPx - modeSwitchBottomPx);
  const stickyBackdropHeightPx =
    (isGallery ? GALLERY_STICKY_BACKDROP_HEIGHT_PX : ARCHIVE_STICKY_BACKDROP_HEIGHT_PX) - lowerNavLiftPx;
  const stickyStackHeightPx =
    (isGallery ? GALLERY_STICKY_STACK_HEIGHT_PX : ARCHIVE_STICKY_STACK_HEIGHT_PX) - lowerNavLiftPx;
  const dividerTopPx = 187 - lowerNavLiftPx;
  const stickyBoundaryHeightPx = dividerTopPx + 1;
  const effectiveStickyBackdropHeightPx = Math.min(stickyBackdropHeightPx, stickyBoundaryHeightPx);
  const effectiveStickyStackHeightPx = Math.min(stickyStackHeightPx, stickyBoundaryHeightPx);
  const isProfileOverlayOpen = false;
  const isCompactOverlayOpen =
    activeOverlaySurface === "profile" ||
    activeOverlaySurface === "settings" ||
    activeOverlaySurface === "feedback" ||
    activeOverlaySurface === "about";
  const isCompactProfileOverlay = activeOverlaySurface === "profile";
  const shouldHideCompactMenuLinks = isCompactProfileOverlay && compactOverlayPhase === "open";
  const isSettingsOrFeedbackOverlay = activeOverlaySurface === "settings" || activeOverlaySurface === "feedback";
  const isAnyOverlayOpen = isProfileOverlayOpen || isCompactOverlayOpen;
  const isQuickMenuVisible = quickMenuPhase !== "closed";
  const isQuickMenuEntering = quickMenuPhase === "open";
  const compactOverlayTargetWidth = isCompactProfileOverlay ? PROFILE_MENU_CONTENT_WIDTH_CSS : COMPACT_MENU_SHEET_WIDTH_CSS;
  const compactOverlayShouldExtendFromMenu = compactOverlayOrigin === "menu";
  const compactOverlayCurrentWidth =
    compactOverlayShouldExtendFromMenu && compactOverlayPhase !== "open"
      ? COMPACT_MENU_RAIL_WIDTH_CSS
      : compactOverlayTargetWidth;
  const shouldKeepExtendingOverlayVisible =
    compactOverlayShouldExtendFromMenu && (compactOverlayPhase === "opening" || compactOverlayPhase === "closing");
  const shouldShowCompactOverlay = compactOverlayPhase === "open" || shouldKeepExtendingOverlayVisible;
  const shouldSlideCompactOverlayRail =
    compactOverlayShouldExtendFromMenu && compactOverlayPhase === "closing" && isCompactOverlayRailClosing;
  const isMenuTriggerMorphed = isQuickMenuVisible || isAnyOverlayOpen;
  const menuButtonAriaLabel = isQuickMenuOpen || isAnyOverlayOpen ? "Close menu" : "Open menu";
  const editActionMenuRef = useRef<HTMLDivElement | null>(null);
  const quickMenuSurfaceRef = useRef<HTMLDivElement | null>(null);
  const quickMenuBrandLabelRef = useRef<HTMLSpanElement | null>(null);
  const compactContentSurfaceRef = useRef<HTMLDivElement | null>(null);
  const compactMenuSurfaceRef = useRef<HTMLDivElement | null>(null);
  const quickMenuAnimationRef = useRef<number | null>(null);
  const quickMenuCloseTimerRef = useRef<number | null>(null);
  const quickMenuHoverCloseTimerRef = useRef<number | null>(null);
  const compactOverlayAnimationRef = useRef<number | null>(null);
  const compactContentAnimationRef = useRef<number | null>(null);
  const compactOverlayCloseTimerRef = useRef<number | null>(null);
  const compactOverlayHoverCloseTimerRef = useRef<number | null>(null);
  const compactIframeRef = useRef<HTMLIFrameElement | null>(null);
  const compactContentScrollRef = useRef<HTMLDivElement | null>(null);
  const compactIframeCleanupRef = useRef<(() => void) | null>(null);
  const isPointerInWindowRef = useRef(true);
  const [compactSettingsFeedbackHeight, setCompactSettingsFeedbackHeight] = useState<number | null>(null);
  const [quickMenuContentInsetPx, setQuickMenuContentInsetPx] = useState<number>(52);
  const safariUa = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const safariVendor = typeof navigator !== "undefined" ? navigator.vendor : "";
  const isChromiumBased = /(Chrome|CriOS|Chromium|Edg|OPR|OPiOS|FxiOS)/i.test(safariUa);
  const isSafariBrowser = /Safari/i.test(safariUa) && /Apple Computer/i.test(safariVendor) && !isChromiumBased;
  const menuIconStrokePx = isSafariBrowser ? MENU_ICON_STROKE_SAFARI_PX : MENU_ICON_STROKE_PX;
  const menuIconClosedTopPx = MENU_ICON_CENTER_Y_PX - MENU_ICON_HALF_GAP_PX - menuIconStrokePx / 2;
  const menuIconClosedBottomPx = MENU_ICON_CENTER_Y_PX + MENU_ICON_HALF_GAP_PX - menuIconStrokePx / 2;
  const menuIconCenterPx = MENU_ICON_CENTER_Y_PX - menuIconStrokePx / 2;
  const menuIconMorphDurationMs = isMenuTriggerMorphed ? MENU_ICON_MORPH_OPEN_MS : MENU_ICON_MORPH_CLOSE_MS;
  const menuIconLineBaseStyle: CSSProperties = {
    width: `${MENU_ICON_LINE_WIDTH_PX}px`,
    height: `${menuIconStrokePx}px`,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  const clearQuickMenuTimers = () => {
    if (quickMenuAnimationRef.current !== null) {
      window.cancelAnimationFrame(quickMenuAnimationRef.current);
      quickMenuAnimationRef.current = null;
    }
    if (quickMenuCloseTimerRef.current !== null) {
      window.clearTimeout(quickMenuCloseTimerRef.current);
      quickMenuCloseTimerRef.current = null;
    }
    if (quickMenuHoverCloseTimerRef.current !== null) {
      window.clearTimeout(quickMenuHoverCloseTimerRef.current);
      quickMenuHoverCloseTimerRef.current = null;
    }
  };

  const clearCompactOverlayAnimation = () => {
    if (compactOverlayAnimationRef.current !== null) {
      window.cancelAnimationFrame(compactOverlayAnimationRef.current);
      compactOverlayAnimationRef.current = null;
    }
    if (compactContentAnimationRef.current !== null) {
      window.cancelAnimationFrame(compactContentAnimationRef.current);
      compactContentAnimationRef.current = null;
    }
    if (compactOverlayCloseTimerRef.current !== null) {
      window.clearTimeout(compactOverlayCloseTimerRef.current);
      compactOverlayCloseTimerRef.current = null;
    }
    if (compactOverlayHoverCloseTimerRef.current !== null) {
      window.clearTimeout(compactOverlayHoverCloseTimerRef.current);
      compactOverlayHoverCloseTimerRef.current = null;
    }
  };

  const cancelQuickMenuHoverClose = () => {
    if (quickMenuHoverCloseTimerRef.current === null) return;
    window.clearTimeout(quickMenuHoverCloseTimerRef.current);
    quickMenuHoverCloseTimerRef.current = null;
  };

  const scheduleQuickMenuHoverClose = () => {
    if (!isPointerInWindowRef.current) return;
    if (quickMenuHoverCloseTimerRef.current !== null) return;
    quickMenuHoverCloseTimerRef.current = window.setTimeout(() => {
      quickMenuHoverCloseTimerRef.current = null;
      closeQuickMenu();
    }, HOVER_CLOSE_GRACE_MS);
  };

  const cancelCompactOverlayHoverClose = () => {
    if (compactOverlayHoverCloseTimerRef.current === null) return;
    window.clearTimeout(compactOverlayHoverCloseTimerRef.current);
    compactOverlayHoverCloseTimerRef.current = null;
  };

  const scheduleCompactOverlayHoverClose = () => {
    if (!isPointerInWindowRef.current) return;
    if (compactOverlayHoverCloseTimerRef.current !== null) return;
    const hoverCloseGraceMs = isCompactProfileOverlay ? PROFILE_HOVER_CLOSE_GRACE_MS : HOVER_CLOSE_GRACE_MS;
    compactOverlayHoverCloseTimerRef.current = window.setTimeout(() => {
      compactOverlayHoverCloseTimerRef.current = null;
      closeOverlaySurface();
    }, hoverCloseGraceMs);
  };

  const isPointInsideBufferedRect = (rect: DOMRect, x: number, y: number, bufferPx: number) =>
    x >= rect.left - bufferPx &&
    x <= rect.right + bufferPx &&
    y >= rect.top - bufferPx &&
    y <= rect.bottom + bufferPx;

  const handleQuickMenuOverlayMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = quickMenuSurfaceRef.current?.getBoundingClientRect();
    if (rect && isPointInsideBufferedRect(rect, event.clientX, event.clientY, HOVER_CLOSE_BUFFER_PX)) {
      cancelQuickMenuHoverClose();
      return;
    }
    scheduleQuickMenuHoverClose();
  };

  const handleCompactOverlayMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const x = event.clientX;
    const y = event.clientY;
    const hoverCloseBufferPx = isCompactProfileOverlay ? PROFILE_HOVER_CLOSE_BUFFER_PX : HOVER_CLOSE_BUFFER_PX;
    const contentRect = compactContentSurfaceRef.current?.getBoundingClientRect();
    const menuRect = compactMenuSurfaceRef.current?.getBoundingClientRect();
    const isInsideContent = contentRect ? isPointInsideBufferedRect(contentRect, x, y, hoverCloseBufferPx) : false;
    const isInsideMenu = menuRect ? isPointInsideBufferedRect(menuRect, x, y, hoverCloseBufferPx) : false;

    if (isInsideContent || isInsideMenu) {
      cancelCompactOverlayHoverClose();
      return;
    }
    scheduleCompactOverlayHoverClose();
  };

  const scheduleQuickMenuOpen = () => {
    quickMenuAnimationRef.current = window.requestAnimationFrame(() => {
      quickMenuAnimationRef.current = window.requestAnimationFrame(() => {
        quickMenuAnimationRef.current = null;
        setQuickMenuPhase("open");
      });
    });
  };

  const scheduleCompactOverlayOpen = () => {
    compactOverlayAnimationRef.current = window.requestAnimationFrame(() => {
      compactOverlayAnimationRef.current = window.requestAnimationFrame(() => {
        compactOverlayAnimationRef.current = null;
        setCompactOverlayPhase("open");
      });
    });
  };

  const scheduleCompactContentOpen = () => {
    compactContentAnimationRef.current = window.requestAnimationFrame(() => {
      compactContentAnimationRef.current = window.requestAnimationFrame(() => {
        compactContentAnimationRef.current = null;
        setCompactContentPhase("open");
      });
    });
  };

  const closeOverlaySurface = () => {
    if (compactOverlayPhase === "closing" || compactOverlayPhase === "closed") return;
    clearCompactOverlayAnimation();
    const shouldCloseThroughMenuRail = compactOverlayOrigin === "menu";
    const finishCompactOverlayClose = () => {
      compactOverlayCloseTimerRef.current = null;
      setCompactOverlayPhase("closed");
      setCompactContentPhase("open");
      setCompactOverlayOrigin("edge");
      setIsCompactOverlayRailClosing(false);
      setCompactSettingsFeedbackHeight(null);
      setActiveOverlaySurface(null);
      setQuickMenuPhase("closed");
    };

    if (
      activeOverlaySurface === "profile" ||
      activeOverlaySurface === "settings" ||
      activeOverlaySurface === "feedback" ||
      activeOverlaySurface === "about"
    ) {
      clearQuickMenuTimers();
      setIsQuickMenuOpen(false);
      setQuickMenuPhase(shouldCloseThroughMenuRail ? "open" : "closing");
      setCompactOverlayPhase("closing");
      setCompactContentPhase("entering");
      setIsCompactOverlayRailClosing(false);
      compactOverlayCloseTimerRef.current = window.setTimeout(() => {
        if (!shouldCloseThroughMenuRail) {
          finishCompactOverlayClose();
          return;
        }
        setIsCompactOverlayRailClosing(true);
        setQuickMenuPhase("closing");
        compactOverlayCloseTimerRef.current = window.setTimeout(finishCompactOverlayClose, QUICK_MENU_TRANSITION_MS);
      }, Math.max(0, COMPACT_OVERLAY_TRANSITION_MS - COMPACT_OVERLAY_RAIL_EXIT_OVERLAP_MS));
      return;
    }
    setCompactOverlayPhase("closed");
    setCompactContentPhase("open");
    setCompactOverlayOrigin("edge");
    setIsCompactOverlayRailClosing(false);
    setCompactSettingsFeedbackHeight(null);
    setActiveOverlaySurface(null);
  };

  const openQuickMenu = () => {
    clearQuickMenuTimers();
    setIsQuickMenuOpen(true);
    setQuickMenuPhase("opening");
    scheduleQuickMenuOpen();
  };

  const closeQuickMenu = () => {
    if (quickMenuPhase === "closing" || quickMenuPhase === "closed") return;
    clearQuickMenuTimers();
    setIsQuickMenuOpen(false);
    setQuickMenuPhase("closing");
    quickMenuCloseTimerRef.current = window.setTimeout(() => {
      quickMenuCloseTimerRef.current = null;
      setQuickMenuPhase("closed");
    }, QUICK_MENU_TRANSITION_MS);
  };

  const closeQuickMenuOnSurfaceLeave = (nextTarget: EventTarget | null) => {
    if (!nextTarget) return;
    if (nextTarget instanceof Node && quickMenuSurfaceRef.current?.contains(nextTarget)) return;
    scheduleQuickMenuHoverClose();
  };

  const closeCompactOverlayOnSurfaceLeave = (nextTarget: EventTarget | null) => {
    if (!nextTarget) {
      scheduleCompactOverlayHoverClose();
      return;
    }
    if (
      nextTarget instanceof Node &&
      (compactContentSurfaceRef.current?.contains(nextTarget) ||
        compactMenuSurfaceRef.current?.contains(nextTarget))
    ) {
      return;
    }
    scheduleCompactOverlayHoverClose();
  };

  const clearCompactIframeObservers = () => {
    if (compactIframeCleanupRef.current) {
      compactIframeCleanupRef.current();
      compactIframeCleanupRef.current = null;
    }
  };

  const syncCompactSettingsFeedbackHeight = () => {
    if (!isSettingsOrFeedbackOverlay) {
      setCompactSettingsFeedbackHeight(null);
      return;
    }
    const iframe = compactIframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    const compactContent = doc.querySelector<HTMLElement>("[data-compact-overlay-content]");
    const contentHeight = compactContent
      ? Math.ceil(compactContent.getBoundingClientRect().height)
      : Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0);
    if (contentHeight <= 0) return;
    const viewportCap = Math.round(window.innerHeight * 0.78);
    const clampedHeight = Math.min(contentHeight, viewportCap);
    setCompactSettingsFeedbackHeight(clampedHeight);
  };

  const bindCompactIframeObservers = () => {
    clearCompactIframeObservers();
    if (!isSettingsOrFeedbackOverlay) return;
    const iframe = compactIframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    if (!doc || !frameWindow) return;

    let rafId = 0;
    const scheduleSync = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(syncCompactSettingsFeedbackHeight);
    };

    const observer = new ResizeObserver(scheduleSync);
    if (doc.documentElement) observer.observe(doc.documentElement);
    if (doc.body) observer.observe(doc.body);

    frameWindow.addEventListener("resize", scheduleSync);
    window.addEventListener("resize", scheduleSync);
    scheduleSync();

    compactIframeCleanupRef.current = () => {
      observer.disconnect();
      frameWindow.removeEventListener("resize", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  };

  useEffect(() => {
    clearCompactIframeObservers();
    return () => {
      clearCompactIframeObservers();
    };
  }, [isCompactOverlayOpen, isSettingsOrFeedbackOverlay, activeOverlaySurface]);

  useEffect(() => {
    if (!isAnyOverlayOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAnyOverlayOpen]);

  useEffect(() => {
    if (!isEditActionMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsEditActionMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEditActionMenuOpen]);

  useEffect(() => {
    if (!isQuickMenuVisible) return;

    const syncInset = () => {
      const surface = quickMenuSurfaceRef.current;
      const brand = quickMenuBrandLabelRef.current;
      if (!surface || !brand) return;
      const surfaceRect = surface.getBoundingClientRect();
      const brandRect = brand.getBoundingClientRect();
      const nextInset = Math.max(0, Math.round(brandRect.left - surfaceRect.left));
      if (Number.isFinite(nextInset) && nextInset !== quickMenuContentInsetPx) {
        setQuickMenuContentInsetPx(nextInset);
      }
    };

    let raf = window.requestAnimationFrame(syncInset);
    const handleResize = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(syncInset);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
    };
  }, [isQuickMenuVisible, quickMenuContentInsetPx]);

  useEffect(() => {
    const handleWindowLeave = (event: globalThis.MouseEvent | PointerEvent) => {
      if (event.relatedTarget !== null) return;
      isPointerInWindowRef.current = false;
      cancelQuickMenuHoverClose();
      cancelCompactOverlayHoverClose();
    };

    const handleWindowEnter = () => {
      isPointerInWindowRef.current = true;
    };

    const handleWindowMouseOut = (event: globalThis.MouseEvent) => {
      if (event.relatedTarget !== null) return;
      handleWindowLeave(event);
    };

    const handleWindowMouseOver = () => {
      handleWindowEnter();
    };

    const handleWindowPointerOut = (event: PointerEvent) => {
      handleWindowLeave(event);
    };

    const handleWindowPointerOver = () => {
      handleWindowEnter();
    };

    const handleWindowMouseLeave = (event: globalThis.MouseEvent) => {
      if (event.relatedTarget !== null) return;
      handleWindowLeave(event);
    };

    const handleWindowPointerLeave = (event: PointerEvent) => {
      if (event.relatedTarget !== null) return;
      handleWindowLeave(event);
    };

    document.addEventListener("mouseout", handleWindowMouseOut);
    document.addEventListener("mouseover", handleWindowMouseOver);
    document.addEventListener("pointerout", handleWindowPointerOut);
    document.addEventListener("pointerover", handleWindowPointerOver);
    document.addEventListener("mouseleave", handleWindowMouseLeave);
    document.addEventListener("pointerleave", handleWindowPointerLeave);

    return () => {
      document.removeEventListener("mouseout", handleWindowMouseOut);
      document.removeEventListener("mouseover", handleWindowMouseOver);
      document.removeEventListener("pointerout", handleWindowPointerOut);
      document.removeEventListener("pointerover", handleWindowPointerOver);
      document.removeEventListener("mouseleave", handleWindowMouseLeave);
      document.removeEventListener("pointerleave", handleWindowPointerLeave);
    };
  }, []);

  useEffect(() => {
    if (!isQuickMenuOpen && !isAnyOverlayOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isAnyOverlayOpen) {
          closeOverlaySurface();
          return;
        }
        closeQuickMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnyOverlayOpen, isQuickMenuOpen]);

  useEffect(() => {
    return () => {
      clearQuickMenuTimers();
      clearCompactOverlayAnimation();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isAnyOverlayOpen || isQuickMenuVisible) {
      root.setAttribute("data-unseen-overlay-open", "true");
      return;
    }
    root.removeAttribute("data-unseen-overlay-open");
  }, [isAnyOverlayOpen, isQuickMenuVisible]);

  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute("data-unseen-overlay-open");
    };
  }, []);

  const handleMenuTriggerClick = () => {
    if (isAnyOverlayOpen) {
      closeOverlaySurface();
      return;
    }
    if (isQuickMenuOpen) {
      closeQuickMenu();
      return;
    }
    openQuickMenu();
  };

  const handleCreateNewEdit = () => {
    setIsEditActionMenuOpen(false);
    openOverlaySurface("profile", { profileTab: "reference-sets", editFlow: "create", origin: "menu" });
  };

  const handleManageEdits = () => {
    setIsEditActionMenuOpen(false);
    openOverlaySurface("profile", { profileTab: "reference-sets", editFlow: null, origin: "menu" });
  };

  const currentQuery = searchParams.toString();
  const currentPathWithQuery = currentQuery ? `${pathname}?${currentQuery}` : pathname;
  const profileOverlayParams = new URLSearchParams({
    embed: "1",
    overlaySection: "profile",
    profileTab: activeProfileOverlayTab,
    back: currentPathWithQuery,
  });
  if (profileOverlayEditFlow) {
    profileOverlayParams.set("editFlow", profileOverlayEditFlow);
  }
  const profileOverlayHref = `/profile?${profileOverlayParams.toString()}`;

  const compactOverlaySection = activeOverlaySurface === "feedback" ? "feedback" : activeOverlaySurface;
  const compactOverlayParams =
    compactOverlaySection && compactOverlaySection !== "profile"
      ? new URLSearchParams({
          embed: "1",
          overlaySection: compactOverlaySection,
          back: currentPathWithQuery,
        })
      : null;
  const compactOverlayHref =
    activeOverlaySurface === "profile"
      ? profileOverlayHref
      : compactOverlayParams
        ? `/profile?${compactOverlayParams.toString()}`
        : null;

  const openOverlaySurface = (
    surface: OverlaySurface,
    options: { profileTab?: ProfileOverlayTab; editFlow?: "create" | null; origin?: "menu" | "edge" } = {},
  ) => {
    const isSwitchingCompactOverlay =
      compactOverlayPhase === "open" &&
      (activeOverlaySurface === "profile" ||
        activeOverlaySurface === "settings" ||
        activeOverlaySurface === "feedback" ||
        activeOverlaySurface === "about");
    const shouldExtendFromMenu =
      options.origin === "menu" ||
      quickMenuPhase === "open" ||
      quickMenuPhase === "opening" ||
      isSwitchingCompactOverlay;

    clearCompactOverlayAnimation();
    if (surface === "profile") {
      setActiveProfileOverlayTab(options.profileTab ?? "signature");
      setProfileOverlayEditFlow(options.editFlow ?? null);
    } else {
      setProfileOverlayEditFlow(null);
    }

    clearQuickMenuTimers();
    setIsQuickMenuOpen(true);
    setQuickMenuPhase("open");
    setCompactOverlayOrigin(shouldExtendFromMenu ? "menu" : "edge");
    setIsCompactOverlayRailClosing(false);
    setCompactSettingsFeedbackHeight(null);
    if (compactContentScrollRef.current) {
      compactContentScrollRef.current.scrollTop = 0;
    }
    setActiveOverlaySurface(surface);
    setCompactContentPhase("entering");

    if (isSwitchingCompactOverlay) {
      setCompactOverlayPhase("open");
      scheduleCompactContentOpen();
      return;
    }

    setCompactOverlayPhase("opening");
    scheduleCompactOverlayOpen();
    scheduleCompactContentOpen();
  };

  const topQuickMenuItems = quickMenuItems.filter((item) => item.id !== "about");
  const bottomQuickMenuItem = quickMenuItems.find((item) => item.id === "about");

  return (
    <header data-sticky-root="true" className="sticky top-0 z-50">
      <StickyHeightSync targetId="sticky-stack" />
      <div id="sticky-stack" className="relative w-full" style={{ height: `${effectiveStickyStackHeightPx}px` }}>
        <div
          className="relative w-full bg-paper/90 backdrop-blur-md"
          style={{ height: `${effectiveStickyBackdropHeightPx}px` }}
          data-node-id={isGallery ? "768:2169" : "770:2181"}
        >
          <div
            className="absolute left-[calc(50%+10px)] h-[34px] w-[198px] -translate-x-1/2 max-[760px]:left-1/2"
            style={{ top: `${MODE_SWITCH_TOP_PX}px` }}
          >
            <ModePill selected={isGallery ? "gallery" : "archive"} />
          </div>

          <div className="absolute right-4 top-[23px] md:right-10" data-sticky-brand-row="true">
            <div className="flex h-[26px] items-center gap-[8px]">
              <p className="hidden h-[26px] items-center text-right text-ink leading-none min-[700px]:inline-flex" data-sticky-logo-wrap="true">
                <span className="font-ui text-[18px] font-bold leading-[18px] tracking-[-0.04em]">cenoir</span>
              </p>
              <div
                data-sticky-beta="true"
                className={`hidden h-[12px] min-w-[28px] items-center justify-center rounded-[2px] px-[5px] min-[700px]:inline-flex ${
                  isGallery ? "bg-ink" : "bg-accent"
                }`}
              >
                <span className="font-ui text-[6.5px] font-bold leading-[6.5px] tracking-[-0.08px] text-paper">
                  BETA
                </span>
              </div>
              <button
                type="button"
                aria-label={menuButtonAriaLabel}
                aria-expanded={isQuickMenuOpen || isAnyOverlayOpen}
                onClick={handleMenuTriggerClick}
                data-sticky-burger="true"
                className={`group relative ml-[10px] inline-flex h-[14px] w-[20px] items-center justify-center transition-[color,opacity] duration-220 ease-out pointer-events-auto opacity-100 focus-visible:outline-none ${
                  isMenuTriggerMorphed ? menuActiveColorClass : `text-meta ${menuHoverColorClass}`
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 block -translate-x-1/2 rounded-full bg-current transition-all ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                    isMenuTriggerMorphed ? "rotate-45" : "rotate-0"
                  }`}
                  style={{
                    ...menuIconLineBaseStyle,
                    top: `${isMenuTriggerMorphed ? menuIconCenterPx : menuIconClosedTopPx}px`,
                    transitionDuration: `${menuIconMorphDurationMs}ms`,
                  }}
                />
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 block -translate-x-1/2 rounded-full bg-current transition-all ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                    isMenuTriggerMorphed ? "-rotate-45" : "rotate-0"
                  }`}
                  style={{
                    ...menuIconLineBaseStyle,
                    top: `${isMenuTriggerMorphed ? menuIconCenterPx : menuIconClosedBottomPx}px`,
                    transitionDuration: `${menuIconMorphDurationMs}ms`,
                  }}
                />
              </button>
            </div>
          </div>

          <div className="absolute left-[41px]" style={{ top: `${TITLE_BLOCK_TOP_PX}px` }}>
            <div className="group flex items-end gap-[10px] pb-0">
              <div className="flex h-[45px] items-end">
                {isGallery ? (
                  <h1 className={`inline-flex items-end text-[30px] leading-none ${headerColorClass}`}>
                    <span className="font-ui font-normal tracking-[-0.06em]">Issue</span>
                    <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">-</span>
                    <span className="ml-[1px] font-instrument italic tracking-[0.01em]">
                      {activeIssueNumber}
                    </span>
                  </h1>
                ) : (
                  <h1 className={`inline-flex items-end text-[30px] leading-none ${headerColorClass}`}>
                    <span className="font-ui font-normal tracking-[-0.06em]">
                      {archiveOwnerName}<span>&apos;</span><span className="-ml-[2px]">s</span>
                    </span>
                    <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">-</span>
                    <span className="ml-[1px] font-instrument italic tracking-[0.01em]">
                      Capsules
                    </span>
                  </h1>
                )}
              </div>
              <span
                className={`pointer-events-none mb-[5px] inline-flex h-[29px] translate-y-1 items-center justify-center whitespace-nowrap rounded-[999px] px-[11px] opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out delay-0 group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-300 ${
                  isGallery ? "border border-ink bg-ink" : "border border-accent bg-accent"
                }`}
                aria-hidden="true"
              >
                <span className="inline-flex items-baseline gap-[1px] text-[14px] leading-[18px] text-paper">
                  <span className="font-ui font-normal tracking-[-0.06em]">{hoverLabelPrefix}</span>
                  <span className="font-instrument italic tracking-normal">{hoverLabelWord}</span>
                </span>
              </span>
            </div>
          </div>

          <div className="absolute left-[41px] z-20" style={{ top: `${137.5 - lowerNavLiftPx}px` }}>
            <GalleryEditNav
              tabs={isGallery ? undefined : archiveCapsuleTabs}
              tone={isGallery ? "gallery" : "archive"}
              queryKey={isGallery ? "edit" : "capsule"}
            />
          </div>

          <div className="absolute right-[33px] z-20" style={{ top: `${198 - lowerNavLiftPx}px` }}>
            <ViewToggle
              mode={mode}
              view={view}
              archiveActiveItemCount={archiveActiveItemCount}
              archiveCapsuleId={archiveCapsuleId}
            />
          </div>

          {isGallery ? (
            <div
              ref={editActionMenuRef}
              className="absolute right-[33px] z-40 h-8"
              onMouseLeave={() => setIsEditActionMenuOpen(false)}
              onBlurCapture={(event) => {
                const nextTarget = event.relatedTarget;
                if (nextTarget instanceof Node && editActionMenuRef.current?.contains(nextTarget)) return;
                setIsEditActionMenuOpen(false);
              }}
              style={{ top: `${146 - lowerNavLiftPx}px` }}
            >
              <button
                type="button"
                aria-label="Show edit actions"
                aria-haspopup="menu"
                aria-expanded={isEditActionMenuOpen}
                onClick={() => setIsEditActionMenuOpen(true)}
                className={`font-ui inline-flex h-[33px] w-[33px] items-center justify-center rounded-full border-[0.5px] text-[18px] font-normal leading-none tracking-[0.02em] transition-[opacity,color,border-color,background-color,box-shadow] ${EDIT_ACTION_MENU_TRANSITION_CLASS} focus-visible:outline-none ${
                  isEditActionMenuOpen
                    ? "pointer-events-none border-[#ECECED] bg-mist/70 text-meta opacity-0"
                    : "border-transparent bg-transparent text-meta opacity-100 shadow-none hover:border-[#F0F0F1] hover:bg-[#F5F5F6] hover:text-[#6F7381] hover:shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] focus-visible:border-[#F0F0F1] focus-visible:bg-[#F5F5F6] focus-visible:text-[#6F7381] focus-visible:shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]"
                }`}
              >
                <span aria-hidden="true" className="relative inline-flex h-[14px] w-[14px] items-center justify-center">
                  <span className="absolute block h-[1.5px] w-[12px] rounded-full bg-current" />
                  <span className="absolute block h-[1.5px] w-[12px] rotate-90 rounded-full bg-current" />
                </span>
              </button>

              <div
                role="menu"
                aria-label="Edit actions"
                className={`absolute right-0 top-0 inline-flex h-8 items-center gap-[6px] transition-all ${EDIT_ACTION_MENU_TRANSITION_CLASS} ${
                  isEditActionMenuOpen
                    ? "pointer-events-auto translate-x-0 opacity-100"
                    : "pointer-events-none translate-x-[10px] opacity-0"
                }`}
                style={{ transformOrigin: "right center" }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleCreateNewEdit}
                  className="inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:text-ink"
                >
                  create
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleManageEdits}
                  className="inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:text-ink"
                >
                  review
                </button>
              </div>
            </div>
          ) : null}

          <div aria-hidden="true" className="pointer-events-none absolute left-[41px] right-[33px] z-10" style={{ top: `${136 - lowerNavLiftPx}px`, height: "42px" }} />

          <div
            className="pointer-events-none absolute left-10 right-10 z-10 h-[1.5px]"
            data-sticky-divider="true"
            style={{ top: `${dividerTopPx}px`, backgroundColor: DIVIDER_COLOR, boxShadow: DIVIDER_SHADOW }}
          />
        </div>
      </div>

      {isQuickMenuVisible && !isAnyOverlayOpen ? (
      <div
        data-unseen-shell-overlay="true"
        onMouseMove={handleQuickMenuOverlayMouseMove}
        className="fixed inset-0 z-[126] pointer-events-auto"
        aria-hidden="false"
      >
        <div
          aria-hidden="true"
          className={`absolute inset-0 bg-black/12 backdrop-blur-[7px] transition-opacity ${
            quickMenuPhase === "closing" ? MENU_CLOSE_TRANSITION_CLASS : MENU_OPEN_TRANSITION_CLASS
          } ${isQuickMenuEntering ? "opacity-100" : "opacity-0"}`}
          style={{
            transition: `opacity ${MENU_TRANSITION_DURATION_CSS} ${
              quickMenuPhase === "closing" ? MENU_CLOSE_EASING_CSS : MENU_OPEN_EASING_CSS
            }`,
          }}
        />
        <button
          type="button"
          aria-label="Close quick menu"
          onClick={closeQuickMenu}
          className="absolute inset-0"
        />
        <div
          ref={quickMenuSurfaceRef}
          onMouseEnter={cancelQuickMenuHoverClose}
          onMouseLeave={(event) => closeQuickMenuOnSurfaceLeave(event.relatedTarget)}
          className={`absolute inset-y-0 right-0 bg-paper shadow-[-10px_0_24px_rgba(17,17,17,0.08)] will-change-transform ${
            quickMenuPhase === "closing" ? MENU_CLOSE_TRANSITION_CLASS : MENU_OPEN_TRANSITION_CLASS
          }`}
          style={{
            width: QUICK_MENU_RAIL_WIDTH_CSS,
            transform: isQuickMenuEntering ? "translate3d(0, 0, 0)" : "translate3d(calc(100% + 16px), 0, 0)",
            transition: `transform ${MENU_TRANSITION_DURATION_CSS} ${
              quickMenuPhase === "closing" ? MENU_CLOSE_EASING_CSS : MENU_OPEN_EASING_CSS
            }`,
          }}
        >
          <div className="absolute inset-x-0 top-[23px] h-[26px]">
            <div className="absolute right-4 top-0 flex h-[26px] items-center gap-[8px] md:right-10">
              <p className="inline-flex h-[26px] items-center text-right text-ink leading-none">
                <span ref={quickMenuBrandLabelRef} className="font-ui text-[18px] font-bold leading-[18px] tracking-[-0.04em]">
                  cenoir
                </span>
              </p>
              <div className="inline-flex h-[12px] min-w-[28px] items-center justify-center rounded-[2px] bg-ink px-[5px]">
                <span className="font-ui text-[6.5px] font-bold leading-[6.5px] tracking-[-0.08px] text-paper">
                  BETA
                </span>
              </div>
              <button
                type="button"
                aria-label="Close quick menu"
                onClick={closeQuickMenu}
                className={`relative ml-[10px] inline-flex h-[14px] w-[20px] items-center justify-center text-meta transition-colors duration-150 ${
                  menuHoverColorClass
                } ${isGallery ? "active:text-ink" : "active:text-accent"} focus-visible:outline-none`}
              >
                <span
                  className="absolute left-1/2 block -translate-x-1/2 rotate-45 rounded-full bg-current"
                  style={{ ...menuIconLineBaseStyle, top: `${menuIconCenterPx}px` }}
                />
                <span
                  className="absolute left-1/2 block -translate-x-1/2 -rotate-45 rounded-full bg-current"
                  style={{ ...menuIconLineBaseStyle, top: `${menuIconCenterPx}px` }}
                />
              </button>
            </div>
          </div>

          <div
            className="flex h-full w-full flex-col pb-6 pt-[78px]"
            style={{ paddingLeft: `${quickMenuContentInsetPx}px`, paddingRight: `${quickMenuContentInsetPx}px` }}
          >
            <ol className="grid gap-[2px]">
              {topQuickMenuItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openOverlaySurface(item.id)}
                    className="inline-flex h-[31px] w-full items-center justify-start text-left font-ui text-[14px] font-medium leading-5 tracking-[0.28px] text-meta transition-colors duration-150 hover:text-ink focus-visible:text-ink focus-visible:outline-none"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-auto">
              {bottomQuickMenuItem ? (
                <button
                  type="button"
                  onClick={() => openOverlaySurface(bottomQuickMenuItem.id)}
                  className="mb-5 inline-flex h-[31px] w-full items-center justify-start text-left font-ui text-[14px] font-medium leading-5 tracking-[0.28px] text-meta transition-colors duration-150 hover:text-ink focus-visible:text-ink focus-visible:outline-none"
                >
                  {bottomQuickMenuItem.label}
                </button>
              ) : null}

              <div className="flex w-full items-center justify-between">
                {quickMenuSocialSymbols.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    className="inline-flex h-[20px] w-[20px] items-center justify-center overflow-hidden text-meta transition-colors duration-150 hover:text-ink focus-visible:text-ink focus-visible:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="h-[20px] w-[20px] bg-current"
                      style={{
                        maskImage: `url(${item.src})`,
                        maskRepeat: "no-repeat",
                        maskPosition: "center",
                        maskSize: "contain",
                        WebkitMaskImage: `url(${item.src})`,
                        WebkitMaskRepeat: "no-repeat",
                        WebkitMaskPosition: "center",
                        WebkitMaskSize: "contain",
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {isProfileOverlayOpen ? (
      <div
        data-unseen-shell-overlay="true"
        className="fixed inset-0 z-[130] pointer-events-auto bg-paper pb-[16px] pl-[17px] pr-[17px] pt-[16px] opacity-100 transition-opacity duration-300 ease-out md:pb-[16px] md:pl-[17px] md:pr-[17px] md:pt-[16px]"
        aria-hidden="false"
      >
        <button
          type="button"
          aria-label="Close profile overlay"
          onClick={closeOverlaySurface}
          className="group fixed right-4 top-[23px] z-[140] inline-flex h-[26px] w-[20px] items-center justify-center text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none md:right-10"
        >
          <span
            className={`absolute left-1/2 block -translate-x-1/2 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
              isProfileOverlayOpen ? "rotate-45" : "rotate-0"
            }`}
            style={{ ...menuIconLineBaseStyle, top: `${isProfileOverlayOpen ? menuIconCenterPx : menuIconClosedTopPx}px` }}
          />
          <span
            className={`absolute left-1/2 block -translate-x-1/2 rounded-full bg-current transition-[opacity] duration-220 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
              isProfileOverlayOpen ? "opacity-0" : "opacity-100"
            }`}
            style={{ ...menuIconLineBaseStyle, top: `${menuIconCenterPx}px` }}
          />
          <span
            className={`absolute left-1/2 block -translate-x-1/2 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
              isProfileOverlayOpen ? "-rotate-45" : "rotate-0"
            }`}
            style={{ ...menuIconLineBaseStyle, top: `${isProfileOverlayOpen ? menuIconCenterPx : menuIconClosedBottomPx}px` }}
          />
        </button>

        <div className="relative h-full w-full translate-y-0 scale-100 bg-paper transition-transform duration-300 ease-out">
          <div className="absolute inset-x-0 top-0 z-10 px-10 pt-[24px]">
            <div className="mx-auto w-full max-w-[1200px]">
              <p
                className="text-center font-ui font-medium tracking-[0.02em] text-meta"
                style={{ fontFamily: "var(--font-ui-sans), sans-serif" }}
              >
                <span className="text-[13px] leading-5">{activeProfileUser?.name ?? "User"}</span>
                <span className="px-[5px] text-[13px] leading-5 text-meta">·</span>
                <span className="text-[13px] leading-5">No. {profileUserIdLabel}</span>
                <span className="px-[5px] text-[13px] leading-5 text-meta">·</span>
                <span className="text-[13px] leading-5">calibrated {profileCalibrationLabel}</span>
                <span className="px-[5px] text-[13px] leading-5 text-meta">·</span>
                <span className="text-[13px] leading-5">Issue {activeIssueNumber}</span>
              </p>

              <nav aria-label="Profile overlay sections" className="mt-[30px] w-full">
                <div className="relative mx-auto w-full max-w-[298px] rounded-[18px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] p-[2px] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]">
                  <ol className="relative z-[1] grid h-[32px] w-full grid-cols-3 gap-[2px]">
                    {profileOverlayTabs.map((tab) => {
                      const isActive = activeProfileOverlayTab === tab.id;
                      return (
                        <li key={tab.id} className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveProfileOverlayTab(tab.id);
                              setProfileOverlayEditFlow(null);
                            }}
                            className={`h-[32px] w-full rounded-[16px] px-3 text-center font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] transition-[background,color,box-shadow] duration-150 focus-visible:outline-none ${
                              isActive
                                ? "bg-[linear-gradient(180deg,#151515_0%,#0d0d0d_100%)] text-paper shadow-[0_0.5px_1px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.05)]"
                                : "text-meta hover:text-[#5F6471]"
                            }`}
                          >
                            {tab.label}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </nav>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 top-[136px] overflow-hidden">
            <iframe
              key={`profile-${activeProfileOverlayTab}`}
              src={profileOverlayHref}
              title="Profile overlay"
              className="h-full w-full border-0 bg-transparent"
            />
          </div>
        </div>
      </div>
      ) : null}

      {isCompactOverlayOpen ? (
      <div
        data-unseen-shell-overlay="true"
        onMouseMove={handleCompactOverlayMouseMove}
        className="fixed inset-0 z-[130] pointer-events-auto"
        aria-hidden="false"
      >
        <div
          aria-hidden="true"
          className={`absolute inset-0 bg-black/12 backdrop-blur-[7px] transition-opacity ${
            compactOverlayPhase === "closing" ? MENU_CLOSE_TRANSITION_CLASS : MENU_OPEN_TRANSITION_CLASS
          } ${shouldShowCompactOverlay && !shouldSlideCompactOverlayRail ? "opacity-100" : "opacity-0"}`}
          style={{
            transition: `opacity ${MENU_TRANSITION_DURATION_CSS} ${
              compactOverlayPhase === "closing" ? MENU_CLOSE_EASING_CSS : MENU_OPEN_EASING_CSS
            }`,
          }}
        />
        <button
          type="button"
          aria-label="Close overlay"
          onClick={closeOverlaySurface}
          className="absolute inset-0"
        />
        <div className="absolute inset-0 overflow-hidden">
            <div
              onMouseLeave={(event) => closeCompactOverlayOnSurfaceLeave(event.relatedTarget)}
              onMouseEnter={cancelCompactOverlayHoverClose}
              className={`absolute inset-y-0 right-0 overflow-hidden bg-paper shadow-[-10px_0_24px_rgba(17,17,17,0.08)] will-change-[width,transform] ${
              compactOverlayPhase === "closing" ? MENU_CLOSE_TRANSITION_CLASS : MENU_OPEN_TRANSITION_CLASS
            }`}
            style={{
              width: compactOverlayCurrentWidth,
              transform:
                shouldSlideCompactOverlayRail
                  ? "translate3d(calc(100% + 16px), 0, 0)"
                  : compactOverlayShouldExtendFromMenu || compactOverlayPhase === "open"
                  ? "translate3d(0, 0, 0)"
                  : "translate3d(100%, 0, 0)",
              transition: `width ${MENU_TRANSITION_DURATION_CSS} ${
                compactOverlayPhase === "closing" ? MENU_CLOSE_EASING_CSS : MENU_OPEN_EASING_CSS
              }, transform ${MENU_TRANSITION_DURATION_CSS} ${
                compactOverlayPhase === "closing" ? MENU_CLOSE_EASING_CSS : MENU_OPEN_EASING_CSS
              }`,
            }}
          >
            <div
              className="absolute inset-y-0 right-0 flex"
              style={{ width: compactOverlayTargetWidth }}
            >
            <div
              ref={compactContentSurfaceRef}
              onMouseLeave={(event) => closeCompactOverlayOnSurfaceLeave(event.relatedTarget)}
              onMouseEnter={cancelCompactOverlayHoverClose}
              className="h-full flex-none overflow-hidden"
              style={{ width: isCompactProfileOverlay ? "100%" : COMPACT_MENU_CONTENT_WIDTH_CSS }}
            >
              <div
                ref={compactContentScrollRef}
                data-compact-content-phase={compactContentPhase}
                className={`h-full w-full transition-opacity ${
                  compactOverlayPhase === "closing" ? MENU_CLOSE_TRANSITION_CLASS : MENU_OPEN_TRANSITION_CLASS
                } ${
                  shouldShowCompactOverlay ? "opacity-100" : "opacity-0"
                } ${isCompactProfileOverlay ? "overflow-hidden" : "overflow-y-auto px-5 pb-6 pt-0 md:px-10"}`}
              >
                {isCompactProfileOverlay ? (
                  <div className="relative h-full w-full translate-y-0 scale-100 bg-paper transition-transform duration-300 ease-out">
                    <div className="absolute inset-x-0 top-0 z-10 px-10 pt-[24px]">
                      <div className="mx-auto w-full max-w-[1200px]">
                        <p
                          className="text-center font-ui font-medium tracking-[0.02em] text-meta"
                          style={{ fontFamily: "var(--font-ui-sans), sans-serif" }}
                        >
                          <span className="text-[13px] leading-5">{activeProfileUser?.name ?? "User"}</span>
                          <span className="px-[5px] text-[13px] leading-5 text-meta">·</span>
                          <span className="text-[13px] leading-5">No. {profileUserIdLabel}</span>
                          <span className="px-[5px] text-[13px] leading-5 text-meta">·</span>
                          <span className="text-[13px] leading-5">calibrated {profileCalibrationLabel}</span>
                          <span className="px-[5px] text-[13px] leading-5 text-meta">·</span>
                          <span className="text-[13px] leading-5">Issue {activeIssueNumber}</span>
                        </p>

                        <nav aria-label="Profile overlay sections" className="mt-[30px] w-full">
                          <div className="relative mx-auto w-full max-w-[298px] rounded-[18px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] p-[2px] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]">
                            <ol className="relative z-[1] grid h-[32px] w-full grid-cols-3 gap-[2px]">
                              {profileOverlayTabs.map((tab) => {
                                const isActive = activeProfileOverlayTab === tab.id;
                                return (
                                  <li key={tab.id} className="flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveProfileOverlayTab(tab.id);
                                        setProfileOverlayEditFlow(null);
                                      }}
                                      className={`h-[32px] w-full rounded-[16px] px-3 text-center font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] transition-[background,color,box-shadow] duration-150 focus-visible:outline-none ${
                                        isActive
                                          ? "bg-[linear-gradient(180deg,#151515_0%,#0d0d0d_100%)] text-paper shadow-[0_0.5px_1px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.05)]"
                                          : "text-meta hover:text-[#5F6471]"
                                      }`}
                                    >
                                      {tab.label}
                                    </button>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        </nav>
                      </div>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 top-[136px] overflow-hidden">
                      <iframe
                        key={`profile-${activeProfileOverlayTab}`}
                        src={profileOverlayHref}
                        title="Profile overlay"
                        className="h-full w-full border-0 bg-transparent"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full overflow-hidden">
                    {compactOverlayHref ? (
                    <iframe
                      ref={compactIframeRef}
                      key={`compact-${activeOverlaySurface}`}
                      src={compactOverlayHref}
                      title={`${activeOverlaySurface ?? "compact"} overlay`}
                      onLoad={() => {
                        if (compactContentScrollRef.current) {
                          compactContentScrollRef.current.scrollTop = 0;
                        }
                        compactIframeRef.current?.contentWindow?.scrollTo(0, 0);
                      }}
                      className="h-full w-full border-0 bg-transparent"
                      />
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div
              ref={compactMenuSurfaceRef}
              className={`${isCompactProfileOverlay ? "absolute inset-y-0 right-0" : "relative h-full flex-none"} ${
              isCompactProfileOverlay ? "bg-transparent" : "bg-paper"
            }`}
              style={{ width: COMPACT_MENU_RAIL_WIDTH_CSS }}
            >
            <div className="absolute inset-x-0 top-[23px] h-[26px]">
              <div
                className="absolute right-4 top-0 flex h-[26px] items-center gap-[8px] transition-opacity duration-300 ease-out opacity-100 md:right-10"
              >
                <p className="inline-flex h-[26px] items-center text-right text-ink leading-none">
                  <span className="font-ui text-[18px] font-bold leading-[18px] tracking-[-0.04em]">cenoir</span>
                </p>
                <div className="inline-flex h-[12px] min-w-[28px] items-center justify-center rounded-[2px] bg-ink px-[5px]">
                  <span className="font-ui text-[6.5px] font-bold leading-[6.5px] tracking-[-0.08px] text-paper">
                    BETA
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Close overlay"
                  onClick={closeOverlaySurface}
                  className="relative ml-[10px] inline-flex h-[14px] w-[20px] items-center justify-center text-meta transition-colors duration-150 hover:text-ink active:text-ink focus-visible:text-ink focus-visible:outline-none"
                >
                  <span
                    className="absolute left-1/2 block -translate-x-1/2 rotate-45 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)]"
                    style={{ ...menuIconLineBaseStyle, top: `${menuIconCenterPx}px` }}
                  />
                  <span
                    className="absolute left-1/2 block -translate-x-1/2 -rotate-45 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)]"
                    style={{ ...menuIconLineBaseStyle, top: `${menuIconCenterPx}px` }}
                  />
                </button>
              </div>
            </div>

            <div
              className={`flex h-full w-full flex-col pb-6 pt-[78px] transition-opacity duration-150 ease-out ${
                shouldHideCompactMenuLinks ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
              style={{ paddingLeft: `${quickMenuContentInsetPx}px`, paddingRight: `${quickMenuContentInsetPx}px` }}
            >
              <ol className="grid gap-[2px]">
                {topQuickMenuItems.map((item) => {
                  const isActiveCompactItem = activeOverlaySurface === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openOverlaySurface(item.id)}
                        className={`inline-flex h-[31px] w-full items-center justify-start text-left font-ui text-[14px] font-medium leading-5 tracking-[0.28px] transition-colors duration-150 focus-visible:outline-none ${
                          isActiveCompactItem ? "text-ink" : "text-meta hover:text-ink focus-visible:text-ink"
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-auto">
                {bottomQuickMenuItem ? (
                  <button
                    type="button"
                    onClick={() => openOverlaySurface(bottomQuickMenuItem.id)}
                    className={`mb-5 inline-flex h-[31px] w-full items-center justify-start text-left font-ui text-[14px] font-medium leading-5 tracking-[0.28px] transition-colors duration-150 focus-visible:outline-none ${
                      activeOverlaySurface === bottomQuickMenuItem.id
                        ? "text-ink"
                        : "text-meta hover:text-ink focus-visible:text-ink"
                    }`}
                  >
                    {bottomQuickMenuItem.label}
                  </button>
                ) : null}

                <div className="flex w-full items-center justify-between">
                  {quickMenuSocialSymbols.map((item) => (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={item.label}
                      className="inline-flex h-[20px] w-[20px] items-center justify-center overflow-hidden text-meta transition-colors duration-150 hover:text-ink focus-visible:text-ink focus-visible:outline-none"
                    >
                      <span
                        aria-hidden="true"
                        className="h-[20px] w-[20px] bg-current"
                        style={{
                          maskImage: `url(${item.src})`,
                          maskRepeat: "no-repeat",
                          maskPosition: "center",
                          maskSize: "contain",
                          WebkitMaskImage: `url(${item.src})`,
                          WebkitMaskRepeat: "no-repeat",
                          WebkitMaskPosition: "center",
                          WebkitMaskSize: "contain",
                        }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
      </div>
      ) : null}
    </header>
  );
}
