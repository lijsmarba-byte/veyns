import { OnboardingClient } from "./OnboardingClient";

export default function OnboardingPage() {
  return (
    <main
      className="relative h-[var(--viewport-h)] overflow-hidden bg-paper md:h-auto md:min-h-screen md:overflow-visible"
      style={{ minHeight: "var(--viewport-h)" }}
    >
      <OnboardingClient />
    </main>
  );
}
