import { sections } from "@/data/mockCatalog";
import { ProductActionRow } from "@/components/unseen/ProductActionRow";
import { ProductImageRail } from "@/components/unseen/ProductImageRail";
import { ProductInfoTransition } from "@/components/unseen/ProductInfoTransition";
import { ProductViewCloseButton } from "@/components/unseen/ProductViewCloseButton";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatPipeLabel(label: string) {
  return label.replace(/^\[/, "").replace(/\]$/, "");
}

function extractCueTokens(values: string[]) {
  const tokens: string[] = [];
  const seen = new Set<string>();

  values.forEach((value) => {
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((token) => {
        const key = token.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        tokens.push(token);
      });
  });

  return tokens;
}

export default async function ProductViewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const itemId = readParam(resolvedSearchParams, "item");
  const mode = readParam(resolvedSearchParams, "mode");
  const editId = readParam(resolvedSearchParams, "edit");
  const clickedImg = readParam(resolvedSearchParams, "img");
  const backParam = readParam(resolvedSearchParams, "back");
  const allItems = sections.flatMap((section) =>
    section.items.map((item) => ({ item, sectionTitle: section.title })),
  );
  const currentIndex = Math.max(
    0,
    allItems.findIndex((entry) => entry.item.id === itemId),
  );
  const current = allItems[currentIndex] ?? allItems[0];
  const imageRail = [
    {
      id: `${current.item.id}-main`,
      src: clickedImg?.startsWith("/") ? clickedImg : current.item.imgSrc,
      alt: `${current.item.brand} ${current.item.artsyName}`,
    },
    {
      id: `${current.item.id}-detail-a`,
      src: "/mock/product-detail/01a.jpeg",
      alt: `${current.item.brand} styled view 1`,
    },
    {
      id: `${current.item.id}-detail-b`,
      src: "/mock/product-detail/01b.jpeg",
      alt: `${current.item.brand} styled view 2`,
    },
    {
      id: `${current.item.id}-detail-c`,
      src: "/mock/product-detail/01c.jpeg",
      alt: `${current.item.brand} styled view 3`,
    },
  ];
  const cuePills = extractCueTokens([
    current.item.cuePalette,
    current.item.cueSurface,
    current.item.cueStructure,
    current.item.cueAccent,
  ]);
  const isPreOwned = current.item.status === "pre-owned";
  const isArchiveMode = mode === "archive";
  const productTitleToneClass = isArchiveMode ? "text-accent" : "text-ink";
  const backHref = backParam?.startsWith("/") ? backParam : mode === "archive" ? "/archive" : "/gallery";
  const leftStickyTop = "calc(var(--sticky-h) + (var(--viewport-h) - var(--sticky-h)) / 2 - 260px)";

  return (
    <main className="font-ui min-h-screen bg-paper text-ink" style={{ minHeight: "var(--viewport-h)" }}>
      <section data-pv-shell="true" className="relative mx-auto w-full max-w-[1440px] px-10 py-8 sm:px-14 md:px-24 md:py-10 lg:px-28 lg:py-6">
        <div className="fixed right-4 top-[23px] z-50 md:right-10">
          <div className="flex h-[26px] items-center">
            <ProductViewCloseButton
              backHref={backHref}
              productId={current.item.id}
              enableBackdropClose
              className="relative inline-flex h-[14px] w-[20px] items-center justify-center text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 sm:gap-12 lg:min-h-[calc(var(--viewport-h)-120px)] lg:grid-cols-[1.03fr_0.97fr] lg:items-start lg:gap-24">
          <ProductInfoTransition
            productId={current.item.id}
            className="pt-8 sm:pt-12 md:pt-16 lg:sticky lg:self-start lg:pt-0"
            style={{ top: leftStickyTop }}
          >
            <div data-pv-info-hit="true" className="w-full max-w-[460px]">
              <h1 className={`relative inline-flex w-full items-center justify-start text-left text-[28px] leading-none ${productTitleToneClass}`}>
                <span className={`inline-flex items-center font-ui text-[26px] font-normal tracking-[-0.06em] ${productTitleToneClass}`}>
                  <span aria-hidden="true" className="text-[24px] leading-none">|</span>
                  <span className="px-[2px]">{formatPipeLabel(current.item.idxLabel)}</span>
                  <span aria-hidden="true" className="text-[24px] leading-none">|</span>
                </span>
                <span className={`-ml-[2px] px-[2px] font-ui text-[26px] font-normal tracking-[-0.06em] ${productTitleToneClass}`}>–</span>
                <span className="ml-[1px] font-instrument italic tracking-[0.01em]">{current.item.artsyName}</span>
              </h1>

              <div className="mt-16 flex w-full flex-col gap-8">
                <div className="flex w-full items-center justify-between text-[14px] font-medium leading-5 tracking-[0.02em] text-meta">
                  <div className="flex items-center gap-[7px]">
                    <p>{current.item.brand}</p>
                    {isPreOwned ? (
                      <span
                        className="inline-flex h-[26px] items-center gap-[8px] bg-transparent text-[11px] font-medium uppercase tracking-[0.12em] text-ink"
                        style={{ fontFamily: "var(--font-meta-mono), monospace" }}
                      >
                        <span
                          aria-hidden="true"
                          className="h-[7px] w-[7px] rounded-full bg-ink"
                        />
                        Pre-owned
                      </span>
                    ) : null}
                  </div>
                  <p className="text-right">{current.item.price}</p>
                </div>

                <p className="text-justify text-[14px] font-normal leading-5 tracking-[0.02em] text-ink">
                  {current.item.artsyDesc}
                </p>

                <div>
                  <ProductActionRow itemId={current.item.id} mode={mode === "archive" ? "archive" : "gallery"} editId={editId ?? null} />
                </div>
              </div>
            </div>
          </ProductInfoTransition>

          <div
            className="relative flex pt-0 lg:min-h-[calc(var(--viewport-h)-120px)] lg:items-start lg:justify-center lg:pt-[calc(var(--sticky-h)+((var(--viewport-h)-var(--sticky-h))/2)-220px)]"
          >
            <ProductImageRail
              images={imageRail}
              cues={cuePills}
              mode={mode === "archive" ? "archive" : "gallery"}
              productId={current.item.id}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
