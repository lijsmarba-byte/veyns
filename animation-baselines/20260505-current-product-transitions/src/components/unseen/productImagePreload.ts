const warmedImages = new Map<string, Promise<void>>();
let sourceHoldTimer: number | null = null;
let sourceHideFrame: number | null = null;
let hiddenSourceNode: HTMLElement | null = null;
let hiddenSourcePreviousVisibility = "";
const SOURCE_HOLD_ID = "unseen-product-transition-source-hold";

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type CompleteProductTransitionHoldOptions = {
  crossfadeMs: number;
  durationMs: number;
  easing: string;
  indicatedStart?: {
    opacity: number;
    scale: number;
    x: number;
    y: number;
  };
  onArrive?: () => void;
  onDone?: () => void;
  productId: string;
  src: string;
  targetRect: RectLike;
};

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function decodeLoadedImage(image: HTMLImageElement) {
  if (typeof image.decode !== "function") return Promise.resolve();
  return image.decode().catch(() => undefined);
}

export function warmProductImage(src: string | null | undefined) {
  if (typeof window === "undefined") return Promise.resolve();
  const safeSrc = typeof src === "string" ? src.trim() : "";
  if (!safeSrc) return Promise.resolve();

  const existing = warmedImages.get(safeSrc);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const image = new window.Image();
    let didResolve = false;

    const finish = () => {
      if (didResolve) return;
      didResolve = true;
      image.onload = null;
      image.onerror = null;
      decodeLoadedImage(image).finally(resolve);
    };

    image.decoding = "async";
    image.loading = "eager";
    image.onload = finish;
    image.onerror = finish;
    image.src = safeSrc;

    if (image.complete) {
      finish();
    }
  });

  warmedImages.set(safeSrc, promise);
  return promise;
}

export async function waitForProductImageDecode(
  image: HTMLImageElement | null | undefined,
  src: string | null | undefined,
  timeoutMs = 220,
) {
  if (typeof window === "undefined") return;

  const decodeTask = (async () => {
    if (image && image.complete && image.naturalWidth > 0) {
      await decodeLoadedImage(image);
      return;
    }

    await warmProductImage(image?.currentSrc || image?.src || src);
  })();

  if (timeoutMs <= 0) {
    await decodeTask;
    return;
  }

  await Promise.race([decodeTask, wait(timeoutMs)]);
}

export function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function getContainRect(containerRect: DOMRect, aspectRatio: number) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return containerRect;

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

export function clearProductTransitionHold() {
  if (typeof document === "undefined") return;
  if (sourceHoldTimer !== null) {
    window.clearTimeout(sourceHoldTimer);
    sourceHoldTimer = null;
  }
  if (sourceHideFrame !== null) {
    window.cancelAnimationFrame(sourceHideFrame);
    sourceHideFrame = null;
  }
  document.getElementById(SOURCE_HOLD_ID)?.remove();
  if (hiddenSourceNode?.isConnected) {
    hiddenSourceNode.style.visibility = hiddenSourcePreviousVisibility;
  }
  hiddenSourceNode = null;
  hiddenSourcePreviousVisibility = "";
}

export function showProductTransitionHold(
  sourceNode: HTMLElement | null | undefined,
  src: string | null | undefined,
  aspectRatio?: number,
  productId?: string,
) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (!sourceNode) return;

  const image = sourceNode.querySelector("img") as HTMLImageElement | null;
  const containerRect = sourceNode.getBoundingClientRect();
  const ratio =
    aspectRatio && aspectRatio > 0
      ? aspectRatio
      : image && image.naturalWidth > 0 && image.naturalHeight > 0
        ? image.naturalWidth / image.naturalHeight
        : 0;
  const rect = ratio > 0 ? getContainRect(containerRect, ratio) : image?.getBoundingClientRect() ?? containerRect;
  if (rect.width < 2 || rect.height < 2) return;

  clearProductTransitionHold();
  hiddenSourceNode = sourceNode;
  hiddenSourcePreviousVisibility = sourceNode.style.visibility;

  const overlay = document.createElement("div");
  overlay.id = SOURCE_HOLD_ID;
  if (productId) overlay.dataset.productId = productId;
  overlay.dataset.src = image?.currentSrc || image?.src || src || "";
  overlay.style.position = "fixed";
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.zIndex = "146";
  overlay.style.pointerEvents = "none";
  overlay.style.userSelect = "none";
  overlay.style.transform = "translate3d(0px, 0px, 0px) scale(1)";
  overlay.style.transformOrigin = "top left";
  overlay.style.willChange = "transform, opacity";
  overlay.style.backfaceVisibility = "hidden";
  overlay.style.transformStyle = "preserve-3d";
  overlay.style.contain = "layout paint style";
  overlay.style.setProperty("-webkit-backface-visibility", "hidden");

  const holdImage = document.createElement("img");
  holdImage.src = image?.currentSrc || image?.src || src || "";
  holdImage.alt = "";
  holdImage.decoding = "sync";
  holdImage.loading = "eager";
  holdImage.style.display = "block";
  holdImage.style.width = "100%";
  holdImage.style.height = "100%";
  holdImage.style.objectFit = "contain";
  holdImage.style.backfaceVisibility = "hidden";
  holdImage.style.transform = "translateZ(0)";
  holdImage.style.userSelect = "none";
  holdImage.style.setProperty("-webkit-backface-visibility", "hidden");
  overlay.appendChild(holdImage);
  document.body.appendChild(overlay);
  sourceHideFrame = window.requestAnimationFrame(() => {
    sourceHideFrame = null;
    if (hiddenSourceNode === sourceNode && sourceNode.isConnected) {
      sourceNode.style.visibility = "hidden";
    }
  });

  sourceHoldTimer = window.setTimeout(() => {
    clearProductTransitionHold();
  }, 6500);
}

