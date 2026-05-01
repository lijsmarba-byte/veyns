"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { MockCatalogItem } from "@/data/mockCatalog";
import { GalleryHoverActions } from "@/components/unseen/GalleryHoverActions";
import { showProductTransitionHold, warmProductImage } from "@/components/unseen/productImagePreload";

type ProductTileProps = {
  item: MockCatalogItem;
  imagePriority?: boolean;
  mode?: "gallery" | "archive";
  issueNumber?: string;
};

const RETURN_FOCUS_ITEM_KEY = "unseen:return-focus-item";
const RETURN_FLIGHT_FINISHED_EVENT = "unseen:return-flight-finished";
const RETURN_FLIGHT_FINISHED_KEY = "unseen:return-flight-finished-flag";
const DEFAULT_RETURN_REVEAL_DELAY_MS = 820;
let hasPrefetchedProductViewRoute = false;

type ReturnFocusPayload = {
  at?: number;
  hideUntil?: number;
  itemId?: string;
};

function readReturnFocusDelayMs(itemId: string, consume = true) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RETURN_FOCUS_ITEM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReturnFocusPayload;
    const isFresh = typeof parsed.at === "number" && Date.now() - parsed.at < 90 * 1000;
    if (!isFresh || parsed.itemId !== itemId) return null;

    if (consume) {
      window.sessionStorage.removeItem(RETURN_FOCUS_ITEM_KEY);
    }
    return typeof parsed.hideUntil === "number"
      ? Math.max(0, Math.min(2000, parsed.hideUntil - Date.now()))
      : DEFAULT_RETURN_REVEAL_DELAY_MS;
  } catch {
    return null;
  }
}

