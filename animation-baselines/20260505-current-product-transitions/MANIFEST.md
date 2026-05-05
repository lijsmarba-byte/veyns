# Product Transition Animation Baseline

Created: 2026-05-05

Purpose: preserve the current uncommitted product-view animation behavior before trying a snappier desktop transition model.

Saved files:
- `src/app/product-view/page.tsx`
- `src/components/unseen/ProductImageRail.tsx`
- `src/components/unseen/ProductViewCloseButton.tsx`
- `src/components/unseen/ProductInfoTransition.tsx`
- `src/components/unseen/ProductTile.tsx`
- `src/components/unseen/ProductTransitionOverlayHost.tsx`
- `src/components/unseen/productImagePreload.ts`
- `src/components/unseen/ReturnTransitionBridge.tsx`
- `src/components/unseen/ReturnScrollRestore.tsx`
- `src/components/unseen/ProductViewMobile.tsx`
- `src/components/unseen/ProductViewMobileScrollLock.tsx`

Restore approach:
- Copy the matching file from this baseline folder back to the same path in the project.
- Review before restoring if later work has intentionally changed the same file.