export function completeProductTransitionHold({
  crossfadeMs,
  durationMs,
  easing,
  indicatedStart,
  onArrive,
  onDone,
  productId,
  src,
  targetRect,
}: CompleteProductTransitionHoldOptions) {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  const overlay = document.getElementById(SOURCE_HOLD_ID) as HTMLDivElement | null;
  if (!overlay) return false;
  if (overlay.dataset.productId && overlay.dataset.productId !== productId) return false;
  if (targetRect.width < 2 || targetRect.height < 2) return false;

  if (sourceHoldTimer !== null) {
    window.clearTimeout(sourceHoldTimer);
    sourceHoldTimer = null;
  }

  const run = async () => {
    const overlayImg = overlay.querySelector("img") as HTMLImageElement | null;
    if (overlayImg && src && overlayImg.getAttribute("src") !== src) {
      overlayImg.src = src;
    }
    let didFinish = false;
    const finish = () => {
      if (didFinish) return;
      didFinish = true;
      clearProductTransitionHold();
      onDone?.();
    };

    await waitForProductImageDecode(overlayImg, src, 160);
    const currentRect = overlay.getBoundingClientRect();
    overlay.getAnimations().forEach((animation) => {
      try {
        animation.cancel();
      } catch {
        // Non-critical: stale animation cleanup.
      }
    });

    if (indicatedStart) {
      overlay.style.transition = "none";
      overlay.style.opacity = String(indicatedStart.opacity);
      overlay.style.left = `${targetRect.left}px`;
      overlay.style.top = `${targetRect.top}px`;
      overlay.style.width = `${targetRect.width}px`;
      overlay.style.height = `${targetRect.height}px`;
      overlay.style.transformOrigin = "top left";
      overlay.style.transform = `translate3d(${indicatedStart.x}px, ${indicatedStart.y}px, 0px) scale(${indicatedStart.scale}, ${indicatedStart.scale})`;
      await nextAnimationFrame();
      await nextAnimationFrame();
      const motion = overlay.animate(
        [
          {
            transform: `translate3d(${indicatedStart.x}px, ${indicatedStart.y}px, 0px) scale(${indicatedStart.scale}, ${indicatedStart.scale})`,
            opacity: indicatedStart.opacity,
          },
          { transform: "translate3d(0px, 0px, 0px) scale(1, 1)", opacity: 1 },
        ],
        { duration: durationMs, easing, fill: "forwards" },
      );
      motion.addEventListener(
        "finish",
        () => {
          onArrive?.();
          const fade = overlay.animate(
            [{ opacity: 1 }, { opacity: 0 }],
            { duration: crossfadeMs, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
          );
          fade.addEventListener(
            "finish",
            () => {
              finish();
            },
            { once: true },
          );
          window.setTimeout(() => {
            finish();
          }, crossfadeMs + 160);
        },
        { once: true },
      );
      return;
    }

    const scale = Math.max(0.0001, currentRect.width / Math.max(targetRect.width, 1));
    const invertX = currentRect.left - targetRect.left;
    const invertY = currentRect.top - targetRect.top;
    const startTransform = `translate3d(${invertX}px, ${invertY}px, 0px) scale(${scale}, ${scale})`;

    overlay.style.transition = "none";
    overlay.style.opacity = "1";
    overlay.style.left = `${targetRect.left}px`;
    overlay.style.top = `${targetRect.top}px`;
    overlay.style.width = `${targetRect.width}px`;
    overlay.style.height = `${targetRect.height}px`;
    overlay.style.transformOrigin = "top left";
    overlay.style.transform = startTransform;

    await nextAnimationFrame();
    await nextAnimationFrame();

    const motion = overlay.animate(
      [
        { transform: startTransform, opacity: 1 },
        { transform: "translate3d(0px, 0px, 0px) scale(1, 1)", opacity: 1 },
      ],
      { duration: durationMs, easing, fill: "forwards" },
    );

    motion.addEventListener(
      "finish",
      () => {
        onArrive?.();
        const fade = overlay.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: crossfadeMs, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
        );
        fade.addEventListener(
          "finish",
          () => {
            finish();
          },
          { once: true },
        );
        window.setTimeout(() => {
          finish();
        }, crossfadeMs + 160);
      },
      { once: true },
    );
  };

  void run();
  return true;
}
