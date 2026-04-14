import { StickyShell } from "@/components/unseen/StickyShell";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { ImmersiveView } from "@/components/unseen/ImmersiveView";
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

export default async function ArchiveImmersivePage({ searchParams }: ArchiveImmersivePageProps) {
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
      className="h-[var(--viewport-h)] w-full overflow-hidden bg-paper"
      style={{
        height: "var(--viewport-h)",
      }}
    >
      <ReturnScrollRestore />
      <StickyShell mode="archive" view="immersive" archiveActiveItemCount={activeCapsuleItemCount} />
      <ImmersiveView mode="archive" />
    </main>
  );
}
