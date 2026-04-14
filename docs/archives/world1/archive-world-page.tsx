import { StickyShell } from "@/components/unseen/StickyShell";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { WorldViewClient } from "@/components/unseen/WorldViewClient";
import { archiveCapsuleItems, sections, type ArchiveCapsuleId } from "@/data/mockCatalog";

type WorldCategoryKey = "OUTER" | "UPPER" | "LOWER" | "SILHOUETTE" | "GROUND" | "ARTIFACTS";

type ArchiveWorldPageProps = {
  searchParams?:
    | {
        capsule?: string;
      }
    | Promise<{
        capsule?: string;
      }>;
};

export default async function ArchiveWorldPage({ searchParams }: ArchiveWorldPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const capsuleParam = resolvedSearchParams.capsule;
  const activeCapsule = (capsuleParam && capsuleParam in archiveCapsuleItems
    ? capsuleParam
    : "main") as ArchiveCapsuleId;
  const activeCapsuleItemCount = archiveCapsuleItems[activeCapsule].length;
  const categoryByItemId = new Map(
    sections.flatMap((section) =>
      section.items.map((item) => [
        item.id,
        { categoryKey: section.key as WorldCategoryKey, categoryLabel: section.title },
      ]),
    ),
  );
  const worldItems = archiveCapsuleItems[activeCapsule].map((item) => {
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
    <main data-return-root="true" className="min-h-screen bg-paper" style={{ minHeight: "var(--viewport-h)" }}>
      <ReturnScrollRestore />
      <StickyShell mode="archive" view="world" archiveActiveItemCount={activeCapsuleItemCount} />
      <section
        data-world-root="true"
        className="flex w-full items-stretch justify-center"
        style={{ height: "calc(var(--viewport-h) - var(--sticky-h))", minHeight: "calc(var(--viewport-h) - var(--sticky-h))" }}
      >
        <WorldViewClient mode="archive" items={worldItems} />
      </section>
    </main>
  );
}
