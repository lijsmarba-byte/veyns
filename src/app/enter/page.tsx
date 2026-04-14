import { LandingEnterActions } from "@/components/unseen/LandingEnterActions";

export default function EnterPage() {
  return (
    <main className="min-h-screen bg-paper" style={{ minHeight: "var(--viewport-h)" }}>
      <section className="relative mx-auto flex w-full max-w-[1333px] min-h-[var(--viewport-h)] flex-col px-10 pb-10 pt-10">
        <div className="fixed right-10 top-[23px] z-30 h-[26px] w-[161px]">
          <p className="absolute left-0 top-0 w-[94px] text-right text-ink leading-none">
            <span className="font-ui text-[14px] font-semibold leading-[26px] tracking-[-0.04em]">seenless</span>
          </p>
          <div className="absolute left-[100px] top-[7px] flex h-3 items-center justify-center rounded-[2px] bg-ink px-1 py-[3px]">
            <span className="font-ui text-[7px] font-bold leading-[7px] tracking-[-0.14px] text-paper">BETA</span>
          </div>
        </div>

        <div className="mt-auto max-w-[500px] pb-[22vh]">
          <h1 className="inline-flex items-end text-[34px] leading-none text-ink">
            <span className="font-ui font-normal tracking-[-0.06em]">Curated</span>
            <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">-</span>
            <span className="ml-[1px] font-instrument italic tracking-[0.01em]">Discovery</span>
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-[4px]">
            <LandingEnterActions initialStage="account" />
          </div>
        </div>
      </section>
    </main>
  );
}
