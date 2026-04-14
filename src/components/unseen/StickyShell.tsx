"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ModePill } from "@/components/unseen/ModePill";
import { ArchiveCapsuleNav } from "@/components/unseen/ArchiveCapsuleNav";
import { GalleryEditNav } from "@/components/unseen/GalleryEditNav";
import { ViewToggle } from "@/components/unseen/ViewToggle";
import { StickyHeightSync } from "@/components/unseen/StickyHeightSync";
import { ProfileSignatureContent } from "@/components/unseen/ProfileSignatureContent";
import { mockUsers } from "@/data/mockUsers";

type StickyMode = "gallery" | "archive";

type StickyShellProps = {
  mode: StickyMode;
  view: "grid" | "immersive" | "world2";
  issueNumber?: string;
  archiveActiveItemCount?: number;
};

type ProfileNavTab = {
  id: "signature" | "reference-sets" | "quiet-constraints";
  label: string;
  activeInterLabel: string;
  activeInstrumentLabel: string;
};

const profileNavTabs: ProfileNavTab[] = [
  {
    id: "signature",
    label: "The-Signature",
    activeInterLabel: "The-",
    activeInstrumentLabel: "Signature",
  },
  {
    id: "reference-sets",
    label: "Reference-Sets",
    activeInterLabel: "Reference-",
    activeInstrumentLabel: "Sets",
  },
  {
    id: "quiet-constraints",
    label: "Quiet-Constraints",
    activeInterLabel: "Quiet-",
    activeInstrumentLabel: "Constraints",
  },
];

const profileCardPath =
  "M4 10C4 6.68629 6.68629 4 10 4H291C294.314 4 297 6.68629 297 10V141C297 144.314 294.314 147 291 147H10C6.68629 147 4 144.314 4 141V10Z";

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
const DIVIDER_SHADOW_FILTER = "drop-shadow(0 1px 0.8px rgba(0,0,0,0.045))";

function ProfileIdCard() {
  const activeUser = mockUsers[0];
  const userName = activeUser?.name ?? "User";
  const calibrationDate = activeUser?.lastCalibrationDate ?? "2026-03-01";
  const userIdLabel = `@${activeUser?.userId ?? 0}`;
  const currentWeekLabel = formatCurrentWeekLabel(new Date());

  return (
    <div className="group relative h-[149px] w-[297px] min-h-[149px] min-w-[297px] max-h-[149px] max-w-[297px] shrink-0 cursor-default transition-transform duration-300 ease-out hover:-translate-y-[1px] hover:scale-[1.006]">
      <div className="absolute inset-[0_-0.67%_-2.68%_-0.67%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 301 153">
          <defs>
            <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="153" id="profile-card-shadow" width="301" x="0" y="0">
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feColorMatrix in="SourceAlpha" result="hardAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
              <feOffset dy="2" />
              <feGaussianBlur stdDeviation="2" />
              <feComposite in2="hardAlpha" operator="out" />
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0" />
              <feBlend in2="BackgroundImageFix" mode="normal" result="effect1_dropShadow_1_32" />
              <feBlend in="BackgroundImageFix" in2="effect1_dropShadow_1_32" mode="normal" result="BackgroundImageFix" />
              <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
            </filter>
            <linearGradient id="mistGradient" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: "#f8f8f9", stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: "#fafafa", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "#f6f6f7", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <g filter="url(#profile-card-shadow)">
            <path d={profileCardPath} fill="url(#mistGradient)" shapeRendering="crispEdges" />
          </g>
        </svg>
      </div>
      <div
        className="pointer-events-none absolute inset-0 rounded-[8px] backdrop-blur-[1px] transition-opacity duration-300 ease-out group-hover:opacity-90"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%)",
          mixBlendMode: "overlay",
        }}
      />
      <p className="absolute right-[21px] top-[14px] text-right font-ui text-[20px] font-medium leading-[normal] tracking-[-0.4px] text-black">{userName}</p>
      <p
        className="absolute left-[21px] top-[12px] text-[11px] leading-[normal] tracking-[-0.22px] text-[#888894]"
        style={{ fontFamily: "var(--font-meta-mono), monospace", fontWeight: 500 }}
      >
        PROFILE–ID
      </p>
      <div className="absolute left-[14px] top-[62px] h-[51px] w-[269px] border-[0.2px] border-solid border-[#888894]" />
      <div className="absolute left-[14px] top-[87px] h-[52px] w-[269px] border-[0.2px] border-solid border-[#888894]" />
      <p
        className="absolute left-[21px] top-[68px] text-[11px] leading-[normal] tracking-[-0.22px] text-[#888894]"
        style={{ fontFamily: "var(--font-meta-mono), monospace" }}
      >
        CURRENT WEEK:
      </p>
      <p
        className="absolute right-[21px] top-[68px] text-right text-[11px] leading-[normal] tracking-[-0.22px] text-[#111111]"
        style={{ fontFamily: "var(--font-meta-mono), monospace", fontWeight: 500 }}
      >
        {currentWeekLabel}
      </p>
      <p
        className="absolute right-[21px] top-[118px] text-right text-[11px] leading-[normal] tracking-[-0.22px] text-[#111111]"
        style={{ fontFamily: "var(--font-meta-mono), monospace", fontWeight: 500 }}
      >
        {userIdLabel}
      </p>
      <p
        className="absolute right-[21px] top-[93px] text-right text-[11px] leading-[normal] tracking-[-0.22px] text-[#111111]"
        style={{ fontFamily: "var(--font-meta-mono), monospace", fontWeight: 500 }}
      >
        {formatCalibrationDate(calibrationDate)}
      </p>
      <p
        className="absolute left-[21px] top-[93px] text-[11px] leading-[normal] tracking-[-0.22px] text-[#888894]"
        style={{ fontFamily: "var(--font-meta-mono), monospace" }}
      >
        LAST CALIBRATION:
      </p>
      <p
        className="absolute left-[21px] top-[118px] text-[11px] leading-[normal] tracking-[-0.22px] text-[#888894]"
        style={{ fontFamily: "var(--font-meta-mono), monospace" }}
      >
        USER-TAG:
      </p>
    </div>
  );
}

