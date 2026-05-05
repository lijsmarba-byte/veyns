"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MobileCategoryOption = {
  key: string;
  label: string;
  disabled?: boolean;
};

type MobileFloatingCategoryPillProps = {
  options: MobileCategoryOption[];
  activeKey: string;
  onSelect: (key: string) => void;
  ariaLabel?: string;
  className?: string;
  bottomOffsetPx?: number;
  enableDragSnap?: boolean;
  focusCueLabel?: string;
};

const DROPDOWN_OUTER_PADDING_PX = 4;
const DROPDOWN_INNER_VERTICAL_PADDING_PX = 2;
const DROPDOWN_ROW_GAP_PX = 2;
const DRAG_START_THRESHOLD_PX = 5;
const DRAG_VIEWPORT_MARGIN_PX = 8;
const DIVIDER_SNAP_GAP_PX = 8;
const FOCUS_CUE_HEIGHT_PX = 35;
const FOCUS_CUE_EXPANDED_WIDTH_PX = 246;
const FOCUS_CUE_VIEWPORT_MARGIN_PX = 10;

type SnapSlot =
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "divider-left"
  | "divider-center"
  | "divider-right";

type DragPosition = {
  left: number;
  top: number;
};

type SnapPoint = DragPosition & {
  slot: SnapSlot;
};

type ActiveDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  hasDragged: boolean;
};

