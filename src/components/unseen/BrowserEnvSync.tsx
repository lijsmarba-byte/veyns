"use client";

import { useEffect } from "react";

function detectSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome\/|CriOS\/|Chromium\/|Edg\//.test(ua);
}

export function BrowserEnvSync() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.browser = detectSafari() ? "safari" : "other";
  }, []);

  return null;
}

