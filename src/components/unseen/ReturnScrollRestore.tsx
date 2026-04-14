"use client";

import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type ReturnScrollPayload = {
  at: number;
  backHref: string;
  scrollY: number;
};

type ReturnScrollIntentPayload = {
  at?: number;
  direction?: number;
  magnitude?: number;
};

const RETURN_SCROLL_KEY = "unseen:return-scroll";
const RETURN_SCROLL_LOCK_KEY = "unseen:return-scroll-lock";
const RETURN_SCROLL_INTENT_KEY = "unseen:return-scroll-intent";
const RETURN_FLIGHT_FINISHED_EVENT = "unseen:return-flight-finished";
const RETURN_FLIGHT_FINISHED_KEY = "unseen:return-flight-finished-flag";
const RETURN_PREV_BODY_PADDING_ATTR = "data-unseen-return-prev-pr";

function unlockPageScrollFromReturn() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RETURN_SCROLL_LOCK_KEY);
    window.sessionStorage.removeItem(RETURN_FLIGHT_FINISHED_KEY);
    window.sessionStorage.removeItem(RETURN_SCROLL_INTENT_KEY);
  } catch {
    // Ignore storage failures and still try to unlock styles.
  }

  const root = document.documentElement;
  const body = document.body;
  root.style.overflow = "";
  body.style.overflow = "";
  root.style.overscrollBehavior = "";
  body.style.overscrollBehavior = "";
  root.style.touchAction = "";
  body.style.touchAction = "";

  const prevBodyPaddingRight = body.getAttribute(RETURN_PREV_BODY_PADDING_ATTR);
  if (prevBodyPaddingRight !== null) {
    body.style.paddingRight = prevBodyPaddingRight;
    body.removeAttribute(RETURN_PREV_BODY_PADDING_ATTR);
  } else {
    body.style.paddingRight = "";
  }
}

