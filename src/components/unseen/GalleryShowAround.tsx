"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { mockUsers } from "@/data/mockUsers";

type WelcomeProfile = {
  firstName?: unknown;
  displayName?: unknown;
  name?: unknown;
};

const actionPillClass =
  "inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-meta shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:outline-none";
const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const ARRIVAL_COMPLETE_EVENT = "unseen:gallery-arrival-complete";

function readWelcomeName(): string {
  const takeFirstName = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const [first] = trimmed.split(/\s+/);
    return first ?? "";
  };

  try {
    const rawProfile = window.localStorage.getItem("unseen:onboarding-profile");
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile) as WelcomeProfile;
      const firstName = typeof parsed.firstName === "string" ? parsed.firstName.trim() : "";
      if (firstName) return firstName;
      const displayName = typeof parsed.displayName === "string" ? parsed.displayName.trim() : "";
      if (displayName) return displayName;
      const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
      if (name) return takeFirstName(name);
    }
  } catch {
    // Ignore profile parsing failures and fall back below.
  }

  const fallbackName = takeFirstName(mockUsers[0]?.name ?? "");
  return fallbackName || "User";
}

export function GalleryShowAround() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [welcomeName, setWelcomeName] = useState("User");
  const isSignupEntry = searchParams.get("entry") === "signup";

  const completeWelcome = useCallback(() => {
    setIsVisible(false);
    window.setTimeout(() => {
      setIsMounted(false);
      if (isSignupEntry) {
        router.replace("/gallery", { scroll: false });
      }
    }, 300);
  }, [isSignupEntry, router]);

  useEffect(() => {
    let openRaf = 0;
    let isCancelled = false;
    let arrivalListener: (() => void) | null = null;

    const openWelcome = () => {
      if (isCancelled) return;
      setWelcomeName(readWelcomeName());
      setIsMounted(true);
      openRaf = window.requestAnimationFrame(() => {
        if (isCancelled) return;
        setIsVisible(true);
      });
    };

    try {
      if (!isSignupEntry) return;
      const isArrivalActive = window.sessionStorage.getItem(GALLERY_ARRIVAL_ACTIVE_KEY) === "1";
      if (isArrivalActive) {
        arrivalListener = () => {
          if (arrivalListener) {
            window.removeEventListener(ARRIVAL_COMPLETE_EVENT, arrivalListener);
            arrivalListener = null;
          }
          openWelcome();
        };
        window.addEventListener(ARRIVAL_COMPLETE_EVENT, arrivalListener, { once: true });
      } else {
        openWelcome();
      }
    } catch {
      // Ignore storage failures.
    }

    return () => {
      isCancelled = true;
      if (arrivalListener) {
        window.removeEventListener(ARRIVAL_COMPLETE_EVENT, arrivalListener);
        arrivalListener = null;
      }
      if (openRaf) window.cancelAnimationFrame(openRaf);
    };
  }, [isSignupEntry]);

  if (!isMounted) return null;

  return (
    <div className="fixed inset-0 z-[150] select-none" aria-live="polite">
      <div
        className="absolute inset-0 bg-black/12 backdrop-blur-[7px]"
        style={{
          WebkitBackdropFilter: "blur(7px)",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 280ms ease-out",
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div
          className="w-full max-w-[900px] rounded-[6px] bg-paper px-8 py-10 text-left shadow-[0_8px_20px_rgba(0,0,0,0.06)] md:px-14 md:py-14"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translate3d(0,0,0) scale(1)" : "translate3d(0,8px,0) scale(0.995)",
            transition: "opacity 280ms ease-out, transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)",
          }}
        >
          <p className="inline-flex items-baseline text-ink">
            <span className="font-ui text-[30px] font-normal leading-none tracking-[-0.06em]">Dear</span>
            <span className="-ml-[1px] font-ui text-[30px] font-normal leading-none tracking-[-0.06em]">–</span>
            <span className="ml-[1px] font-instrument text-[30px] italic leading-none tracking-[0.01em]">{welcomeName}</span>
          </p>

          <p className="mt-6 font-ui text-[14px] font-normal leading-6 tracking-[0.01em] text-ink">
            Welcome to a calm, curated commerce shaped entirely by individual taste. What appears here has been shown
            to no one else — the selection is as individual as the references behind it.
          </p>

          <p className="mt-5 font-ui text-[14px] font-normal leading-6 tracking-[0.01em] text-ink">
            Each week, the new <span className="font-semibold">Issue</span> refreshes the full selection in the Edits,
            found in the <span className="font-semibold">Gallery</span>. Saved pieces move permanently to the{" "}
            <span className="font-semibold">Archive</span>, forming personal Capsules paired to each Edit. The
            individual Signature of your aesthetic direction, along with the references behind each Edit, can be
            reviewed or rebuilt from the menu.
          </p>

          <p className="mt-5 font-ui text-[14px] font-normal leading-6 tracking-[0.01em] text-ink">
            <span className="inline-flex items-center gap-2 align-middle">
              <span className="font-ui text-[15px] font-bold leading-none tracking-[-0.03em] text-ink">cenoir</span>
              <span className="inline-flex h-[12px] min-w-[28px] items-center justify-center rounded-[2px] bg-ink px-[5px]">
                <span className="font-ui text-[6.5px] font-bold leading-[6.5px] tracking-[-0.08px] text-paper">BETA</span>
              </span>
            </span>
            <span className="px-1">:</span>
            Some recommendations may still be resolving. Certain links or functions remain in progress. Feedback
            shapes what comes next. Thank you for being here this early.
          </p>

          <p className="mt-4 font-ui text-[14px] font-normal leading-6 tracking-[0.01em] text-ink">Best,</p>
          <p className="mt-3 font-belmonte text-[31px] leading-none italic text-accent">Jil &amp; Nick</p>

          <div className="mt-6 flex justify-center">
            <button type="button" onClick={completeWelcome} className={actionPillClass}>
              enter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
