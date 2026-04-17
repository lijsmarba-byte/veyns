"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalibrationLayout } from "@/components/unseen/CalibrationLayout";
import { ReferenceUploadDropzone } from "@/components/unseen/ReferenceUploadDropzone";

const MIN_REFERENCE_IMAGES = 30;
const MAX_REFERENCE_IMAGES = 150;
const GALLERY_ENTRY_ARRIVAL_KEY = "unseen:gallery-entry-arrival";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const PROCESSING_MESSAGES = [
  "Reading references.",
  "Mapping silhouette, material, finish.",
  "Distilling palette and proportion.",
  "Resolving the Signature.",
  "Composing the Main Edit.",
  "Placing Issue 01.",
] as const;

const DEFAULT_MAIN_EDIT_NAME = "mainEdit";
const DEFAULT_MAIN_CAPSULE_NAME = "mainCapsule";

type OnboardingStep = "invitation" | "account" | "references" | "processing";

type StepMeta = {
  key: OnboardingStep;
  label: string;
};

type ReferenceImage = {
  id: string;
  file: File;
  previewUrl: string;
};

function getProcessingMessageIndex(progress: number): number {
  if (progress < 16) return 0;
  if (progress < 33) return 1;
  if (progress < 50) return 2;
  if (progress < 66) return 3;
  if (progress < 83) return 4;
  return 5;
}

const STEP_META: StepMeta[] = [
  { key: "invitation", label: "Access" },
  { key: "account", label: "Account" },
  { key: "references", label: "References" },
  { key: "processing", label: "Entry" },
];

const CALIBRATION_SPACING = {
  A: "mt-12",
  B: "mt-7",
  C: "mt-8",
  D: "mt-5",
  E: "mt-8",
} as const;

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string): boolean {
  const compact = value.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(compact);
}

