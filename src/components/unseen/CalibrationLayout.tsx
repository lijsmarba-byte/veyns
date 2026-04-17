"use client";

import type { ReactNode } from "react";

type CalibrationLayoutProps = {
  children: ReactNode;
  className?: string;
};

export function CalibrationLayout({ children, className = "" }: CalibrationLayoutProps) {
  return <div className={`w-full max-w-[640px] ${className}`}>{children}</div>;
}
