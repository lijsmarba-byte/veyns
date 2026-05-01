import { LandingEnterActions } from "@/components/unseen/LandingEnterActions";

export default function EnterPage() {
  return (
    <main className="min-h-screen bg-paper" style={{ minHeight: "var(--viewport-h)" }}>
      <section className="relative mx-auto flex w-full max-w-[1333px] min-h-[var(--viewport-h)] flex-col px-10 pb-10 pt-10">
        <div className="fixed right-10 top-[23px] z-30 flex h-[26px] items-center gap-[8px]">
          <p className="inline-flex h-[26px] items-center text-right text-ink leading-none">
            <span className="font-ui text-[18px] font-bold leading-[18px] tracking-[-0.04em]">cenoir</span>
          </p>
          <div className="inline-flex h-[12px] min-w-[28px] items-center justify-center rounded-[2px] bg-ink px-[5px]">
            <span className="font-ui text-[6.5px] font-bold leading-[6.5px] tracking-[-0.08px] text-paper">BETA</span>
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