function getContainRect(containerRect: DOMRect, aspectRatio: number) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return containerRect;
  }

  const containerRatio = containerRect.width / Math.max(containerRect.height, 1);
  if (aspectRatio > containerRatio) {
    const fittedHeight = containerRect.width / aspectRatio;
    const insetY = (containerRect.height - fittedHeight) / 2;
    return {
      left: containerRect.left,
      top: containerRect.top + insetY,
      width: containerRect.width,
      height: fittedHeight,
    };
  }

  const fittedWidth = containerRect.height * aspectRatio;
  const insetX = (containerRect.width - fittedWidth) / 2;
  return {
    left: containerRect.left + insetX,
    top: containerRect.top,
    width: fittedWidth,
    height: containerRect.height,
  };
}

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
  const [returnImageState, setReturnImageState] = useState(() => {
    const delayMs = readReturnFocusDelayMs(item.id, true);
    return {
      delayMs: delayMs ?? 0,
      hidden: delayMs !== null,
    };
  });
  const imageAreaRef = useRef<HTMLDivElement | null>(null);
  const topLabelRef = useRef<HTMLParagraphElement | null>(null);
  const prefetchedHrefRef = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  useEffect(() => {
    if (hasPrefetchedProductViewRoute) return;
    hasPrefetchedProductViewRoute = true;
    router.prefetch("/product-view");
  }, [router]);

  useEffect(() => {
    if (!imagePriority) return;
    warmProductTransition();
  }, [imagePriority, productViewHref]);

  useLayoutEffect(() => {
    if (returnImageState.hidden) return;
    const delayMs = readReturnFocusDelayMs(item.id, true);
    if (delayMs === null) return;
    setReturnImageState({ hidden: true, delayMs });
  }, [item.id, returnImageState.hidden]);

  useEffect(() => {
    if (!returnImageState.hidden) return;
    let isRevealed = false;
    const revealImage = () => {
      if (isRevealed) return;
      isRevealed = true;
      setReturnImageState((state) => (state.hidden ? { ...state, hidden: false } : state));
    };

    const timer = window.setTimeout(revealImage, returnImageState.delayMs || DEFAULT_RETURN_REVEAL_DELAY_MS);
    const handleFlightFinished = () => {
      revealImage();
    };
    window.addEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);

    try {
      if (window.sessionStorage.getItem(RETURN_FLIGHT_FINISHED_KEY)) {
        revealImage();
      }
    } catch {
      // Keep timer fallback when storage is unavailable.
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(RETURN_FLIGHT_FINISHED_EVENT, handleFlightFinished as EventListener);
    };
  }, [returnImageState.delayMs, returnImageState.hidden]);

  const isGridActionEventTarget = (target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    const element = target instanceof Element ? target : target.parentElement;
    return Boolean(element?.closest('[data-grid-action-hit="true"]'));
  };
  const warmTransitionImage = () => {
    void warmProductImage(item.imgSrc);
  };
  const warmProductTransition = () => {
    warmTransitionImage();
    if (prefetchedHrefRef.current === productViewHref) return;
    prefetchedHrefRef.current = productViewHref;
    router.prefetch(productViewHref);
  };

  const openProductView = () => {
    warmProductTransition();
    const imgEl = imageAreaRef.current?.querySelector("img");
    if (imgEl) {
      imgEl.style.filter = "none";
      imgEl.style.transition = "none";
    }
    const containerRect = imageAreaRef.current?.getBoundingClientRect();
    const imgRect = imgEl?.getBoundingClientRect();
    const aspectRatio =
      imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0
        ? imgEl.naturalWidth / imgEl.naturalHeight
        : undefined;
    const containRect =
      containerRect && aspectRatio ? getContainRect(containerRect, aspectRatio) : null;
    const rect = containRect ?? imgRect ?? containerRect;
    showProductTransitionHold(imageAreaRef.current, item.imgSrc, aspectRatio, item.id);
    if (rect) {
      try {
        window.sessionStorage.setItem(
          "unseen:product-view-transition",
          JSON.stringify({
            itemId: item.id,
            src: item.imgSrc,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            aspectRatio,
            at: Date.now(),
          }),
        );
      } catch {
        // Transition is optional; ignore storage failures.
      }
    }
    const textRect = topLabelRef.current?.getBoundingClientRect();
    if (textRect) {
      try {
        window.sessionStorage.setItem(
          "unseen:product-view-text-transition",
          JSON.stringify({
            itemId: item.id,
            left: textRect.left,
            top: textRect.top,
            width: textRect.width,
            height: textRect.height,
            at: Date.now(),
          }),
        );
      } catch {
        // Transition is optional; ignore storage failures.
      }
    }

    try {
      window.sessionStorage.setItem(
        "unseen:return-scroll",
        JSON.stringify({
          at: Date.now(),
          backHref,
          scrollY: window.scrollY,
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
        className={`relative mx-auto h-[280px] w-full max-w-[210px] cursor-pointer ${
          returnImageState.hidden ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
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
          className={`pointer-events-none select-none object-contain object-center transition-[filter] duration-150 ease-out ${
            hasHoverActions ? "group-hover/product:blur-[1.8px] group-focus-within/product:blur-[1.8px]" : ""
          }`}
          sizes="(max-width: 768px) 70vw, (max-width: 1024px) 42vw, 19vw"
          loading={imagePriority ? "eager" : "lazy"}
          fetchPriority={imagePriority ? "high" : "auto"}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
        />
        {hasHoverActions ? <GalleryHoverActions itemId={item.id} mode={mode} hoverResetKey={hoverResetKey} /> : null}
      </div>

      <div
        className="mt-[16px] flex w-full cursor-pointer flex-col items-center gap-[3px] text-center text-[13px] font-medium leading-5 tracking-[0.02em] text-meta"
        onPointerDown={warmProductTransition}
        onFocus={warmProductTransition}
        onClick={openProductView}
      >
        <p
          ref={topLabelRef}
          className="inline-flex h-[22px] items-center justify-center font-ui text-meta"
        >
          <span aria-hidden="true">|</span>
          <span className="px-[2px]">{topLabel}</span>
          <span aria-hidden="true">|</span>
        </p>
        <p className={`inline-flex h-[22px] items-center justify-center text-center font-ui ${brandTextClass}`}>
          {item.brand}
        </p>
        <p className="inline-flex h-[22px] items-center justify-center font-ui text-meta">
          {item.price}
        </p>
      </div>
    </article>
  );
}
