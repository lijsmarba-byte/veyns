"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type GestureLikeEvent = Event & {
  clientY?: number;
};

function resolveTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function getEventClientY(event: Event): number | null {
  if ("touches" in event) {
    const touchEvent = event as TouchEvent;
    if (touchEvent.touches.length > 0) {
      return touchEvent.touches[0]?.clientY ?? null;
    }
    return null;
  }
  const maybeGesture = event as GestureLikeEvent;
  return typeof maybeGesture.clientY === "number" ? maybeGesture.clientY : null;
}

export function MobileZoomGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const isImmersiveRoute = pathname.includes("/immersive");

    const allowPinchInImmersiveZone = (event: Event) => {
      if (!isImmersiveRoute) return false;
      const targetElement = resolveTargetElement(event.target);
      if (!targetElement) return false;
      const zoomZone = targetElement.closest('[data-immersive-zoom-zone="true"]');
      if (!zoomZone) return false;

      const touchY = getEventClientY(event);
      const divider = document.querySelector<HTMLElement>('[data-sticky-divider="true"]');
      if (touchY !== null && divider) {
        const dividerTop = divider.getBoundingClientRect().top;
        if (touchY <= dividerTop + 1) return false;
      }

      return true;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      if (allowPinchInImmersiveZone(event)) return;
      event.preventDefault();
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      if (allowPinchInImmersiveZone(event)) return;
      event.preventDefault();
    };

    const handleGestureStart = (event: Event) => {
      if (allowPinchInImmersiveZone(event)) return;
      event.preventDefault();
    };

    const handleGestureChange = (event: Event) => {
      if (allowPinchInImmersiveZone(event)) return;
      event.preventDefault();
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: false, capture: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });
    document.addEventListener("gesturestart", handleGestureStart, { passive: false, capture: true });
    document.addEventListener("gesturechange", handleGestureChange, { passive: false, capture: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart, true);
      document.removeEventListener("touchmove", handleTouchMove, true);
      document.removeEventListener("gesturestart", handleGestureStart, true);
      document.removeEventListener("gesturechange", handleGestureChange, true);
    };
  }, [pathname]);

  return null;
}

