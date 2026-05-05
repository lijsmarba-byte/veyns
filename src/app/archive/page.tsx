import { Suspense } from "react";
import Link from "next/link";
import { StickyShell } from "@/components/unseen/StickyShell";
import { ProductTile } from "@/components/unseen/ProductTile";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
import { RouteShellFallback } from "@/components/unseen/RouteShellFallback";
import { archiveCapsuleItems, type ArchiveCapsuleId } from "@/data/mockCatalog";

type ArchivePageProps = {
  searchParams?:
    | {
        capsule?: string;
      }
    | Promise<{
        capsule?: string;
      }>;
};

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const capsuleParam = resolvedSearchParams.capsule;
  const activeCapsule = (capsuleParam && capsuleParam in archiveCapsuleItems
    ? capsuleParam
    : "main") as ArchiveCapsuleId;
  const sectionItems = archiveCapsuleItems[activeCapsule];
  const isCapsule2Empty = activeCapsule === "capsule2" && sectionItems.length === 0;
  const capsule2EditHref = "/gallery?edit=edit1b";
  const issueLabel = "04";

  return (
    <main
      data-return-root="true"
      data-mobile-first-paint-gate="true"
      className="relative min-h-screen bg-paper"
      style={{ minHeight: "calc(var(--viewport-h) + var(--mobile-safe-bottom))" }}
    >
      <Suspense
        fallback={<RouteShellFallback />}
      >
        <ReturnScrollRestore />
        <StickyShell mode="archive" view="grid" archiveActiveItemCount={sectionItems.length} />
        <section
          data-grid-root="true"
          className="relative w-full bg-paper pb-[var(--mobile-safe-bottom)] pt-[64px] md:pb-24"
        >
          <div className="mx-auto max-w-[1333px] px-2 sm:px-6 md:px-10">
            {isCapsule2Empty ? (
              <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 pt-[86px] text-center">
                <h2 className="font-ui text-[14px] font-medium leading-5 tracking-[0.02em] text-accent">
                  Capsule not yet formed
                </h2>
                <p className="font-ui text-[14px] font-normal leading-6 tracking-[0.02em] text-meta">
                  Saved selections from the paired edit will appear here. None have been added yet.
                </p>
                <Link
                  href={capsule2EditHref}
                  className="inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:text-ink focus-visible:outline-none"
                >
                  open paired edit
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-[14px] gap-y-[96px] md:gap-x-[64px] md:gap-y-[132px] lg:grid-cols-3 lg:gap-x-[72px]">
                {sectionItems.map((item, itemIndex) => (
                  <ProductTile
                    key={item.id}
                    item={item}
                    mode="archive"
                    issueNumber={issueLabel}
                    imagePriority={itemIndex === 0}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </Suspense>
    </main>
  );
}
