import { Suspense } from "react";
import { StickyShell } from "@/components/unseen/StickyShell";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { World2ViewClient } from "@/components/unseen/World2ViewClient";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";
import { archiveCapsuleItems, sections, type ArchiveCapsuleId } from "@/data/mockCatalog";
import { redirect } from "next/navigation";

type World2CategoryKey = "OUTER" | "UPPER" | "LOWER" | "SILHOUETTE" | "GROUND" | "ARTIFACTS";

type ArchiveWorld2PageProps = {
  searchParams?:
    | {
        capsule?: string;
      }
    | Promise<{
        capsule?: string;
      }>;
};

const ARCHIVE_MIN_IMMERSIVE_ITEMS = 5;

export default async function ArchiveImmersivePage({ searchParams }: ArchiveWorld2PageProps) {
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

  const activeItems = archiveCapsuleItems[activeCapsule];

  const categoryByItemId = new Map(
    sections.flatMap((section) =>
      section.items.map((item) => [
        item.id,
        { categoryKey: section.key as World2CategoryKey, categoryLabel: section.title },
      ]),
    ),
  );

  const worldItems = activeItems.map((item) => {
    const categoryData = categoryByItemId.get(item.id) ?? {
      categoryKey: "OUTER" as const,
      categoryLabel: "Outer",
    };

    return {
      item,
      categoryKey: categoryData.categoryKey,
      categoryLabel: categoryData.categoryLabel,
    };
  });

  return (
    <main
      data-return-root="true"
      className="relative h-[var(--viewport-h)] w-full overflow-hidden bg-paper"
      style={{ height: "var(--viewport-h)" }}
    >
      <Suspense
        fallback={<RouteShellFallback />}
      >
        <ReturnScrollRestore />
        <StickyShell mode="archive" view="immersive" archiveActiveItemCount={activeCapsuleItemCount} />
        <section
          data-world2-root="true"
          className="relative flex w-full items-stretch justify-center"
          style={{
            height: "var(--viewport-h)",
            minHeight: "var(--viewport-h)",
            marginTop: "calc(var(--sticky-h) * -1)",
          }}
        >
          <World2ViewClient key={activeCapsule} items={worldItems} mode="archive" showCategoryNav={false} />
        </section>
      </Suspense>
    </main>
  );
}
