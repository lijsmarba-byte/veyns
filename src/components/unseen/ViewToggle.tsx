import Link from "next/link";

type ViewToggleProps = {
  mode: "gallery" | "archive";
  view: "grid" | "immersive" | "world2";
  archiveActiveItemCount?: number;
  archiveCapsuleId?: string | null;
};

const ARCHIVE_MIN_IMMERSIVE_ITEMS = 5;
const IMMERSIVE_STATE_KEY = "unseen:immersive-state";
const WORLD2_CAMERA_STATE_KEY = "unseen:world2-camera-state";
const WORLD2_RETURN_CAMERA_KEY = "unseen:world2-return-camera";
const WORLD2_RETURN_REVEAL_KEY = "unseen:world2-return-reveal";

export function ViewToggle({ mode, view, archiveActiveItemCount, archiveCapsuleId }: ViewToggleProps) {
  const archiveCapsuleQuery =
    mode === "archive" && archiveCapsuleId ? `?capsule=${encodeURIComponent(archiveCapsuleId)}` : "";
  const gridHref = mode === "gallery" ? "/gallery" : `/archive${archiveCapsuleQuery}`;
  const immersiveHref = mode === "gallery" ? "/gallery/immersive" : `/archive/immersive${archiveCapsuleQuery}`;
  const world2Href = mode === "gallery" ? "/gallery/world-2" : `/archive/world-2${archiveCapsuleQuery}`;
  const isArchiveImmersiveLocked =
    mode === "archive" && (archiveActiveItemCount ?? 0) < ARCHIVE_MIN_IMMERSIVE_ITEMS;
  const lockHintText = `Save at least ${ARCHIVE_MIN_IMMERSIVE_ITEMS} items`;
  const shouldResetImmersiveStateOnEntry = view !== "immersive";
  const shouldResetWorld2StateOnEntry = view !== "world2";

  const handleImmersiveEntry = () => {
    if (!shouldResetImmersiveStateOnEntry || typeof window === "undefined") return;

    try {
      window.sessionStorage.removeItem(IMMERSIVE_STATE_KEY);
    } catch {
      // Ignore storage failures and continue navigation.
    }
  };

  const handleWorld2Entry = () => {
    if (!shouldResetWorld2StateOnEntry || typeof window === "undefined") return;

    try {
      window.sessionStorage.removeItem(WORLD2_CAMERA_STATE_KEY);
      window.sessionStorage.removeItem(WORLD2_RETURN_CAMERA_KEY);
      window.sessionStorage.removeItem(WORLD2_RETURN_REVEAL_KEY);
    } catch {
      // Ignore storage failures and continue navigation.
    }
  };

  return (
    <div data-show-around-target="discovery-views" className="relative isolate inline-flex items-end gap-4">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-[64px] -right-[34px] top-[-18px] h-[46px] -z-10"
        style={{
          background:
            "radial-gradient(210% 260% at 52% 62%, rgba(254,254,253,0.24) 0%, rgba(254,254,253,0.17) 24%, rgba(254,254,253,0.095) 46%, rgba(254,254,253,0.045) 66%, rgba(254,254,253,0.016) 82%, rgba(254,254,253,0.004) 92%, rgba(254,254,253,0) 100%)",
          filter: "blur(10px)",
        }}
      />
      <Link
        href={gridHref}
        scroll={false}
        className={`relative pb-[7px] font-ui text-[13px] leading-4 tracking-[0.02em] transition-colors ${
          view === "grid" ? "font-medium text-meta/85" : "font-medium text-inactive hover:text-meta/85"
        }`}
      >
        Grid
      </Link>

      {isArchiveImmersiveLocked ? (
        <div className="group relative pb-[7px] font-ui text-[13px] font-medium leading-4 tracking-[0.02em] text-inactive">
          <span
            aria-disabled="true"
            className="cursor-default transition-colors group-hover:text-meta/85 group-focus-within:text-meta/85"
          >
            Focus
          </span>
          <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-transparent" />
          <span
            className="pointer-events-none absolute right-full top-full z-20 mt-[8px] mr-[-42px] inline-flex h-[29px] w-max max-w-none translate-y-1 items-center justify-center whitespace-nowrap rounded-[999px] border border-accent bg-accent px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100"
            aria-hidden="true"
          >
            {lockHintText}
          </span>
        </div>
      ) : (
        <Link
          href={immersiveHref}
          scroll={false}
          onClick={handleImmersiveEntry}
          className={`relative pb-[7px] font-ui text-[13px] leading-4 tracking-[0.02em] transition-colors ${
            view === "immersive" ? "font-medium text-meta/85" : "font-medium text-inactive hover:text-meta/85"
          }`}
        >
          Focus
        </Link>
      )}

      {mode === "gallery" ? (
        <Link
          href={world2Href}
          scroll={false}
          onClick={handleWorld2Entry}
          className={`relative pb-[7px] font-ui text-[13px] leading-4 tracking-[0.02em] transition-colors ${
            view === "world2" ? "font-medium text-meta/85" : "font-medium text-inactive hover:text-meta/85"
          }`}
        >
          Immersive
        </Link>
      ) : isArchiveImmersiveLocked ? (
        <div className="group relative pb-[7px] font-ui text-[13px] font-medium leading-4 tracking-[0.02em] text-inactive">
          <span
            aria-disabled="true"
            className="cursor-default transition-colors group-hover:text-meta/85 group-focus-within:text-meta/85"
          >
            Immersive
          </span>
          <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-transparent" />
          <span
            className="pointer-events-none absolute right-full top-full z-20 mt-[8px] mr-[-42px] inline-flex h-[29px] w-max max-w-none translate-y-1 items-center justify-center whitespace-nowrap rounded-[999px] border border-accent bg-accent px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100"
            aria-hidden="true"
          >
            {lockHintText}
          </span>
        </div>
      ) : (
        <Link
          href={world2Href}
          scroll={false}
          onClick={handleWorld2Entry}
          className={`relative pb-[7px] font-ui text-[13px] leading-4 tracking-[0.02em] transition-colors ${
            view === "world2" ? "font-medium text-meta/85" : "font-medium text-inactive hover:text-meta/85"
          }`}
        >
          Immersive
        </Link>
      )}
    </div>
  );
}
