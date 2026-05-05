import { Suspense } from "react";
import { StickyShell } from "@/components/unseen/StickyShell";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { ImmersiveView } from "@/components/unseen/ImmersiveView";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";

export default function GalleryFocusPage() {
  return (
    <main
      data-return-root="true"
      data-mobile-first-paint-gate="true"
      className="w-full bg-paper min-h-[calc(var(--viewport-h)+var(--mobile-safe-bottom))] md:h-[var(--viewport-h)] md:overflow-hidden"
    >
      <Suspense
        fallback={<RouteShellFallback />}
      >
        <ReturnScrollRestore />
        <StickyShell mode="gallery" view="focus" />
        <ImmersiveView mode="gallery" />
      </Suspense>
    </main>
  );
}