function ReferenceSetsContent({ user }: { user: (typeof mockUsers)[number] }) {
  const references = user.referenceSetForMainEdit ?? [];
  const preview = references.slice(0, 5);

  return (
    <div className="px-10">
      <p className="max-w-[760px] font-ui text-[13px] font-normal leading-[1.8] tracking-[0.02em] text-meta">
        A visual representation of your taste. Below, you&apos;ll find the reference sets corresponding to your edits.
      </p>

      <div className="mt-5 flex w-full max-w-[760px] items-end gap-5">
        <div className="w-[220px] shrink-0 self-end pb-2">
          <div className="flex items-baseline gap-3">
            <p className="font-ui text-[26px] font-medium leading-none tracking-[-0.03em] text-ink">MAIN EDIT</p>
            <p className="font-ui text-[12px] font-normal leading-4 tracking-[0.02em] text-meta">30 References</p>
          </div>
        </div>

        <div className="w-full max-w-[430px] self-end overflow-hidden rounded-[12px] bg-mist p-2">
          <div className="grid h-[180px] grid-cols-[1.7fr_1fr_0.7fr] gap-2">
            <div className="relative h-full w-full overflow-hidden rounded-[6px]">
              {preview[0] ? (
                <Image
                  src={preview[0].publicPath}
                  alt={preview[0].fileName}
                  fill
                  sizes="(max-width: 900px) 100vw, 300px"
                  className="object-cover object-center"
                />
              ) : null}
            </div>
            <div className="grid h-full grid-rows-2 gap-2">
              <div className="relative h-full w-full overflow-hidden rounded-[6px]">
                {preview[1] ? (
                  <Image
                    src={preview[1].publicPath}
                    alt={preview[1].fileName}
                    fill
                    sizes="(max-width: 900px) 50vw, 160px"
                    className="object-cover object-center"
                  />
                ) : null}
              </div>
              <div className="relative h-full w-full overflow-hidden rounded-[6px]">
                {preview[2] ? (
                  <Image
                    src={preview[2].publicPath}
                    alt={preview[2].fileName}
                    fill
                    sizes="(max-width: 900px) 50vw, 160px"
                    className="object-cover object-center"
                  />
                ) : null}
              </div>
            </div>
            <div className="grid h-full grid-rows-2 gap-2">
              <div className="relative h-full w-full overflow-hidden rounded-[6px]">
                {preview[3] ? (
                  <Image
                    src={preview[3].publicPath}
                    alt={preview[3].fileName}
                    fill
                    sizes="(max-width: 900px) 40vw, 120px"
                    className="object-cover object-center"
                  />
                ) : null}
              </div>
              <div className="relative h-full w-full overflow-hidden rounded-[6px]">
                {preview[4] ? (
                  <Image
                    src={preview[4].publicPath}
                    alt={preview[4].fileName}
                    fill
                    sizes="(max-width: 900px) 40vw, 120px"
                    className="object-cover object-center"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCurrentWeekLabel(date: Date): string {
  const { weekNumber, isoYear } = getIsoWeek(date);
  return `W${String(weekNumber).padStart(2, "0")} ${isoYear}`;
}

function getIsoWeek(date: Date): { weekNumber: number; isoYear: number } {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return {
    weekNumber: Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
    isoYear: tmp.getUTCFullYear(),
  };
}

function formatCalibrationDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function StickyShell({ mode, view, issueNumber = "04", archiveActiveItemCount }: StickyShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileNavTab["id"]>("signature");
  const activeProfileUser = mockUsers[0] ?? null;
  const fallbackIssueNumber = Number(issueNumber);
  const resolvedIssueNumber = activeProfileUser?.userId ?? (Number.isFinite(fallbackIssueNumber) ? fallbackIssueNumber : 0);
  const activeIssueNumber = String(resolvedIssueNumber).padStart(2, "0");
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
  const menuButtonAriaLabel = isMenuOpen ? "Close menu" : "Open menu";
  const editActionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

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

  const handleProfileOpen = () => {
    openProfile();
  };

  const handleCreateNewEdit = () => {
    setIsEditActionMenuOpen(false);
    openProfile({ tab: "reference-sets", editFlow: "create" });
  };

  const handleManageEdits = () => {
    setIsEditActionMenuOpen(false);
    openProfile({ tab: "reference-sets" });
  };

  return (
    <header data-sticky-root="true" className="sticky top-0 z-50">
      <StickyHeightSync targetId="sticky-stack" />
      <div id="sticky-stack" className="relative w-full" style={{ height: `${stickyStackHeightPx}px` }}>
        <div
          className="relative w-full bg-paper/90 backdrop-blur-md after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-8 after:h-8 after:bg-[linear-gradient(180deg,rgba(254,254,253,0.34)_0%,rgba(254,254,253,0.16)_42%,rgba(254,254,253,0.05)_72%,rgba(254,254,253,0)_100%)]"
          style={{ height: `${stickyBackdropHeightPx}px` }}
          data-node-id={isGallery ? "768:2169" : "770:2181"}
        >
          <div
            className={`absolute h-[34px] w-[198px] -translate-x-1/2 ${
              isGallery ? "left-[calc(50%+10.5px)]" : "left-[calc(50%+10px)]"
            }`}
            style={{ top: `${MODE_SWITCH_TOP_PX}px` }}
          >
            <ModePill selected={isGallery ? "gallery" : "archive"} />
          </div>

          <div className="absolute right-10 top-[23px] h-[26px] w-[161px]">
            <div className="relative h-[26px] w-[161px]">
              <p className="absolute left-0 top-0 w-[94px] text-right text-ink leading-none">
                <span className="font-ui text-[14px] font-semibold leading-[26px] tracking-[-0.04em]">seenless</span>
              </p>
              <div
                className={`absolute left-[100px] top-[7px] flex h-3 items-center justify-center rounded-[2px] px-1 py-[3px] ${
                  isGallery ? "bg-ink" : "bg-accent"
                }`}
              >
                <span className="font-ui text-[7px] font-bold leading-[7px] tracking-[-0.14px] text-paper">
                  BETA
                </span>
              </div>
              <button
                type="button"
                aria-label="Open profile"
                data-show-around-target="profile-button"
                onClick={handleProfileOpen}
                className="group absolute left-[146px] top-[7px] inline-flex h-[11px] w-[15px] items-center justify-center transition-opacity duration-300 ease-out pointer-events-auto opacity-100 focus-visible:outline-none"
              >
                <span
                  className={`absolute block h-[1.5px] w-[15px] rounded-full bg-meta transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                    isProfileEntryFromClose
                      ? "translate-y-0 rotate-45"
                      : "-translate-y-[4px] rotate-0 group-hover:scale-x-[1.04]"
                  }`}
                />
                <span
                  className={`absolute block h-[1.5px] w-[15px] rounded-full bg-meta transition-all duration-220 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                    isProfileEntryFromClose ? "opacity-0" : "opacity-100 group-hover:scale-x-[0.96]"
                  }`}
                />
                <span
                  className={`absolute block h-[1.5px] w-[15px] rounded-full bg-meta transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
                    isProfileEntryFromClose
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
                  <h1
                    data-show-around-target="issue-heading"
                    className={`inline-flex items-end text-[30px] leading-none ${headerColorClass}`}
                  >
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

          {isGallery ? (
            <div className="absolute left-[41px] z-20" style={{ top: `${137 - lowerNavLiftPx}px` }}>
              <GalleryEditNav />
            </div>
          ) : (
            <div className="absolute left-0 right-0" style={{ top: `${137 - lowerNavLiftPx}px` }}>
              <ArchiveCapsuleNav targetDividerY={dividerTopPx - (137 - lowerNavLiftPx)} />
            </div>
          )}

          <div className="absolute right-10 z-20" style={{ top: `${195 - lowerNavLiftPx}px` }}>
            <ViewToggle
              mode={mode}
              view={view}
              archiveActiveItemCount={archiveActiveItemCount}
              archiveCapsuleId={archiveCapsuleId}
            />
          </div>

          {isGallery ? (
            <div
              data-show-around-target="edits-row"
              aria-hidden="true"
              className="pointer-events-none absolute left-[41px] right-[33px] z-10"
              style={{ top: `${136 - lowerNavLiftPx}px`, height: "42px" }}
            />
          ) : null}

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
                data-show-around-target="edit-plus"
                onClick={() => setIsEditActionMenuOpen(true)}
                className={`font-ui inline-flex h-8 w-8 items-center justify-center rounded-full border text-[18px] font-medium leading-none tracking-[0.02em] transition-all duration-150 ease-out focus-visible:outline-none ${
                  isEditActionMenuOpen
                    ? "pointer-events-none scale-[0.96] border-line/70 bg-mist/70 text-inactive opacity-0"
                    : "scale-100 border-transparent bg-transparent text-inactive opacity-100 hover:border-line/80 hover:bg-[#F5F5F6] hover:text-[#6F7381] hover:shadow-[0_1px_2px_rgba(0,0,0,0.12)] focus-visible:border-line/80 focus-visible:bg-[#F5F5F6] focus-visible:text-[#6F7381] focus-visible:shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
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
                  className="inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:font-medium focus-visible:font-medium hover:text-ink focus-visible:text-ink"
                >
                  create
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleManageEdits}
                  className="inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:font-medium focus-visible:font-medium hover:text-ink focus-visible:text-ink"
                >
                  review
                </button>
              </div>
            </div>
          ) : null}

          {isGallery && (
            <>
              <div
                className="pointer-events-none absolute left-10 right-10 z-10 h-[1px]"
                style={{ top: `${dividerTopPx}px`, backgroundColor: DIVIDER_COLOR, filter: DIVIDER_SHADOW_FILTER }}
              />
            </>
          )}
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[130] bg-paper p-[16px] transition-opacity duration-300 ease-out ${
          isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isMenuOpen}
      >
        <div
          className={`relative h-full w-full rounded-[8px] bg-[#FCFCFA] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-out ${
            isMenuOpen ? "translate-y-0 scale-100" : "translate-y-[2px] scale-[0.996]"
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-[250px] px-10">
            <div className="relative grid h-full w-full grid-cols-[minmax(230px,1fr)_minmax(297px,auto)] gap-x-8">
              <div className="relative z-20 flex h-full flex-col items-start justify-start pt-[70px]">
                <div className="flex w-full flex-col items-start gap-3 text-left">
                  {profileNavTabs.map((tab) => {
                    const isActive = activeProfileTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveProfileTab(tab.id)}
                        className={`inline-flex items-end whitespace-nowrap transition-all duration-300 ease-out ${
                          isActive
                            ? "leading-none text-ink"
                            : "font-ui text-[14px] font-medium leading-5 tracking-[0.02em] text-inactive hover:text-meta"
                        }`}
                      >
                        {isActive ? (
                          <span className="inline-flex items-end">
                            {tab.activeInterLabel ? (
                              <span className="font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">
                                {tab.activeInterLabel}
                              </span>
                            ) : null}
                            <span className="ml-[2px] font-instrument text-[25px] italic leading-none tracking-[0.01em]">
                              {tab.activeInstrumentLabel}
                            </span>
                          </span>
                        ) : (
                          tab.label
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex h-full -translate-x-2 items-start justify-end pt-5">
                <ProfileIdCard />
              </div>

              <div
                className="pointer-events-none absolute left-0 top-[186px] h-px w-[35%]"
                style={{ backgroundColor: DIVIDER_COLOR, filter: DIVIDER_SHADOW_FILTER }}
              />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 top-[194px] overflow-y-auto pt-4">
            {activeProfileTab === "signature" && activeProfileUser ? (
              <ProfileSignatureContent user={activeProfileUser} />
            ) : null}
            {activeProfileTab === "reference-sets" ? (
              activeProfileUser ? <ReferenceSetsContent user={activeProfileUser} /> : null
            ) : null}
          </div>
        </div>
        <button
          type="button"
          aria-label={menuButtonAriaLabel}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(false)}
          className={`absolute right-10 top-[30px] flex h-[11px] w-[15px] items-center justify-center transition-opacity duration-300 ease-out ${
            isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <span className="absolute block h-[1.5px] w-[15px] rotate-45 rounded-full bg-meta" />
          <span className="absolute block h-[1.5px] w-[15px] -rotate-45 rounded-full bg-meta" />
        </button>
      </div>
    </header>
  );
}
