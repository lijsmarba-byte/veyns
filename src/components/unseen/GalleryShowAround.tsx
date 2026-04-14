"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mockUsers } from "@/data/mockUsers";

const SHOW_AROUND_PENDING_KEY = "unseen:show-around-pending";
const SHOW_AROUND_COMPLETED_AT_KEY = "unseen:show-around-completed-at";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const GALLERY_ARRIVAL_COMPLETE_EVENT = "unseen:gallery-arrival-complete";
const SHOW_AROUND_OPEN_DELAY_MS = 1400;
const FOCUS_MOTION_MS = 760;
const INTRO_STAGGER_MS = 70;

type TourStep = {
  id: string;
  target: string;
  copy: string;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type PanelSize = {
  width: number;
  height: number;
};

type TourPhase = "intro" | "blur" | "tour";

const TOUR_STEPS: TourStep[] = [
  {
    id: "gallery",
    target: "gallery-segment",
    copy:
      "The Gallery is the live weekly view. With each new Issue, Edits refresh across categories and new arrivals take their place.",
  },
  {
    id: "archive",
    target: "archive-segment",
    copy:
      "The Archive holds saved items, gathered into selections called Capsules, each tied to an Edit.",
  },
  {
    id: "views",
    target: "discovery-views",
    copy: "Three viewing modes are available: Grid, Focus, and Immersive.",
  },
  {
    id: "profile",
    target: "profile-button",
    copy: "Profile holds personalized Signature, reference sets, and settings.",
  },
  {
    id: "edits",
    target: "edits-row",
    copy:
      "The Main Edit is the primary aesthetic line. Additional Edits can be individually created for distinct contexts, such as Summer or Wedding Guest. With each new Issue, all Edits refresh across categories.",
  },
  {
    id: "create",
    target: "edit-plus",
    copy: "Use + to create a new Edit or review existing Edits.",
  },
  {
    id: "categories",
    target: "category-nav",
    copy: "Category navigation opens into six lines: Outer, Upper, Lower, Silhouette, Ground, and Artifacts.",
  },
];

const actionPillClass =
  "inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:font-medium hover:text-ink focus-visible:font-medium focus-visible:text-ink focus-visible:outline-none";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pickVisibleTargetRect(target: string, stepId?: string): TargetRect | null {
  if (stepId === "gallery" || stepId === "archive") {
    const segment = document.querySelector(`[data-show-around-target="${target}"]`);
    if (segment instanceof HTMLElement) {
      const segmentRect = segment.getBoundingClientRect();
      const segmentStyles = window.getComputedStyle(segment);
      const isVisible =
        segmentRect.width > 1 &&
        segmentRect.height > 1 &&
        segmentStyles.display !== "none" &&
        segmentStyles.visibility !== "hidden";
      if (isVisible) {
        return {
          top: segmentRect.top,
          left: segmentRect.left,
          width: segmentRect.width,
          height: segmentRect.height,
        };
      }
    }
  }

  if (stepId === "categories") {
    const contentNodes = Array.from(document.querySelectorAll('[data-show-around-target="category-nav-content"]')).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    if (contentNodes.length > 0) {
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const rects = contentNodes
        .map((node) => {
          const rect = node.getBoundingClientRect();
          const styles = window.getComputedStyle(node);
          const ix = Math.max(0, Math.min(rect.right, viewportW) - Math.max(rect.left, 0));
          const iy = Math.max(0, Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0));
          const isVisible =
            rect.width > 1 &&
            rect.height > 1 &&
            styles.display !== "none" &&
            styles.visibility !== "hidden" &&
            Number(styles.opacity || "1") > 0.02 &&
            ix > 0 &&
            iy > 0;
          return isVisible ? rect : null;
        })
        .filter((rect): rect is DOMRect => rect !== null);
      if (rects.length > 0) {
        const left = Math.min(...rects.map((rect) => rect.left));
        const top = Math.min(...rects.map((rect) => rect.top));
        const right = Math.max(...rects.map((rect) => rect.right));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        return {
          top,
          left,
          width: Math.max(1, right - left),
          height: Math.max(1, bottom - top),
        };
      }
    }
  }

  const nodes = Array.from(document.querySelectorAll(`[data-show-around-target="${target}"]`)).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  if (nodes.length === 0) return null;

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const visibleNodes = nodes
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const styles = window.getComputedStyle(node);
      const isVisible =
        rect.width > 1 &&
        rect.height > 1 &&
        styles.display !== "none" &&
        styles.visibility !== "hidden" &&
        Number(styles.opacity || "1") > 0.02;

      const ix = Math.max(0, Math.min(rect.right, viewportW) - Math.max(rect.left, 0));
      const iy = Math.max(0, Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0));
      const intersectionArea = ix * iy;

      return {
        rect,
        isVisible,
        area: intersectionArea > 0 ? intersectionArea : rect.width * rect.height,
      };
    })
    .filter((entry) => entry.isVisible)
    .sort((a, b) => b.area - a.area);

  if (visibleNodes.length === 0) return null;
  const rect = visibleNodes[0].rect;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function isRectClose(a: TargetRect | null, b: TargetRect): boolean {
  if (!a) return false;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export function GalleryShowAround() {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourPhase, setTourPhase] = useState<TourPhase>("intro");
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 1440, height: 900 });
  const [panelSize, setPanelSize] = useState<PanelSize>({ width: 400, height: 210 });
  const [introName, setIntroName] = useState("User");
  const [isIntroEntered, setIsIntroEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const currentStep = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;
  const isPromptVisible = tourPhase === "intro";
  const isBlurVisible = tourPhase === "blur";
  const isTourVisible = tourPhase === "tour";

  const completeShowAround = useCallback(() => {
    setIsOpen(false);
    setStepIndex(0);
    setTourPhase("intro");
    setTargetRect(null);
    try {
      window.localStorage.removeItem(SHOW_AROUND_PENDING_KEY);
      window.localStorage.setItem(SHOW_AROUND_COMPLETED_AT_KEY, new Date().toISOString());
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const beginTour = useCallback(() => {
    setStepIndex(0);
    const panelRect = panelRef.current?.getBoundingClientRect();
    if (panelRect && panelRect.width > 1 && panelRect.height > 1) {
      setTargetRect({
        top: panelRect.top,
        left: panelRect.left,
        width: panelRect.width,
        height: panelRect.height,
      });
    } else {
      setTargetRect(null);
    }
    setTourPhase("blur");
  }, []);

  useEffect(() => {
    if (!isOpen) {
      window.dispatchEvent(new CustomEvent("unseen:tour-step-change", { detail: { stepId: null } }));
      return;
    }

    const stepId = isTourVisible ? currentStep.id : null;
    window.dispatchEvent(new CustomEvent("unseen:tour-step-change", { detail: { stepId } }));

    return () => {
      window.dispatchEvent(new CustomEvent("unseen:tour-step-change", { detail: { stepId: null } }));
    };
  }, [currentStep.id, isOpen, isTourVisible]);

  useEffect(() => {
    let openTimer: number | null = null;
    let onArrivalComplete: (() => void) | null = null;

    const readIntroName = (): string => {
      try {
        const activeUserName = mockUsers[0]?.name?.trim();
        if (activeUserName) return activeUserName;
        const rawProfile = window.localStorage.getItem("unseen:onboarding-profile");
        if (!rawProfile) return "User";
        const parsed = JSON.parse(rawProfile) as { name?: unknown };
        if (typeof parsed?.name !== "string") return "User";
        const trimmed = parsed.name.trim();
        return trimmed.length > 0 ? trimmed : "User";
      } catch {
        return "User";
      }
    };

    try {
      if (window.localStorage.getItem(SHOW_AROUND_PENDING_KEY) === "1") {
        const openShowAround = () => {
          setIntroName(readIntroName());
          setStepIndex(0);
          setTourPhase("intro");
          setTargetRect(null);
          setIsOpen(true);
        };

        const shouldWaitForArrival = window.sessionStorage.getItem(GALLERY_ARRIVAL_ACTIVE_KEY) === "1";
        if (shouldWaitForArrival) {
          onArrivalComplete = () => {
            openTimer = window.setTimeout(openShowAround, SHOW_AROUND_OPEN_DELAY_MS);
          };
          window.addEventListener(GALLERY_ARRIVAL_COMPLETE_EVENT, onArrivalComplete, { once: true });
        } else {
          openTimer = window.setTimeout(openShowAround, SHOW_AROUND_OPEN_DELAY_MS);
        }
      }
    } catch {
      // Ignore storage failures.
    }

    return () => {
      if (openTimer !== null) {
        window.clearTimeout(openTimer);
      }
      if (onArrivalComplete) {
        window.removeEventListener(GALLERY_ARRIVAL_COMPLETE_EVENT, onArrivalComplete);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (tourPhase !== "blur") return;

    const tourTimer = window.setTimeout(() => {
      setTourPhase("tour");
    }, 760);

    return () => {
      window.clearTimeout(tourTimer);
    };
  }, [isOpen, tourPhase]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        completeShowAround();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [completeShowAround, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let rafId = 0;
    const syncViewport = () => {
      setViewport((current) => {
        const nextWidth = window.innerWidth;
        const nextHeight = window.innerHeight;
        if (current.width === nextWidth && current.height === nextHeight) return current;
        return { width: nextWidth, height: nextHeight };
      });
    };

    rafId = window.requestAnimationFrame(syncViewport);
    window.addEventListener("resize", syncViewport);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", syncViewport);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!panelRef.current) return;

    let rafId = 0;
    const node = panelRef.current;
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            if (width <= 0 || height <= 0) return;
            setPanelSize((current) => {
              if (Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5) return current;
              return { width, height };
            });
          })
        : null;

    observer?.observe(node);
    rafId = window.requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setPanelSize({ width: rect.width, height: rect.height });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [currentStep.id, isOpen, isPromptVisible, isTourVisible]);

  useEffect(() => {
    if (!isOpen) return;
    if (isPromptVisible) return;

    let rafId = 0;

    const loop = () => {
      const nextRect = pickVisibleTargetRect(currentStep.target, currentStep.id);
      if (nextRect) {
        setTargetRect((current) => (isRectClose(current, nextRect) ? current : nextRect));
      }
      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [currentStep.id, currentStep.target, isOpen, isPromptVisible]);

  useEffect(() => {
    let resetTimer: number | null = null;
    let revealTimer: number | null = null;

    if (!isOpen || !isPromptVisible) {
      resetTimer = window.setTimeout(() => {
        setIsIntroEntered(false);
      }, 0);
      return () => {
        if (resetTimer !== null) {
          window.clearTimeout(resetTimer);
        }
      };
    }

    resetTimer = window.setTimeout(() => {
      setIsIntroEntered(false);
    }, 0);
    revealTimer = window.setTimeout(() => {
      setIsIntroEntered(true);
    }, 60);

    return () => {
      if (resetTimer !== null) {
        window.clearTimeout(resetTimer);
      }
      if (revealTimer !== null) {
        window.clearTimeout(revealTimer);
      }
    };
  }, [isOpen, isPromptVisible]);

  if (!isOpen) return null;

  const blurPx = tourPhase === "intro" ? 0 : tourPhase === "blur" ? 1 : 2;
  const tintOpacity = tourPhase === "intro" ? 0 : tourPhase === "blur" ? 0.1 : 0.18;
  const safeInsetX = 22;
  const safeInsetTop = 4;
  const safeInsetBottom = 22;
  const isModeSegmentStep = currentStep.id === "gallery" || currentStep.id === "archive";
  const isCategoryNavStep = currentStep.id === "categories";
  const isViewsStep = currentStep.id === "views";
  const isEditsStep = currentStep.id === "edits";
  const isCreateStep = currentStep.id === "create";
  const isProfileStep = currentStep.id === "profile";
  const cutoutPaddingLeft = isModeSegmentStep ? 4 : isCategoryNavStep ? 12 : 22;
  const cutoutPaddingRight = isModeSegmentStep ? 4 : isCategoryNavStep ? 4 : 22;
  const cutoutPaddingTop = isModeSegmentStep ? 4 : isCategoryNavStep ? 0 : isEditsStep ? 6 : isCreateStep ? 8 : 14;
  const cutoutPaddingBottom = isModeSegmentStep ? 4 : isCategoryNavStep ? 20 : 14;
  const horizontalFocusNudge = 0;
  const categoryFocusRightShift = isCategoryNavStep ? 2 : 0;
  const categoryFocusWidthTrim = isCategoryNavStep ? 98 : 0;
  const categoryFocusDownShift = isCategoryNavStep ? 42 : 0;
  const viewsFocusUpShift = isViewsStep ? 4 : 0;
  const editCreateDownShift = isEditsStep ? 8 : 0;
  const activeRect = targetRect;
  const hasTarget = activeRect !== null;

  const rawHoleTop = hasTarget
    ? activeRect.top - cutoutPaddingTop + categoryFocusDownShift + editCreateDownShift - viewsFocusUpShift
    : viewport.height * 0.25;
  const rawHoleLeft = hasTarget
    ? activeRect.left - cutoutPaddingLeft + horizontalFocusNudge + categoryFocusRightShift
    : viewport.width * 0.35;
  const rawHoleWidth = hasTarget
    ? activeRect.width + cutoutPaddingLeft + cutoutPaddingRight - categoryFocusWidthTrim
    : viewport.width * 0.34;
  const rawHoleHeight = hasTarget ? activeRect.height + cutoutPaddingTop + cutoutPaddingBottom : 52;

  const profileFocusCenterX = hasTarget ? activeRect.left + activeRect.width * 0.5 + 5 : 0;
  const profileFocusCenterY = hasTarget ? activeRect.top + activeRect.height * 0.5 + 6 : 0;
  const profileFocusSize = hasTarget ? 56 : 0;
  const createFocusCenterX = hasTarget ? activeRect.left + activeRect.width * 0.5 : 0;
  const createFocusCenterY = hasTarget ? activeRect.top + activeRect.height * 0.5 : 0;
  const createFocusSize = hasTarget ? 44 : 0;
  const isFixedCircularStep = isProfileStep || isCreateStep;
  const fixedFocusCenterX = isProfileStep ? profileFocusCenterX : createFocusCenterX;
  const fixedFocusCenterY = isProfileStep ? profileFocusCenterY : createFocusCenterY;
  const fixedFocusSize = isProfileStep ? profileFocusSize : createFocusSize;
  const resolvedRawHoleLeft = isProfileStep && hasTarget ? profileFocusCenterX - profileFocusSize * 0.5 : rawHoleLeft;
  const resolvedRawHoleTop = isProfileStep && hasTarget ? profileFocusCenterY - profileFocusSize * 0.5 : rawHoleTop;
  const resolvedRawHoleWidth = isProfileStep && hasTarget ? profileFocusSize : rawHoleWidth;
  const resolvedRawHoleHeight = isProfileStep && hasTarget ? profileFocusSize : rawHoleHeight;
  const finalRawHoleLeft = isFixedCircularStep && hasTarget ? fixedFocusCenterX - fixedFocusSize * 0.5 : resolvedRawHoleLeft;
  const finalRawHoleTop = isFixedCircularStep && hasTarget ? fixedFocusCenterY - fixedFocusSize * 0.5 : resolvedRawHoleTop;
  const finalRawHoleWidth = isFixedCircularStep && hasTarget ? fixedFocusSize : resolvedRawHoleWidth;
  const finalRawHoleHeight = isFixedCircularStep && hasTarget ? fixedFocusSize : resolvedRawHoleHeight;

  const holeLeft = clamp(finalRawHoleLeft, safeInsetX, viewport.width - safeInsetX - 40);
  const holeTop = clamp(finalRawHoleTop, safeInsetTop, viewport.height - safeInsetBottom - 24);
  const minimumHoleWidth = isModeSegmentStep ? 40 : isCategoryNavStep ? 84 : isProfileStep ? 48 : isCreateStep ? 40 : 140;
  const holeWidth = isProfileStep || isCreateStep
    ? clamp(
        finalRawHoleWidth,
        minimumHoleWidth,
        Math.min(viewport.width - holeLeft - safeInsetX, viewport.height - holeTop - safeInsetBottom),
      )
    : clamp(finalRawHoleWidth, minimumHoleWidth, viewport.width - holeLeft - safeInsetX);
  const holeHeight = isProfileStep || isCreateStep
    ? holeWidth
    : clamp(finalRawHoleHeight, 24, viewport.height - holeTop - safeInsetBottom);

  const holeLeftPx = Math.floor(holeLeft);
  const holeTopPx = Math.floor(holeTop);
  const holeRightPx = Math.ceil(holeLeft + holeWidth);
  const holeBottomPx = Math.ceil(holeTop + holeHeight);
  const holeWidthPx = Math.max(holeRightPx - holeLeftPx, 1);
  const holeHeightPx = Math.max(holeBottomPx - holeTopPx, 1);
  const focusRadiusPx = isCategoryNavStep
    ? Math.max(44, Math.min(holeHeightPx / 2, holeWidthPx / 2))
    : Math.max(12, Math.min(holeHeightPx / 2, holeWidthPx / 2));

  const panelMargin = 24;
  const panelLeft = clamp((viewport.width - panelSize.width) / 2, panelMargin, viewport.width - panelSize.width - panelMargin);
  const panelTop = clamp(
    viewport.height * 0.56 - panelSize.height * 0.5,
    panelMargin,
    viewport.height - panelSize.height - panelMargin,
  );

  const paneStyle = {
    backdropFilter: `blur(${blurPx}px)`,
    WebkitBackdropFilter: `blur(${blurPx}px)`,
    backgroundColor: `rgba(254,254,253,${tintOpacity})`,
    transition:
      `backdrop-filter ${FOCUS_MOTION_MS}ms cubic-bezier(0.22,0.75,0.28,1), background-color ${FOCUS_MOTION_MS}ms cubic-bezier(0.22,0.75,0.28,1), clip-path ${FOCUS_MOTION_MS}ms cubic-bezier(0.22,0.75,0.28,1), -webkit-clip-path ${FOCUS_MOTION_MS}ms cubic-bezier(0.22,0.75,0.28,1)`,
  } as const;

  const roundedHolePathCCW = [
    `M ${holeLeftPx + focusRadiusPx} ${holeTopPx}`,
    `A ${focusRadiusPx} ${focusRadiusPx} 0 0 0 ${holeLeftPx} ${holeTopPx + focusRadiusPx}`,
    `V ${holeBottomPx - focusRadiusPx}`,
    `A ${focusRadiusPx} ${focusRadiusPx} 0 0 0 ${holeLeftPx + focusRadiusPx} ${holeBottomPx}`,
    `H ${holeRightPx - focusRadiusPx}`,
    `A ${focusRadiusPx} ${focusRadiusPx} 0 0 0 ${holeRightPx} ${holeBottomPx - focusRadiusPx}`,
    `V ${holeTopPx + focusRadiusPx}`,
    `A ${focusRadiusPx} ${focusRadiusPx} 0 0 0 ${holeRightPx - focusRadiusPx} ${holeTopPx}`,
    `H ${holeLeftPx + focusRadiusPx}`,
    "Z",
  ].join(" ");
  const overlayClipPath = `path("M 0 0 H ${viewport.width} V ${viewport.height} H 0 Z ${roundedHolePathCCW}")`;

  return (
    <div className="fixed inset-0 z-[150]" aria-live="polite">
      <div
        className="absolute inset-0"
        style={{
          ...paneStyle,
          clipPath: overlayClipPath,
          WebkitClipPath: overlayClipPath,
          clipRule: "evenodd",
        }}
      />

      {tourPhase !== "intro" && hasTarget ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute border shadow-[0_0_0_2px_rgba(254,254,253,0.96),0_1px_4px_rgba(0,0,0,0.05)] transition-[top,left,width,height,border-radius] duration-[760ms] ease-[cubic-bezier(0.22,0.75,0.28,1)]"
          style={{
            top: `${holeTopPx}px`,
            left: `${holeLeftPx}px`,
            width: `${holeWidthPx}px`,
            height: `${holeHeightPx}px`,
            borderRadius: `${focusRadiusPx}px`,
            borderColor: "rgba(136, 136, 148, 0.52)",
          }}
        />
      ) : null}

      {isPromptVisible || isBlurVisible || isTourVisible ? (
        <div
          ref={panelRef}
          className="absolute z-[2] flex min-h-[252px] w-[min(580px,calc(100%-72px))] flex-col bg-paper/97 px-6 pb-5 pt-5 shadow-[0_2px_8px_rgba(0,0,0,0.045)] transition-[top,left,opacity] duration-[420ms] ease-[cubic-bezier(0.22,0.75,0.28,1)]"
          style={{ top: `${panelTop}px`, left: `${panelLeft}px` }}
        >
          {isPromptVisible ? (
            <>
              <div className="flex flex-1 items-center justify-center">
                <div className="flex max-w-[470px] flex-col items-center text-center">
                  <p
                    className="inline-flex items-baseline text-ink"
                    style={{
                      opacity: isIntroEntered ? 1 : 0,
                      transform: isIntroEntered ? "translate3d(0,0,0) scale(1)" : "translate3d(0,10px,0) scale(0.992)",
                      transition:
                        "opacity 620ms cubic-bezier(0.22,0.75,0.28,1), transform 620ms cubic-bezier(0.22,0.75,0.28,1)",
                      willChange: "opacity, transform",
                    }}
                  >
                    <span className="font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">Welcome</span>
                    <span className="-ml-[1px] font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">–</span>
                    <span className="ml-[1px] font-instrument text-[25px] italic leading-none tracking-[0.01em]">
                      {introName}
                    </span>
                  </p>
                  <p
                    className="mt-5 font-ui text-[15px] leading-[1.7] tracking-[0.006em] text-meta"
                    style={{
                      opacity: isIntroEntered ? 1 : 0,
                      transform: isIntroEntered ? "translate3d(0,0,0)" : "translate3d(0,8px,0)",
                      transition:
                        "opacity 620ms cubic-bezier(0.22,0.75,0.28,1), transform 620ms cubic-bezier(0.22,0.75,0.28,1)",
                      transitionDelay: `${INTRO_STAGGER_MS}ms`,
                      willChange: "opacity, transform",
                    }}
                  >
                    A short orientation is available. Begin with a brief introduction to Issue, Archive, Profile, and
                    Edits, or enter directly.
                  </p>
                </div>
              </div>
              <div
                className="mt-auto w-full max-w-[470px] self-center pt-8"
                style={{
                  opacity: isIntroEntered ? 1 : 0,
                  transform: isIntroEntered ? "translate3d(0,0,0)" : "translate3d(0,6px,0)",
                  transition: "opacity 560ms cubic-bezier(0.22,0.75,0.28,1), transform 560ms cubic-bezier(0.22,0.75,0.28,1)",
                  transitionDelay: `${INTRO_STAGGER_MS * 2}ms`,
                  willChange: "opacity, transform",
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <button type="button" onClick={completeShowAround} className={actionPillClass}>
                    Enter directly
                  </button>
                  <button type="button" onClick={beginTour} className={actionPillClass}>
                    Begin orientation
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-1 items-center justify-center">
                <p
                  className="max-w-[470px] text-center font-ui text-[15px] leading-[1.72] tracking-[0.006em] text-meta"
                  style={{ whiteSpace: currentStep.id === "categories" ? "pre-line" : "normal" }}
                >
                  {currentStep.copy}
                </p>
              </div>

              <div className="mt-auto w-full max-w-[470px] self-center pb-4">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (stepIndex === 0) {
                        setTourPhase("intro");
                        setTargetRect(null);
                        return;
                      }
                      setStepIndex((current) => Math.max(current - 1, 0));
                    }}
                    className={actionPillClass}
                  >
                    back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isLastStep) {
                        completeShowAround();
                        return;
                      }
                      setStepIndex((current) => Math.min(current + 1, TOUR_STEPS.length - 1));
                    }}
                    className={actionPillClass}
                  >
                    {isLastStep ? "enter issue" : "next"}
                  </button>
                </div>
              </div>

              <div className="-mx-6 h-[2px] bg-line">
                <div
                  className="h-full bg-ink transition-[width] duration-[320ms] ease-[cubic-bezier(0.22,0.75,0.28,1)]"
                  style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
