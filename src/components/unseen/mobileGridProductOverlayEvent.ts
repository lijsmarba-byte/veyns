import type { MockCatalogItem } from "@/data/mockCatalog";

export const MOBILE_GRID_PRODUCT_OPEN_EVENT = "unseen:mobile-grid-product-open";
export const MOBILE_GRID_QUERY_ITEM_KEY = "pvItem";
export const MOBILE_GRID_QUERY_MODE_KEY = "pvMode";
export const MOBILE_GRID_QUERY_IMG_KEY = "pvImg";
export const MOBILE_GRID_QUERY_EDIT_KEY = "pvEdit";
export const MOBILE_GRID_QUERY_BACK_KEY = "pvBack";

export type MobileGridProductOverlayPayload = {
  backHref: string;
  brand: string;
  cues: string[];
  description: string;
  editId?: string | null;
  images: Array<{ id: string; src: string; alt: string }>;
  isArchiveMode: boolean;
  isPreOwned: boolean;
  itemId: string;
  mode: "gallery" | "archive";
  pipeLabel: string;
  price: string;
  productViewHref: string;
  title: string;
};

export function formatPipeLabel(label: string) {
  return label.replace(/^\[/, "").replace(/\]$/, "");
}

export function extractCueTokens(values: string[]) {
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

export function buildProductImages(item: MockCatalogItem, clickedImg?: string) {
  return [
    {
      id: `${item.id}-main`,
      src: clickedImg?.startsWith("/") ? clickedImg : item.imgSrc,
      alt: `${item.brand} ${item.artsyName}`,
    },
    {
      id: `${item.id}-detail-a`,
      src: "/mock/product-detail/01a.jpeg",
      alt: `${item.brand} styled view 1`,
    },
    {
      id: `${item.id}-detail-b`,
      src: "/mock/product-detail/01b.jpeg",
      alt: `${item.brand} styled view 2`,
    },
    {
      id: `${item.id}-detail-c`,
      src: "/mock/product-detail/01c.jpeg",
      alt: `${item.brand} styled view 3`,
    },
  ];
}

export function buildMobileGridOverlayPayload(
  item: MockCatalogItem,
  mode: "gallery" | "archive",
  backHref: string,
  editId?: string | null,
): MobileGridProductOverlayPayload {
  const productViewParams = new URLSearchParams({
    item: item.id,
    mode,
    back: backHref,
    img: item.imgSrc,
  });
  if (editId) {
    productViewParams.set("edit", editId);
  }

  return {
    backHref,
    brand: item.brand,
    cues: extractCueTokens([item.cuePalette, item.cueSurface, item.cueStructure, item.cueAccent]),
    description: item.artsyDesc,
    editId: editId ?? null,
    images: buildProductImages(item, item.imgSrc),
    isArchiveMode: mode === "archive",
    isPreOwned: item.status === "pre-owned",
    itemId: item.id,
    mode,
    pipeLabel: formatPipeLabel(item.idxLabel),
    price: item.price,
    productViewHref: `/product-view?${productViewParams.toString()}`,
    title: item.artsyName,
  };
}
