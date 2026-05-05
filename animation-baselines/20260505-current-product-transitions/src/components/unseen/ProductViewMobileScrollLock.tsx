"use client";

import { useEffect } from "react";
import { useViewportMode } from "@/lib/ui/viewportMode";

const PREV_SCROLL_Y_ATTR = "data-unseen-pv-mobile-scroll-y";
const PREV_BODY_POSITION_ATTR = "data-unseen-pv-mobile-prev-position";
const PREV_BODY_TOP_ATTR = "data-unseen-pv-mobile-prev-top";
const PREV_BODY_LEFT_ATTR = "data-unseen-pv-mobile-prev-left";
const PREV_BODY_WIDTH_ATTR = "data-unseen-pv-mobile-prev-width";
const SCROLL_REGION_SELECTOR = "[data-pv-mobile-scroll-region='true']";

function getMobileScrollRegion(target: EventTarget | null) {
  if (!(target instanceof Node)) return null;
  const element = target instanceof Element ? target : target.parentElement;
  return element?.closest(SCROLL_REGION_SELECTOR) as HTMLElement | null;
}

function canScrollRegion(region: HTMLElement, deltaY: number) {
  const scrollTop = region.scrollTop;
  const maxScrollTop = Math.max(0, region.scrollHeight - region.clientHeight);
  if (maxScrollTop <= 1) return false;
  if (deltaY < 0) return scrollTop < maxScrollTop - 1;
  if (deltaY > 0) return scrollTop > 1;
  return false;
}

export function ProductViewMobileScrollLock() {
  const { isMobileExperience } = useViewportMode();

  useEffect(() => {
    if (!isMobileExperience) return;

    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    let touchStartX = 0;
    let touchStartY = 0;

    body.setAttribute(PREV_SCROLL_Y_ATTR, `${scrollY}`);
    body.setAttribute(PREV_BODY_POSITION_ATTR, body.style.position);
    body.setAttribute(PREV_BODY_TOP_ATTR, body.style.top);
    body.setAttribute(PREV_BODY_LEFT_ATTR, body.style.left);
    body.setAttribute(PREV_BODY_WIDTH_ATTR, body.style.width);

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.width = "100vw";

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        const scrollRegion = getMobileScrollRegion(event.target);
        if (scrollRegion && canScrollRegion(scrollRegion, deltaY)) {
          return;
        }
        event.preventDefault();
      }
    };

    const blockScroll = (event: WheelEvent) => {
      const scrollRegion = getMobileScrollRegion(event.target);
      if (scrollRegion && canScrollRegion(scrollRegion, -event.deltaY)) {
        return;
      }
      event.preventDefault();
    };

    const blockScrollKeys = (event: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"].includes(event.key)) return;
      event.preventDefault();
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });
    window.addEventListener("wheel", blockScroll, { passive: false, capture: true });
    window.addEventListener("keydown", blockScrollKeys, { capture: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart, { capture: true });
      window.removeEventListener("touchmove", handleTouchMove, { capture: true });
      window.removeEventListener("wheel", blockScroll, { capture: true });
      window.removeEventListener("keydown", blockScrollKeys, { capture: true });

      const previousScrollY = Number.parseFloat(body.getAttribute(PREV_SCROLL_Y_ATTR) ?? "0");
      body.style.position = body.getAttribute(PREV_BODY_POSITION_ATTR) ?? "";
      body.style.top = body.getAttribute(PREV_BODY_TOP_ATTR) ?? "";
      body.style.left = body.getAttribute(PREV_BODY_LEFT_ATTR) ?? "";
      body.style.width = body.getAttribute(PREV_BODY_WIDTH_ATTR) ?? "";
      body.removeAttribute(PREV_SCROLL_Y_ATTR);
      body.removeAttribute(PREV_BODY_POSITION_ATTR);
      body.removeAttribute(PREV_BODY_TOP_ATTR);
      body.removeAttribute(PREV_BODY_LEFT_ATTR);
      body.removeAttribute(PREV_BODY_WIDTH_ATTR);
      root.style.overflow = "";
      root.style.overscrollBehavior = "";
      body.style.overflow = "";
      body.style.overscrollBehavior = "";
      window.scrollTo(0, Number.isFinite(previousScrollY) ? previousScrollY : 0);
    };
  }, [isMobileExperience]);

  return null;
}
