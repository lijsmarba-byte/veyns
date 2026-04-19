import { Suspense } from "react";
import { StickyShell } from "@/components/unseen/StickyShell";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { ImmersiveView } from "@/components/unseen/ImmersiveView";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";

export default function GalleryImmersivePage() {
  return (
    <main
      data-return-root="true"
      className="h-[var(--viewport-h)] w-full overflow-hidden bg-paper"
      style={{
        height: "var(--viewport-h)",
      }}
    >
      <Suspense
        fallback={<RouteShellFallback />}
      >
        <ReturnScrollRestore />
        <StickyShell mode="gallery" view="immersive" />
        <ImmersiveView mode="gallery" />
      </Suspense>
    </main>
  );
}
