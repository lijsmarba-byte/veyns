"use client";

import type { ReactNode } from "react";
import { useViewportMode } from "@/lib/ui/viewportMode";

type GalleryRouteWrapperProps = {
  desktopView: ReactNode;
  mobileView: ReactNode;
};

export function GalleryRouteWrapper({ desktopView, mobileView }: GalleryRouteWrapperProps) {
  const { isMobileExperience } = useViewportMode();
  return <>{isMobileExperience ? mobileView : desktopView}</>;
}
