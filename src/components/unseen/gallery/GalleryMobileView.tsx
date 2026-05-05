import { ProductTile } from "@/components/unseen/ProductTile";
import { RightCategoryNav } from "@/components/unseen/RightCategoryNav";
import { GalleryMobileCategoryPillNav } from "@/components/unseen/gallery/GalleryMobileCategoryPillNav";
import type { MockCatalogSection } from "@/data/mockCatalog";

type GalleryMobileViewProps = {
  sections: MockCatalogSection[];
  sectionKeys: string[];
};

function CategoryTransitionMarker() {
  return (
    <span
      aria-hidden="true"
      className="block"
      style={{
        width: "30px",
        height: "1.25px",
        backgroundColor: "#F0F0F1",
      }}
    />
  );
}

export function GalleryMobileView({ sections, sectionKeys }: GalleryMobileViewProps) {
  return (
    <section
      data-grid-root="true"
      className="relative w-full bg-paper pb-[var(--mobile-safe-bottom)] pt-[64px] md:pb-24"
    >
      <div
        data-gallery-left-nav="true"
        className="pointer-events-none absolute left-5 top-0 z-30 hidden h-full lg:block"
      >
        <div
          className="pointer-events-auto sticky -translate-y-1/2"
          style={{ top: "var(--gallery-category-nav-top)" }}
        >
          <RightCategoryNav sectionKeys={sectionKeys} sectionIdPrefix="gallery-section-" />
        </div>
      </div>

      <div className="mx-auto max-w-[1333px] px-2 sm:px-6 md:px-10 xl:pl-[220px]">
        <div className="min-w-0">
          {sections.map((section, sectionIndex) => (
            <div key={section.key}>
              <section
                id={`gallery-section-${section.key.toLowerCase()}`}
                className={`relative ${sectionIndex === 0 ? "pt-[28px]" : ""}`}
                style={{ scrollMarginTop: "calc(var(--sticky-h) + 170px)" }}
                aria-label={section.title}
              >
                <div className="grid grid-cols-2 gap-x-[14px] gap-y-[96px] md:gap-x-[64px] md:gap-y-[148px] xl:grid-cols-3 xl:gap-x-[72px]">
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

              {sectionIndex < sections.length - 1 ? (
                <div className="pointer-events-none flex h-[180px] items-center justify-center">
                  <CategoryTransitionMarker />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <GalleryMobileCategoryPillNav sections={sections} />
    </section>
  );
}
