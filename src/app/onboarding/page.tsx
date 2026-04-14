import { OnboardingFlow } from "@/components/unseen/OnboardingFlow";

export default function OnboardingPage() {
  return (
    <main className="relative min-h-screen bg-paper" style={{ minHeight: "var(--viewport-h)" }}>
      <OnboardingFlow />
    </main>
  );
}

