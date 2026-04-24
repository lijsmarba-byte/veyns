"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ModePill } from "@/components/unseen/ModePill";
import { GalleryEditNav } from "@/components/unseen/GalleryEditNav";
import { ViewToggle } from "@/components/unseen/ViewToggle";
import { StickyHeightSync } from "@/components/unseen/StickyHeightSync";
import { mockUsers } from "@/data/mockUsers";

type StickyMode = "gallery" | "archive";

type StickyShellProps = {
  mode: StickyMode;
  view: "grid" | "immersive" | "world2";
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
  { id: "instagram", label: "Instagram", src: "/logos/instagram.png", href: "https://www.instagram.com/cenoir.co" },
  { id: "tiktok", label: "TikTok", src: "/logos/tiktok.png", href: "https://www.tiktok.com/@cenoir_co" },
  { id: "substack", label: "Substack", src: "/logos/substack.png", href: "https://substack.com/" },
  { id: "pinterest", label: "Pinterest", src: "/logos/pinterest.png", href: "https://www.pinterest.com/" },
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
const DIVIDER_COLOR = "#ECEDEF";
const DIVIDER_SHADOW = "0 1px 0.6px rgba(0,0,0,0.03)";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [activeOverlaySurface, setActiveOverlaySurface] = useState<OverlaySurface | null>(null);
  const [activeProfileOverlayTab, setActiveProfileOverlayTab] = useState<ProfileOverlayTab>("signature");
  const [isEditActionMenuOpen, setIsEditActionMenuOpen] = useState(false);
  const [isProfileEntryFromClose, setIsProfileEntryFromClose] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.sessionStorage.getItem("unseen:profile-close-morph");
      if (!raw) return false;
      window.sessionStorage.removeItem("unseen:profile-close-morph");
      const parsed = JSON.parse(raw) as { targetPath?: string; at?: number };
      const isFresh = typeof parsed.at === "number" && Date.now() - parsed.at < 3000;
      const isTargetMatch = typeof parsed.targetPath === "string" && parsed.targetPath === pathname;
      return isFresh && isTargetMatch;
    } catch {
      return false;
    }
  });
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
  const galleryImmersiveStickyHeightPx = dividerTopPx + 1;
  const effectiveStickyBackdropHeightPx =
    isGallery && view === "immersive" ? galleryImmersiveStickyHeightPx : stickyBackdropHeightPx;
  const effectiveStickyStackHeightPx =
    isGallery && view === "immersive" ? galleryImmersiveStickyHeightPx : stickyStackHeightPx;
  const isProfileOverlayOpen = activeOverlaySurface === "profile";
  const isCompactOverlayOpen =
    activeOverlaySurface === "settings" || activeOverlaySurface === "feedback" || activeOverlaySurface === "about";
  const isSettingsOrFeedbackOverlay = activeOverlaySurface === "settings" || activeOverlaySurface === "feedback";
  const isAnyOverlayOpen = isProfileOverlayOpen || isCompactOverlayOpen;
  const isMenuTriggerMorphed = isProfileEntryFromClose || isQuickMenuOpen || isAnyOverlayOpen;
  const menuButtonAriaLabel = isQuickMenuOpen || isAnyOverlayOpen ? "Close menu" : "Open menu";
  const editActionMenuRef = useRef<HTMLDivElement | null>(null);
  const compactIframeRef = useRef<HTMLIFrameElement | null>(null);
  const compactIframeCleanupRef = useRef<(() => void) | null>(null);
  const [compactSettingsFeedbackHeight, setCompactSettingsFeedbackHeight] = useState<number | null>(null);

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
    if (!isCompactOverlayOpen || !isSettingsOrFeedbackOverlay) {
      clearCompactIframeObservers();
      setCompactSettingsFeedbackHeight(null);
      return;
    }
    bindCompactIframeObservers();
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
    if (!isProfileEntryFromClose) return;
    const timer = window.setTimeout(() => {
      setIsProfileEntryFromClose(false);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isProfileEntryFromClose]);

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
    if (!isQuickMenuOpen && !isAnyOverlayOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isAnyOverlayOpen) {
          setActiveOverlaySurface(null);
          return;
        }
        setIsQuickMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnyOverlayOpen, isQuickMenuOpen]);

  useEffect(() => {
    const root = document.documentElement;
    if (isProfileOverlayOpen) {
      root.setAttribute("data-unseen-overlay-open", "true");
      return;
    }
    root.removeAttribute("data-unseen-overlay-open");
  }, [isProfileOverlayOpen]);

  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute("data-unseen-overlay-open");
    };
  }, []);

  const openProfile = (options?: { tab?: "reference-sets"; editFlow?: "create" }) => {
    const query = searchParams.toString();
    const backHref = query ? `${pathname}?${query}` : pathname;
    const nextParams = new URLSearchParams();
    nextParams.set("back", backHref);
    nextParams.set("iconMorph", "1");
    if (options?.tab) {
      nextParams.set("tab", options.tab);
    }
    if (options?.editFlow) {
      nextParams.set("editFlow", options.editFlow);
    }
    router.push(`/profile?${nextParams.toString()}`);
  };

  const handleMenuTriggerClick = () => {
    if (isAnyOverlayOpen) {
      setActiveOverlaySurface(null);
      return;
    }
    setIsQuickMenuOpen((current) => !current);
  };

  const handleCreateNewEdit = () => {
    setIsEditActionMenuOpen(false);
    openProfile({ tab: "reference-sets", editFlow: "create" });
  };

  const handleManageEdits = () => {
    setIsEditActionMenuOpen(false);
    openProfile({ tab: "reference-sets" });
  };

  const currentQuery = searchParams.toString();
  const currentPathWithQuery = currentQuery ? `${pathname}?${currentQuery}` : pathname;
  const profileOverlayParams = new URLSearchParams({
    embed: "1",
    overlaySection: "profile",
    profileTab: activeProfileOverlayTab,
    back: currentPathWithQuery,
  });
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
  const compactOverlayHref = compactOverlayParams ? `/profile?${compactOverlayParams.toString()}` : null;

  const openOverlaySurface = (surface: OverlaySurface) => {
    setIsQuickMenuOpen(false);
    if (surface === "profile") {
      setActiveProfileOverlayTab("signature");
    }
    setActiveOverlaySurface(surface);
  };
  const topQuickMenuItems = quickMenuItems;

  return (
    <header data-sticky-root="true" className="sticky top-0 z-50">
      <StickyHeightSync targetId="sticky-stack" />
      <div id="sticky-stack" className="relative w-full" style={{ height: `${effectiveStickyStackHeightPx}px` }}>
        <div
          className="relative w-full bg-paper/90 backdrop-blur-md after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-8 after:h-8 after:bg-[linear-gradient(180deg,rgba(254,254,253,0.34)_0%,rgba(254,254,253,0.16)_42%,rgba(254,254,253,0.05)_72%,rgba(254,254,253,0)_100%)]"
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
            <div className="flex h-[26px] items-center gap-[6px]">
              <p className="hidden h-[26px] items-center text-right text-ink leading-none min-[700px]:inline-flex" data-sticky-logo-wrap="true">
                <span className="font-ui text-[18px] font-semibold leading-[18px] tracking-[-0.04em]">cenoir</span>
              </p>
              <div
                data-sticky-beta="true"
                className={`hidden h-[12px] min-w-[26px] items-center justify-center rounded-[2px] px-[4px] min-[700px]:inline-flex ${
                  isGallery ? "bg-ink" : "bg-accent"
                }`}
              >
                <span className="font-ui text-[7px] font-bold leading-[7px] tracking-[-0.14px] text-paper">
                  BETA
                </span>
              </div>
              <button
                type="button"
                aria-label={menuButtonAriaLabel}
                aria-expanded={isQuickMenuOpen || isAnyOverlayOpen}
                onClick={handleMenuTriggerClick}
                data-sticky-burger="true"
                className="group relative ml-[10px] inline-flex h-[12px] w-[16px] items-center justify-center transition-opacity duration-300 ease-out pointer-events-auto opacity-100 focus-visible:outline-none"
              >
                <span
                  className={`absolute block h-px w-[16px] rounded-full bg-meta transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                    isMenuTriggerMorphed
                      ? "translate-y-0 rotate-45"
                      : "-translate-y-[4px] rotate-0 group-hover:scale-x-[1.04]"
                  }`}
                />
                <span
                  className={`absolute block h-px w-[16px] rounded-full bg-meta transition-all duration-220 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                    isMenuTriggerMorphed ? "opacity-0" : "opacity-100 group-hover:scale-x-[0.96]"
                  }`}
                />
                <span
                  className={`absolute block h-px w-[16px] rounded-full bg-meta transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                    isMenuTriggerMorphed
                      ? "translate-y-0 -rotate-45"
                      : "translate-y-[4px] rotate-0 group-hover:scale-x-[1.03]"
                  }`}
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

          <div className="absolute left-[41px] z-20" style={{ top: `${137 - lowerNavLiftPx}px` }}>
            <GalleryEditNav
              tabs={isGallery ? undefined : archiveCapsuleTabs}
              tone={isGallery ? "gallery" : "archive"}
              queryKey={isGallery ? "edit" : "capsule"}
            />
          </div>

          <div className="absolute right-10 z-20" style={{ top: `${195 - lowerNavLiftPx}px` }}>
            <ViewToggle
              mode={mode}
              view={view}
              archiveActiveItemCount={archiveActiveItemCount}
              archiveCapsuleId={archiveCapsuleId}
            />
          </div>

          <div aria-hidden="true" className="pointer-events-none absolute left-[41px] right-[33px] z-10" style={{ top: `${136 - lowerNavLiftPx}px`, height: "42px" }} />

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
                className={`font-ui inline-flex h-[33px] w-[33px] items-center justify-center rounded-full border-[0.5px] text-[18px] font-medium leading-none tracking-[0.02em] transition-[opacity,color,border-color,background-color,box-shadow] duration-150 ease-out focus-visible:outline-none ${
                  isEditActionMenuOpen
                    ? "pointer-events-none border-[#ECECED] bg-mist/70 text-inactive opacity-0"
                    : "border-transparent bg-transparent text-inactive opacity-100 shadow-none hover:border-[#F0F0F1] hover:bg-[#F5F5F6] hover:text-[#6F7381] hover:shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] focus-visible:border-[#F0F0F1] focus-visible:bg-[#F5F5F6] focus-visible:text-[#6F7381] focus-visible:shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]"
                }`}
              >
                +
              </button>

              <div
                role="menu"
                aria-label="Edit actions"
                className={`absolute right-0 top-0 inline-flex h-8 items-center gap-[6px] transition-all duration-150 ease-out ${
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

          <div
            className="pointer-events-none absolute left-10 right-10 z-10 h-[1px]"
            data-sticky-divider="true"
            style={{ top: `${dividerTopPx}px`, backgroundColor: DIVIDER_COLOR, boxShadow: DIVIDER_SHADOW }}
          />
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[126] transition-opacity duration-280 ease-out ${
          isQuickMenuOpen && !isAnyOverlayOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isQuickMenuOpen || isAnyOverlayOpen}
      >
        <button
          type="button"
          aria-label="Close quick menu"
          onClick={() => setIsQuickMenuOpen(false)}
          className="absolute inset-0"
        />
        <div
          className={`absolute inset-y-0 right-0 w-[202px] rounded-bl-[6px] rounded-tl-[6px] bg-paper shadow-[-10px_0_22px_rgba(0,0,0,0.08)] transition-transform duration-500 ease-[cubic-bezier(0.22,0.88,0.24,1)] ${
            isQuickMenuOpen && !isAnyOverlayOpen ? "translate-x-0" : "translate-x-[102%]"
          }`}
        >
          <button
            type="button"
            aria-label="Close quick menu"
            onClick={() => setIsQuickMenuOpen(false)}
            className="group absolute right-4 top-[23px] inline-flex h-[26px] w-[16px] items-center justify-center text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none md:right-10"
          >
            <span
              className={`absolute block h-px w-[16px] rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                isQuickMenuOpen ? "translate-y-0 rotate-45" : "-translate-y-[4px] rotate-0"
              }`}
            />
            <span
              className={`absolute block h-px w-[16px] rounded-full bg-current transition-all duration-220 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                isQuickMenuOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute block h-px w-[16px] rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                isQuickMenuOpen ? "translate-y-0 -rotate-45" : "translate-y-[4px] rotate-0"
              }`}
            />
          </button>

          <div className="flex h-full w-full flex-col pb-6 pl-3 pr-0 pt-[64px]">
            <ol className="grid gap-[2px]">
              {topQuickMenuItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openOverlaySurface(item.id)}
                    className="inline-flex h-[31px] w-full items-center justify-end pr-4 text-right font-ui text-[14px] font-medium leading-5 tracking-[0.28px] text-inactive transition-colors duration-150 hover:text-meta focus-visible:outline-none md:pr-10"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-auto flex items-center justify-end gap-[14px] pr-4 md:pr-10">
              {quickMenuSocialSymbols.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="inline-flex h-[18px] w-[18px] items-center justify-center overflow-hidden transition-opacity duration-150 hover:opacity-75 focus-visible:opacity-75 focus-visible:outline-none"
                >
                  <Image
                    src={item.src}
                    alt={item.label}
                    width={18}
                    height={18}
                    unoptimized
                    className="h-[18px] w-[18px] object-contain"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[130] bg-paper pb-[16px] pl-[17px] pr-[17px] pt-[16px] transition-opacity duration-300 ease-out md:pb-[16px] md:pl-[17px] md:pr-[17px] md:pt-[16px] ${
          isProfileOverlayOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isProfileOverlayOpen}
      >
        <button
          type="button"
          aria-label="Close profile overlay"
          onClick={() => setActiveOverlaySurface(null)}
          className="group fixed right-4 top-[23px] z-[140] inline-flex h-[26px] w-[16px] items-center justify-center text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none md:right-10"
        >
          <span
            className={`absolute block h-px w-[16px] rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
              isProfileOverlayOpen ? "translate-y-0 rotate-45" : "-translate-y-[4px] rotate-0"
            }`}
          />
          <span
            className={`absolute block h-px w-[16px] rounded-full bg-current transition-all duration-220 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
              isProfileOverlayOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute block h-px w-[16px] rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
              isProfileOverlayOpen ? "translate-y-0 -rotate-45" : "translate-y-[4px] rotate-0"
            }`}
          />
        </button>

        <div
          className={`relative h-full w-full bg-paper transition-transform duration-300 ease-out ${
            isProfileOverlayOpen ? "translate-y-0 scale-100" : "translate-y-[2px] scale-[0.996]"
          }`}
        >
          <div className="absolute inset-x-0 top-0 z-10 px-10 pt-[24px]">
            <div className="mx-auto w-full max-w-[1200px]">
              <p
                className="text-center font-ui font-bold tracking-[0.02em] text-meta"
                style={{ fontFamily: "var(--font-meta-mono), monospace" }}
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
                            onClick={() => setActiveProfileOverlayTab(tab.id)}
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

      <div
        className={`fixed inset-0 z-[130] bg-paper/80 px-5 py-8 transition-opacity duration-250 ease-out sm:px-10 ${
          isCompactOverlayOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isCompactOverlayOpen}
      >
        <button
          type="button"
          aria-label="Close overlay"
          onClick={() => setActiveOverlaySurface(null)}
          className="absolute inset-0"
        />
        <button
          type="button"
          aria-label="Close overlay"
          onClick={() => setActiveOverlaySurface(null)}
          className="fixed right-4 top-[23px] z-[140] inline-flex h-[26px] w-[16px] items-center justify-center text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none md:right-10"
        >
          <span className="absolute block h-[1.5px] w-[15px] rotate-45 rounded-full bg-current" />
          <span className="absolute block h-[1.5px] w-[15px] -rotate-45 rounded-full bg-current" />
        </button>
        <div className={`relative mx-auto mt-[84px] w-full ${isSettingsOrFeedbackOverlay ? "max-w-[760px]" : "max-w-[840px]"}`}>
          <div
            className={`mx-auto w-full rounded-[6px] bg-paper shadow-[0_8px_20px_rgba(0,0,0,0.06)] transition-transform duration-250 ease-out ${
              isSettingsOrFeedbackOverlay ? "max-w-[740px]" : "max-w-[820px]"
            } ${
              isCompactOverlayOpen ? "translate-y-0 scale-100" : "translate-y-[2px] scale-[0.996]"
            }`}
          >
            <div
              className={`${
                isSettingsOrFeedbackOverlay ? "" : "h-[min(68vh,680px)]"
              } w-full overflow-hidden`}
              style={
                isSettingsOrFeedbackOverlay && compactSettingsFeedbackHeight
                  ? { height: `${compactSettingsFeedbackHeight}px` }
                  : undefined
              }
            >
              {compactOverlayHref ? (
                <iframe
                  ref={isSettingsOrFeedbackOverlay ? compactIframeRef : null}
                  key={`compact-${activeOverlaySurface}`}
                  src={compactOverlayHref}
                  title={`${activeOverlaySurface ?? "compact"} overlay`}
                  onLoad={() => {
                    if (isSettingsOrFeedbackOverlay) bindCompactIframeObservers();
                  }}
                  className={`${isSettingsOrFeedbackOverlay ? "w-full" : "h-full w-full"} border-0 bg-transparent`}
                  style={
                    isSettingsOrFeedbackOverlay && compactSettingsFeedbackHeight
                      ? { height: `${compactSettingsFeedbackHeight}px` }
                      : undefined
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
