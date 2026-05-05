"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MOBILE_GRID_QUERY_BACK_KEY,
  MOBILE_GRID_QUERY_EDIT_KEY,
  MOBILE_GRID_QUERY_IMG_KEY,
  MOBILE_GRID_QUERY_ITEM_KEY,
  MOBILE_GRID_QUERY_MODE_KEY,
} from "@/components/unseen/mobileGridProductOverlayEvent";
import { useViewportMode } from "@/lib/ui/viewportMode";

function isGridBackHref(backHref: string) {
  return backHref === "/gallery" || backHref.startsWith("/gallery?") || backHref === "/archive" || backHref.startsWith("/archive?");
}

export function ProductViewMobileGridRedirect() {
  const { isMobileExperience } = useViewportMode();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isMobileExperience) return;
    if (window.location.pathname !== "/product-view") return;

    const item = searchParams.get("item");
    const mode = searchParams.get("mode");
    const img = searchParams.get("img");
    const edit = searchParams.get("edit");
    const back = searchParams.get("back");
    if (!item || !mode || !back) return;
    if ((mode !== "gallery" && mode !== "archive") || !isGridBackHref(back)) return;

    const url = new URL(back, window.location.origin);
    url.searchParams.set(MOBILE_GRID_QUERY_ITEM_KEY, item);
    url.searchParams.set(MOBILE_GRID_QUERY_MODE_KEY, mode);
    if (img) {
      url.searchParams.set(MOBILE_GRID_QUERY_IMG_KEY, img);
    } else {
      url.searchParams.delete(MOBILE_GRID_QUERY_IMG_KEY);
    }
    url.searchParams.set(MOBILE_GRID_QUERY_BACK_KEY, back);
    if (edit) {
      url.searchParams.set(MOBILE_GRID_QUERY_EDIT_KEY, edit);
    } else {
      url.searchParams.delete(MOBILE_GRID_QUERY_EDIT_KEY);
    }
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [isMobileExperience, router, searchParams]);

  return null;
}