export function ReturnScrollRestore() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentHref = query ? `${pathname}?${query}` : pathname;

  useLayoutEffect(() => {
    let hasReturnLock = false;
    let hasFinishedFlag = false;
    try {
      hasReturnLock = Boolean(window.sessionStorage.getItem(RETURN_SCROLL_LOCK_KEY));
      hasFinishedFlag = Boolean(window.sessionStorage.getItem(RETURN_FLIGHT_FINISHED_KEY));
    } catch {
      hasReturnLock = false;
      hasFinishedFlag = false;
    }

    let unlockFallbackTimer: number | null = null;
    let pendingScrollIntent = 0;
    let pendingScrollIntentAt = 0;
    let pendingScrollMagnitude = 16;
    let touchStartY: number | null = null;
    let assistRafId: number | null = null;
    let assistVelocity = 0;
    let assistUntil = 0;
    let assistLastTs = 0;
    let assistInputDetachTimer: number | null = null;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const normalizeMagnitude = (delta: number) => clamp(Math.abs(delta), 8, 120);

    const feedAssistInput = (delta: number) => {
      const direction = delta > 0 ? 1 : -1;
      const magnitude = normalizeMagnitude(delta);
      const velocityBoost = 0.12 + magnitude * 0.0075;
      assistVelocity = clamp(assistVelocity * 0.78 + direction * velocityBoost, -2.8, 2.8);
      assistUntil = Math.max(assistUntil, performance.now() + 900);
    };

    const pullStoredIntent = () => {
      try {
        const raw = window.sessionStorage.getItem(RETURN_SCROLL_INTENT_KEY);
        if (!raw) return;
        if (raw === "1" || raw === "-1") {
          pendingScrollIntent = Number(raw);
          pendingScrollIntentAt = Date.now();
          return;
        }
        const parsed = JSON.parse(raw) as ReturnScrollIntentPayload;
        const direction =
          typeof parsed.direction === "number" ? (parsed.direction > 0 ? 1 : parsed.direction < 0 ? -1 : 0) : 0;
        if (direction !== 0) {
          pendingScrollIntent = direction;
          pendingScrollIntentAt = typeof parsed.at === "number" ? parsed.at : Date.now();
          pendingScrollMagnitude =
            typeof parsed.magnitude === "number" && Number.isFinite(parsed.magnitude)
              ? normalizeMagnitude(parsed.magnitude)
              : 22;
        }
      } catch {
        // Ignore storage failures.
      }
    };

    const rememberScrollIntent = (delta: number) => {
      if (!hasReturnLock) return;
      if (Math.abs(delta) < 1) return;
      const magnitude = normalizeMagnitude(delta);
      pendingScrollIntent = delta > 0 ? 1 : -1;
      pendingScrollIntentAt = Date.now();
      pendingScrollMagnitude = magnitude;
      try {
        window.sessionStorage.setItem(
          RETURN_SCROLL_INTENT_KEY,
          JSON.stringify({
            direction: pendingScrollIntent,
            at: pendingScrollIntentAt,
            magnitude,
          }),
        );
      } catch {
        // Ignore storage failures.
      }
    };

    const startAssistScroll = (direction: number, intentAt: number, magnitude: number) => {
      const now = Date.now();
      const age = now - intentAt;
      const freshFactor = age < 600 ? 1 : age < 1200 ? 0.82 : 0.68;
      const baseVelocity = clamp((0.28 + magnitude * 0.0115) * freshFactor, 0.38, 2.4);
      assistVelocity = direction * baseVelocity;
      assistUntil = performance.now() + 1050;
      assistLastTs = 0;

      const handleAssistWheel = (event: WheelEvent) => {
        if (Math.abs(event.deltaY) < 0.5) return;
        feedAssistInput(event.deltaY);
      };
      const handleAssistTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        touchStartY = touch ? touch.clientY : null;
      };
      const handleAssistTouchMove = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (!touch || touchStartY === null) return;
        const delta = touchStartY - touch.clientY;
        touchStartY = touch.clientY;
        if (Math.abs(delta) < 0.5) return;
        feedAssistInput(delta);
      };
      const handleAssistKey = (event: KeyboardEvent) => {
        if (["ArrowDown", "PageDown", " ", "End"].includes(event.key)) {
          feedAssistInput(18);
          return;
        }
        if (["ArrowUp", "PageUp", "Home"].includes(event.key)) {
          feedAssistInput(-18);
        }
      };
      const detachAssistInput = () => {
        window.removeEventListener("wheel", handleAssistWheel);
        window.removeEventListener("touchstart", handleAssistTouchStart);
        window.removeEventListener("touchmove", handleAssistTouchMove);
        window.removeEventListener("keydown", handleAssistKey);
      };
      window.addEventListener("wheel", handleAssistWheel, { passive: true });
      window.addEventListener("touchstart", handleAssistTouchStart, { passive: true });
      window.addEventListener("touchmove", handleAssistTouchMove, { passive: true });
      window.addEventListener("keydown", handleAssistKey);
      assistInputDetachTimer = window.setTimeout(() => {
        detachAssistInput();
        assistInputDetachTimer = null;
      }, 1300);

      const tick = (ts: number) => {
        const dt = assistLastTs > 0 ? Math.min(34, Math.max(0, ts - assistLastTs)) : 16;
        assistLastTs = ts;
        const active = ts <= assistUntil;
        const damping = active ? 0.92 : 0.85;
        assistVelocity *= damping;
        const step = assistVelocity * dt;
        if (Math.abs(step) > 0.01) {
          window.scrollBy({ top: step, left: 0, behavior: "auto" });
        }
        if (Math.abs(assistVelocity) > 0.035 || active) {
          assistRafId = window.requestAnimationFrame(tick);
        } else {
          assistRafId = null;
          if (assistInputDetachTimer !== null) {
            window.clearTimeout(assistInputDetachTimer);
            assistInputDetachTimer = null;
          }
          detachAssistInput();
        }
      };

      assistRafId = window.requestAnimationFrame(tick);
    };

    const handleWheelIntent = (event: WheelEvent) => {
      rememberScrollIntent(event.deltaY);
    };

    const handleTouchStartIntent = (event: TouchEvent) => {
      const touch = event.touches[0];
      touchStartY = touch ? touch.clientY : null;
    };

    const handleTouchMoveIntent = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || touchStartY === null) return;
      const delta = touchStartY - touch.clientY;
      rememberScrollIntent(delta);
      touchStartY = touch.clientY;
    };

    const handleKeyIntent = (event: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " ", "End"].includes(event.key)) {
        rememberScrollIntent(1);
        return;
      }
      if (["ArrowUp", "PageUp", "Home"].includes(event.key)) {
        rememberScrollIntent(-1);
      }
    };

    const attachIntentListeners = () => {
      window.addEventListener("wheel", handleWheelIntent, { passive: true });
      window.addEventListener("touchstart", handleTouchStartIntent, { passive: true });
      window.addEventListener("touchmove", handleTouchMoveIntent, { passive: true });
      window.addEventListener("keydown", handleKeyIntent);
    };

    const detachIntentListeners = () => {
      window.removeEventListener("wheel", handleWheelIntent);
      window.removeEventListener("touchstart", handleTouchStartIntent);
      window.removeEventListener("touchmove", handleTouchMoveIntent);
      window.removeEventListener("keydown", handleKeyIntent);
    };

    const blockScrollKey = (key: string) =>
      ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"].includes(key);

    const handleWheelBlock = (event: WheelEvent) => {
      if (!hasReturnLock) return;
      rememberScrollIntent(event.deltaY);
      event.preventDefault();
    };

    const handleTouchMoveBlock = (event: TouchEvent) => {
      if (!hasReturnLock) return;
      const touch = event.touches[0];
      if (touch && touchStartY !== null) {
        rememberScrollIntent(touchStartY - touch.clientY);
      }
      event.preventDefault();
    };

    const handleKeyBlock = (event: KeyboardEvent) => {
      if (!hasReturnLock) return;
      if (!blockScrollKey(event.key)) return;
      if (["ArrowDown", "PageDown", " ", "Spacebar", "End"].includes(event.key)) {
        rememberScrollIntent(1);
      } else {
        rememberScrollIntent(-1);
      }
      event.preventDefault();
    };

    const attachBlockListeners = () => {
      window.addEventListener("wheel", handleWheelBlock, { passive: false, capture: true });
      window.addEventListener("touchmove", handleTouchMoveBlock, { passive: false, capture: true });
      window.addEventListener("keydown", handleKeyBlock, true);
    };

    const detachBlockListeners = () => {
      window.removeEventListener("wheel", handleWheelBlock, true);
      window.removeEventListener("touchmove", handleTouchMoveBlock, true);
      window.removeEventListener("keydown", handleKeyBlock, true);
    };

    const handleFlightFinished = () => {
      if (!hasReturnLock) return;
      pullStoredIntent();
      unlockPageScrollFromReturn();
      hasReturnLock = false;
      window.removeEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);
      detachIntentListeners();
      detachBlockListeners();
      if (pendingScrollIntent !== 0) {
        const direction = pendingScrollIntent;
        const intentAt = pendingScrollIntentAt || Date.now();
        const intentMagnitude = pendingScrollMagnitude;
        pendingScrollIntent = 0;
        pendingScrollIntentAt = 0;
        pendingScrollMagnitude = 16;
        window.requestAnimationFrame(() => {
          startAssistScroll(direction, intentAt, intentMagnitude);
        });
      }
      if (unlockFallbackTimer !== null) {
        window.clearTimeout(unlockFallbackTimer);
        unlockFallbackTimer = null;
      }
    };

    if (hasReturnLock && hasFinishedFlag) {
      handleFlightFinished();
    } else if (hasReturnLock) {
      pullStoredIntent();
      attachIntentListeners();
      attachBlockListeners();
      window.addEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);
      unlockFallbackTimer = window.setTimeout(() => {
        handleFlightFinished();
      }, 900);
    }

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

          const schedule = [0, 56] as const;
          rafId = window.requestAnimationFrame(() => {
            if (cancelled) return;
            schedule.forEach((delay) => {
              const timer = window.setTimeout(() => {
                if (cancelled) return;
                attemptRestore();
                if (delay === schedule[schedule.length - 1]) {
                  try {
                    window.sessionStorage.removeItem(RETURN_SCROLL_KEY);
                  } catch {
                    // Ignore cleanup failures.
                  }
                }
              }, delay);
              timers.push(timer);
            });
          });
        }
      }
    } catch {
      // Ignore malformed storage payloads.
    }

    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      timers.forEach((timer) => window.clearTimeout(timer));
      if (hasReturnLock) {
        window.removeEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);
        detachIntentListeners();
        detachBlockListeners();
      }
      if (assistRafId !== null) {
        window.cancelAnimationFrame(assistRafId);
      }
      if (assistInputDetachTimer !== null) {
        window.clearTimeout(assistInputDetachTimer);
      }
      if (unlockFallbackTimer !== null) {
        window.clearTimeout(unlockFallbackTimer);
      }
    };
  }, [currentHref]);

  return null;
}
