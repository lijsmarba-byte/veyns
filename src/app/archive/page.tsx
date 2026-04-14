import Link from "next/link";
import { StickyShell } from "@/components/unseen/StickyShell";
import { ProductTile } from "@/components/unseen/ProductTile";
import { ReturnScrollRestore } from "@/components/unseen/ReturnScrollRestore";
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
    <main data-return-root="true" className="min-h-screen bg-paper" style={{ minHeight: "var(--viewport-h)" }}>
      <ReturnScrollRestore />
      <StickyShell mode="archive" view="grid" archiveActiveItemCount={sectionItems.length} />
      <section data-grid-root="true" className="mx-auto max-w-[1333px] pb-24 pl-10 pr-10 pt-[64px]">
        {isCapsule2Empty ? (
          <div className="mx-auto flex w-full max-w-[560px] flex-col items-start gap-4 pt-[86px]">
            <h2 className="font-ui text-[14px] font-medium leading-5 tracking-[0.02em] text-accent">
              Capsule not yet formed
            </h2>
            <p className="font-ui text-[14px] font-normal leading-6 tracking-[0.02em] text-meta">
              Saved selections from the paired Edit will appear here. None have been added yet.
            </p>
            <Link
              href={capsule2EditHref}
              className="inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:font-medium hover:text-ink focus-visible:font-medium focus-visible:text-ink focus-visible:outline-none"
            >
              Open paired Edit
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-y-[132px] md:grid-cols-2 md:gap-x-[64px] lg:grid-cols-3 lg:gap-x-[72px]">
            {sectionItems.map((item) => (
              <ProductTile key={item.id} item={item} mode="archive" issueNumber={issueLabel} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
