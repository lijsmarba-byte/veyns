import { Suspense } from "react";
import { StickyShell } from "@/components/unseen/StickyShell";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { ImmersiveView } from "@/components/unseen/ImmersiveView";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";
import { archiveCapsuleItems, type ArchiveCapsuleId } from "@/data/mockCatalog";
import { redirect } from "next/navigation";

type ArchiveImmersivePageProps = {
  searchParams?:
    | {
        capsule?: string;
      }
    | Promise<{
        capsule?: string;
      }>;
};

const ARCHIVE_MIN_IMMERSIVE_ITEMS = 5;

export default async function ArchiveFocusPage({ searchParams }: ArchiveImmersivePageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const capsuleParam = resolvedSearchParams.capsule;
  const activeCapsule = (capsuleParam && capsuleParam in archiveCapsuleItems
    ? capsuleParam
    : "main") as ArchiveCapsuleId;
  const activeCapsuleItemCount = archiveCapsuleItems[activeCapsule].length;

  if (activeCapsuleItemCount < ARCHIVE_MIN_IMMERSIVE_ITEMS) {
    const nextParams = new URLSearchParams();
    if (activeCapsule !== "main") {
      nextParams.set("capsule", activeCapsule);
    }
    const query = nextParams.toString();
    redirect(query ? `/archive?${query}` : "/archive");
  }

  return (
    <main
      data-return-root="true"
      data-mobile-first-paint-gate="true"
      className="w-full bg-paper min-h-[calc(var(--viewport-h)+var(--mobile-safe-bottom))] md:h-[var(--viewport-h)] md:overflow-hidden"
    >
      <Suspense
        fallback={<RouteShellFallback />}
      >
        <ReturnScrollRestore />
        <StickyShell mode="archive" view="focus" archiveActiveItemCount={activeCapsuleItemCount} />
        <ImmersiveView mode="archive" />
      </Suspense>
    </main>
  );
}
