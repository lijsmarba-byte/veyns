"use client";

import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type ReturnScrollPayload = {
  at: number;
  backHref: string;
  scrollY: number;
};

const RETURN_SCROLL_KEY = "unseen:return-scroll";
const RETURN_SCROLL_LOCK_KEY = "unseen:return-scroll-lock";
const RETURN_SCROLL_INTENT_KEY = "unseen:return-scroll-intent";
const RETURN_FLIGHT_FINISHED_EVENT = "unseen:return-flight-finished";
const RETURN_FLIGHT_FINISHED_KEY = "unseen:return-flight-finished-flag";
const RETURN_PREV_BODY_PADDING_ATTR = "data-unseen-return-prev-pr";
const ENTER_SCROLL_LOCK_KEY = "unseen:enter-scroll-lock";
const ENTER_SCROLL_INTENT_KEY = "unseen:enter-scroll-intent";
const ENTER_PREV_BODY_PADDING_ATTR = "data-unseen-enter-prev-pr";

function clearStalePageScrollLocks() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(RETURN_SCROLL_LOCK_KEY);
    window.sessionStorage.removeItem(RETURN_SCROLL_INTENT_KEY);
    window.sessionStorage.removeItem(RETURN_FLIGHT_FINISHED_KEY);
    window.sessionStorage.removeItem(ENTER_SCROLL_LOCK_KEY);
    window.sessionStorage.removeItem(ENTER_SCROLL_INTENT_KEY);
  } catch {
    // Ignore storage failures and still restore styles.
  }

  const root = document.documentElement;
  const body = document.body;
  root.style.overflow = "";
  body.style.overflow = "";
  root.style.overscrollBehavior = "";
  body.style.overscrollBehavior = "";
  root.style.overscrollBehaviorX = "";
  body.style.overscrollBehaviorX = "";
  root.style.touchAction = "";
  body.style.touchAction = "";
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";

  const prevReturnPaddingRight = body.getAttribute(RETURN_PREV_BODY_PADDING_ATTR);
  if (prevReturnPaddingRight !== null) {
    body.style.paddingRight = prevReturnPaddingRight;
    body.removeAttribute(RETURN_PREV_BODY_PADDING_ATTR);
  } else {
    body.style.paddingRight = "";
  }

  const prevEnterPaddingRight = body.getAttribute(ENTER_PREV_BODY_PADDING_ATTR);
  if (prevEnterPaddingRight !== null) {
    body.style.paddingRight = prevEnterPaddingRight;
    body.removeAttribute(ENTER_PREV_BODY_PADDING_ATTR);
  }
}

export function ReturnScrollRestore() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentHref = query ? `${pathname}?${query}` : pathname;

  useLayoutEffect(() => {
    clearStalePageScrollLocks();

    const handleFlightFinished = () => {
      clearStalePageScrollLocks();
    };

    window.addEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);

    let rafId: number | null = null;
    const timers: number[] = [];
    let cancelled = false;

    try {
      const raw = window.sessionStorage.getItem(RETURN_SCROLL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ReturnScrollPayload;
        const isFresh = Date.now() - parsed.at < 30 * 60 * 1000;
        if (isFresh && parsed.backHref === currentHref && Number.isFinite(parsed.scrollY)) {
          const targetY = Math.max(0, parsed.scrollY);

          const attemptRestore = () => {
            if (cancelled) return;
            const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            const nextY = Math.min(targetY, maxY);
            if (Math.abs(window.scrollY - nextY) > 1) {
              window.scrollTo({ top: nextY, left: 0, behavior: "auto" });
            }
          };

          attemptRestore();
          const schedule = [0, 56, 180, 360] as const;
          rafId = window.requestAnimationFrame(() => {
            if (cancelled) return;
            schedule.forEach((delay, index) => {
              const timerId = window.setTimeout(() => {
                if (cancelled) return;
                attemptRestore();
                if (index === schedule.length - 1) {
                  try {
                    window.sessionStorage.removeItem(RETURN_SCROLL_KEY);
                  } catch {
                    // Ignore cleanup failures.
                  }
                }
              }, delay);
              timers.push(timerId);
            });
          });
        }
      }
    } catch {
      // Ignore malformed payloads.
    }

    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      timers.forEach((timerId) => window.clearTimeout(timerId));
      window.removeEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);
    };
  }, [currentHref, pathname]);

  return null;
}
