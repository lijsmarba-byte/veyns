"use client";

import dynamic from "next/dynamic";

const OnboardingFlow = dynamic(
  () => import("@/components/unseen/OnboardingFlow").then((module) => module.OnboardingFlow),
  { ssr: false },
);

export function OnboardingClient() {
  return <OnboardingFlow />;
}
