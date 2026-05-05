"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { KeyboardEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MIN_REFERENCE_IMAGES = 30;
const MAX_REFERENCE_IMAGES = 150;
const GALLERY_ENTRY_ARRIVAL_KEY = "unseen:gallery-entry-arrival";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const CALIBRATION_DOT_COUNT = 8;
const REFERENCE_THUMBNAIL_MAX_SIZE = 480;
const REFERENCE_THUMBNAIL_QUALITY = 0.86;
const REFERENCE_THUMBNAIL_BATCH_SIZE = 6;

const CALIBRATION_LINES = [
  "Reading silhouette",
  "Reading material and finish",
  "Noting palette direction",
  "Observing proportion and cut",
  "Mapping reference relationships",
  "Shaping the Signature",
  "Preparing the first Edit of the current Issue",
] as const;

type StepKey = "account" | "references" | "calibration";

type StepMeta = {
  key: StepKey;
  label: string;
};

type ReferenceImage = {
  id: string;
  file: File;
  previewUrl: string;
};

const STEP_META: StepMeta[] = [
  { key: "account", label: "Account" },
  { key: "references", label: "References" },
  { key: "calibration", label: "Calibration" },
];

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isMobileOnboardingViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function isEditableElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element.isContentEditable
  );
}

function resetMobileDocumentScroll({ force = false }: { force?: boolean } = {}) {
  if (!isMobileOnboardingViewport()) return;
  if (!force && isEditableElement(document.activeElement)) return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function getReferenceThumbnailSize(width: number, height: number) {
  const scale = Math.min(1, REFERENCE_THUMBNAIL_MAX_SIZE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", REFERENCE_THUMBNAIL_QUALITY);
  });
}

function loadReferenceImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load reference image."));
    };
    image.src = objectUrl;
  });
}

async function createReferenceThumbnailUrl(file: File): Promise<string> {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return URL.createObjectURL(file);

    if ("createImageBitmap" in window) {
      const bitmap = await createImageBitmap(file);
      const size = getReferenceThumbnailSize(bitmap.width, bitmap.height);
      canvas.width = size.width;
      canvas.height = size.height;
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      bitmap.close();
    } else {
      const image = await loadReferenceImage(file);
      const size = getReferenceThumbnailSize(image.naturalWidth, image.naturalHeight);
      canvas.width = size.width;
      canvas.height = size.height;
      context.drawImage(image, 0, 0, size.width, size.height);
    }

    const thumbnailBlob = await canvasToBlob(canvas);
    return thumbnailBlob ? URL.createObjectURL(thumbnailBlob) : URL.createObjectURL(file);
  } catch {
    return URL.createObjectURL(file);
  }
}

function yieldReferenceUploadFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function UnseenBetaMark() {
  return (
    <div className="fixed right-4 top-[calc(var(--mobile-safe-top)+18px)] z-30 flex h-[26px] items-center gap-[8px] md:right-10 md:top-[23px]">
      <p className="inline-flex h-[26px] items-center text-right text-ink leading-none">
        <span className="font-ui text-[18px] font-bold leading-[18px] tracking-[-0.04em]">cenoir</span>
      </p>
      <div className="inline-flex h-[12px] min-w-[28px] items-center justify-center rounded-[2px] bg-ink px-[5px]">
        <span className="font-ui text-[6.5px] font-bold leading-[6.5px] tracking-[-0.08px] text-paper">BETA</span>
      </div>
    </div>
  );
}

