"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MIN_REFERENCE_IMAGES = 30;
const MAX_REFERENCE_IMAGES = 150;
const GALLERY_ENTRY_ARRIVAL_KEY = "unseen:gallery-entry-arrival";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const PROCESSING_MESSAGES = [
  "Reading visual references for recurring intent and aesthetic direction",
  "Mapping silhouette, material, finish, and visual density",
  "Translating input into an initial personalized signature",
  "Composing the first Edit, Capsule, and surrounding discovery field",
  "Balancing affinity, contrast, and range across the first view",
  "Finalizing the first issue",
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

const STEP_META: StepMeta[] = [
  { key: "invitation", label: "Access" },
  { key: "account", label: "Account" },
  { key: "references", label: "References" },
  { key: "processing", label: "Entry" },
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
        <span className="font-ui text-[14px] font-semibold leading-[26px] tracking-[-0.04em]">seenless</span>
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
  const [error, setError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessageIndex, setProcessingMessageIndex] = useState(0);
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

    const messageTimer = window.setInterval(() => {
      setProcessingMessageIndex((current) => Math.min(current + 1, PROCESSING_MESSAGES.length - 1));
    }, 5000);

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
        window.localStorage.setItem("unseen:show-around-pending", "1");
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
      router.push("/gallery");
    }, durationMs);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(messageTimer);
      window.clearTimeout(completeTimer);
    };
  }, [currentStep, email, isPhoneVerified, name, phone, references, router]);

  const allReferenceItems = useMemo(() => references, [references]);
  const referencePreviewColumns = getReferencePreviewColumns(viewportWidth);

  const actionPillPrimaryClass =
    "inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:font-medium hover:text-ink focus-visible:font-medium focus-visible:text-ink focus-visible:outline-none";
  const actionPillSkipClass =
    "inline-flex h-[33px] items-center justify-center rounded-[999px] border border-[#E8B9B9] bg-[#FCEBEB] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#B22929] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:border-[#B22929] hover:bg-[#B22929] hover:text-paper focus-visible:border-[#B22929] focus-visible:bg-[#B22929] focus-visible:text-paper focus-visible:outline-none";
  const inputClass =
    "h-[34px] w-full border-0 border-b border-line bg-transparent px-0 font-ui text-[14px] font-normal leading-5 text-ink outline-none placeholder:text-inactive focus:border-ink";
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

  const moveToAccount = () => {
    setError(null);
    setStepIndex(1);
  };

  const skipToGalleryForTesting = () => {
    setError(null);
    try {
      window.localStorage.setItem("unseen:onboarding-complete", "1");
      window.localStorage.setItem("unseen:show-around-pending", "1");
      window.localStorage.setItem("unseen:onboarding-skip-testing", "1");
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
    router.push("/gallery");
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
      setError("Please enter your name.");
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
    setProcessingMessageIndex(0);
    setStepIndex(3);
  };

  return (
    <section className="font-ui min-h-screen bg-paper text-ink">
      <div className="relative mx-auto w-full max-w-[1440px] px-10 py-8 sm:px-14 md:px-24 md:py-10 lg:px-28 lg:py-6">
        <UnseenBetaMark />

        <div className="pt-[92px]">
          <nav aria-label="Onboarding steps" className="relative mx-auto w-full max-w-[920px]">
            <div className="pointer-events-none absolute inset-x-0 top-[14px] h-px bg-line" />
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
                      className={`inline-flex h-[29px] items-center justify-center whitespace-nowrap rounded-[999px] border px-[11px] font-ui text-[13px] leading-[18px] tracking-[-0.03em] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 ${
                        isActive
                          ? "border-ink bg-ink text-paper"
                          : isPast
                            ? "cursor-pointer border-line/80 bg-[#F5F5F6] text-ink"
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

          <div className="mx-auto mt-12 w-full max-w-[920px]">
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

                  <div className="mt-7 w-full max-w-[760px]">
                    <div>
                      <p className="font-ui text-[14px] leading-[1.9] tracking-[0.02em] text-meta">
                        Some recommendations may still be resolving, some links may not yet reflect live availability,
                        and certain functions are still in progress. The experience is being refined continuously, and
                        feedback helps shape what evolves next. Thank you for being part of it at this early stage.
                      </p>
                      <p className="mt-6 font-ui text-[13px] leading-[1.8] tracking-[0.02em] text-meta">
                        Best,
                      </p>
                      <p className="mt-4 font-belmonte text-[28px] leading-none italic text-accent">
                        Jil &amp; Nick
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={moveToAccount} className={actionPillPrimaryClass}>
                      enter
                    </button>
                    <button type="button" onClick={skipToGalleryForTesting} className={actionPillSkipClass}>
                      skip
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

                  <div className="mt-8 w-full space-y-5">
                    <label className="grid min-h-[60px] grid-cols-1 items-center gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:gap-6">
                      <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">Name</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Your name"
                        className={inputClass}
                      />
                    </label>

                    <label className="grid min-h-[60px] grid-cols-1 items-center gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:gap-6">
                      <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">Email</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className={inputClass}
                      />
                    </label>

                    <label className="grid min-h-[60px] grid-cols-1 items-center gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:gap-6">
                      <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                        Password
                      </span>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="For email login"
                        className={inputClass}
                      />
                    </label>

                    <label className="grid min-h-[60px] grid-cols-1 items-center gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:gap-6">
                      <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                        Phone <span className="font-normal">(optional)</span>
                      </span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(event) => handlePhoneChange(event.target.value)}
                        placeholder="+41 79 123 45 67"
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <p className="mt-5 font-ui text-[12px] leading-[1.8] tracking-[0.02em] text-meta">
                    Either email or phone number is required. Phone access uses a one-time code.
                  </p>

                  {phone.trim().length > 0 ? (
                    <div className="mt-5 w-full">
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
                        <div className="mt-4 flex flex-wrap items-end gap-3">
                          <label className="min-w-[180px] flex-1">
                            <span className="font-ui text-[11px] font-medium uppercase tracking-[0.08em] text-meta">
                              Verification Code
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={phoneCodeInput}
                              onChange={(event) => setPhoneCodeInput(event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                              placeholder="6-digit code"
                              className={`${inputClass} mt-1`}
                            />
                          </label>
                          <button type="button" onClick={confirmPhoneCode} className={actionPillPrimaryClass}>
                            confirm code
                          </button>
                        </div>
                      ) : null}

                      {isPhoneCodeSent && !isPhoneVerified ? (
                        <p className="mt-3 font-ui text-[11px] leading-5 tracking-[0.02em] text-meta">
                          Beta preview code: {phoneVerificationCode}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setStepIndex(0)} className={actionPillPrimaryClass}>
                      back
                    </button>
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

                  <div className="mt-6 w-full">
                    <p className="font-ui text-[13px] leading-[1.8] tracking-[0.02em] text-meta">
                      Add visual references that define the aesthetic direction. The selection shapes the personalized
                      Signature and forms the foundation of the Main Edit.
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      appendReferences(Array.from(event.target.files ?? []));
                      event.currentTarget.value = "";
                    }}
                  />

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
                      appendReferences(Array.from(event.dataTransfer.files));
                    }}
                    className={`mx-auto mt-8 flex w-fit max-w-[calc(100%-2rem)] flex-col items-center justify-center rounded-full border px-12 py-10 text-center transition-colors duration-150 ${
                      isDragOver ? "border-ink text-ink" : "border-line text-meta"
                    }`}
                  >
                    <span className="font-ui text-[32px] font-normal leading-none">+</span>
                    <span className="mt-2 font-ui text-[14px] font-normal leading-5">Add visual references</span>
                    <span className="mt-1 font-ui text-[12px] font-normal leading-5 text-meta">Screenshots, saved images, or Pinterest board captures.</span>
                  </button>

                  {allReferenceItems.length > 0 ? (
                    <div
                      className="mt-6 grid w-full gap-[6px]"
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
                    </div>
                  ) : null}

                  <p className="mt-5 font-ui text-[12px] leading-5 tracking-[0.02em] text-meta">
                    {references.length} selected · min {MIN_REFERENCE_IMAGES} · max {MAX_REFERENCE_IMAGES}
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setStepIndex(1)} className={actionPillPrimaryClass}>
                      back
                    </button>
                    <button type="button" onClick={moveToProcessing} className={actionPillPrimaryClass}>
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
                    <span className="font-ui font-normal tracking-[-0.06em]">Enter</span>
                    <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">-</span>
                    <span className="ml-[1px] font-ui font-normal tracking-[-0.06em]">seenless</span>
                  </h1>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={processingMessageIndex}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="mt-6 font-ui text-[14px] leading-7 text-meta"
                    >
                      {PROCESSING_MESSAGES[processingMessageIndex]}
                    </motion.p>
                  </AnimatePresence>

                  <div className="mt-8 w-full overflow-hidden rounded-full border border-line bg-paper p-[2px]">
                    <motion.div
                      className="h-[8px] rounded-full bg-ink"
                      animate={{ width: `${processingProgress}%` }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      style={{ width: `${processingProgress}%` }}
                    />
                  </div>

                  <p className="mt-2 text-right font-ui text-[12px] font-medium leading-5 tracking-[0.03em] text-meta">
                    {processingProgress}%
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {error ? (
              <p className="mt-6 font-ui text-[13px] leading-6 text-[#B22929]">{error}</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
