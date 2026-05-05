import { Suspense } from "react";
import { StickyShell } from "@/components/unseen/StickyShell";
import { GalleryRouteController } from "@/components/unseen/gallery/GalleryRouteController";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { GalleryShowAround } from "@/components/unseen/GalleryShowAround";
import { GalleryArrivalReveal } from "@/components/unseen/GalleryArrivalReveal";
import { MobileGridProductOverlayHost } from "@/components/unseen/MobileGridProductOverlayHost";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";
import { sections } from "@/data/mockCatalog";

export default function GalleryPage() {
  return (
    <main
      data-return-root="true"
      data-mobile-first-paint-gate="true"
      data-desktop-sticky-paint-gate="true"
      className="relative min-h-screen bg-paper"
      style={{ minHeight: "calc(var(--viewport-h) + var(--mobile-safe-bottom))" }}
    >
      <Suspense
        fallback={<RouteShellFallback />}
      >
        <ReturnScrollRestore />
        <StickyShell mode="gallery" view="grid" />
        <GalleryArrivalReveal />
        <GalleryShowAround />
        <GalleryRouteController sections={sections} />
        <MobileGridProductOverlayHost mode="gallery" />
      </Suspense>
    </main>
  );
}
