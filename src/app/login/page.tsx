import { LoginFlow } from "@/components/unseen/LoginFlow";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-paper" style={{ minHeight: "var(--viewport-h)" }}>
      <LoginFlow />
    </main>
  );
}
