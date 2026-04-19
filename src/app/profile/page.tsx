import { Suspense } from "react";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";
import ProfilePageClient from "./ProfilePageClient";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={<RouteShellFallback />}
    >
      <ProfilePageClient />
    </Suspense>
  );
}
