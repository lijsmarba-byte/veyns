"use client";

import Link from "next/link";
import { useState } from "react";

const actionPillClass =
  "inline-flex h-[33px] items-center whitespace-nowrap rounded-full border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 text-left font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:border-[#ECECED] hover:text-ink focus-visible:border-[#ECECED] focus-visible:text-ink focus-visible:outline-none";

type EntryStage = "enter" | "account";

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
        className={`inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-all duration-150 ease-out focus-visible:outline-none ${
          stage !== "enter"
            ? "pointer-events-none scale-[0.96] border-[#ECECED] bg-mist/70 text-inactive opacity-0"
            : "pointer-events-auto scale-100 border-[#F0F0F1] bg-[#F5F5F6] text-[#6F7381] opacity-100 hover:text-ink"
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
        <Link href="/login" role="menuitem" className={actionPillClass}>
          log in
        </Link>
      </div>
    </div>
  );
}