export function OnboardingFlow() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const previewRowRef = useRef<HTMLDivElement | null>(null);
  const referencesRef = useRef<ReferenceImage[]>([]);
  const calibrationTimerRef = useRef<number | null>(null);
  const calibrationHoldRef = useRef<number | null>(null);
  const routeTimerRef = useRef<number | null>(null);
  const mobileScrollResetTimersRef = useRef<number[]>([]);
  const referenceActiveReleaseTimerRef = useRef<number | null>(null);

  const [stepIndex, setStepIndex] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordHovered, setIsPasswordHovered] = useState(false);
  const [revealEmail, setRevealEmail] = useState(false);
  const [revealPassword, setRevealPassword] = useState(false);

  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [showAllReferences, setShowAllReferences] = useState(false);
  const [previewItemsPerRow, setPreviewItemsPerRow] = useState(5);
  const [isReferenceUploading, setIsReferenceUploading] = useState(false);
  const [isReferenceTouchActive, setIsReferenceTouchActive] = useState(false);
  const [calibrationLineIndex, setCalibrationLineIndex] = useState(0);
  const [calibrationPercent, setCalibrationPercent] = useState(0);
  const [calibrationSpinTick, setCalibrationSpinTick] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const currentStep = STEP_META[stepIndex]?.key ?? "account";
  const hasName = name.trim().length > 0;
  const hasValidEmail = isValidEmail(email);
  const hasPassword = password.trim().length > 0;
  const canProceed = hasName && hasValidEmail && hasPassword;
  const canCalibrate = references.length >= MIN_REFERENCE_IMAGES;
  const stepProgressPercent = ((stepIndex + 1) / STEP_META.length) * 100;
  const completedDotCount =
    calibrationPercent >= 100 ? CALIBRATION_DOT_COUNT : Math.floor((calibrationPercent / 100) * CALIBRATION_DOT_COUNT);
  const remainingDotCount = Math.max(0, CALIBRATION_DOT_COUNT - completedDotCount);
  const spinningDotIndex =
    remainingDotCount > 0 ? completedDotCount + (calibrationSpinTick % remainingDotCount) : -1;

  useEffect(() => {
    referencesRef.current = references;
  }, [references]);

  useEffect(() => {
    if (!isMobileOnboardingViewport()) return;

    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousRootHeight = root.style.height;
    const previousRootOverscrollBehavior = root.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyHeight = body.style.height;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    const previousBodyPosition = body.style.position;
    const previousBodyInset = body.style.inset;
    const previousBodyWidth = body.style.width;

    root.style.overflow = "hidden";
    root.style.height = "var(--viewport-h)";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.height = "var(--viewport-h)";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.inset = "0";
    body.style.width = "100%";
    resetMobileDocumentScroll({ force: true });

    const handleViewportSettle = () => {
      resetMobileDocumentScroll();
    };

    window.visualViewport?.addEventListener("resize", handleViewportSettle);
    window.visualViewport?.addEventListener("scroll", handleViewportSettle);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportSettle);
      window.visualViewport?.removeEventListener("scroll", handleViewportSettle);
      root.style.overflow = previousRootOverflow;
      root.style.height = previousRootHeight;
      root.style.overscrollBehavior = previousRootOverscrollBehavior;
      body.style.overflow = previousBodyOverflow;
      body.style.height = previousBodyHeight;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      body.style.position = previousBodyPosition;
      body.style.inset = previousBodyInset;
      body.style.width = previousBodyWidth;
    };
  }, []);

  const clearMobileScrollResetTimers = () => {
    mobileScrollResetTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    mobileScrollResetTimersRef.current = [];
  };

  const scheduleMobileStepReset = () => {
    if (!isMobileOnboardingViewport()) return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) activeElement.blur();

    clearMobileScrollResetTimers();
    resetMobileDocumentScroll({ force: true });
    window.requestAnimationFrame(() => resetMobileDocumentScroll({ force: true }));
    [60, 140, 280, 520, 760].forEach((delayMs) => {
      const timerId = window.setTimeout(() => resetMobileDocumentScroll({ force: true }), delayMs);
      mobileScrollResetTimersRef.current.push(timerId);
    });
  };

  useEffect(() => {
    scheduleMobileStepReset();
  }, [currentStep]);

  useEffect(() => {
    return () => {
      referencesRef.current.forEach((entry) => {
        URL.revokeObjectURL(entry.previewUrl);
      });
      if (calibrationTimerRef.current !== null) window.clearTimeout(calibrationTimerRef.current);
      if (calibrationHoldRef.current !== null) window.clearTimeout(calibrationHoldRef.current);
      if (routeTimerRef.current !== null) window.clearTimeout(routeTimerRef.current);
      clearMobileScrollResetTimers();
      if (referenceActiveReleaseTimerRef.current !== null) window.clearTimeout(referenceActiveReleaseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (hasName) setRevealEmail(true);
  }, [hasName]);

  useEffect(() => {
    if (revealEmail && hasValidEmail) setRevealPassword(true);
  }, [hasValidEmail, revealEmail]);

  useEffect(() => {
    if (currentStep !== "account") return;
    const rafId = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== "calibration") return;

    setCalibrationLineIndex(0);
    setCalibrationPercent(0);
    setCalibrationSpinTick(0);
    const totalDurationMs = (CALIBRATION_LINES.length - 1) * 7400 + 2000;
    const startedAt = performance.now();
    let rafId = 0;

    const tickPercent = (now: number) => {
      const elapsed = Math.max(0, now - startedAt);
      const progress = Math.min(100, Math.round((elapsed / totalDurationMs) * 100));
      setCalibrationPercent(progress);
      if (progress < 100) {
        rafId = window.requestAnimationFrame(tickPercent);
      }
    };

    rafId = window.requestAnimationFrame(tickPercent);

    const runLine = (index: number) => {
      if (index >= CALIBRATION_LINES.length - 1) {
        calibrationHoldRef.current = window.setTimeout(() => {
          try {
            window.localStorage.setItem(
              "unseen:onboarding-profile",
              JSON.stringify({
                name: name.trim(),
                email: email.trim(),
                referenceCount: references.length,
                referenceFileNames: references.map((entry) => entry.file.name),
                completedAt: new Date().toISOString(),
              }),
            );
            window.localStorage.setItem("unseen:onboarding-complete", "1");
            window.sessionStorage.setItem(
              GALLERY_ENTRY_ARRIVAL_KEY,
              JSON.stringify({
                source: "onboarding",
                at: new Date().toISOString(),
              }),
            );
            window.sessionStorage.setItem(GALLERY_ARRIVAL_ACTIVE_KEY, "1");
          } catch {
            // Ignore local storage failures.
          }
          router.push("/gallery?entry=signup");
        }, 4200);
        return;
      }

      calibrationTimerRef.current = window.setTimeout(() => {
        setCalibrationLineIndex(index + 1);
        runLine(index + 1);
      }, 7400);
    };

    runLine(0);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (calibrationTimerRef.current !== null) {
        window.clearTimeout(calibrationTimerRef.current);
        calibrationTimerRef.current = null;
      }
      if (calibrationHoldRef.current !== null) {
        window.clearTimeout(calibrationHoldRef.current);
        calibrationHoldRef.current = null;
      }
      if (routeTimerRef.current !== null) {
        window.clearTimeout(routeTimerRef.current);
        routeTimerRef.current = null;
      }
    };
  }, [currentStep, email, name, references, router]);

  useEffect(() => {
    if (currentStep !== "calibration") return;
    const intervalId = window.setInterval(() => {
      setCalibrationSpinTick((current) => current + 1);
    }, 170);
    return () => window.clearInterval(intervalId);
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== "references" || showAllReferences) return;
    const node = previewRowRef.current;
    if (!node) return;

    const tileSize = 120;
    const gapSize = 8;
    const update = () => {
      const width = node.clientWidth;
      const next = Math.max(1, Math.floor((width + gapSize) / (tileSize + gapSize)));
      setPreviewItemsPerRow(next);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [currentStep, showAllReferences, references.length]);

  const appendReferences = async (incomingFiles: File[]) => {
    const imageFiles = incomingFiles.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setError("Please upload image files only.");
      return;
    }

    const initialRemaining = MAX_REFERENCE_IMAGES - referencesRef.current.length;
    if (initialRemaining <= 0) {
      setError(`Reference set is capped at ${MAX_REFERENCE_IMAGES} images.`);
      return;
    }

    const candidateFiles = imageFiles.slice(0, initialRemaining);
    const accepted: ReferenceImage[] = [];

    for (let index = 0; index < candidateFiles.length; index += 1) {
      const file = candidateFiles[index];
      accepted.push({
        id: randomId("ref"),
        file,
        previewUrl: await createReferenceThumbnailUrl(file),
      });

      if ((index + 1) % REFERENCE_THUMBNAIL_BATCH_SIZE === 0) {
        await yieldReferenceUploadFrame();
      }
    }

    setReferences((current) => {
      const remaining = MAX_REFERENCE_IMAGES - current.length;
      if (remaining <= 0) {
        accepted.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
        setError(`Reference set is capped at ${MAX_REFERENCE_IMAGES} images.`);
        return current;
      }

      const nextAccepted = accepted.slice(0, remaining);
      accepted.slice(remaining).forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
      const droppedCount = imageFiles.length - nextAccepted.length;
      setError(
        droppedCount > 0 ? `Added ${nextAccepted.length} images. ${droppedCount} exceeded the 150-image limit.` : null,
      );

      return [...current, ...nextAccepted];
    });
  };

  const removeReference = (id: string) => {
    setReferences((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  };

  const handleRemoveReference = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    removeReference(id);
  };

  const handleIncomingReferences = async (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;
    setIsReferenceUploading(true);
    try {
      await appendReferences(incomingFiles);
    } finally {
      setIsReferenceUploading(false);
    }
  };

  const openReferenceUploadPicker = () => {
    fileInputRef.current?.click();
  };

  const handleMobileReferenceUploadStart = () => {
    if (!isMobileOnboardingViewport()) return;
    setMobileReferenceActive(true);
  };

  const handleMobileReferenceUploadEnd = () => {
    if (!isMobileOnboardingViewport()) return;
    releaseMobileReferenceActive(220);
  };

  const handleReferenceUploadClick = () => {
    setMobileReferenceActive(true);
    openReferenceUploadPicker();
    releaseMobileReferenceActive(260);
  };

  const setMobileReferenceActive = (nextActive: boolean) => {
    if (!isMobileOnboardingViewport()) return;
    if (referenceActiveReleaseTimerRef.current !== null) {
      window.clearTimeout(referenceActiveReleaseTimerRef.current);
      referenceActiveReleaseTimerRef.current = null;
    }
    setIsReferenceTouchActive(nextActive);
  };

  const releaseMobileReferenceActive = (delayMs = 160) => {
    if (!isMobileOnboardingViewport()) return;
    if (referenceActiveReleaseTimerRef.current !== null) {
      window.clearTimeout(referenceActiveReleaseTimerRef.current);
    }
    referenceActiveReleaseTimerRef.current = window.setTimeout(() => {
      setIsReferenceTouchActive(false);
      referenceActiveReleaseTimerRef.current = null;
    }, delayMs);
  };

  const expandAllReferences = () => {
    setShowAllReferences(true);
  };

  const handleMobileExpandReferences = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isMobileOnboardingViewport()) return;
    event.preventDefault();
    event.stopPropagation();
    expandAllReferences();
  };

  const moveToReferences = () => {
    if (!canProceed) {
      setError("Please complete the account fields.");
      return;
    }
    setError(null);
    scheduleMobileStepReset();
    setStepIndex(1);
  };

  const handleMobileProceed = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isMobileOnboardingViewport()) return;
    event.preventDefault();
    event.stopPropagation();
    moveToReferences();
  };

  const handleMobileAccountInputPointerDown = (event: PointerEvent<HTMLInputElement>) => {
    if (!isMobileOnboardingViewport()) return;
    event.currentTarget.focus({ preventScroll: true });
  };

  const moveToCalibration = () => {
    if (!canCalibrate) {
      setError(`Please add at least ${MIN_REFERENCE_IMAGES} reference images.`);
      return;
    }
    setError(null);
    scheduleMobileStepReset();
    setStepIndex(2);
  };

  const handleMobileCalibrate = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isMobileOnboardingViewport()) return;
    event.preventDefault();
    event.stopPropagation();
    moveToCalibration();
  };

  const visibleReferences = showAllReferences ? references : references.slice(0, previewItemsPerRow);
  const mobileCollapsedReferences = references.slice(0, 6);
  const collapsedVisibleCount = Math.min(references.length, previewItemsPerRow);
  const collapsedTrackWidthPx =
    collapsedVisibleCount > 0 ? collapsedVisibleCount * 120 + Math.max(0, collapsedVisibleCount - 1) * 8 : 0;
  const referenceUploadIsActive = isReferenceUploading || isReferenceTouchActive;

  const inputClass =
    "mt-1 block h-[30px] w-full select-text border-0 bg-transparent px-0 text-center font-ui text-[16px] font-normal leading-6 text-ink outline-none placeholder:text-inactive md:text-[13px]";
  const isPasswordMasked = password.trim().length > 0 && !isPasswordHovered;
  const passwordMaskDotCount = Math.min(password.length, 18);
  const maskedPasswordInputClass =
    isPasswordMasked
      ? `${inputClass} text-transparent caret-ink [-webkit-text-fill-color:transparent] md:text-[13px] md:text-ink md:[-webkit-text-fill-color:currentColor]`
      : inputClass;

  const focusEmailField = () => {
    window.requestAnimationFrame(() => {
      emailInputRef.current?.focus();
    });
  };

  const focusPasswordField = () => {
    window.requestAnimationFrame(() => {
      passwordInputRef.current?.focus();
    });
  };

  const handleNameEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!hasName) return;
    setRevealEmail(true);
    focusEmailField();
  };

  const handleEmailEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!hasValidEmail) return;
    setRevealPassword(true);
    focusPasswordField();
  };

  const handlePasswordEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
  };

  return (
    <section className="h-[var(--viewport-h)] overflow-hidden select-none bg-paper font-ui text-ink md:h-auto md:min-h-screen md:overflow-visible">
      <div className="relative mx-auto flex h-full w-full max-w-[1440px] flex-col px-4 pb-[calc(var(--mobile-safe-bottom)+28px)] pt-0 md:block md:h-auto md:px-24 md:py-10 lg:px-28 lg:py-6">
        <UnseenBetaMark />

        <div className="flex min-h-0 flex-1 flex-col pt-[calc(var(--mobile-safe-top)+58px)] md:block md:pt-[92px]">
          <div className="mx-auto flex min-h-0 w-full max-w-[920px] flex-1 flex-col md:block">
            <div className="mx-auto flex min-h-0 w-full max-w-[900px] flex-1 flex-col bg-paper px-0 py-0 md:block md:rounded-[6px] md:px-14 md:py-14 md:shadow-[0_8px_20px_rgba(0,0,0,0.06)]">
              <div className="flex min-h-0 w-full flex-1 flex-col md:block">
                <nav aria-label="Onboarding steps" className="w-full">
                  <div className="relative mx-auto h-[35px] w-full max-w-[318px] overflow-hidden rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] md:h-[33px] md:max-w-[360px]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-[999px] bg-ink transition-[width] duration-300 ease-out"
                      style={{ width: `${stepProgressPercent}%` }}
                    />
                    <ol className="relative z-[1] grid h-full w-full grid-cols-3">
                      {STEP_META.map((step, index) => {
                        const isCompletedOrActive = index <= stepIndex;
                        const isCompleted = index < stepIndex;
                        return (
                          <li key={step.key} className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (isCompleted) {
                                  setError(null);
                                  setStepIndex(index);
                                }
                              }}
                              disabled={!isCompleted}
                              className={`h-full w-full px-3 text-center font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] transition-colors duration-150 focus-visible:outline-none md:text-[13px] ${
                                isCompleted ? "cursor-pointer" : "cursor-default"
                              } ${isCompletedOrActive ? "text-paper" : "text-[#6F7381] md:text-meta"}`}
                            >
                              {step.label}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </nav>

                <div
                  className={`mt-9 min-h-0 w-full flex-1 md:mt-12 md:block md:overflow-visible ${
                    currentStep === "references" && references.length > 0
                      ? "touch-pan-y overflow-y-scroll overscroll-contain pb-[calc(var(--mobile-safe-bottom)+104px)] pr-1 md:pb-0"
                      : "overflow-hidden"
                  }`}
                  style={
                    currentStep === "references" && references.length > 0
                      ? { WebkitOverflowScrolling: "touch" }
                      : undefined
                  }
                >
                <AnimatePresence mode="wait">
                {currentStep === "account" ? (
                  <motion.div
                    key="account"
                    className="flex h-full flex-col items-center md:block md:h-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <div className="mx-auto mt-8 w-full max-w-[280px] md:mt-12 md:max-w-[360px]">
                      <label className="relative block">
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          onPointerDown={handleMobileAccountInputPointerDown}
                          onKeyDown={handleNameEnter}
                          placeholder="First name"
                          className={inputClass}
                        />
                      </label>

                      <AnimatePresence>
                        {revealEmail ? (
                          <motion.label
                            key="email"
                            className="mt-5 block"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                          >
                            <input
                              ref={emailInputRef}
                              type="email"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              onPointerDown={handleMobileAccountInputPointerDown}
                              onKeyDown={handleEmailEnter}
                              placeholder="Email"
                              className={inputClass}
                            />
                          </motion.label>
                        ) : null}
                      </AnimatePresence>

                      <AnimatePresence>
                        {revealPassword ? (
                          <motion.label
                            key="password"
                            className="mt-5 block"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                          >
                            <div
                              className="relative"
                              onMouseEnter={() => setIsPasswordHovered(true)}
                              onMouseLeave={() => setIsPasswordHovered(false)}
                            >
                              <input
                                ref={passwordInputRef}
                                type={password.trim().length > 0 && isPasswordHovered ? "text" : "password"}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                onPointerDown={handleMobileAccountInputPointerDown}
                                onKeyDown={handlePasswordEnter}
                                placeholder="Password"
                                className={maskedPasswordInputClass}
                              />
                              {isPasswordMasked ? (
                                <div
                                  aria-hidden="true"
                                  className="pointer-events-none absolute inset-x-0 top-1 flex h-[30px] items-center justify-center md:hidden"
                                >
                                  <span className="inline-flex max-w-[152px] items-center justify-center gap-[4px] overflow-hidden">
                                    {Array.from({ length: passwordMaskDotCount }).map((_, dotIndex) => (
                                      <span key={dotIndex} className="h-[4px] w-[4px] shrink-0 rounded-full bg-ink" />
                                    ))}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </motion.label>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    {canProceed ? (
                      <div className="mt-9 flex w-full justify-center md:mt-12">
                        <button
                          type="button"
                          onPointerUp={handleMobileProceed}
                          onClick={moveToReferences}
                          className="inline-flex h-[43px] min-w-[96px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-[18px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 active:text-ink focus-visible:outline-none md:h-[33px] md:min-w-0 md:px-4 md:text-[13px] md:text-meta md:hover:text-ink"
                        >
                          proceed
                        </button>
                      </div>
                    ) : null}
                  </motion.div>
                ) : null}

                {currentStep === "references" ? (
                  <motion.div
                    key="references"
                    className="flex h-full min-h-0 flex-col md:block md:h-auto"
                    onPointerDown={() => setMobileReferenceActive(true)}
                    onPointerMove={() => setMobileReferenceActive(true)}
                    onPointerUp={() => releaseMobileReferenceActive()}
                    onPointerCancel={() => releaseMobileReferenceActive()}
                    onPointerLeave={() => releaseMobileReferenceActive()}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        handleIncomingReferences(Array.from(event.target.files ?? []));
                        event.currentTarget.value = "";
                      }}
                    />

                    {references.length === 0 ? (
                      <div
                        className="group mx-auto mt-16 flex w-full max-w-[340px] flex-col items-center gap-7 px-0 py-0 text-center md:mt-16 md:max-w-[640px] md:gap-8 md:px-0 md:pb-10 md:pt-0 md:text-center"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleIncomingReferences(Array.from(event.dataTransfer.files));
                        }}
                      >
                        <button
                          type="button"
                          aria-label="Upload visual references"
                          onClick={handleReferenceUploadClick}
                          onPointerDown={handleMobileReferenceUploadStart}
                          onPointerMove={() => setMobileReferenceActive(true)}
                          onPointerUp={handleMobileReferenceUploadEnd}
                          onPointerCancel={handleMobileReferenceUploadEnd}
                          onPointerLeave={handleMobileReferenceUploadEnd}
                          className="flex min-h-[132px] w-full touch-manipulation flex-col items-center justify-center gap-7 py-2 text-center focus-visible:outline-none md:min-h-0 md:max-w-[420px] md:gap-3 md:py-0 md:text-center"
                        >
                          <span
                            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line/80 bg-paper font-ui text-[18px] leading-none text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 group-hover:border-ink group-hover:bg-ink group-hover:text-paper md:h-9 md:w-9 md:text-meta ${
                              referenceUploadIsActive ? "!border-ink !bg-ink !text-paper" : ""
                            }`}
                          >
                            ↑
                          </span>
                          <span
                            className={`block cursor-pointer font-ui text-[14px] font-normal leading-[1.55] text-meta transition-colors duration-150 group-hover:text-ink md:hidden ${
                              referenceUploadIsActive ? "!text-ink" : ""
                            }`}
                          >
                            Upload visual references that
                            <br />
                            define the aesthetic direction.
                          </span>
                          <span
                            className={`hidden font-ui text-[14px] font-normal leading-[1.7] text-meta transition-colors duration-150 group-hover:text-ink md:block ${
                              referenceUploadIsActive ? "!text-ink" : ""
                            }`}
                          >
                            Upload visual references that define the aesthetic direction.
                          </span>
                        </button>
                        <p className="mt-16 max-w-[318px] text-justify font-ui text-[14px] font-normal leading-[1.7] text-meta md:hidden">
                          Use screenshots, saved images, or Pinterest captures. On the Pinterest app,{" "}
                          <span className="italic">Compact Board View</span> gives the cleanest grid to screenshot.
                          Around 30 to 150 images gives the cleanest read — silhouette, material, finish, and palette
                          are registered across each image.
                        </p>
                        <p className="hidden max-w-[620px] text-justify font-ui text-[14px] font-normal leading-[1.7] text-meta md:block">
                          Use screenshots, saved images, or Pinterest captures. On the Pinterest app,{" "}
                          <span className="italic">Compact Board View</span> gives the cleanest grid to screenshot.
                          Around 30 to 150 images gives the cleanest read — silhouette, material, finish, and palette
                          are registered across each image.
                        </p>
                      </div>
                    ) : (
                      <div
                        className={`mt-10 md:mt-12 ${
                          showAllReferences
                            ? "pb-8 md:pb-0"
                            : ""
                        }`}
                      >
                        {showAllReferences ? (
                          <>
                            <div className="mb-2 flex w-full justify-end">
                              <span className="inline-flex shrink-0 whitespace-nowrap font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                                <span>{references.length} references</span>
                              </span>
                            </div>
                            <div
                              className="grid w-full grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4"
                            >
                            {visibleReferences.map((entry) => (
                              <div key={entry.id} className="group relative aspect-square w-full overflow-hidden rounded-[3px] bg-mist">
                                <Image
                                  src={entry.previewUrl}
                                  alt={entry.file.name}
                                  fill
                                  unoptimized
                                  sizes="120px"
                                  className="pointer-events-none select-none object-cover"
                                  onDragStart={(event) => event.preventDefault()}
                                  draggable={false}
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove ${entry.file.name}`}
                                  onPointerUp={(event) => handleRemoveReference(event, entry.id)}
                                  onClick={() => removeReference(entry.id)}
                                  className="absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-paper/92 font-ui text-[13px] leading-none text-[#6F7381] opacity-100 transition-opacity duration-150 focus-visible:outline-none md:h-5 md:w-5 md:text-[12px] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:text-meta"
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              aria-label="Add visual references"
                              onClick={handleReferenceUploadClick}
                              onPointerDown={handleMobileReferenceUploadStart}
                              onPointerMove={() => setMobileReferenceActive(true)}
                              onPointerUp={handleMobileReferenceUploadEnd}
                              onPointerCancel={handleMobileReferenceUploadEnd}
                              onPointerLeave={handleMobileReferenceUploadEnd}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                handleIncomingReferences(Array.from(event.dataTransfer.files));
                              }}
                              className="group inline-flex aspect-square w-full touch-manipulation flex-col items-center justify-center gap-2 border-0 bg-transparent transition-colors duration-180 focus-visible:outline-none"
                            >
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-line/80 bg-paper font-ui text-[16px] font-medium leading-none text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 group-hover:border-ink group-hover:bg-ink group-hover:text-paper md:text-meta ${
                                  referenceUploadIsActive ? "!border-ink !bg-ink !text-paper" : ""
                                }`}
                              >
                                ↑
                              </span>
                              <span
                                className={`font-ui text-[11px] font-medium leading-4 tracking-[0.02em] text-meta transition-colors duration-150 group-hover:text-ink ${
                                  referenceUploadIsActive ? "!text-ink" : ""
                                }`}
                              >
                                add more
                              </span>
                              {references.length < MIN_REFERENCE_IMAGES ? (
                                <span
                                  className={`font-ui text-[11px] font-medium leading-4 tracking-[0.02em] text-meta transition-colors duration-150 group-hover:text-ink ${
                                    referenceUploadIsActive ? "!text-ink" : ""
                                  }`}
                                >
                                  (upload at least {MIN_REFERENCE_IMAGES} images)
                                </span>
                              ) : null}
                            </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="mx-auto grid w-full max-w-[340px] grid-cols-3 gap-2 md:hidden">
                              {mobileCollapsedReferences.map((entry) => (
                                <div key={entry.id} className="group relative aspect-square w-full overflow-hidden rounded-[3px] bg-mist">
                                  <Image
                                    src={entry.previewUrl}
                                    alt={entry.file.name}
                                    fill
                                    unoptimized
                                    sizes="112px"
                                    className="pointer-events-none select-none object-cover"
                                    onDragStart={(event) => event.preventDefault()}
                                    draggable={false}
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Remove ${entry.file.name}`}
                                    onPointerUp={(event) => handleRemoveReference(event, entry.id)}
                                    onClick={() => removeReference(entry.id)}
                                    className="absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-paper/92 font-ui text-[13px] leading-none text-[#6F7381] opacity-100 transition-opacity duration-150 focus-visible:outline-none md:h-5 md:w-5 md:text-[12px] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div ref={previewRowRef} className="hidden w-full flex-nowrap justify-start gap-2 overflow-hidden md:flex md:max-w-none">
                              {visibleReferences.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="group relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-[3px] bg-mist"
                                >
                                  <Image
                                    src={entry.previewUrl}
                                    alt={entry.file.name}
                                    fill
                                    unoptimized
                                    sizes="120px"
                                    className="pointer-events-none select-none object-cover"
                                    onDragStart={(event) => event.preventDefault()}
                                    draggable={false}
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Remove ${entry.file.name}`}
                                    onPointerUp={(event) => handleRemoveReference(event, entry.id)}
                                    onClick={() => removeReference(entry.id)}
                                    className="absolute right-2 top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-paper/92 font-ui text-[12px] leading-none text-meta opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {references.length > 0 ? (
                      <>
                        <div className={`mx-auto mt-3 flex w-full max-w-[340px] items-center justify-between md:hidden ${showAllReferences ? "hidden" : ""}`}>
                          {!showAllReferences ? (
                            <span className="inline-flex shrink-0 whitespace-nowrap font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                              <span>{references.length} references</span>
                            </span>
                          ) : null}
                          {references.length > 6 && !showAllReferences ? (
                            <button
                              type="button"
                              onPointerUp={handleMobileExpandReferences}
                              onClick={expandAllReferences}
                              className="relative z-[20] inline-flex min-h-[34px] items-center gap-2 border-0 bg-transparent px-2 py-1 font-ui text-[13px] leading-5 tracking-[0.02em] text-meta transition-colors duration-150 active:text-ink focus-visible:outline-none"
                            >
                              view all
                              <span aria-hidden="true">▾</span>
                            </button>
                          ) : null}
                        </div>
                        <div
                          className={`mx-auto mt-2 hidden items-center justify-between md:mx-0 md:flex ${showAllReferences ? "w-full" : ""}`}
                          style={
                            showAllReferences
                              ? undefined
                              : {
                                  width: `${collapsedTrackWidthPx}px`,
                                  maxWidth: "100%",
                                }
                          }
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {!showAllReferences ? (
                              <span className="inline-flex shrink-0 whitespace-nowrap font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                                <span>{references.length} references</span>
                              </span>
                            ) : null}
                          </div>
                          {references.length > previewItemsPerRow && !showAllReferences ? (
                            <button
                              type="button"
                              onClick={expandAllReferences}
                              className="inline-flex items-center gap-2 border-0 bg-transparent p-0 font-ui text-[13px] leading-5 tracking-[0.02em] text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none"
                            >
                              view all
                              <span aria-hidden="true">▾</span>
                            </button>
                          ) : null}
                        </div>
                      </>
                    ) : null}

                    {references.length > 0 ? (
                      <div className="relative z-[2] mt-8 flex justify-center pb-[calc(var(--mobile-safe-bottom)+132px)] md:mt-12 md:pb-0">
                        <button
                          type="button"
                          onPointerUp={handleMobileCalibrate}
                          onClick={moveToCalibration}
                          className="inline-flex h-[35px] min-w-[92px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 active:text-ink focus-visible:outline-none md:h-[33px] md:min-w-0 md:px-4 md:text-[13px] md:text-meta md:hover:text-ink"
                        >
                          calibrate
                        </button>
                      </div>
                    ) : null}

                  </motion.div>
                ) : null}

                {currentStep === "calibration" ? (
                  <motion.div
                    key="calibration"
                    className="flex h-full flex-col items-center justify-center md:block md:h-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <div className="flex min-h-[260px] -translate-y-4 flex-col items-center justify-start gap-12 pt-2 md:mt-24 md:min-h-[240px] md:translate-y-0 md:gap-16 md:pt-3">
                      <div className="relative h-[60px] w-[60px]" aria-hidden="true">
                        {Array.from({ length: CALIBRATION_DOT_COUNT }).map((_, dotIndex) => {
                          const angleDeg = (360 / CALIBRATION_DOT_COUNT) * dotIndex;
                          const dotColor =
                            dotIndex < completedDotCount
                              ? "#111111"
                              : dotIndex === spinningDotIndex
                                ? "#6F7381"
                                : "#D8D8DA";
                          return (
                            <span
                              key={dotIndex}
                              className="absolute left-1/2 top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-150 ease-out"
                              style={{
                                transform: `translate(-50%, -50%) rotate(${angleDeg}deg) translateY(-24px)`,
                                transformOrigin: "center",
                                backgroundColor: dotColor,
                              }}
                            />
                          );
                        })}
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={calibrationLineIndex}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="relative text-center"
                        >
                          <p className="font-ui text-[14px] font-normal leading-6 tracking-[0.01em] text-meta">
                            {CALIBRATION_LINES[calibrationLineIndex]}
                          </p>
                          <motion.p
                            aria-hidden="true"
                            initial={{ clipPath: "inset(0 100% 0 0)" }}
                            animate={{ clipPath: "inset(0 0 0 0)" }}
                            transition={{ duration: 5.2, ease: [0.22, 0.72, 0.22, 1] }}
                            className="pointer-events-none absolute inset-0 font-ui text-[14px] font-normal leading-6 tracking-[0.01em] text-ink"
                          >
                            {CALIBRATION_LINES[calibrationLineIndex]}
                          </motion.p>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : null}
                </AnimatePresence>

                {error ? <p className="mt-6 font-ui text-[13px] leading-6 text-[#B22929]">{error}</p> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