function getStickyDividerLimitPx() {
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue("--sticky-h");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRootCssPixelValue(name: string) {
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name);
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findNearestSnapPoint(left: number, top: number, snapPoints: SnapPoint[]) {
  return snapPoints.reduce((nearest, point) => {
    const nearestDistance = Math.hypot(left - nearest.left, top - nearest.top);
    const pointDistance = Math.hypot(left - point.left, top - point.top);
    return pointDistance < nearestDistance ? point : nearest;
  }, snapPoints[0]);
}

function toTitleCase(label: string) {
  return label
    .replace(/^\//, "")
    .trim()
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}

function ActiveCategoryLabel({ label }: { label: string }) {
  const text = toTitleCase(label) || "All";

  return (
    <span className="inline-flex items-baseline text-[#6F7381]">
      <span className="font-ui text-[15px] font-normal leading-none tracking-[-0.05em]">The</span>
      <span className="-ml-[1px] font-ui text-[15px] font-normal leading-none tracking-[-0.05em]">
        &ndash;
      </span>
      <span className="ml-[2px] font-instrument text-[15px] italic leading-none tracking-[0.01em]">
        {text}
      </span>
    </span>
  );
}

function FocusCueMark() {
  return (
    <span aria-hidden="true" className="relative block h-[35px] w-[35px]">
      <span className="absolute left-1/2 top-1/2 block h-[11px] w-[3px] -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-1/2 top-0 block h-[7.5px] w-[1.35px] -translate-x-1/2 rounded-full bg-[#888894]" />
        <span className="absolute bottom-0 left-1/2 block h-[1.7px] w-[1.7px] -translate-x-1/2 rounded-full bg-[#888894]" />
      </span>
    </span>
  );
}

export function MobileFloatingCategoryPill({
  options,
  activeKey,
  onSelect,
  ariaLabel = "Category navigation",
  className = "",
  bottomOffsetPx = 6,
  enableDragSnap = false,
  focusCueLabel,
}: MobileFloatingCategoryPillProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isFocusCueExpanded, setIsFocusCueExpanded] = useState(false);
  const [focusCueOverlayStyle, setFocusCueOverlayStyle] = useState<CSSProperties | null>(null);
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null);
  const [snapSlot, setSnapSlot] = useState<SnapSlot | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const focusCueRootRef = useRef<HTMLSpanElement | null>(null);
  const focusCueOverlayRef = useRef<HTMLButtonElement | null>(null);
  const focusCueButtonRef = useRef<HTMLButtonElement | null>(null);
  const dragStateRef = useRef<ActiveDragState | null>(null);
  const suppressClickRef = useRef(false);
  const menuId = useId();

  const activeOption =
    options.find((option) => option.key === activeKey) ??
    options.find((option) => !option.disabled) ??
    options[0];

  const selectableOptions = useMemo(
    () =>
      options.filter(
        (option) => option.key !== activeOption?.key && !option.disabled,
      ),
    [activeOption?.key, options],
  );

  useEffect(() => {
    if (isExpanded) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setIsDropdownVisible(true);
      return;
    }

    closeTimerRef.current = window.setTimeout(() => {
      setIsDropdownVisible(false);
      closeTimerRef.current = null;
    }, 180);

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isExpanded]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        isFocusCueExpanded &&
        !focusCueRootRef.current?.contains(target) &&
        !focusCueOverlayRef.current?.contains(target)
      ) {
        setIsFocusCueExpanded(false);
      }
      if (!rootRef.current?.contains(target)) {
        setIsExpanded(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
        setIsFocusCueExpanded(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown, { passive: true });
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isFocusCueExpanded]);

  useEffect(() => {
    if (!isFocusCueExpanded) return;

    const closeFocusCue = () => {
      setIsFocusCueExpanded(false);
    };

    window.addEventListener("scroll", closeFocusCue, { passive: true });
    window.addEventListener("wheel", closeFocusCue, { passive: true });
    window.addEventListener("touchmove", closeFocusCue, { passive: true });
    window.addEventListener("resize", closeFocusCue);
    window.visualViewport?.addEventListener("resize", closeFocusCue);
    window.visualViewport?.addEventListener("scroll", closeFocusCue);
    return () => {
      window.removeEventListener("scroll", closeFocusCue);
      window.removeEventListener("wheel", closeFocusCue);
      window.removeEventListener("touchmove", closeFocusCue);
      window.removeEventListener("resize", closeFocusCue);
      window.visualViewport?.removeEventListener("resize", closeFocusCue);
      window.visualViewport?.removeEventListener("scroll", closeFocusCue);
    };
  }, [isFocusCueExpanded]);

  useEffect(() => {
    setIsExpanded(false);
  }, [activeKey]);

  useEffect(() => {
    setIsFocusCueExpanded(false);
  }, [activeKey, focusCueLabel]);

  const clampDragPosition = useCallback((left: number, top: number, width: number, height: number): DragPosition => {
    const visualViewport = window.visualViewport;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const minLeft = viewportLeft + DRAG_VIEWPORT_MARGIN_PX;
    const stickyDividerLimitPx = getStickyDividerLimitPx();
    const minTop = Math.max(viewportTop + DRAG_VIEWPORT_MARGIN_PX, stickyDividerLimitPx + DRAG_VIEWPORT_MARGIN_PX);
    const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - width - DRAG_VIEWPORT_MARGIN_PX);
    const maxTop = Math.max(minTop, viewportTop + viewportHeight - height - DRAG_VIEWPORT_MARGIN_PX);

    return {
      left: Math.min(Math.max(left, minLeft), maxLeft),
      top: Math.min(Math.max(top, minTop), maxTop),
    };
  }, []);

  const resolveSnapPoints = useCallback(
    (width: number, height: number): SnapPoint[] => {
      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const safeBottomPx = getRootCssPixelValue("--mobile-safe-bottom");
      const bottomTop = viewportTop + viewportHeight - height - safeBottomPx - bottomOffsetPx;
      const dividerTop = getStickyDividerLimitPx() + DIVIDER_SNAP_GAP_PX;
      const left = viewportLeft + DRAG_VIEWPORT_MARGIN_PX;
      const center = viewportLeft + viewportWidth / 2 - width / 2;
      const right = viewportLeft + viewportWidth - width - DRAG_VIEWPORT_MARGIN_PX;

      return [
        { slot: "bottom-left", ...clampDragPosition(left, bottomTop, width, height) },
        { slot: "bottom-center", ...clampDragPosition(center, bottomTop, width, height) },
        { slot: "bottom-right", ...clampDragPosition(right, bottomTop, width, height) },
        { slot: "divider-left", ...clampDragPosition(left, dividerTop, width, height) },
        { slot: "divider-center", ...clampDragPosition(center, dividerTop, width, height) },
        { slot: "divider-right", ...clampDragPosition(right, dividerTop, width, height) },
      ];
    },
    [bottomOffsetPx, clampDragPosition],
  );

  useEffect(() => {
    if (!enableDragSnap) return;
    if (!dragPosition && !snapSlot) return;

    const syncWithinViewport = () => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      if (snapSlot) {
        const snapPoint = resolveSnapPoints(rect.width, rect.height).find((point) => point.slot === snapSlot);
        if (!snapPoint) return;
        setDragPosition((current) => {
          if (current?.left === snapPoint.left && current.top === snapPoint.top) return current;
          return { left: snapPoint.left, top: snapPoint.top };
        });
        return;
      }
      setDragPosition((current) => {
        if (!current) return current;
        const next = clampDragPosition(current.left, current.top, rect.width, rect.height);
        if (next.left === current.left && next.top === current.top) return current;
        return next;
      });
    };

    window.addEventListener("resize", syncWithinViewport);
    window.addEventListener("sticky-height-change", syncWithinViewport);
    window.visualViewport?.addEventListener("resize", syncWithinViewport);
    window.visualViewport?.addEventListener("scroll", syncWithinViewport);
    return () => {
      window.removeEventListener("resize", syncWithinViewport);
      window.removeEventListener("sticky-height-change", syncWithinViewport);
      window.visualViewport?.removeEventListener("resize", syncWithinViewport);
      window.visualViewport?.removeEventListener("scroll", syncWithinViewport);
    };
  }, [clampDragPosition, dragPosition, enableDragSnap, resolveSnapPoints, snapSlot]);

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!enableDragSnap) return;
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      dragStateRef.current = null;
      setIsDragging(false);

      if (dragState.hasDragged) {
        const root = rootRef.current;
        if (root) {
          const rect = root.getBoundingClientRect();
          const nearest = findNearestSnapPoint(rect.left, rect.top, resolveSnapPoints(rect.width, rect.height));
          setSnapSlot(nearest.slot);
          setDragPosition({ left: nearest.left, top: nearest.top });
        }
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [enableDragSnap, resolveSnapPoints],
  );

  const updateFocusCueOverlayPosition = useCallback(() => {
    const anchor = rootRef.current ?? focusCueButtonRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const cueWidth = Math.min(FOCUS_CUE_EXPANDED_WIDTH_PX, viewportWidth - FOCUS_CUE_VIEWPORT_MARGIN_PX * 2);
    const centerX = rect.left + rect.width / 2;
    const minLeft = viewportLeft + FOCUS_CUE_VIEWPORT_MARGIN_PX;
    const maxLeft = viewportLeft + viewportWidth - cueWidth - FOCUS_CUE_VIEWPORT_MARGIN_PX;
    const left = Math.min(Math.max(centerX - cueWidth / 2, minLeft), Math.max(minLeft, maxLeft));

    setFocusCueOverlayStyle({
      left: `${left}px`,
      top: `${rect.top}px`,
      width: `${cueWidth}px`,
    });
  }, []);

  const handleDragPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!enableDragSnap) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const root = rootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      hasDragged: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [enableDragSnap]);

  const handleDragPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const dragState = dragStateRef.current;
      if (!enableDragSnap) return;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
      if (!dragState.hasDragged && distance < DRAG_START_THRESHOLD_PX) return;

      dragState.hasDragged = true;
      setIsDragging(true);
      setIsExpanded(false);
      setSnapSlot(null);
      event.preventDefault();

      const nextLeft = event.clientX - dragState.offsetX;
      const nextTop = event.clientY - dragState.offsetY;
      setDragPosition(clampDragPosition(nextLeft, nextTop, dragState.width, dragState.height));
    },
    [clampDragPosition, enableDragSnap],
  );

  const rootStyle: CSSProperties = enableDragSnap && dragPosition
    ? {
        left: `${dragPosition.left}px`,
        top: `${dragPosition.top}px`,
      }
    : { bottom: `calc(var(--mobile-safe-bottom) + ${bottomOffsetPx}px)` };
  const opensDropdownDown = enableDragSnap && snapSlot?.startsWith("divider-");

  if (!activeOption) return null;

  const focusCueOverlay =
    focusCueLabel && isFocusCueExpanded && focusCueOverlayStyle ? (
      <button
        data-mobile-floating-category-cue="true"
        ref={focusCueOverlayRef}
        type="button"
        aria-label={focusCueLabel}
        aria-expanded="true"
        onClick={(event) => {
          event.stopPropagation();
          setIsFocusCueExpanded(false);
        }}
        className="fixed z-[180] inline-flex items-center justify-center overflow-hidden rounded-full border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-[15px] text-center font-ui text-[14px] font-normal leading-none tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        style={{
          ...focusCueOverlayStyle,
          height: `${FOCUS_CUE_HEIGHT_PX}px`,
        }}
      >
        <span className="min-w-0 whitespace-nowrap">
          {focusCueLabel}
        </span>
      </button>
    ) : null;

  return (
    <div
      ref={rootRef}
      data-mobile-floating-category-pill="true"
      data-immersive-drag-exempt="true"
      className={`pointer-events-none fixed z-[95] w-max md:hidden ${
        enableDragSnap && dragPosition ? "" : "left-1/2 -translate-x-1/2"
      } ${className}`.trim()}
      style={rootStyle}
    >
      <div className="pointer-events-auto flex items-center justify-center gap-[6px]">
        <div className="relative">
          {isDropdownVisible ? (
            <div
              className={`absolute left-1/2 z-20 min-w-full -translate-x-1/2 rounded-[14px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-all duration-[180ms] ease-out ${
                opensDropdownDown ? "top-[39px] origin-top" : "bottom-[39px] origin-bottom"
              } ${
                isExpanded
                  ? "translate-y-0 scale-100 opacity-100"
                  : `${
                      opensDropdownDown ? "-translate-y-[4px]" : "translate-y-[4px]"
                    } scale-[0.985] opacity-0 pointer-events-none`
              }`}
              style={{ padding: `${DROPDOWN_OUTER_PADDING_PX}px` }}
            >
              <ul
                role="menu"
                id={menuId}
                aria-label={ariaLabel}
                className="m-0 list-none p-0"
                style={{
                  paddingTop: `${DROPDOWN_INNER_VERTICAL_PADDING_PX}px`,
                  paddingBottom: `${DROPDOWN_INNER_VERTICAL_PADDING_PX}px`,
                }}
              >
                {selectableOptions.map((option, index) => (
                  <li key={option.key} style={{ marginTop: index === 0 ? 0 : `${DROPDOWN_ROW_GAP_PX}px` }}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onSelect(option.key);
                        setIsExpanded(false);
                      }}
                      className="inline-flex min-h-[30px] w-full items-center justify-center whitespace-nowrap rounded-[10px] px-[16px] py-[5px] text-center font-ui text-[14px] font-normal leading-5 tracking-[0.01em] text-[#6F7381] transition-colors duration-150 hover:text-[#6F7381] focus-visible:outline-none"
                    >
                      {toTitleCase(option.label)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={menuId}
            aria-haspopup="menu"
            onPointerDown={enableDragSnap ? handleDragPointerDown : undefined}
            onPointerMove={enableDragSnap ? handleDragPointerMove : undefined}
            onPointerUp={enableDragSnap ? finishDrag : undefined}
            onPointerCancel={enableDragSnap ? finishDrag : undefined}
            onClick={() => {
              if (suppressClickRef.current) return;
              if (selectableOptions.length === 0) return;
              setIsFocusCueExpanded(false);
              setIsExpanded((open) => !open);
            }}
            className={`inline-flex h-[35px] select-none items-center justify-center gap-[6px] whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:outline-none ${
              enableDragSnap ? "touch-none" : ""
            } ${
              enableDragSnap ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
            }`}
          >
            <ActiveCategoryLabel label={activeOption.label} />
            {selectableOptions.length > 0 ? (
              <span
                aria-hidden="true"
                className={`inline-block text-[12px] leading-none transition-transform duration-150 ${
                  opensDropdownDown
                    ? isExpanded
                      ? "rotate-0"
                      : "rotate-180"
                    : isExpanded
                      ? "rotate-180"
                      : "rotate-0"
                }`}
              >
                ▾
              </span>
            ) : null}
          </button>
        </div>

        {focusCueLabel ? (
          <span
            ref={focusCueRootRef}
            className="relative inline-flex h-[35px] w-[35px] shrink-0"
          >
            <button
              ref={focusCueButtonRef}
              type="button"
              aria-label={focusCueLabel}
              aria-expanded={isFocusCueExpanded}
              onClick={(event) => {
                event.stopPropagation();
                setIsExpanded(false);
                setIsFocusCueExpanded((open) => {
                  if (open) return false;
                  updateFocusCueOverlayPosition();
                  return true;
                });
              }}
              className={`inline-flex h-[35px] min-h-[35px] w-[35px] min-w-[35px] shrink-0 items-center justify-center rounded-full border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] p-0 shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 ${
                isFocusCueExpanded ? "opacity-0" : "opacity-100"
              }`}
            >
              <FocusCueMark />
            </button>
          </span>
        ) : null}

        {focusCueOverlay && typeof document !== "undefined" ? createPortal(focusCueOverlay, document.body) : null}
      </div>
    </div>
  );
}
