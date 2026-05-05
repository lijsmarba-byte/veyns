"use client";

import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, PointerEvent, useEffect, useRef, useState } from "react";

const GALLERY_ENTRY_ARRIVAL_KEY = "unseen:gallery-entry-arrival";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const DEMO_LOGIN_PASSWORD = "sunnysunny123";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isMobileLoginViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
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

function ActionPill({
  label,
  onClick,
  type = "button",
}: {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex h-[35px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:outline-none md:h-[33px] md:px-4 md:text-[13px]"
    >
      {label}
    </button>
  );
}

export function LoginFlow() {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordHovered, setIsPasswordHovered] = useState(false);
  const [revealPassword, setRevealPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasValidEmail = isValidEmail(email);
  const hasPassword = password.trim().length > 0;
  const canEnter = hasValidEmail && hasPassword;

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      emailInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (hasValidEmail) {
      setRevealPassword(true);
    }
  }, [hasValidEmail]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!trimmedPassword) {
      setError("Please enter the password.");
      return;
    }

    if (trimmedPassword !== DEMO_LOGIN_PASSWORD) {
      setError("Incorrect password. Please try again.");
      setShowForgotPassword(true);
      return;
    }

    try {
      window.localStorage.setItem(
        "unseen:last-login",
        JSON.stringify({
          method: "email",
          identifier: trimmedEmail,
          at: new Date().toISOString(),
        }),
      );
      window.sessionStorage.setItem(
        GALLERY_ENTRY_ARRIVAL_KEY,
        JSON.stringify({
          source: "login",
          at: new Date().toISOString(),
        }),
      );
      window.sessionStorage.setItem(GALLERY_ARRIVAL_ACTIVE_KEY, "1");
    } catch {
      // Ignore storage failures in beta flow.
    }

    setError(null);
    setShowForgotPassword(false);
    router.push("/gallery");
  };

  const handleForgotPassword = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setError("Enter a valid email first.");
      return;
    }
    setShowForgotPassword(false);
    setError("Password reset is in progress. Please check your email.");
  };

  const inputClass =
    "mt-1 block h-[30px] w-full select-text border-0 bg-transparent px-0 text-center font-ui text-[16px] font-normal leading-6 text-ink outline-none placeholder:text-inactive md:text-[13px]";
  const isPasswordMasked = password.trim().length > 0 && !isPasswordHovered;
  const passwordMaskDotCount = Math.min(password.length, 18);
  const maskedPasswordInputClass =
    isPasswordMasked
      ? `${inputClass} text-transparent caret-ink [-webkit-text-fill-color:transparent] md:text-[13px] md:text-ink md:[-webkit-text-fill-color:currentColor]`
      : inputClass;

  const focusPasswordField = () => {
    window.requestAnimationFrame(() => {
      passwordInputRef.current?.focus();
    });
  };

  const handleMobileLoginInputPointerDown = (event: PointerEvent<HTMLInputElement>) => {
    if (!isMobileLoginViewport()) return;
    event.currentTarget.focus({ preventScroll: true });
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
    <section className="font-ui min-h-[var(--viewport-h)] bg-paper text-ink">
      <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-[calc(var(--mobile-safe-bottom)+28px)] pt-0 md:px-24 md:py-10 lg:px-28 lg:py-6">
        <UnseenBetaMark />

        <div className="pt-[calc(var(--mobile-safe-top)+58px)] md:pt-[92px]">
          <div className="mx-auto w-full max-w-[920px]">
            <div className="mx-auto w-full max-w-[460px] bg-paper px-0 py-0 md:rounded-[6px] md:px-10 md:py-10 md:shadow-[0_8px_20px_rgba(0,0,0,0.06)]">
              <div className="w-full">
                <nav aria-label="Login" className="flex w-full justify-center">
                  <div className="inline-flex h-[35px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-ink bg-ink px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-paper shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] md:h-[33px] md:px-3 md:text-[13px]">
                    Login
                  </div>
                </nav>

                <form onSubmit={handleSubmit} className="mt-9 w-full md:mt-12">
                  <div className="mx-auto mt-8 w-full max-w-[260px] md:mt-12 md:max-w-[220px]">
                    <label className="relative block">
                      <input
                        ref={emailInputRef}
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        onPointerDown={handleMobileLoginInputPointerDown}
                        onKeyDown={handleEmailEnter}
                        placeholder="Email"
                        className={inputClass}
                      />
                    </label>

                    {revealPassword ? (
                      <label className="mt-5 block">
                        <div
                          className="relative"
                          onMouseEnter={() => setIsPasswordHovered(true)}
                          onMouseLeave={() => setIsPasswordHovered(false)}
                        >
                          <input
                            ref={passwordInputRef}
                            type={password.trim().length > 0 && isPasswordHovered ? "text" : "password"}
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            onPointerDown={handleMobileLoginInputPointerDown}
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
                      </label>
                    ) : null}
                  </div>

                  {error || showForgotPassword ? (
                    <div className="mx-auto mt-6 w-full max-w-[260px] text-left md:max-w-[220px]">
                      {error ? <p className="font-ui text-[13px] leading-6 text-[#B22929]">{error}</p> : null}
                      {showForgotPassword ? (
                        <div className="mt-1 flex justify-start">
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="font-ui text-[13px] leading-5 tracking-[0.02em] text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none"
                          >
                            Forgot password?
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {canEnter ? (
                    <div className="mt-10 flex justify-center md:mt-12">
                      <ActionPill type="submit" label="enter" />
                    </div>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
