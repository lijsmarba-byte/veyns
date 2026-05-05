import { Suspense } from "react";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";
import ProfilePageClient from "./ProfilePageClient";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={<RouteShellFallback />}
    >
      <ProfilePageClient />
    </Suspense>
  );
}
