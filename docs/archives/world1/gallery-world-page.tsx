import { StickyShell } from "@/components/unseen/StickyShell";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { WorldViewClient } from "@/components/unseen/WorldViewClient";
import { sections } from "@/data/mockCatalog";

type WorldCategoryKey = "OUTER" | "UPPER" | "LOWER" | "SILHOUETTE" | "GROUND" | "ARTIFACTS";

export default function GalleryWorldPage() {
  const worldItems = sections.flatMap((section) =>
    section.items.map((item) => ({
      item,
      categoryKey: section.key as WorldCategoryKey,
      categoryLabel: section.title,
    })),
  );

  return (
    <main data-return-root="true" className="min-h-screen bg-paper" style={{ minHeight: "var(--viewport-h)" }}>
      <ReturnScrollRestore />
      <StickyShell mode="gallery" view="world" />
      <section
        data-world-root="true"
        className="flex w-full items-stretch justify-center"
        style={{ height: "calc(var(--viewport-h) - var(--sticky-h))", minHeight: "calc(var(--viewport-h) - var(--sticky-h))" }}
      >
        <WorldViewClient mode="gallery" items={worldItems} />
      </section>
    </main>
  );
}
