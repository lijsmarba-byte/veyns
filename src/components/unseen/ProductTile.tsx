"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { MockCatalogItem } from "@/data/mockCatalog";
import { GalleryHoverActions } from "@/components/unseen/GalleryHoverActions";
import {
  buildMobileGridOverlayPayload,
  MOBILE_GRID_QUERY_BACK_KEY,
  MOBILE_GRID_QUERY_EDIT_KEY,
  MOBILE_GRID_QUERY_IMG_KEY,
  MOBILE_GRID_QUERY_ITEM_KEY,
  MOBILE_GRID_QUERY_MODE_KEY,
  MOBILE_GRID_PRODUCT_OPEN_EVENT,
} from "@/components/unseen/mobileGridProductOverlayEvent";
import { warmProductImage } from "@/components/unseen/productImagePreload";
import { useViewportMode } from "@/lib/ui/viewportMode";

type ProductTileProps = {
  item: MockCatalogItem;
  imagePriority?: boolean;
  mode?: "gallery" | "archive";
  issueNumber?: string;
};

let hasPrefetchedProductViewRoute = false;

function getItemNumber(item: MockCatalogItem) {
  const fromIdxLabel = item.idxLabel.match(/\d+/)?.[0];
  if (fromIdxLabel) return fromIdxLabel;
  const fromId = item.id.match(/\d+/)?.[0];
  return fromId ?? "00";
}

