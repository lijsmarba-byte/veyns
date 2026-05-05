import { Suspense } from "react";
import { StickyShell } from "@/components/unseen/StickyShell";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { World2ViewClient } from "@/components/unseen/World2ViewClient";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";
import { sections } from "@/data/mockCatalog";

type World2CategoryKey = "OUTER" | "UPPER" | "LOWER" | "SILHOUETTE" | "GROUND" | "ARTIFACTS";

type GalleryWorld2PageProps = {
  searchParams?:
    | {
        edit?: string;
      }
    | Promise<{
        edit?: string;
      }>;
};

export default async function GalleryImmersivePage({ searchParams }: GalleryWorld2PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const world2ViewKey = resolvedSearchParams.edit ?? "main";
  const worldItems = sections.flatMap((section) =>
    section.items.map((item) => ({
      item,
      categoryKey: section.key as World2CategoryKey,
      categoryLabel: section.title,
    })),
  );

  return (
    <main
      data-return-root="true"
      data-mobile-first-paint-gate="true"
      className="relative bg-paper min-h-[calc(var(--viewport-h)+var(--mobile-safe-bottom))] md:min-h-[var(--viewport-h)]"
    >
      <Suspense
        fallback={<RouteShellFallback />}
      >
        <ReturnScrollRestore />
        <StickyShell mode="gallery" view="immersive" />
        <section
          data-world2-root="true"
          className="relative flex w-full items-stretch justify-center h-[calc(var(--viewport-h)+var(--mobile-safe-bottom))] min-h-[calc(var(--viewport-h)+var(--mobile-safe-bottom))] md:h-[var(--viewport-h)] md:min-h-[var(--viewport-h)]"
          style={{
            marginTop: "calc(var(--immersive-sticky-h, var(--sticky-h)) * -1)",
          }}
        >
          <World2ViewClient key={world2ViewKey} items={worldItems} mode="gallery" />
        </section>
      </Suspense>
    </main>
  );
}
