"use client";

import { useEffect } from "react";
import { clearProductTransitionHold } from "@/components/unseen/productImagePreload";

export function ProductTransitionOverlayHost() {
  useEffect(() => {
    return () => {
      clearProductTransitionHold();
    };
  }, []);

  return null;
}
