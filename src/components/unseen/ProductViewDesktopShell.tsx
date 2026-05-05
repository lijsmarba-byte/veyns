"use client";

import type { ReactNode } from "react";
import { useViewportMode } from "@/lib/ui/viewportMode";

type ProductViewDesktopShellProps = {
  children: ReactNode;
};

export function ProductViewDesktopShell({ children }: ProductViewDesktopShellProps) {
  const { isMobileExperience } = useViewportMode();
  if (isMobileExperience) return null;
  return <>{children}</>;
}
