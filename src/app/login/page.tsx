import { Suspense } from "react";
import { LoginFlow } from "@/components/unseen/LoginFlow";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-paper" style={{ minHeight: "var(--viewport-h)" }}>
      <Suspense
        fallback={<RouteShellFallback />}
      >
        <LoginFlow />
      </Suspense>
    </main>
  );
}
