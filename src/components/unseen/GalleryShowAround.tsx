"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { mockUsers } from "@/data/mockUsers";

const GALLERY_ARRIVAL_ACTIVE_KEY = "unseen:gallery-arrival-active";
const GALLERY_ARRIVAL_COMPLETE_EVENT = "unseen:gallery-arrival-complete";
const WELCOME_OPEN_DELAY_MS = 1400;
const INTRO_STAGGER_MS = 70;

type WelcomeProfile = {
  firstName?: unknown;
  displayName?: unknown;
  name?: unknown;
};

const actionPillClass =
  "inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:font-medium focus-visible:font-medium focus-visible:outline-none";

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
  const [isOpen, setIsOpen] = useState(false);
  const [welcomeName, setWelcomeName] = useState("User");
  const isSignupEntry = searchParams.get("entry") === "signup";

  const completeWelcome = useCallback(() => {
    setIsOpen(false);
    if (isSignupEntry) {
      router.replace("/gallery", { scroll: false });
    }
  }, [isSignupEntry, router]);

  useEffect(() => {
    let openTimer: number | null = null;
    let onArrivalComplete: (() => void) | null = null;

    const openWelcome = () => {
      setWelcomeName(readWelcomeName());
      setIsOpen(true);
    };

    try {
      if (!isSignupEntry) {
        return;
      }

      const shouldWaitForArrival = window.sessionStorage.getItem(GALLERY_ARRIVAL_ACTIVE_KEY) === "1";
      if (shouldWaitForArrival) {
        onArrivalComplete = () => {
          openTimer = window.setTimeout(openWelcome, WELCOME_OPEN_DELAY_MS);
        };
        window.addEventListener(GALLERY_ARRIVAL_COMPLETE_EVENT, onArrivalComplete, { once: true });
      } else {
        openTimer = window.setTimeout(openWelcome, WELCOME_OPEN_DELAY_MS);
      }
    } catch {
      // Ignore storage failures.
    }

    return () => {
      if (openTimer !== null) {
        window.clearTimeout(openTimer);
      }
      if (onArrivalComplete) {
        window.removeEventListener(GALLERY_ARRIVAL_COMPLETE_EVENT, onArrivalComplete);
      }
    };
  }, [isSignupEntry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-paper/85" aria-live="polite">
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="w-[min(600px,calc(100%-48px))] bg-paper px-6 pb-6 pt-6">
          <div className="flex min-h-[252px] flex-col items-start justify-center text-left">
            <p
              className="inline-flex items-baseline text-ink"
              style={{
                opacity: 1,
                transform: "translate3d(0,0,0) scale(1)",
                transition: "opacity 620ms cubic-bezier(0.22,0.75,0.28,1), transform 620ms cubic-bezier(0.22,0.75,0.28,1)",
                willChange: "opacity, transform",
              }}
            >
              <span className="font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">Welcome</span>
              <span className="-ml-[1px] font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">–</span>
              <span className="ml-[1px] font-instrument text-[25px] italic leading-none tracking-[0.01em]">
                {welcomeName}
              </span>
            </p>
            <p
              className="mt-6 max-w-[470px] font-ui text-[15px] leading-7 tracking-[0.006em] text-ink"
              style={{
                opacity: 1,
                transform: "translate3d(0,0,0)",
                transition: "opacity 620ms cubic-bezier(0.22,0.75,0.28,1), transform 620ms cubic-bezier(0.22,0.75,0.28,1)",
                transitionDelay: `${INTRO_STAGGER_MS}ms`,
                willChange: "opacity, transform",
              }}
            >
              Each weekly Issue refreshes the Gallery and its Edits. Saved pieces move to the Archive, forming Capsules paired to each Edit. The Signature, and the references behind each Edit, can be reviewed or rebuilt from the menu.
            </p>
          </div>

          <div
            className="mt-10 flex justify-start"
            style={{
              opacity: 1,
              transform: "translate3d(0,0,0)",
              transition: "opacity 560ms cubic-bezier(0.22,0.75,0.28,1), transform 560ms cubic-bezier(0.22,0.75,0.28,1)",
              transitionDelay: `${INTRO_STAGGER_MS * 2}ms`,
              willChange: "opacity, transform",
            }}
          >
            <button type="button" onClick={completeWelcome} className={actionPillClass}>
              enter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
