"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sections } from "@/data/mockCatalog";
import { ProductViewMobileShell } from "@/components/unseen/ProductViewMobileShell";
import {
  buildProductImages,
  extractCueTokens,
  formatPipeLabel,
  MOBILE_GRID_QUERY_BACK_KEY,
  MOBILE_GRID_QUERY_EDIT_KEY,
  MOBILE_GRID_QUERY_IMG_KEY,
  MOBILE_GRID_QUERY_ITEM_KEY,
  MOBILE_GRID_QUERY_MODE_KEY,
  MOBILE_GRID_PRODUCT_OPEN_EVENT,
  type MobileGridProductOverlayPayload,
} from "@/components/unseen/mobileGridProductOverlayEvent";
import { useViewportMode } from "@/lib/ui/viewportMode";

type MobileGridProductOverlayHostProps = {
  mode: "gallery" | "archive";
};

function readOverlayPayloadFromHistoryState() {
  if (typeof window === "undefined") return null;
  const state = window.history.state as { overlayPayload?: unknown } | null;
  const maybePayload = state?.overlayPayload;
  if (!maybePayload || typeof maybePayload !== "object") return null;
  return maybePayload as MobileGridProductOverlayPayload;
}

export function MobileGridProductOverlayHost({ mode }: MobileGridProductOverlayHostProps) {
  const { isMobileExperience } = useViewportMode();
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<MobileGridProductOverlayPayload | null>(null);
  const [forceReplaceOnClose, setForceReplaceOnClose] = useState(false);

  useEffect(() => {
    if (!isMobileExperience) return;

    const maybeHydrateFromHistory = () => {
      if (window.location.pathname !== "/product-view") return;
      const statePayload = readOverlayPayloadFromHistoryState();
      if (!statePayload || statePayload.mode !== mode) return;
      setPayload(statePayload);
    };

    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<MobileGridProductOverlayPayload>).detail;
      if (!detail || detail.mode !== mode) return;
      setForceReplaceOnClose(false);
      setPayload(detail);
    };

    const handlePopState = () => {
      if (window.location.pathname === "/product-view") {
        maybeHydrateFromHistory();
        return;
      }
      setPayload(null);
      setForceReplaceOnClose(false);
    };

    maybeHydrateFromHistory();
    window.addEventListener(MOBILE_GRID_PRODUCT_OPEN_EVENT, handleOpen as EventListener);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener(MOBILE_GRID_PRODUCT_OPEN_EVENT, handleOpen as EventListener);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isMobileExperience, mode]);

  useEffect(() => {
    if (!isMobileExperience) return;
    const itemId = searchParams.get(MOBILE_GRID_QUERY_ITEM_KEY);
    const queryMode = searchParams.get(MOBILE_GRID_QUERY_MODE_KEY);
    if (!itemId || queryMode !== mode) {
      setForceReplaceOnClose(false);
      setPayload(null);
      return;
    }
    const item = sections.flatMap((section) => section.items).find((entry) => entry.id === itemId);
    if (!item) {
      setForceReplaceOnClose(false);
      setPayload(null);
      return;
    }
    const backHref = searchParams.get(MOBILE_GRID_QUERY_BACK_KEY) ?? (mode === "archive" ? "/archive" : "/gallery");
    const editId = searchParams.get(MOBILE_GRID_QUERY_EDIT_KEY);
    const img = searchParams.get(MOBILE_GRID_QUERY_IMG_KEY);
    const nextPayload: MobileGridProductOverlayPayload = {
      backHref,
      brand: item.brand,
      cues: extractCueTokens([item.cuePalette, item.cueSurface, item.cueStructure, item.cueAccent]),
      description: item.artsyDesc,
      editId: editId ?? null,
      images: buildProductImages(item, img ?? item.imgSrc),
      isArchiveMode: mode === "archive",
      isPreOwned: item.status === "pre-owned",
      itemId: item.id,
      mode,
      pipeLabel: formatPipeLabel(item.idxLabel),
      price: item.price,
      productViewHref: "",
      title: item.artsyName,
    };
    setPayload(nextPayload);
    const state = window.history.state as { unseenMobileGridOverlay?: unknown } | null;
    setForceReplaceOnClose(state?.unseenMobileGridOverlay !== true);
  }, [isMobileExperience, mode, searchParams]);

  useLayoutEffect(() => {
    if (!isMobileExperience) return;
    const root = document.documentElement;
    if (payload) {
      root.setAttribute("data-unseen-mobile-grid-product-overlay-open", "true");
    } else {
      root.removeAttribute("data-unseen-mobile-grid-product-overlay-open");
    }
    return () => {
      root.removeAttribute("data-unseen-mobile-grid-product-overlay-open");
    };
  }, [isMobileExperience, payload]);

  if (!isMobileExperience || !payload) return null;

  return (
    <ProductViewMobileShell
      backHref={payload.backHref}
      brand={payload.brand}
      cues={payload.cues}
      description={payload.description}
      editId={payload.editId ?? null}
      images={payload.images}
      isArchiveMode={payload.isArchiveMode}
      isPreOwned={payload.isPreOwned}
      itemId={payload.itemId}
      mode={payload.mode}
      pipeLabel={payload.pipeLabel}
      price={payload.price}
      title={payload.title}
      disableEnterAnimation
      disableGridReturnPrep
      forceReplaceOnClose={forceReplaceOnClose}
    />
  );
}
