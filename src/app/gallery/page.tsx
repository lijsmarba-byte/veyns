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
        <section data-grid-root="true" className="relative w-full pb-24 pt-[64px]">
          <div
            data-gallery-left-nav="true"
            className="pointer-events-none absolute left-5 top-0 z-30 hidden h-full lg:block"
          >
            <div
              className="pointer-events-auto sticky -translate-y-1/2"
              style={{ top: "var(--gallery-category-nav-top)" }}
            >
              <RightCategoryNav
                sectionKeys={sectionKeys}
                sectionIdPrefix="gallery-section-"
              />
            </div>
          </div>

          <div className="mx-auto max-w-[1333px] px-10 xl:pl-[220px]">
            <div className="min-w-0">
              {sections.map((section, sectionIndex) => (
                <section
                  key={section.key}
                  id={`gallery-section-${section.key.toLowerCase()}`}
                  className="mb-[180px] last:mb-0"
                  style={{ scrollMarginTop: "calc(var(--sticky-h) + 170px)" }}
                  aria-label={section.title}
                >
                  <div className="grid grid-cols-1 gap-y-[148px] md:grid-cols-2 md:gap-x-[64px] xl:grid-cols-3 xl:gap-x-[72px]">
                    {section.items.map((item, itemIndex) => (
                      <ProductTile
                        key={item.id}
                        item={item}
                        mode="gallery"
                        issueNumber="04"
                        imagePriority={sectionIndex === 0 && itemIndex === 0}
                      />
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
