"use client";

import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

const GALLERY_ENTRY_ARRIVAL_KEY = "unseen:gallery-entry-arrival";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const DEMO_LOGIN_PASSWORD = "sunnysunny123";

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
      className="inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-meta shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:outline-none"
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
    "mt-1 block h-[30px] w-full select-text border-0 bg-transparent px-0 text-center font-ui text-[13px] font-normal leading-6 text-ink outline-none placeholder:text-inactive";

  const focusPasswordField = () => {
    window.requestAnimationFrame(() => {
      passwordInputRef.current?.focus();
    });
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
    <section className="font-ui min-h-screen bg-paper text-ink">
      <div className="relative mx-auto w-full max-w-[1440px] px-10 py-8 sm:px-14 md:px-24 md:py-10 lg:px-28 lg:py-6">
        <UnseenBetaMark />

        <div className="pt-[92px]">
          <div className="mx-auto w-full max-w-[920px]">
            <div className="mx-auto w-full max-w-[460px] rounded-[6px] bg-paper px-6 py-8 shadow-[0_8px_20px_rgba(0,0,0,0.06)] md:px-10 md:py-10">
              <div className="w-full">
                <nav aria-label="Login" className="flex w-full justify-center">
                  <div className="inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-ink bg-ink px-3 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-paper shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]">
                    log in
                  </div>
                </nav>

                <form onSubmit={handleSubmit} className="mt-12 w-full">
                  <div className="mx-auto mt-12 w-full max-w-[220px]">
                    <label className="relative block">
                      <input
                        ref={emailInputRef}
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        onKeyDown={handleEmailEnter}
                        placeholder="email"
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
                            onKeyDown={handlePasswordEnter}
                            placeholder="password"
                            className={inputClass}
                          />
                        </div>
                      </label>
                    ) : null}
                  </div>

                  {error || showForgotPassword ? (
                    <div className="mx-auto mt-6 w-full max-w-[220px] text-left">
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
                    <div className="mt-12 flex justify-center">
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
