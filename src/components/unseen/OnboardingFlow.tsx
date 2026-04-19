"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MIN_REFERENCE_IMAGES = 30;
const MAX_REFERENCE_IMAGES = 150;
const GALLERY_ENTRY_ARRIVAL_KEY = "unseen:gallery-entry-arrival";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const CALIBRATION_DOT_COUNT = 8;

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

function UnseenBetaMark() {
  return (
    <div className="fixed right-10 top-[23px] z-30 h-[26px] w-[161px]">
      <p className="absolute left-0 top-0 w-[94px] text-right text-ink leading-none">
        <span className="font-ui text-[18px] font-semibold leading-[26px] tracking-[-0.04em]">cenoir</span>
      </p>
      <div className="absolute left-[100px] top-[7px] flex h-3 items-center justify-center rounded-[2px] bg-ink px-1 py-[3px]">
        <span className="font-ui text-[7px] font-bold leading-[7px] tracking-[-0.14px] text-paper">BETA</span>
      </div>
    </div>
  );
}

function ActionPill({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-meta shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:outline-none"
    >
      {label}
    </button>
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
    return () => {
      referencesRef.current.forEach((entry) => {
        URL.revokeObjectURL(entry.previewUrl);
      });
      if (calibrationTimerRef.current !== null) window.clearTimeout(calibrationTimerRef.current);
      if (calibrationHoldRef.current !== null) window.clearTimeout(calibrationHoldRef.current);
      if (routeTimerRef.current !== null) window.clearTimeout(routeTimerRef.current);
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

  const appendReferences = (incomingFiles: File[]) => {
    const imageFiles = incomingFiles.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setError("Please upload image files only.");
      return;
    }

    setReferences((current) => {
      const remaining = MAX_REFERENCE_IMAGES - current.length;
      if (remaining <= 0) {
        setError(`Reference set is capped at ${MAX_REFERENCE_IMAGES} images.`);
        return current;
      }

      const accepted = imageFiles.slice(0, remaining).map((file) => ({
        id: randomId("ref"),
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      const droppedCount = imageFiles.length - accepted.length;
      setError(droppedCount > 0 ? `Added ${accepted.length} images. ${droppedCount} exceeded the 150-image limit.` : null);

      return [...current, ...accepted];
    });
  };

  const removeReference = (id: string) => {
    setReferences((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  };

  const pulseReferenceUploading = () => {
    setIsReferenceUploading(true);
    window.setTimeout(() => {
      setIsReferenceUploading(false);
    }, 220);
  };

  const handleIncomingReferences = (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;
    pulseReferenceUploading();
    appendReferences(incomingFiles);
  };

  const moveToReferences = () => {
    if (!canProceed) {
      setError("Please complete the account fields.");
      return;
    }
    setError(null);
    setStepIndex(1);
  };

  const moveToCalibration = () => {
    if (!canCalibrate) {
      setError(`Please add at least ${MIN_REFERENCE_IMAGES} reference images.`);
      return;
    }
    setError(null);
    setStepIndex(2);
  };

  const visibleReferences = showAllReferences ? references : references.slice(0, previewItemsPerRow);
  const collapsedVisibleCount = Math.min(references.length, previewItemsPerRow);
  const collapsedTrackWidthPx =
    collapsedVisibleCount > 0 ? collapsedVisibleCount * 120 + Math.max(0, collapsedVisibleCount - 1) * 8 : 0;

  const inputClass =
    "mt-1 block h-[30px] w-full select-text border-0 bg-transparent px-0 text-center font-ui text-[13px] font-normal leading-6 text-ink outline-none placeholder:text-inactive";

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
    <section className="select-none font-ui min-h-screen bg-paper text-ink">
      <div className="relative mx-auto w-full max-w-[1440px] px-10 py-8 sm:px-14 md:px-24 md:py-10 lg:px-28 lg:py-6">
        <UnseenBetaMark />

        <div className="pt-[92px]">
          <div className="mx-auto w-full max-w-[920px]">
            <div className="mx-auto w-full max-w-[900px] rounded-[6px] bg-paper px-8 py-10 shadow-[0_8px_20px_rgba(0,0,0,0.06)] md:px-14 md:py-14">
              <div className="w-full">
                <nav aria-label="Onboarding steps" className="w-full">
                  <div className="relative mx-auto h-[33px] w-full max-w-[360px] overflow-hidden rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]">
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
                              className={`h-full w-full px-3 text-center font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] transition-colors duration-150 focus-visible:outline-none ${
                                isCompleted ? "cursor-pointer" : "cursor-default"
                              } ${isCompletedOrActive ? "text-paper" : "text-meta"}`}
                            >
                              {step.label}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </nav>

                <div className="mt-12 w-full">
                <AnimatePresence mode="wait">
                {currentStep === "account" ? (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <div className="mx-auto mt-12 w-full max-w-[360px]">
                      <label className="relative block">
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          onKeyDown={handleNameEnter}
                          placeholder="first name"
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
                              onKeyDown={handleEmailEnter}
                              placeholder="email"
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
                                onKeyDown={handlePasswordEnter}
                                placeholder="password"
                                className={inputClass}
                              />
                            </div>
                          </motion.label>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    {canProceed ? (
                      <div className="mt-12 flex justify-center">
                        <ActionPill label="proceed" onClick={moveToReferences} />
                      </div>
                    ) : null}
                  </motion.div>
                ) : null}

                {currentStep === "references" ? (
                  <motion.div
                    key="references"
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
                      className="hidden"
                      onChange={(event) => {
                        handleIncomingReferences(Array.from(event.target.files ?? []));
                        event.currentTarget.value = "";
                      }}
                    />

                    {references.length === 0 ? (
                      <div
                        className="group mt-12 flex w-full items-center gap-6 rounded-[12px] px-4 py-3"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleIncomingReferences(Array.from(event.dataTransfer.files));
                        }}
                      >
                        <button
                          type="button"
                          aria-label="Upload visual references"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line/80 bg-paper shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 group-hover:border-ink group-hover:bg-ink focus-visible:outline-none"
                        >
                          <span className="font-ui text-[18px] leading-none text-meta transition-colors duration-150 group-hover:text-paper">
                            ↑
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-left focus-visible:outline-none"
                        >
                          <p className="font-ui text-[14px] font-normal leading-[1.7] text-meta transition-colors duration-150 group-hover:text-ink">
                            Upload visual references that define the aesthetic direction. Use screenshots, saved
                            images, or Pinterest captures (on the Pinterest app, Compact board view gives the cleanest
                            grid to screenshot). Around 30 to 150 images gives the cleanest read — silhouette,
                            material, finish, and palette are registered across each image.
                          </p>
                        </button>
                      </div>
                    ) : (
                      <div className="mt-12">
                        {showAllReferences ? (
                          <>
                            <div className="mb-2 flex w-full justify-end">
                              <span className="inline-flex shrink-0 whitespace-nowrap font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                                <span aria-hidden="true">|</span>
                                <span className="px-[2px]">{references.length} references</span>
                                <span aria-hidden="true">|</span>
                              </span>
                            </div>
                            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                            {visibleReferences.map((entry) => (
                              <div key={entry.id} className="group relative aspect-square w-full overflow-hidden rounded-[4px] bg-mist">
                                <Image
                                  src={entry.previewUrl}
                                  alt={entry.file.name}
                                  fill
                                  unoptimized
                                  sizes="120px"
                                  className="object-cover"
                                  draggable={false}
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove ${entry.file.name}`}
                                  onClick={() => removeReference(entry.id)}
                                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-paper/92 font-ui text-[12px] leading-none text-meta opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              aria-label="Add visual references"
                              onClick={() => fileInputRef.current?.click()}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                handleIncomingReferences(Array.from(event.dataTransfer.files));
                              }}
                              className="group inline-flex aspect-square w-full flex-col items-center justify-center gap-2 border-0 bg-transparent transition-colors duration-180 focus-visible:outline-none"
                            >
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line/80 bg-paper font-ui text-[16px] font-medium leading-none text-meta shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                                ↑
                              </span>
                              <span className="font-ui text-[11px] font-medium leading-4 tracking-[0.02em] text-meta transition-colors duration-150 group-hover:text-ink">
                                add more
                              </span>
                              {references.length < MIN_REFERENCE_IMAGES ? (
                                <span className="font-ui text-[11px] font-medium leading-4 tracking-[0.02em] text-meta transition-colors duration-150 group-hover:text-ink">
                                  (upload at least {MIN_REFERENCE_IMAGES} images)
                                </span>
                              ) : null}
                            </button>
                            </div>
                          </>
                        ) : (
                          <div ref={previewRowRef} className="flex w-full flex-nowrap justify-start gap-2 overflow-hidden">
                            {visibleReferences.map((entry) => (
                              <div
                                key={entry.id}
                                className="group relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-[4px] bg-mist"
                              >
                                <Image
                                  src={entry.previewUrl}
                                  alt={entry.file.name}
                                  fill
                                  unoptimized
                                  sizes="120px"
                                  className="object-cover"
                                  draggable={false}
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove ${entry.file.name}`}
                                  onClick={() => removeReference(entry.id)}
                                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-paper/92 font-ui text-[12px] leading-none text-meta opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {references.length > 0 ? (
                      <div
                        className={`mt-2 flex items-center justify-between ${showAllReferences ? "w-full" : ""}`}
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
                              <span aria-hidden="true">|</span>
                              <span className="px-[2px]">{references.length} references</span>
                              <span aria-hidden="true">|</span>
                            </span>
                          ) : null}
                        </div>
                        {references.length > previewItemsPerRow && !showAllReferences ? (
                          <button
                            type="button"
                            onClick={() => setShowAllReferences(true)}
                            className="inline-flex items-center gap-2 border-0 bg-transparent p-0 font-ui text-[13px] leading-5 tracking-[0.02em] text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none"
                          >
                            view all
                            <span aria-hidden="true">▾</span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {canCalibrate ? (
                      <div className="mt-12 flex justify-center">
                        <ActionPill label="calibrate" onClick={moveToCalibration} />
                      </div>
                    ) : null}

                  </motion.div>
                ) : null}

                {currentStep === "calibration" ? (
                  <motion.div
                    key="calibration"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <div className="mt-20 flex min-h-[240px] flex-col items-center justify-start gap-14 pt-3">
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
