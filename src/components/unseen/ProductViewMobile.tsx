"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { TouchEvent as ReactTouchEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductViewMobileScrollLock } from "@/components/unseen/ProductViewMobileScrollLock";

type MobileProductImage = {
  id: string;
  src: string;
  alt: string;
};

type ProductViewMobileProps = {
  backHref: string;
  brand: string;
  cues: string[];
  disableEnterAnimation?: boolean;
  disableGridReturnPrep?: boolean;
  forceReplaceOnClose?: boolean;
  description: string;
  editId?: string | null;
  images: MobileProductImage[];
  isArchiveMode: boolean;
  isPreOwned: boolean;
  itemId: string;
  mode: string | undefined;
  pipeLabel: string;
  price: string;
  title: string;
};

type SavedItemRecord = {
  itemId: string;
  capsuleId: string;
  savedAt: string;
};

type CapsuleOption = {
  id: string;
  label: string;
};

const capsuleOptions: CapsuleOption[] = [
  { id: "main", label: "Main Capsule" },
  { id: "capsule1", label: "Capsule 1" },
  { id: "capsule2", label: "Capsule 2" },
  { id: "capsule3", label: "Capsule 3" },
];

const MOBILE_DOT_SIZE_PX = 6;
const EDGE_SWIPE_START_PX = 28;
const EDGE_SWIPE_COMMIT_PX = 72;
const EDGE_SWIPE_INTENT_PX = 12;
const EDGE_SWIPE_MAX_VERTICAL_PX = 80;
const IMAGE_SWIPE_COMMIT_PX = 42;
const IMAGE_SWIPE_INTENT_PX = 10;
const IMAGE_SWIPE_CUE_CANCEL_PX = 3;
const IMAGE_SWIPE_MAX_VERTICAL_PX = 72;
const MOBILE_CUE_ACTIVATION_MS = 170;
const MOBILE_CUE_MOVE_ACTIVATE_PX = 3;
const MOBILE_BACKDROP_CLOSE_ARM_DELAY_MS = 420;
const MOBILE_OVERLAY_OPEN_DURATION_MS = 260;
const MOBILE_OVERLAY_TRANSITION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const MOBILE_GRID_PRODUCT_RETURN_KEY = "unseen:mobile-grid-product-return";
const IMMERSIVE_RETURN_STEADY_KEY = "unseen:immersive-return-steady";
const RETURN_FOCUS_ITEM_KEY = "unseen:return-focus-item";
const MOBILE_MAIN_IMAGE_SIZE = { width: 1094, height: 1237 };
const MOBILE_DETAIL_IMAGE_SIZE = { width: 2160, height: 2441 };
const MOBILE_IMAGE_LIMITS = [
  {
    maxWidth: "min(138vw, 552px)",
    maxHeight: "min(100%, 56dvh, 466px)",
  },
  {
    maxWidth: "min(130vw, 516px)",
    maxHeight: "min(100%, 54dvh, 427px)",
  },
  {
    maxWidth: "min(130vw, 516px)",
    maxHeight: "min(100%, 54dvh, 427px)",
  },
  {
    maxWidth: "min(130vw, 516px)",
    maxHeight: "min(100%, 54dvh, 427px)",
  },
];

function getMobileImageSize(index: number) {
  return index === 0 ? MOBILE_MAIN_IMAGE_SIZE : MOBILE_DETAIL_IMAGE_SIZE;
}

function getDefaultCapsuleId(editId: string | null | undefined) {
  if (!editId || editId === "main") return "main";
  if (editId === "edit1" || editId === "edit1a") return "capsule1";
  if (editId === "edit2" || editId === "edit1b") return "capsule2";
  if (editId === "edit3" || editId === "edit1c") return "capsule3";
  return "main";
}

function emitSavedItemsUpdated(itemId: string, isSaved: boolean) {
  window.dispatchEvent(
    new CustomEvent("unseen:saved-items-updated", {
      detail: { itemId, isSaved },
    }),
  );
}

function readSavedCapsuleId(itemId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("unseen:saved-items");
    if (!raw) return null;
    const records = JSON.parse(raw) as SavedItemRecord[];
    return records.find((record) => record.itemId === itemId)?.capsuleId ?? null;
  } catch {
    return null;
  }
}