function getReferencePreviewColumns(viewportWidth: number): number {
  if (viewportWidth >= 1900) return 8;
  if (viewportWidth >= 1600) return 7;
  if (viewportWidth >= 1300) return 6;
  if (viewportWidth >= 1050) return 5;
  return 4;
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

export function OnboardingFlow() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const referencesRef = useRef<ReferenceImage[]>([]);
  const uploadPulseTimeoutRef = useRef<number | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCodeInput, setPhoneCodeInput] = useState("");
  const [phoneVerificationCode, setPhoneVerificationCode] = useState("");
  const [isPhoneCodeSent, setIsPhoneCodeSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isReferenceUploading, setIsReferenceUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1440));

  const currentStep = STEP_META[stepIndex]?.key ?? "invitation";

  useEffect(() => {
    referencesRef.current = references;
  }, [references]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      referencesRef.current.forEach((entry) => {
        URL.revokeObjectURL(entry.previewUrl);
      });
      if (uploadPulseTimeoutRef.current !== null) {
        window.clearTimeout(uploadPulseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentStep !== "processing") return;

    const startedAt = performance.now();
    const durationMs = 30000;
    let rafId = 0;

    const tick = (now: number) => {
      const raw = Math.min((now - startedAt) / durationMs, 1);
      const eased = 1 - Math.pow(1 - raw, 3);
      setProcessingProgress(Math.round(eased * 100));
      if (raw < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    const completeTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          "unseen:onboarding-profile",
          JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            phoneVerified: phone.trim().length > 0 ? isPhoneVerified : false,
            mainEditName: DEFAULT_MAIN_EDIT_NAME,
            mainCapsuleName: DEFAULT_MAIN_CAPSULE_NAME,
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
    }, durationMs);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(completeTimer);
    };
  }, [currentStep, email, isPhoneVerified, name, phone, references, router]);

  const allReferenceItems = useMemo(() => references, [references]);
  const referencePreviewColumns = getReferencePreviewColumns(viewportWidth);
  const processingMessageIndex = getProcessingMessageIndex(processingProgress);

  const actionPillPrimaryClass =
    "inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:font-medium hover:text-ink focus-visible:font-medium focus-visible:text-ink focus-visible:outline-none";
  const actionPillStandardInkClass =
    "inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:font-medium focus-visible:font-medium focus-visible:outline-none";
  const inputClass =
    "h-[34px] w-full border-0 bg-transparent px-0 font-ui text-[14px] font-normal leading-5 text-ink outline-none placeholder:text-inactive";
  const onboardingTitleClass = "inline-flex items-end text-[30px] leading-none text-ink";

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
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((entry) => entry.id !== id);
    });
  };

  const pulseReferenceUploading = () => {
    setIsReferenceUploading(true);
    if (uploadPulseTimeoutRef.current !== null) {
      window.clearTimeout(uploadPulseTimeoutRef.current);
    }
    uploadPulseTimeoutRef.current = window.setTimeout(() => {
      setIsReferenceUploading(false);
      uploadPulseTimeoutRef.current = null;
    }, 280);
  };

  const handleIncomingReferences = (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;
    pulseReferenceUploading();
    appendReferences(incomingFiles);
  };

  const moveToAccount = () => {
    setError(null);
    setStepIndex(1);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setIsPhoneCodeSent(false);
    setIsPhoneVerified(false);
    setPhoneCodeInput("");
    setPhoneVerificationCode("");
  };

  const sendPhoneCode = () => {
    const trimmedPhone = phone.trim();
    if (!isValidPhone(trimmedPhone)) {
      setError("Please enter a valid phone number.");
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    setPhoneVerificationCode(code);
    setIsPhoneCodeSent(true);
    setIsPhoneVerified(false);
    setPhoneCodeInput("");
    setError(null);
  };

  const confirmPhoneCode = () => {
    if (!isPhoneCodeSent || !phoneVerificationCode) {
      setError("Send a code first.");
      return;
    }
    if (phoneCodeInput.trim() !== phoneVerificationCode) {
      setError("Incorrect code. Please try again.");
      return;
    }
    setIsPhoneVerified(true);
    setError(null);
  };

  const moveToReferences = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (trimmedName.length < 2) {
      setError("Please enter a name.");
      return;
    }

    const hasEmail = trimmedEmail.length > 0;
    const hasPhone = trimmedPhone.length > 0;

    if (!hasEmail && !hasPhone) {
      setError("Enter either email or phone number.");
      return;
    }

    if (hasEmail && !isValidEmail(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (hasEmail && password.trim().length < 8) {
      setError("Password should be at least 8 characters for email login.");
      return;
    }

    if (hasPhone && !isValidPhone(trimmedPhone)) {
      setError("Please enter a valid phone number.");
      return;
    }

    if (hasPhone && !isPhoneVerified) {
      setError("Confirm phone number with code to continue.");
      return;
    }

    setError(null);
    setStepIndex(2);
  };

  const moveToProcessing = () => {
    if (references.length < MIN_REFERENCE_IMAGES) {
      setError(`Please add at least ${MIN_REFERENCE_IMAGES} reference images.`);
      return;
    }
    setError(null);
    setProcessingProgress(0);
    setStepIndex(3);
  };

  return (
    <section className="font-ui min-h-screen bg-paper text-ink">
      <div className="relative mx-auto w-full max-w-[1440px] px-10 py-8 sm:px-14 md:px-24 md:py-10 lg:px-28 lg:py-6">
        <UnseenBetaMark />

        <div className="pt-[92px]">
          <nav aria-label="Onboarding steps" className="relative mx-auto w-full max-w-[920px]">
            <ol className="relative flex items-center justify-between gap-2">
              {STEP_META.map((step, index) => {
                const isActive = index === stepIndex;
                const isPast = index < stepIndex;
                return (
                  <li key={step.key}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isPast) {
                          setError(null);
                          setStepIndex(index);
                        }
                      }}
                      disabled={!isPast}
                      className={`inline-flex h-[29px] items-center justify-center whitespace-nowrap rounded-[999px] border px-[11px] font-ui text-[13px] font-normal leading-[18px] tracking-[-0.03em] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 ${
                        isActive
                          ? "border-ink bg-ink text-paper"
                          : isPast
                            ? "cursor-pointer border-line/80 bg-[#F5F5F6] text-ink hover:font-medium focus-visible:font-medium"
                            : "cursor-default border-line/80 bg-paper text-inactive"
                      }`}
                    >
                      {step.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="mx-auto w-full max-w-[920px]">
            <CalibrationLayout className={CALIBRATION_SPACING.A}>
              <AnimatePresence mode="wait">
              {currentStep === "invitation" ? (
                <motion.div
                  key="invitation"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <h1 className={onboardingTitleClass}>
                    <span className="font-ui font-normal tracking-[-0.06em]">Private</span>
                    <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">-</span>
                    <span className="ml-[1px] font-instrument italic tracking-[0.01em]">Beta</span>
                  </h1>

                  <div className={`${CALIBRATION_SPACING.B} w-full`}>
                    <div>
                      <p className="text-left font-ui text-[14px] leading-[1.9] tracking-[0.02em] text-ink">
                        Some recommendations may still be resolving. Certain links or functions remain in progress.
                        Feedback shapes what comes next. Thank you for being here this early.
                      </p>
                      <p className="mt-6 text-left font-ui text-[13px] leading-[1.8] tracking-[0.02em] text-ink">
                        Best,
                      </p>
                      <p className="mt-4 font-belmonte text-[28px] leading-none italic text-accent">
                        Jil &amp; Nick
                      </p>
                    </div>
                  </div>

                  <div className={`${CALIBRATION_SPACING.E} flex flex-wrap items-center justify-start gap-3`}>
                    <button type="button" onClick={moveToAccount} className={actionPillStandardInkClass}>
                      enter
                    </button>
                  </div>
                </motion.div>
              ) : null}

              {currentStep === "account" ? (
                <motion.div
                  key="account"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <h1 className={onboardingTitleClass}>
                    <span className="font-ui font-normal tracking-[-0.06em]">Account</span>
                    <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">-</span>
                    <span className="ml-[1px] font-instrument italic tracking-[0.01em]">Details</span>
                  </h1>

                  <div className={`${CALIBRATION_SPACING.C} w-full space-y-11`}>
                    <label className="block">
                      <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">Name</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Name"
                        className={`${inputClass} mt-2`}
                      />
                    </label>

                    <label className="block">
                      <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">Email</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className={`${inputClass} mt-2`}
                      />
                    </label>

                    <label className="block">
                      <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                        Password
                      </span>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="For email login"
                        className={`${inputClass} mt-2`}
                      />
                    </label>

                    <label className="block">
                      <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                        Phone <span className="font-normal">(optional)</span>
                      </span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(event) => handlePhoneChange(event.target.value)}
                        placeholder="+41 79 123 45 67"
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                  </div>

                  <p className={`${CALIBRATION_SPACING.D} font-ui text-[12px] leading-[1.8] tracking-[0.02em] text-meta`}>
                    Email or phone required. Phone access uses a one-time code.
                  </p>

                  {phone.trim().length > 0 ? (
                    <div className={`${CALIBRATION_SPACING.D} w-full`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={sendPhoneCode} className={actionPillPrimaryClass}>
                          {isPhoneCodeSent ? "resend code" : "send code"}
                        </button>
                        {isPhoneVerified ? (
                          <span className="font-ui text-[12px] font-medium leading-5 tracking-[0.02em] text-meta">
                            phone confirmed
                          </span>
                        ) : null}
                      </div>

                      {isPhoneCodeSent && !isPhoneVerified ? (
                        <div className="mt-4 w-full">
                          <label className="block">
                            <span className="font-ui text-[11px] font-medium uppercase tracking-[0.08em] text-meta">
                              Verification Code
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={phoneCodeInput}
                              onChange={(event) => setPhoneCodeInput(event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                              placeholder="6-digit code"
                              className={`${inputClass} mt-2`}
                            />
                          </label>
                          <div className="mt-4 flex items-center justify-start">
                            <button type="button" onClick={confirmPhoneCode} className={actionPillPrimaryClass}>
                              confirm code
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {isPhoneCodeSent && !isPhoneVerified ? (
                        <p className="mt-3 font-ui text-[11px] leading-5 tracking-[0.02em] text-meta">
                          Beta preview code: {phoneVerificationCode}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className={`${CALIBRATION_SPACING.E} flex flex-wrap items-center justify-start gap-3`}>
                    <button type="button" onClick={moveToReferences} className={actionPillPrimaryClass}>
                      proceed
                    </button>
                  </div>
                </motion.div>
              ) : null}

              {currentStep === "references" ? (
                <motion.div
                  key="references"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <h1 className={onboardingTitleClass}>
                    <span className="font-ui font-normal tracking-[-0.06em]">Reference</span>
                    <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">-</span>
                    <span className="ml-[1px] font-instrument italic tracking-[0.01em]">Sets</span>
                  </h1>

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

                  {allReferenceItems.length === 0 ? (
                    <>
                      <div className={`${CALIBRATION_SPACING.B} w-full`}>
                        <p className="font-ui text-[13px] leading-[1.8] tracking-[0.02em] text-meta">
                          Add visual references that define the aesthetic direction. The selection shapes the
                          Signature and anchors the Main Edit.
                        </p>
                      </div>

                      <ReferenceUploadDropzone
                        register="accent"
                        align="left"
                        isUploading={isReferenceUploading}
                        onClick={() => fileInputRef.current?.click()}
                        onFilesDrop={handleIncomingReferences}
                        className={CALIBRATION_SPACING.C}
                      />
                    </>
                  ) : (
                    <div
                      className={`${CALIBRATION_SPACING.C} grid w-full gap-[6px]`}
                      style={{ gridTemplateColumns: `repeat(${referencePreviewColumns}, minmax(0, 1fr))` }}
                    >
                      {allReferenceItems.map((entry) => (
                        <div key={entry.id} className="group relative aspect-square w-full overflow-hidden rounded-[4px]">
                          <Image
                            src={entry.previewUrl}
                            alt={entry.file.name}
                            fill
                            unoptimized
                            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 16vw"
                            className="object-cover"
                            draggable={false}
                          />
                          <button
                            type="button"
                            aria-label={`Remove ${entry.file.name}`}
                            onClick={() => removeReference(entry.id)}
                            className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/45 font-ui text-[12px] leading-none text-paper opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setIsDragOver(true);
                        }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={(event) => {
                          event.preventDefault();
                          setIsDragOver(false);
                          handleIncomingReferences(Array.from(event.dataTransfer.files));
                        }}
                        className={`flex aspect-square w-full items-center justify-center bg-mist font-ui text-[32px] font-normal leading-none text-meta transition-colors duration-150 hover:text-ink ${
                          isDragOver ? "text-accent" : ""
                        }`}
                        aria-label="Add visual references"
                      >
                        +
                      </button>
                    </div>
                  )}

                  <p className={`${CALIBRATION_SPACING.D} font-ui text-[12px] leading-5 tracking-[0.02em] text-meta`}>
                    {references.length} selected · min {MIN_REFERENCE_IMAGES} · max {MAX_REFERENCE_IMAGES}
                  </p>

                  <div className={`${CALIBRATION_SPACING.E} flex flex-wrap items-center justify-start gap-3`}>
                    <button type="button" onClick={moveToProcessing} className={actionPillStandardInkClass}>
                      calibrate
                    </button>
                  </div>
                </motion.div>
              ) : null}

              {currentStep === "processing" ? (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="w-full"
                >
                  <h1 className={onboardingTitleClass}>
                    <span className="font-ui font-normal tracking-[-0.06em]">Entering</span>
                    <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">–</span>
                    <span className="ml-[1px] font-instrument italic tracking-[0.01em]">Cenoir</span>
                  </h1>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={processingMessageIndex}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className={`${CALIBRATION_SPACING.B} font-ui text-[14px] leading-7 text-meta`}
                    >
                      {PROCESSING_MESSAGES[processingMessageIndex]}
                    </motion.p>
                  </AnimatePresence>

                  <div className={`${CALIBRATION_SPACING.C} h-px w-full overflow-hidden`}>
                    <motion.div
                      className="h-px w-full bg-ink"
                      animate={{ scaleX: processingProgress / 100 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      style={{ transformOrigin: "left" }}
                    />
                  </div>
                </motion.div>
              ) : null}
              </AnimatePresence>

              {error ? (
                <p className="mt-6 font-ui text-[13px] leading-6 text-[#B22929]">{error}</p>
              ) : null}
            </CalibrationLayout>
          </div>
        </div>
      </div>
    </section>
  );
}
