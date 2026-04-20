import { Suspense } from "react";
import { StickyShell } from "@/components/unseen/StickyShell";
import { ProductTile } from "@/components/unseen/ProductTile";
import { RightCategoryNav } from "@/components/unseen/RightCategoryNav";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { GalleryShowAround } from "@/components/unseen/GalleryShowAround";
import { GalleryArrivalReveal } from "@/components/unseen/GalleryArrivalReveal";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";
import { sections } from "@/data/mockCatalog";

export default function GalleryPage() {
  const sectionKeys = sections.map((section) => section.key);

  return (
    <main data-return-root="true" className="relative min-h-screen bg-paper" style={{ minHeight: "var(--viewport-h)" }}>
      <Suspense
        fallback={<RouteShellFallback />}
      >
        <ReturnScrollRestore />
        <StickyShell mode="gallery" view="grid" />
        <GalleryArrivalReveal />
        <GalleryShowAround />
        <div
          data-gallery-left-nav="true"
          className="pointer-events-none fixed left-5 z-40 hidden -translate-y-1/2 lg:block"
          style={{ top: "calc(var(--sticky-h) + (var(--viewport-h) - var(--sticky-h)) / 2 - 32px)" }}
        >
          <div className="pointer-events-auto">
            <RightCategoryNav
              sectionKeys={sectionKeys}
              sectionIdPrefix="gallery-section-"
            />
          </div>
        </div>
        <section data-grid-root="true" className="relative w-full pb-24 pt-[64px]">
          <div className="mx-auto max-w-[1333px] px-10 lg:pl-[220px]">
            <div className="min-w-0">
              {sections.map((section) => (
                <section
                  key={section.key}
                  id={`gallery-section-${section.key.toLowerCase()}`}
                  className="mb-[180px] last:mb-0"
                  style={{ scrollMarginTop: "calc(var(--sticky-h) + 170px)" }}
                  aria-label={section.title}
                >
                  <div className="grid grid-cols-1 gap-y-[148px] md:grid-cols-2 md:gap-x-[64px] lg:grid-cols-3 lg:gap-x-[72px]">
                    {section.items.map((item) => (
                      <ProductTile key={item.id} item={item} mode="gallery" issueNumber="04" />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </Suspense>
    </main>
  );
}
