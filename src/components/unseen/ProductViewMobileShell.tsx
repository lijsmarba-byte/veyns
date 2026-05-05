"use client";

import { ProductViewMobile } from "@/components/unseen/ProductViewMobile";
import { useViewportMode } from "@/lib/ui/viewportMode";

type ProductViewMobileShellProps = {
  backHref: string;
  brand: string;
  cues: string[];
  description: string;
  editId?: string | null;
  images: Array<{ id: string; src: string; alt: string }>;
  isArchiveMode: boolean;
  isPreOwned: boolean;
  itemId: string;
  mode: string | undefined;
  pipeLabel: string;
  price: string;
  title: string;
};

export function ProductViewMobileShell(props: ProductViewMobileShellProps) {
  const { isMobileExperience } = useViewportMode();
  if (!isMobileExperience) return null;
  return <ProductViewMobile {...props} />;
}
