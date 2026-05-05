"use client";

import { useEffect, useLayoutEffect, useState } from "react";

export const MOBILE_MAX_WIDTH_PX = 767;
export const VIEWPORT_MODE_SYNC_EVENT = "unseen:viewport-mode-sync";

const MOBILE_WIDTH_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;
const TOUCH_PRIMARY_QUERY = "(hover: none) and (pointer: coarse)";

export type DeviceClass = "iphone" | "ipad" | "desktop";
export type LayoutClass = "phone" | "desktop";
export type InteractionClass = "iphone-touch" | "ipad-touch" | "desktop-pointer";

export type ViewportMode = {
  deviceClass: DeviceClass;
  interactionClass: InteractionClass;
  isMobileWidth: boolean;
  isDesktopExperience: boolean;
  isIPadExperience: boolean;
  isIPhoneExperience: boolean;
  isTouchPrimary: boolean;
  isIOSWebKitMobile: boolean;
  isMobileExperience: boolean;
  layoutClass: LayoutClass;
  usesDesktopLayout: boolean;
  usesTouchGestures: boolean;
};

type MqListener = (event: MediaQueryListEvent) => void;

const DEFAULT_VIEWPORT_MODE: ViewportMode = {
  deviceClass: "desktop",
  interactionClass: "desktop-pointer",
  isMobileWidth: false,
  isDesktopExperience: true,
  isIPadExperience: false,
  isIPhoneExperience: false,
  isTouchPrimary: false,
  isIOSWebKitMobile: false,
  isMobileExperience: false,
  layoutClass: "desktop",
  usesDesktopLayout: true,
  usesTouchGestures: false,
};

let cachedClientViewportMode: ViewportMode | null = null;
let hasDispatchedViewportModeSync = false;

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function isSameViewportMode(a: ViewportMode, b: ViewportMode) {
  return (
    a.deviceClass === b.deviceClass &&
    a.interactionClass === b.interactionClass &&
    a.isMobileWidth === b.isMobileWidth &&
    a.isDesktopExperience === b.isDesktopExperience &&
    a.isIPadExperience === b.isIPadExperience &&
    a.isIPhoneExperience === b.isIPhoneExperience &&
    a.isTouchPrimary === b.isTouchPrimary &&
    a.isIOSWebKitMobile === b.isIOSWebKitMobile &&
    a.isMobileExperience === b.isMobileExperience &&
    a.layoutClass === b.layoutClass &&
    a.usesDesktopLayout === b.usesDesktopLayout &&
    a.usesTouchGestures === b.usesTouchGestures
  );
}

function addMqChangeListener(mq: MediaQueryList, listener: MqListener) {
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }
  mq.addListener(listener);
  return () => mq.removeListener(listener);
}

function isIOSWebKitMobileUA() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const vendor = navigator.vendor;
  const isIOSDevice = /iPhone|iPad|iPod/i.test(ua);
  const isAppleWebKit = /AppleWebKit/i.test(ua) && /Apple Computer/i.test(vendor);
  return isIOSDevice && isAppleWebKit;
}

function getDeviceClass(): DeviceClass {
  if (typeof navigator === "undefined") return "desktop";

  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const isIPhoneLike = /iPhone|iPod/i.test(ua);
  const isIPadLike = /iPad/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);

  if (isIPhoneLike) return "iphone";
  if (isIPadLike) return "ipad";
  return "desktop";
}

function getViewportModeSnapshot(): ViewportMode {
  if (typeof window === "undefined") {
    return DEFAULT_VIEWPORT_MODE;
  }

  const isMobileWidth = window.matchMedia(MOBILE_WIDTH_QUERY).matches;
  const isTouchPrimary = window.matchMedia(TOUCH_PRIMARY_QUERY).matches;
  const isIOSWebKitMobile = isIOSWebKitMobileUA();
  const deviceClass = getDeviceClass();
  const isIPhoneExperience = deviceClass === "iphone";
  const isIPadExperience = deviceClass === "ipad";
  const isDesktopExperience = deviceClass === "desktop";
  const layoutClass: LayoutClass = isIPhoneExperience ? "phone" : "desktop";
  const interactionClass: InteractionClass = isIPhoneExperience
    ? "iphone-touch"
    : isIPadExperience
      ? "ipad-touch"
      : "desktop-pointer";
  const usesDesktopLayout = layoutClass === "desktop";
  const usesTouchGestures = isIPhoneExperience || isIPadExperience;
  const isMobileExperience = isIPhoneExperience;

  return {
    deviceClass,
    interactionClass,
    isMobileWidth,
    isDesktopExperience,
    isIPadExperience,
    isIPhoneExperience,
    isTouchPrimary,
    isIOSWebKitMobile,
    isMobileExperience,
    layoutClass,
    usesDesktopLayout,
    usesTouchGestures,
  };
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() => {
    return cachedClientViewportMode ?? DEFAULT_VIEWPORT_MODE;
  });

  useBrowserLayoutEffect(() => {
    const mobileWidthMq = window.matchMedia(MOBILE_WIDTH_QUERY);
    const touchPrimaryMq = window.matchMedia(TOUCH_PRIMARY_QUERY);

    const sync = () => {
      const nextMode = getViewportModeSnapshot();
      cachedClientViewportMode = nextMode;
      setMode((current) => (isSameViewportMode(current, nextMode) ? current : nextMode));
      if (!hasDispatchedViewportModeSync) {
        hasDispatchedViewportModeSync = true;
        window.dispatchEvent(new CustomEvent(VIEWPORT_MODE_SYNC_EVENT));
      }
    };

    sync();
    const removeMobileWidthListener = addMqChangeListener(mobileWidthMq, sync);
    const removeTouchPrimaryListener = addMqChangeListener(touchPrimaryMq, sync);
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);

    return () => {
      removeMobileWidthListener();
      removeTouchPrimaryListener();
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, []);

  return mode;
}