export function ProductTile({
  item,
  imagePriority = false,
  mode = "archive",
  issueNumber = "04",
}: ProductTileProps) {
  const hasHoverActions = mode === "gallery" || mode === "archive";
  const [hoverResetKey, setHoverResetKey] = useState(0);
  const imageAreaRef = useRef<HTMLDivElement | null>(null);
  const brandLabelRef = useRef<HTMLParagraphElement | null>(null);
  const prefetchedHrefRef = useRef<string | null>(null);
  const [isMobileBrandWrapped, setIsMobileBrandWrapped] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isIPadExperience, isMobileExperience } = useViewportMode();
  const showPreviewHoverActions = hasHoverActions && !isIPadExperience;
  const itemNumber = getItemNumber(item);
  const galleryCoreLabel = item.idxLabel.replace(/^\[/, "").replace(/\]$/, "");
  const topLabel = mode === "archive" ? `Issue ${issueNumber} | ${itemNumber}` : galleryCoreLabel;
  const brandTextClass = mode === "archive" ? "text-accent" : "text-ink";
  const handleHoverReset = () => {
    if (!hasHoverActions) return;
    setHoverResetKey((key) => key + 1);
  };
  const editParam = searchParams.get("edit");
  const currentQuery = searchParams.toString();
  const backHref = currentQuery ? `${pathname}?${currentQuery}` : pathname;
  const productViewHref = useMemo(() => {
    const nextParams = new URLSearchParams({
      item: item.id,
      mode,
      back: backHref,
      img: item.imgSrc,
    });
    if (editParam) {
      nextParams.set("edit", editParam);
    }
    return `/product-view?${nextParams.toString()}`;
  }, [backHref, editParam, item.id, item.imgSrc, mode]);
  const warmTransitionImage = useCallback(() => {
    void warmProductImage(item.imgSrc);
  }, [item.imgSrc]);
  const warmProductTransition = useCallback(() => {
    warmTransitionImage();
    if (prefetchedHrefRef.current === productViewHref) return;
    prefetchedHrefRef.current = productViewHref;
    router.prefetch(productViewHref);
  }, [productViewHref, router, warmTransitionImage]);

  useEffect(() => {
    if (hasPrefetchedProductViewRoute) return;
    hasPrefetchedProductViewRoute = true;
    router.prefetch("/product-view");
  }, [router]);

  useEffect(() => {
    if (!imagePriority) return;
    warmProductTransition();
  }, [imagePriority, warmProductTransition]);

  const syncMobileBrandWrap = useCallback(() => {
    const labelNode = brandLabelRef.current;
    if (!labelNode) return;
    if (window.innerWidth > 640) {
      setIsMobileBrandWrapped(false);
      return;
    }
    const wrapped = labelNode.scrollHeight - labelNode.clientHeight > 1;
    setIsMobileBrandWrapped(wrapped);
  }, []);

  useEffect(() => {
    const raf = window.requestAnimationFrame(syncMobileBrandWrap);
    const onResize = () => {
      window.requestAnimationFrame(syncMobileBrandWrap);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [syncMobileBrandWrap]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(syncMobileBrandWrap);
    return () => window.cancelAnimationFrame(raf);
  }, [item.brand, syncMobileBrandWrap]);

  const isGridActionEventTarget = (target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    const element = target instanceof Element ? target : target.parentElement;
    return Boolean(element?.closest('[data-grid-action-hit="true"]'));
  };
  const openProductView = () => {
    warmProductTransition();
    const imgEl = imageAreaRef.current?.querySelector("img");
    if (imgEl) {
      imgEl.style.filter = "none";
      imgEl.style.transition = "none";
    }
    if (isMobileExperience) {
      try {
        window.sessionStorage.removeItem("unseen:product-view-transition");
        window.sessionStorage.removeItem("unseen:product-view-text-transition");
        window.sessionStorage.removeItem("unseen:return-focus-item");
        window.sessionStorage.removeItem("unseen:return-flight-finished-flag");
        document.getElementById("unseen-product-transition-source-hold")?.remove();
      } catch {
        // Ignore storage failures.
      }
    }

    const isMobileGridRoute = isMobileExperience && (pathname === "/gallery" || pathname === "/archive");
    if (isMobileGridRoute) {
      const payload = buildMobileGridOverlayPayload(item, mode, backHref, editParam);
      const backUrl = new URL(backHref, window.location.origin);
      backUrl.searchParams.set(MOBILE_GRID_QUERY_ITEM_KEY, item.id);
      backUrl.searchParams.set(MOBILE_GRID_QUERY_MODE_KEY, mode);
      backUrl.searchParams.set(MOBILE_GRID_QUERY_IMG_KEY, item.imgSrc);
      backUrl.searchParams.set(MOBILE_GRID_QUERY_BACK_KEY, backHref);
      if (editParam) {
        backUrl.searchParams.set(MOBILE_GRID_QUERY_EDIT_KEY, editParam);
      } else {
        backUrl.searchParams.delete(MOBILE_GRID_QUERY_EDIT_KEY);
      }
      try {
        window.history.pushState(
          {
            unseenMobileGridOverlay: true,
            overlayPayload: payload,
          },
          "",
          backUrl.pathname + backUrl.search,
        );
      } catch {
        router.push(payload.productViewHref);
        return;
      }
      window.dispatchEvent(
        new CustomEvent(MOBILE_GRID_PRODUCT_OPEN_EVENT, {
          detail: payload,
        }),
      );
      return;
    }

    try {
      const stickyPhaseAttr = document.documentElement.getAttribute("data-unseen-mobile-sticky-phase");
      const stickyPhase =
        stickyPhaseAttr === "compact" ? 2 : stickyPhaseAttr === "mid" ? 1 : stickyPhaseAttr === "full" ? 0 : null;
      window.sessionStorage.setItem(
        "unseen:return-scroll",
        JSON.stringify({
          at: Date.now(),
          backHref,
          scrollY: window.scrollY,
          ...(isMobileExperience && stickyPhase !== null ? { stickyPhase } : {}),
        }),
      );
    } catch {
      // Ignore storage failures.
    }
    window.requestAnimationFrame(() => {
      router.push(productViewHref);
    });
  };
  return (
    <article
      className="group/product flex w-full flex-col items-center"
      onMouseLeave={handleHoverReset}
      onBlur={(event) => {
        if (!hasHoverActions) return;
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          handleHoverReset();
        }
      }}
      onPointerEnter={warmProductTransition}
    >
      <div
        ref={imageAreaRef}
        data-product-tile-image-root="true"
        className="relative mx-auto h-[212px] w-full max-w-[162px] cursor-pointer min-[641px]:h-[280px] min-[641px]:max-w-[210px]"
        onPointerDown={warmProductTransition}
        onFocus={warmProductTransition}
        onClick={(event) => {
          if (isGridActionEventTarget(event.target)) return;
          openProductView();
        }}
      >
        <Image
          src={item.imgSrc}
          alt={`${item.brand} ${item.artsyName}`}
          fill
          data-gallery-mobile-static-image={mode === "gallery" ? "true" : undefined}
          className={`pointer-events-none select-none object-contain object-center ${
            showPreviewHoverActions
              ? mode === "gallery"
                ? "max-[767px]:!filter-none max-[767px]:!transition-none min-[768px]:transition-[filter] min-[768px]:duration-150 min-[768px]:ease-out min-[768px]:group-hover/product:blur-[1.8px] min-[768px]:group-focus-within/product:blur-[1.8px]"
                : "transition-[filter] duration-150 ease-out group-hover/product:blur-[1.8px] group-focus-within/product:blur-[1.8px]"
              : ""
          }`}
          sizes="(max-width: 768px) 70vw, (max-width: 1024px) 42vw, 19vw"
          loading={imagePriority ? "eager" : "lazy"}
          fetchPriority={imagePriority ? "high" : "auto"}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
        />
        {showPreviewHoverActions ? (
          <GalleryHoverActions
            itemId={item.id}
            mode={mode}
            hoverResetKey={hoverResetKey}
            mobileDisabled={true}
          />
        ) : null}
      </div>

      <div
        className="mt-[16px] flex h-[76px] w-full cursor-pointer flex-col items-center justify-between text-center text-[13px] font-medium leading-5 tracking-[0.02em] text-meta min-[641px]:mt-[14px] min-[641px]:h-auto min-[641px]:justify-start min-[641px]:gap-[3px]"
        onPointerDown={warmProductTransition}
        onFocus={warmProductTransition}
        onClick={openProductView}
      >
        <p className="inline-flex h-[22px] items-center justify-center font-ui text-meta">
          <span aria-hidden="true">|</span>
          <span className="px-[2px]">{topLabel}</span>
          <span aria-hidden="true">|</span>
        </p>
        <p
          ref={brandLabelRef}
          className={`w-full max-w-full px-1 text-center font-ui min-[641px]:inline-flex min-[641px]:h-[22px] min-[641px]:items-center min-[641px]:justify-center min-[641px]:leading-5 max-[640px]:h-[30px] max-[640px]:overflow-hidden max-[640px]:[display:-webkit-box] max-[640px]:[-webkit-box-orient:vertical] max-[640px]:[-webkit-line-clamp:2] ${
            isMobileBrandWrapped
              ? "max-[640px]:pt-0 max-[640px]:leading-[13px]"
              : "max-[640px]:pt-[4px] max-[640px]:leading-5"
          } ${brandTextClass}`}
        >
          {item.brand}
        </p>
        <p
          className={`inline-flex h-[22px] items-center justify-center font-ui text-meta ${
            isMobileBrandWrapped ? "max-[640px]:translate-y-[2px]" : ""
          }`}
        >
          {item.price}
        </p>
      </div>
    </article>
  );
}