function isMobileProductViewHit(target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  const element = target instanceof Element ? target : target.parentElement;
  if (!element) return false;
  return Boolean(
    element.closest(
      '[data-pv-mobile-close-guard="true"], [data-pv-mobile-scroll-region="true"], [data-pv-info-hit="true"]',
    ),
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isMobileGridBackHref(backHref: string) {
  if (backHref.includes("/focus") || backHref.includes("/immersive")) return false;
  return backHref === "/gallery" || backHref.startsWith("/gallery?") || backHref === "/archive" || backHref.startsWith("/archive?");
}

function isMobileImmersiveBackHref(backHref: string) {
  return backHref.includes("/focus") || backHref.includes("/immersive");
}

function prepareMobileProductClose(backHref: string) {
  if (typeof window === "undefined") return;
  if (!isMobileGridBackHref(backHref)) return;
  // Grid return should follow the same deterministic close feel as focus/immersive:
  // no freeze-layer choreography that can introduce image flash on mobile browsers.
  // We still keep the return marker for arrival-reveal gating.
  try {
    window.sessionStorage.setItem(
      MOBILE_GRID_PRODUCT_RETURN_KEY,
      JSON.stringify({
        at: Date.now(),
        backHref,
      }),
    );
  } catch {
    // Optional return polish only.
  }
}

function MobileActionRow({
  editId,
  itemId,
  mode,
}: {
  editId?: string | null;
  itemId: string;
  mode: string | undefined;
}) {
  const isArchiveMode = mode === "archive";
  const defaultCapsuleId = getDefaultCapsuleId(editId);
  const [selectedCapsuleId, setSelectedCapsuleId] = useState(defaultCapsuleId);
  const [isSaveFlowOpen, setIsSaveFlowOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedCapsuleId = readSavedCapsuleId(itemId);
      setSelectedCapsuleId(savedCapsuleId ?? defaultCapsuleId);
      setIsSaved(isArchiveMode || savedCapsuleId !== null);
      setIsSaveFlowOpen(false);
      setIsDropdownOpen(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [defaultCapsuleId, isArchiveMode, itemId]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || dropdownRef.current?.contains(target)) return;
      setIsDropdownOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  const selectedCapsuleLabel =
    capsuleOptions.find((option) => option.id === selectedCapsuleId)?.label ?? capsuleOptions[0].label;
  const otherCapsules = capsuleOptions.filter((option) => option.id !== selectedCapsuleId);
  const baseButtonClass =
    "inline-flex h-[35px] min-w-[78px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]";

  const saveToStorage = (capsuleId: string) => {
    try {
      const raw = window.localStorage.getItem("unseen:saved-items");
      const currentRecords: SavedItemRecord[] = raw ? JSON.parse(raw) : [];
      const nextRecords = [
        ...currentRecords.filter((record) => record.itemId !== itemId),
        { itemId, capsuleId, savedAt: new Date().toISOString() },
      ];
      window.localStorage.setItem("unseen:saved-items", JSON.stringify(nextRecords));
      emitSavedItemsUpdated(itemId, true);
    } catch {
      // Keep UI responsive even if storage is unavailable.
    }
  };

  const removeFromStorage = () => {
    try {
      const raw = window.localStorage.getItem("unseen:saved-items");
      const currentRecords: SavedItemRecord[] = raw ? JSON.parse(raw) : [];
      const nextRecords = currentRecords.filter((record) => record.itemId !== itemId);
      window.localStorage.setItem("unseen:saved-items", JSON.stringify(nextRecords));
      emitSavedItemsUpdated(itemId, false);
    } catch {
      // Keep UI responsive even if storage is unavailable.
    }
  };

  return (
    <div
      data-pv-mobile-hit="true"
      data-pv-info-hit="true"
      className="relative flex items-center justify-center gap-[10px]"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={baseButtonClass}
        onClick={() => window.open("https://www.mytheresa.com", "_blank", "noopener,noreferrer")}
      >
        acquire
      </button>

      {isSaved ? (
        <button
          type="button"
          onClick={() => {
            removeFromStorage();
            setIsSaved(false);
            setIsSaveFlowOpen(false);
            setIsDropdownOpen(false);
          }}
          className="inline-flex h-[35px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-accent bg-accent px-[15px] font-ui text-[14px] font-medium leading-5 tracking-[-0.03em] text-paper shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]"
          aria-label="Remove from saved"
        >
          saved
        </button>
      ) : !isSaveFlowOpen ? (
        <button
          type="button"
          className={baseButtonClass}
          onClick={() => {
            setIsSaveFlowOpen(true);
            setIsDropdownOpen(false);
          }}
        >
          save
        </button>
      ) : (
        <div ref={dropdownRef} className="relative">
          <div className="relative inline-flex h-[35px] w-auto items-center overflow-visible rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] pl-[12px] pr-0 font-ui text-[14px] leading-5 tracking-[-0.03em] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]">
            <button
              type="button"
              className="inline-flex flex-1 items-center gap-[6px] whitespace-nowrap rounded-[999px] px-[2px] py-0 font-ui text-[14px] font-medium leading-5 tracking-[-0.03em] text-accent"
              onClick={() => setIsDropdownOpen((open) => !open)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="menu"
            >
              <span>{selectedCapsuleLabel}</span>
              <span
                aria-hidden="true"
                className={`inline-block text-[11px] leading-none transition-transform duration-150 ${
                  isDropdownOpen ? "rotate-180" : "rotate-0"
                }`}
              >
                ▾
              </span>
            </button>

            <button
              type="button"
              className="relative z-[1] ml-[8px] mr-[-1px] inline-flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-full bg-accent text-[18px] font-medium leading-none text-paper"
              onClick={() => {
                saveToStorage(selectedCapsuleId);
                setIsSaved(true);
                setIsDropdownOpen(false);
              }}
              aria-label={`Save to ${selectedCapsuleLabel}`}
            >
              <span aria-hidden="true" className="relative left-[-0.5px] top-[-0.5px] block">
                +
              </span>
            </button>
          </div>

          {isDropdownOpen ? (
            <div
              className={`absolute bottom-[41px] left-0 z-20 min-w-full origin-bottom rounded-[14px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] p-[6px] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-all duration-[180ms] ease-out ${
                "translate-y-0 scale-100 opacity-100"
              }`}
            >
              <div role="menu" aria-label="Choose capsule" className="flex flex-col gap-[2px]">
                {otherCapsules.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitem"
                    className="w-full rounded-[10px] px-[10px] py-[6px] text-left font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-accent"
                    onClick={() => {
                      setSelectedCapsuleId(option.id);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ProductViewMobile({
  backHref,
  brand,
  cues,
  disableEnterAnimation = false,
  disableGridReturnPrep = false,
  forceReplaceOnClose = false,
  description,
  editId,
  images,
  isArchiveMode,
  isPreOwned,
  itemId,
  mode,
  pipeLabel,
  price,
  title,
}: ProductViewMobileProps) {
  const router = useRouter();
  const closeRequestedRef = useRef(false);
  const productViewRootRef = useRef<HTMLElement | null>(null);
  const enterRafRef = useRef<number | null>(null);
  const mountedAtRef = useRef<number | null>(null);
  const reduceMotionQueryRef = useRef<MediaQueryList | null>(null);
  const edgeSwipeRef = useRef({ active: false, horizontal: false, startX: 0, startY: 0 });
  const imageSwipeRef = useRef({ active: false, horizontal: false, startX: 0, startY: 0 });
  const mobileCuePillRef = useRef<HTMLSpanElement | null>(null);
  const mobileCueTargetRef = useRef({ x: 0, y: 0 });
  const mobileCueCurrentRef = useRef({ x: 0, y: 0 });
  const mobileCueFrameRef = useRef<number | null>(null);
  const mobileCueActivationTimerRef = useRef<number | null>(null);
  const mobileCueVisibleRef = useRef(false);
  const mobileCueActiveIndexRef = useRef(0);
  const mobileCueLastSwitchAtRef = useRef(0);
  const mobileCueLastMoveRef = useRef({ t: 0, x: 0, y: 0 });
  const mobileCueTravelDistanceRef = useRef(0);
  const mobileCueTouchRef = useRef({ active: false, eligible: false, startX: 0, startY: 0 });
  const brandMetaRef = useRef<HTMLDivElement | null>(null);
  const brandTextRef = useRef<HTMLParagraphElement | null>(null);
  const preOwnedTagRef = useRef<HTMLSpanElement | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isEntered, setIsEntered] = useState(disableEnterAnimation);
  const [isReducingMotion, setIsReducingMotion] = useState(false);
  const [isMobileCueVisible, setIsMobileCueVisible] = useState(false);
  const [activeMobileCueIndex, setActiveMobileCueIndex] = useState(0);
  const [isPreOwnedStacked, setIsPreOwnedStacked] = useState(false);
  const resolvedCues = cues.filter(Boolean);
  const hasMobileCues = resolvedCues.length > 0;

  const close = useCallback(() => {
    if (closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    if (!disableGridReturnPrep) {
      prepareMobileProductClose(backHref);
    }
    if (isMobileImmersiveBackHref(backHref)) {
      try {
        window.sessionStorage.setItem(
          IMMERSIVE_RETURN_STEADY_KEY,
          JSON.stringify({
            at: Date.now(),
            href: backHref,
          }),
        );
        window.sessionStorage.removeItem(RETURN_FOCUS_ITEM_KEY);
      } catch {
        // Optional return polish only.
      }
    }
    if (!forceReplaceOnClose && window.history.length > 1) {
      window.history.back();
      return;
    }
    router.replace(backHref, { scroll: false });
  }, [backHref, disableGridReturnPrep, forceReplaceOnClose, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    mountedAtRef.current = Date.now();
    router.prefetch(backHref);
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionQueryRef.current = reduceMotionQuery;
    const onReduceMotionChange = () => {
      setIsReducingMotion(reduceMotionQuery.matches);
      if (reduceMotionQuery.matches) {
        setIsEntered(true);
      }
    };
    onReduceMotionChange();
    if (reduceMotionQuery.addEventListener) {
      reduceMotionQuery.addEventListener("change", onReduceMotionChange);
    } else {
      reduceMotionQuery.addListener(onReduceMotionChange);
    }
    if (!reduceMotionQuery.matches && !disableEnterAnimation) {
      enterRafRef.current = window.requestAnimationFrame(() => {
        setIsEntered(true);
      });
    } else {
      setIsEntered(true);
    }

    return () => {
      if (reduceMotionQueryRef.current) {
        if (reduceMotionQueryRef.current.removeEventListener) {
          reduceMotionQueryRef.current.removeEventListener("change", onReduceMotionChange);
        } else {
          reduceMotionQueryRef.current.removeListener(onReduceMotionChange);
        }
      }
      reduceMotionQueryRef.current = null;
      if (enterRafRef.current !== null) {
        window.cancelAnimationFrame(enterRafRef.current);
        enterRafRef.current = null;
      }
      if (mobileCueFrameRef.current !== null) {
        window.cancelAnimationFrame(mobileCueFrameRef.current);
        mobileCueFrameRef.current = null;
      }
      if (mobileCueActivationTimerRef.current !== null) {
        window.clearTimeout(mobileCueActivationTimerRef.current);
        mobileCueActivationTimerRef.current = null;
      }
    };
  }, [backHref, disableEnterAnimation, router]);

  useEffect(() => {
    const resetSwipe = () => {
      edgeSwipeRef.current = { active: false, horizontal: false, startX: 0, startY: 0 };
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        resetSwipe();
        return;
      }
      const touch = event.touches[0];
      if (!touch || touch.clientX > EDGE_SWIPE_START_PX) {
        resetSwipe();
        return;
      }
      edgeSwipeRef.current = { active: true, horizontal: false, startX: touch.clientX, startY: touch.clientY };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const swipe = edgeSwipeRef.current;
      if (!swipe.active) return;
      const touch = event.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - swipe.startX;
      const deltaY = touch.clientY - swipe.startY;
      if (deltaX < -EDGE_SWIPE_INTENT_PX || Math.abs(deltaY) > EDGE_SWIPE_MAX_VERTICAL_PX) {
        resetSwipe();
        return;
      }
      if (deltaX > EDGE_SWIPE_INTENT_PX && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
        edgeSwipeRef.current.horizontal = true;
        event.preventDefault();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const swipe = edgeSwipeRef.current;
      if (!swipe.active) return;
      const touch = event.changedTouches[0];
      const deltaX = touch ? touch.clientX - swipe.startX : 0;
      const deltaY = touch ? touch.clientY - swipe.startY : 0;
      const shouldClose = swipe.horizontal && deltaX >= EDGE_SWIPE_COMMIT_PX && Math.abs(deltaY) <= EDGE_SWIPE_MAX_VERTICAL_PX;
      resetSwipe();
      if (shouldClose) {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: false, capture: true });
    window.addEventListener("touchcancel", resetSwipe, { passive: true, capture: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart, { capture: true });
      window.removeEventListener("touchmove", handleTouchMove, { capture: true });
      window.removeEventListener("touchend", handleTouchEnd, { capture: true });
      window.removeEventListener("touchcancel", resetSwipe, { capture: true });
    };
  }, [close]);

  useEffect(() => {
    if (!isPreOwned) {
      setIsPreOwnedStacked(false);
      return;
    }

    let frame: number | null = null;
    const measurePreOwnedFit = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const metaNode = brandMetaRef.current;
        const brandNode = brandTextRef.current;
        const tagNode = preOwnedTagRef.current;
        if (!metaNode || !brandNode || !tagNode) return;

        const metaWidth = metaNode.getBoundingClientRect().width;
        const tagWidth = tagNode.getBoundingClientRect().width;
        const gapWidth = 7;
        const needsStack = brandNode.scrollWidth + tagWidth + gapWidth > metaWidth;
        setIsPreOwnedStacked(needsStack);
      });
    };

    measurePreOwnedFit();
    const resizeObserver = new ResizeObserver(measurePreOwnedFit);
    if (brandMetaRef.current) resizeObserver.observe(brandMetaRef.current);
    if (brandTextRef.current) resizeObserver.observe(brandTextRef.current);

    return () => {
      resizeObserver.disconnect();
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [brand, isPreOwned]);

  const clearMobileCueActivation = () => {
    if (mobileCueActivationTimerRef.current !== null) {
      window.clearTimeout(mobileCueActivationTimerRef.current);
      mobileCueActivationTimerRef.current = null;
    }
  };

  const hideMobileCue = () => {
    clearMobileCueActivation();
    mobileCueTouchRef.current = { active: false, eligible: false, startX: 0, startY: 0 };
    mobileCueVisibleRef.current = false;
    mobileCueTravelDistanceRef.current = 0;
    mobileCueLastMoveRef.current = { t: 0, x: 0, y: 0 };
    setIsMobileCueVisible(false);
  };

  const queueMobileCueFrame = () => {
    if (mobileCueFrameRef.current !== null) return;

    const animate = () => {
      const node = mobileCuePillRef.current;
      if (!node) {
        mobileCueFrameRef.current = null;
        return;
      }

      const current = mobileCueCurrentRef.current;
      const target = mobileCueTargetRef.current;
      const nextX = current.x + (target.x - current.x) * 0.22;
      const nextY = current.y + (target.y - current.y) * 0.22;
      mobileCueCurrentRef.current = { x: nextX, y: nextY };
      node.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) translate3d(-50%, -66px, 0)`;

      const distance = Math.abs(target.x - nextX) + Math.abs(target.y - nextY);
      if (mobileCueVisibleRef.current || distance > 0.25) {
        mobileCueFrameRef.current = window.requestAnimationFrame(animate);
        return;
      }
      mobileCueFrameRef.current = null;
    };

    mobileCueFrameRef.current = window.requestAnimationFrame(animate);
  };

  const commitMobileCueIndex = (nextIndex: number) => {
    const count = resolvedCues.length;
    if (count <= 0) return;
    const normalizedIndex = ((nextIndex % count) + count) % count;
    mobileCueActiveIndexRef.current = normalizedIndex;
    mobileCueLastSwitchAtRef.current = performance.now();
    setActiveMobileCueIndex(normalizedIndex);
  };

  const advanceMobileCueByMovement = (distance: number, speed: number, now: number) => {
    const count = resolvedCues.length;
    if (count <= 1) return;
    mobileCueTravelDistanceRef.current += distance;

    const speedNorm = clampNumber(speed / 1.1, 0, 1);
    const stepDistancePx = 54 - speedNorm * 20;
    const cooldownMs = 280 - speedNorm * 140;
    if (now - mobileCueLastSwitchAtRef.current < cooldownMs) return;
    if (mobileCueTravelDistanceRef.current < stepDistancePx) return;

    mobileCueTravelDistanceRef.current = mobileCueTravelDistanceRef.current % stepDistancePx;
    commitMobileCueIndex(mobileCueActiveIndexRef.current + 1);
  };

  const updateMobileCuePosition = (target: EventTarget & HTMLDivElement, clientX: number, clientY: number) => {
    const rect = target.getBoundingClientRect();
    const x = clampNumber(clientX - rect.left, rect.width * 0.16, rect.width * 0.84);
    const y = clampNumber(clientY - rect.top, rect.height * 0.08, rect.height * 0.88);
    mobileCueTargetRef.current = { x, y };
    queueMobileCueFrame();
    return { x, y };
  };

  const revealMobileCue = (anchor: { x: number; y: number }) => {
    clearMobileCueActivation();
    mobileCueVisibleRef.current = true;
    mobileCueCurrentRef.current = anchor;
    mobileCueTargetRef.current = anchor;
    mobileCueTravelDistanceRef.current = 0;
    mobileCueLastMoveRef.current = { t: performance.now(), x: anchor.x, y: anchor.y };
    commitMobileCueIndex(mobileCueActiveIndexRef.current);
    setIsMobileCueVisible(true);
    queueMobileCueFrame();
  };

  const handleImageTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      imageSwipeRef.current = { active: false, horizontal: false, startX: 0, startY: 0 };
      hideMobileCue();
      return;
    }
    const touch = event.touches[0];
    if (!touch) return;
    imageSwipeRef.current = { active: true, horizontal: false, startX: touch.clientX, startY: touch.clientY };
    hideMobileCue();
    if (!hasMobileCues || activeImageIndex !== 0) return;

    mobileCueTouchRef.current = {
      active: true,
      eligible: true,
      startX: touch.clientX,
      startY: touch.clientY,
    };
    const anchor = updateMobileCuePosition(event.currentTarget, touch.clientX, touch.clientY);
    mobileCueActivationTimerRef.current = window.setTimeout(() => {
      mobileCueActivationTimerRef.current = null;
      const cueTouch = mobileCueTouchRef.current;
      if (!cueTouch.active || !cueTouch.eligible || activeImageIndex !== 0 || !hasMobileCues) return;
      revealMobileCue(anchor);
    }, MOBILE_CUE_ACTIVATION_MS);
  };

  const handleImageTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const swipe = imageSwipeRef.current;
    if (!swipe.active) return;
    const touch = event.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - swipe.startX;
    const deltaY = touch.clientY - swipe.startY;
    const cueTouch = mobileCueTouchRef.current;
    if (cueTouch.active && cueTouch.eligible && !mobileCueVisibleRef.current) {
      const touchDistance = Math.hypot(touch.clientX - cueTouch.startX, touch.clientY - cueTouch.startY);
      const hasHorizontalSwipeIntent =
        Math.abs(deltaX) > IMAGE_SWIPE_INTENT_PX && Math.abs(deltaX) > Math.abs(deltaY) * 1.25;
      const shouldCancelCueForSwipe =
        deltaX < -IMAGE_SWIPE_CUE_CANCEL_PX && Math.abs(deltaX) > Math.abs(deltaY) * 0.45;
      if (hasHorizontalSwipeIntent || shouldCancelCueForSwipe) {
        clearMobileCueActivation();
        mobileCueTouchRef.current = { ...cueTouch, eligible: false };
      } else {
        const anchor = updateMobileCuePosition(event.currentTarget, touch.clientX, touch.clientY);
        if (touchDistance >= MOBILE_CUE_MOVE_ACTIVATE_PX) {
          revealMobileCue(anchor);
        }
      }
    }
    if (mobileCueVisibleRef.current) {
      event.preventDefault();
      const now = performance.now();
      const prevMove = mobileCueLastMoveRef.current;
      const next = updateMobileCuePosition(event.currentTarget, touch.clientX, touch.clientY);
      const dt = Math.max(8, now - prevMove.t);
      const distance = Math.hypot(next.x - prevMove.x, next.y - prevMove.y);
      const speed = distance / dt;
      mobileCueLastMoveRef.current = { t: now, x: next.x, y: next.y };
      advanceMobileCueByMovement(distance, speed, now);
      return;
    }
    if (Math.abs(deltaY) > IMAGE_SWIPE_MAX_VERTICAL_PX) {
      imageSwipeRef.current = { active: false, horizontal: false, startX: 0, startY: 0 };
      hideMobileCue();
      return;
    }
    if (Math.abs(deltaX) > IMAGE_SWIPE_INTENT_PX && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      imageSwipeRef.current.horizontal = true;
      event.preventDefault();
    }
  };

  const handleImageTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (mobileCueVisibleRef.current) {
      event.preventDefault();
      hideMobileCue();
      imageSwipeRef.current = { active: false, horizontal: false, startX: 0, startY: 0 };
      return;
    }
    clearMobileCueActivation();
    mobileCueTouchRef.current = { active: false, eligible: false, startX: 0, startY: 0 };
    const swipe = imageSwipeRef.current;
    if (!swipe.active) return;
    const touch = event.changedTouches[0];
    const deltaX = touch ? touch.clientX - swipe.startX : 0;
    const deltaY = touch ? touch.clientY - swipe.startY : 0;
    imageSwipeRef.current = { active: false, horizontal: false, startX: 0, startY: 0 };
    if (!swipe.horizontal || Math.abs(deltaX) < IMAGE_SWIPE_COMMIT_PX || Math.abs(deltaY) > IMAGE_SWIPE_MAX_VERTICAL_PX) return;
    event.preventDefault();
    const direction = deltaX < 0 ? 1 : -1;
    const nextIndex = activeImageIndex + direction;
    if (nextIndex >= 0 && nextIndex < images.length) {
      setActiveImageIndex(nextIndex);
    }
  };

  const titleToneClass = isArchiveMode ? "text-accent" : "text-ink";
  const overlayStyle = disableEnterAnimation
    ? {
        opacity: 1,
        transform: "scale(1)",
        transition: "none",
      }
    : isReducingMotion
    ? {
        opacity: 1,
        transform: "scale(1)",
        transition: "none",
      }
    : {
        opacity: isEntered ? 1 : 0,
        transform: "scale(1)",
        transition: `opacity ${MOBILE_OVERLAY_OPEN_DURATION_MS}ms ${MOBILE_OVERLAY_TRANSITION_EASING}, transform ${MOBILE_OVERLAY_OPEN_DURATION_MS}ms ${MOBILE_OVERLAY_TRANSITION_EASING}`,
      };

  return (
    <main
      ref={productViewRootRef}
      className="fixed left-0 top-0 z-[1600] block overflow-hidden overscroll-none bg-paper text-ink md:hidden"
      style={{
        width: "100vw",
        maxWidth: "100vw",
        height: "100dvh",
        minHeight: "100svh",
        ...overlayStyle,
        pointerEvents: isEntered ? "auto" : "none",
      }}
      onClick={(event) => {
        if (
          mountedAtRef.current !== null &&
          Date.now() - mountedAtRef.current < MOBILE_BACKDROP_CLOSE_ARM_DELAY_MS
        ) {
          return;
        }
        if (isMobileProductViewHit(event.target)) return;
        close();
      }}
    >
      <ProductViewMobileScrollLock />
      <div
        className="grid h-full min-w-0 px-7"
        style={{
          gridTemplateRows:
            "calc(var(--mobile-safe-top) + 58px) clamp(290px, 46dvh, 398px) 34px minmax(0, 1fr) calc(var(--mobile-safe-bottom) + 72px)",
        }}
      >
        <section data-pv-mobile-hit="true" className="row-start-1">
          <button
            type="button"
            data-pv-mobile-hit="true"
            data-pv-mobile-close-guard="true"
            aria-label="Close preview"
            className="fixed z-50 inline-flex h-[14px] w-[20px] items-center justify-center text-meta"
            style={{
              right: "calc(env(safe-area-inset-right, 0px) + 16px)",
              top: "calc(env(safe-area-inset-top, 0px) + 31px)",
            }}
            onClick={close}
            onTouchEnd={(event) => {
              event.preventDefault();
              close();
            }}
          >
            <span aria-hidden="true" className="absolute left-1/2 block h-[1.5px] w-[20px] -translate-x-1/2 rotate-45 rounded-full bg-current" />
            <span aria-hidden="true" className="absolute left-1/2 block h-[1.5px] w-[20px] -translate-x-1/2 -rotate-45 rounded-full bg-current" />
          </button>
        </section>

        <section
          data-pv-mobile-hit="true"
          className="row-start-2 min-h-0 min-w-0 overflow-visible"
          style={{ transform: "translateY(-16px)" }}
        >
          <div
            data-pv-mobile-close-guard="true"
            className="relative h-full w-full min-w-0 touch-pan-y select-none overflow-visible"
            onTouchStart={handleImageTouchStart}
            onTouchMove={handleImageTouchMove}
            onTouchEnd={handleImageTouchEnd}
            onTouchCancel={() => {
              imageSwipeRef.current = { active: false, horizontal: false, startX: 0, startY: 0 };
              hideMobileCue();
            }}
          >
            <div className="h-full w-full overflow-hidden">
              <div
                className="flex h-full w-full will-change-transform"
                style={{
                  transform: `translate3d(${-activeImageIndex * 100}%, 0, 0)`,
                  transition: isReducingMotion
                    ? "none"
                    : "transform 260ms cubic-bezier(0.22, 0.8, 0.24, 1)",
                }}
              >
                {images.map((image, index) => {
                  const imageSize = getMobileImageSize(index);
                  const isFirstImage = index === 0;
                  return (
                    <div
                      key={image.id}
                      className={`flex h-full w-full shrink-0 items-center justify-center ${isFirstImage ? "px-0" : "px-4"}`}
                      aria-hidden={index !== activeImageIndex}
                    >
                      <Image
                        src={image.src}
                        alt={image.alt}
                        width={imageSize.width}
                        height={imageSize.height}
                        priority={isFirstImage}
                        loading={isFirstImage ? undefined : "eager"}
                        fetchPriority={isFirstImage ? "high" : "auto"}
                        sizes={isFirstImage ? "68vw" : "68vw"}
                        className="pointer-events-none h-auto w-auto max-w-full select-none object-contain"
                        style={MOBILE_IMAGE_LIMITS[index] ?? MOBILE_IMAGE_LIMITS[1]}
                        draggable={false}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {hasMobileCues && activeImageIndex === 0 ? (
              <span
                ref={mobileCuePillRef}
                className={`pointer-events-none absolute left-0 top-0 z-[70] inline-flex h-[29px] items-center whitespace-nowrap rounded-[999px] border px-[11px] ${
                  mode === "archive" ? "border-accent bg-accent" : "border-ink bg-ink"
                } ${isMobileCueVisible ? "opacity-100" : "opacity-0"}`}
              >
                <span
                  key={`${activeMobileCueIndex}-${resolvedCues[activeMobileCueIndex] ?? ""}`}
                  className="relative whitespace-nowrap font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper"
                >
                  {resolvedCues[activeMobileCueIndex]}
                </span>
              </span>
            ) : null}
          </div>
        </section>

        <section data-pv-mobile-hit="true" className="row-start-3 flex min-w-0 items-start justify-center pt-[4px]" aria-label="Product image position">
          <div className="flex justify-center gap-[9px]">
            {images.map((image, index) => (
              <span
                key={`mobile-dot-${image.id}-${index}`}
                aria-hidden="true"
                className="block rounded-full transition-colors duration-150 ease-out"
                style={{
                  width: `${MOBILE_DOT_SIZE_PX}px`,
                  height: `${MOBILE_DOT_SIZE_PX}px`,
                  backgroundColor: index === activeImageIndex ? "#6F7381" : "#D8D8DA",
                }}
              />
            ))}
          </div>
        </section>

        <section data-pv-mobile-hit="true" className="row-start-4 flex min-h-0 min-w-0 w-full flex-col overflow-hidden pt-[2px]">
          <h1 className={`relative inline-flex w-full min-w-0 items-baseline justify-start overflow-visible whitespace-nowrap text-left text-[26px] leading-none ${titleToneClass}`}>
            <span className={`inline-flex items-center font-ui text-[24px] font-normal leading-none tracking-[-0.06em] ${titleToneClass}`}>
              <span aria-hidden="true" className="inline-flex items-center text-[22px] leading-none">|</span>
              <span className="px-[2px]">{pipeLabel}</span>
              <span aria-hidden="true" className="inline-flex items-center text-[22px] leading-none">|</span>
            </span>
            <span className={`-ml-[3px] pl-[1px] pr-[2px] font-ui text-[24px] font-normal leading-none tracking-[-0.06em] ${titleToneClass}`}>–</span>
            <span className="ml-[1px] min-w-0 translate-y-[1px] overflow-hidden text-ellipsis pb-[5px] mb-[-5px] font-instrument italic leading-[1.12] tracking-[0.01em]">{title}</span>
          </h1>

          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 text-[14px] font-medium leading-5 tracking-[0.02em] text-meta">
              <div
                ref={brandMetaRef}
                className={`flex min-w-0 ${
                  isPreOwnedStacked ? "flex-col items-start gap-[3px]" : "items-center gap-[7px]"
                }`}
              >
                <p ref={brandTextRef} className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                  {brand}
                </p>
                {isPreOwned ? (
                  <span
                    ref={preOwnedTagRef}
                    className="inline-flex h-[20px] shrink-0 items-center gap-[7px] whitespace-nowrap bg-transparent text-[10px] font-medium uppercase leading-none tracking-[0.12em] text-ink"
                    style={{ fontFamily: "var(--font-meta-mono), monospace" }}
                  >
                    <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-ink" />
                    Pre-owned
                  </span>
                ) : null}
              </div>
              <p className="shrink-0 text-right">{price}</p>
            </div>

            <p
              data-pv-mobile-scroll-region="true"
              className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-[2px] text-justify text-[14px] font-normal leading-5 tracking-[0.02em] text-ink"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {description}
            </p>
          </div>
        </section>

        <section data-pv-mobile-hit="true" className="row-start-5 flex min-w-0 items-start justify-center pt-[16px]">
          <MobileActionRow itemId={itemId} mode={mode} editId={editId} />
        </section>
      </div>
    </main>
  );
}
