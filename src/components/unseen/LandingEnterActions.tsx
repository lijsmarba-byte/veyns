"use client";

import Link from "next/link";
import { useState } from "react";

const actionPillClass =
  "inline-flex h-[33px] items-center whitespace-nowrap rounded-full border border-line/80 bg-[#F5F5F6] px-4 text-left font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:border-line hover:text-ink focus-visible:border-line focus-visible:text-ink focus-visible:outline-none";

type EntryStage = "enter" | "account" | "loginMethod";

type LandingEnterActionsProps = {
  initialStage?: EntryStage;
};

export function LandingEnterActions({ initialStage = "enter" }: LandingEnterActionsProps) {
  const [stage, setStage] = useState<EntryStage>(initialStage);

  return (
    <div className="relative h-[33px]">
      <button
        type="button"
        aria-label="Show entry actions"
        aria-haspopup="menu"
        aria-expanded={stage !== "enter"}
        onClick={() => setStage("account")}
        className={`inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out focus-visible:outline-none ${
          stage !== "enter"
            ? "pointer-events-none scale-[0.96] border-line/70 bg-mist/70 text-inactive opacity-0"
            : "pointer-events-auto scale-100 border-line/80 bg-[#F5F5F6] text-[#6F7381] opacity-100 hover:font-medium hover:text-ink"
        }`}
      >
        enter
      </button>

      <div
        role="menu"
        aria-label="Account actions"
        className={`absolute left-0 top-0 inline-flex h-[33px] items-center gap-[4px] transition-all duration-150 ease-out ${
          stage === "account" ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-[10px] opacity-0"
        }`}
        style={{ transformOrigin: "left center" }}
      >
        <Link href="/onboarding" role="menuitem" className={actionPillClass}>
          sign up
        </Link>
        <button type="button" role="menuitem" onClick={() => setStage("loginMethod")} className={actionPillClass}>
          log in
        </button>
      </div>

      <div
        role="menu"
        aria-label="Login method actions"
        className={`absolute left-0 top-0 inline-flex h-[33px] items-center gap-[4px] transition-all duration-150 ease-out ${
          stage === "loginMethod"
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-[10px] opacity-0"
        }`}
        style={{ transformOrigin: "left center" }}
      >
        <Link href="/login?method=phone" role="menuitem" className={actionPillClass}>
          phone
        </Link>
        <Link href="/login?method=email" role="menuitem" className={actionPillClass}>
          email
        </Link>
      </div>
    </div>
  );
}
