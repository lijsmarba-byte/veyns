import { GalleryDesktopView } from "@/components/unseen/gallery/GalleryDesktopView";
import { GalleryMobileView } from "@/components/unseen/gallery/GalleryMobileView";
import { GalleryRouteWrapper } from "@/components/unseen/gallery/GalleryRouteWrapper";
import type { MockCatalogSection } from "@/data/mockCatalog";

type GalleryRouteControllerProps = {
  sections: MockCatalogSection[];
};

export function GalleryRouteController({ sections }: GalleryRouteControllerProps) {
  const sectionKeys = sections.map((section) => section.key);

  return (
    <GalleryRouteWrapper
      desktopView={
        <GalleryDesktopView
          sections={sections}
          sectionIdPrefix="gallery-desktop-section-"
          sectionKeys={sectionKeys}
        />
      }
      mobileView={<GalleryMobileView sections={sections} sectionKeys={sectionKeys} />}
    />
  );
}
