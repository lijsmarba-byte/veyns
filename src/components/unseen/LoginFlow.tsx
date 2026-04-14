"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const GALLERY_ENTRY_ARRIVAL_KEY = "unseen:gallery-entry-arrival";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string): boolean {
  const compact = value.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(compact);
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

export function LoginFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const methodParam = searchParams.get("method");
  const [loginMethod, setLoginMethod] = useState<"email" | "phone" | null>(null);
  const [isMethodChooserOpen, setIsMethodChooserOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [phoneCodeInput, setPhoneCodeInput] = useState("");
  const [phoneVerificationCode, setPhoneVerificationCode] = useState("");
  const [isPhoneCodeSent, setIsPhoneCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionPillPrimaryClass =
    "inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:font-medium hover:text-ink focus-visible:font-medium focus-visible:text-ink focus-visible:outline-none";
  const inputClass =
    "h-[34px] w-full border-0 border-b border-line bg-transparent px-0 font-ui text-[14px] font-normal leading-5 text-ink outline-none placeholder:text-inactive focus:border-ink";

  useEffect(() => {
    if (methodParam === "email" || methodParam === "phone") {
      const timer = window.setTimeout(() => {
        setLoginMethod(methodParam);
        setIsMethodChooserOpen(false);
        setError(null);
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [methodParam]);

  const openMethodChooser = () => {
    setIsMethodChooserOpen(true);
    setError(null);
  };

  const selectMethod = (nextMethod: "email" | "phone") => {
    setLoginMethod(nextMethod);
    setIsMethodChooserOpen(false);
    setError(null);
  };

  const resetMethodChoice = () => {
    setLoginMethod(null);
    setIsMethodChooserOpen(true);
    setEmail("");
    setPhone("");
    setPassword("");
    setPhoneCodeInput("");
    setPhoneVerificationCode("");
    setIsPhoneCodeSent(false);
    setError(null);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setIsPhoneCodeSent(false);
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
    setPhoneCodeInput("");
    setError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPassword = password.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!loginMethod) {
      setError("Choose email or phone first.");
      return;
    }

    if (loginMethod === "email") {
      if (!trimmedEmail) {
        setError("Enter your email address.");
        return;
      }

      if (!isValidEmail(trimmedEmail)) {
        setError("Please enter a valid email address.");
        return;
      }

      if (trimmedPassword.length < 8) {
        setError("Password should be at least 8 characters.");
        return;
      }
    }

    if (loginMethod === "phone") {
      if (!trimmedPhone) {
        setError("Enter your phone number.");
        return;
      }

      if (!isValidPhone(trimmedPhone)) {
        setError("Please enter a valid phone number.");
        return;
      }

      if (!isPhoneCodeSent || !phoneVerificationCode) {
        setError("Send a code first.");
        return;
      }

      if (phoneCodeInput.trim() !== phoneVerificationCode) {
        setError("Incorrect code. Please try again.");
        return;
      }
    }

    try {
      window.localStorage.setItem(
        "unseen:last-login",
        JSON.stringify({
          method: loginMethod,
          identifier: loginMethod === "email" ? trimmedEmail : trimmedPhone,
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
    router.push("/gallery");
  };

  return (
    <section className="font-ui min-h-screen bg-paper text-ink">
      <div className="relative mx-auto w-full max-w-[1440px] px-10 py-8 sm:px-14 md:px-24 md:py-10 lg:px-28 lg:py-6">
        <UnseenBetaMark />

        <div className="pt-[92px]">
          <div className="mx-auto w-full max-w-[620px]">
            <h1 className="inline-flex items-end text-[30px] leading-none text-ink">
              <span className="font-ui font-normal tracking-[-0.06em]">Log</span>
              <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">-</span>
              <span className="ml-[1px] font-instrument italic tracking-[0.01em]">In</span>
            </h1>

            <p className="mt-6 font-ui text-[13px] leading-[1.8] tracking-[0.02em] text-meta">
              Use your existing account details to enter your space.
            </p>

            <form id="login-form" onSubmit={handleSubmit} className="mt-8 w-full space-y-5">
              {loginMethod === "email" ? (
                <>
                  <label className="grid min-h-[60px] grid-cols-1 items-center gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:gap-6">
                    <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">Email</span>
                    <input
                      type="email"
                      autoComplete="username"
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
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Your password"
                      className={inputClass}
                    />
                  </label>
                </>
              ) : null}

              {loginMethod === "phone" ? (
                <>
                  <label className="grid min-h-[60px] grid-cols-1 items-center gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:gap-6">
                    <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">Phone</span>
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => handlePhoneChange(event.target.value)}
                      placeholder="+41 79 123 45 67"
                      className={inputClass}
                    />
                  </label>

                  <div className="md:pl-[146px]">
                    <button
                      type="button"
                      onClick={sendPhoneCode}
                      className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none"
                    >
                      {isPhoneCodeSent ? "resend code" : "send code"}
                    </button>
                  </div>

                  <label className="grid min-h-[60px] grid-cols-1 items-center gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:gap-6">
                    <span className="font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">Code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={phoneCodeInput}
                      onChange={(event) => setPhoneCodeInput(event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      className={inputClass}
                    />
                  </label>

                  {isPhoneCodeSent ? (
                    <p className="md:pl-[146px] font-ui text-[11px] leading-5 tracking-[0.02em] text-meta">
                      Beta preview code: {phoneVerificationCode}
                    </p>
                  ) : null}
                </>
              ) : null}
            </form>

            {error ? <p className="mt-6 font-ui text-[13px] leading-6 text-[#B22929]">{error}</p> : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="relative h-[33px]">
                <button
                  type="button"
                  onClick={openMethodChooser}
                  aria-haspopup="menu"
                  aria-expanded={isMethodChooserOpen && !loginMethod}
                  className={`${actionPillPrimaryClass} transition-all duration-150 ease-out ${
                    isMethodChooserOpen || loginMethod
                      ? "pointer-events-none scale-[0.96] border-line/70 bg-mist/70 text-inactive opacity-0"
                      : "pointer-events-auto scale-100 opacity-100"
                  }`}
                >
                  log in
                </button>

                <div
                  role="menu"
                  aria-label="Login method actions"
                  className={`absolute left-0 top-0 inline-flex h-[33px] items-center gap-[4px] transition-all duration-150 ease-out ${
                    isMethodChooserOpen && !loginMethod
                      ? "pointer-events-auto translate-x-0 opacity-100"
                      : "pointer-events-none translate-x-[10px] opacity-0"
                  }`}
                  style={{ transformOrigin: "left center" }}
                >
                  <button type="button" role="menuitem" onClick={() => selectMethod("phone")} className={actionPillPrimaryClass}>
                    phone
                  </button>
                  <button type="button" role="menuitem" onClick={() => selectMethod("email")} className={actionPillPrimaryClass}>
                    email
                  </button>
                </div>
              </div>

              {loginMethod ? (
                <>
                  <button
                    type="button"
                    onClick={resetMethodChoice}
                    className="font-ui text-[13px] font-normal leading-5 tracking-[0.02em] text-meta transition-colors duration-150 hover:text-ink"
                  >
                    change method
                  </button>
                  <button type="submit" form="login-form" className={actionPillPrimaryClass}>
                    enter
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
