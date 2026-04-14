import { LandingEnterActions } from "@/components/unseen/LandingEnterActions";

export default function Home() {
  return (
    <main className="min-h-screen bg-paper" style={{ minHeight: "var(--viewport-h)" }}>
      <section className="relative font-ui min-h-screen bg-paper text-ink">
        <div className="relative mx-auto w-full max-w-[1440px] px-10 py-8 sm:px-14 md:px-24 md:py-10 lg:px-28 lg:py-6">
        <div className="fixed right-10 top-[23px] z-30 h-[26px] w-[161px]">
          <p className="absolute left-0 top-0 w-[94px] text-right text-ink leading-none">
            <span className="font-ui text-[14px] font-semibold leading-[26px] tracking-[-0.04em]">seenless</span>
          </p>
          <div className="absolute left-[100px] top-[7px] flex h-3 items-center justify-center rounded-[2px] bg-ink px-1 py-[3px]">
            <span className="font-ui text-[7px] font-bold leading-[7px] tracking-[-0.14px] text-paper">BETA</span>
          </div>
        </div>

        <div className="pt-[92px]">
          <div aria-hidden="true" className="mx-auto h-[29px] w-full max-w-[920px]" />

          <div className="mx-auto mt-12 w-full max-w-[920px]">
            <div aria-hidden="true" className="invisible mt-7 w-full max-w-[760px]">
              <p className="font-ui text-[14px] leading-[1.9] tracking-[0.02em] text-meta">
                Some recommendations may still be resolving, some links may not yet reflect live availability, and
                certain functions are still in progress. The experience is being refined continuously, and feedback
                helps shape what evolves next. Thank you for being part of it at this early stage.
              </p>
              <p className="mt-6 font-ui text-[13px] leading-[1.8] tracking-[0.02em] text-meta">Best,</p>
              <p className="mt-4 font-belmonte text-[28px] leading-none italic text-accent">Jil &amp; Nick</p>
            </div>

            <div className="relative top-[20px]">
              <h1 className="inline-flex items-end justify-start text-left text-[30px] leading-none text-ink">
                <span className="font-ui font-normal tracking-[-0.06em]">Curated</span>
                <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">-</span>
                <span className="ml-[1px] font-instrument italic tracking-[0.01em]">Discovery</span>
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <LandingEnterActions />
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>
    </main>
  );
}
