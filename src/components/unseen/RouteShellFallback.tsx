export function RouteShellFallback() {
  return (
    <div aria-hidden="true" className="relative min-h-[var(--viewport-h)] w-full bg-paper">
      <div className="sticky top-0 z-10 h-[188px] w-full bg-paper/90 backdrop-blur-md">
        <div className="mx-auto h-[34px] w-[198px] translate-y-[17px] rounded-[18px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6]" />
        <div className="mx-auto mt-[44px] h-[30px] w-[240px] rounded-[8px] bg-[#F7F7F8]" />
        <div className="mt-[54px] h-px w-full bg-line" />
      </div>
      <div className="mx-auto mt-[52px] h-[200px] max-w-[1333px] rounded-[12px] bg-[#FBFBFA]" />
    </div>
  );
}
