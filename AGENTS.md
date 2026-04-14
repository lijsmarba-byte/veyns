# AGENTS.md

This file captures the current implementation context for the `unseen-ui` project so follow-up chats can continue without losing design/UX decisions.

## Hard change rule

- Only change code that the user explicitly and concretely requested in this chat.
- Never modify any other view/route/component "proactively" or "while touching related code".
- If a change is not explicitly requested, do not implement it.

## Project

- Name: **The Unseen**
- Stack: **Next.js App Router + TypeScript + Tailwind CSS**
- Design direction: calm editorial gallery, minimal copy, image-first
- Important: local fonts only (network-restricted environment)

## Fonts (local, via `next/font/local`)

- Config: `src/app/layout.tsx`
- Inter: `public/fonts/inter/*`
- Instrument Serif: `public/fonts/instrument-serif/*`
- IBM Plex Mono: `public/fonts/ibm-plex-mono/*`
- Belmonte Ballpoint: `public/fonts/BelmonteBallpoint-*`

## Tokens / Global CSS

- File: `src/app/globals.css`
- Core variables:
- `--paper: #FEFEFD`
- `--mist: #F8F8F6`
- `--ink: #111111`
- `--meta: #888894`
- `--inactive: #C1C5D4`
- `--line: #ECEDEF`
- `--archiveColor: #FEFEFD`
- `--accent: #35237A`
- Sticky and viewport:
- `--sticky-h: 156px` (runtime-updated)
- `--viewport-h: max(100dvh, 450px)`

## Sticky header behavior

- Component: `src/components/unseen/StickyShell.tsx`
- Sticky stack is measured by `StickyHeightSync`:
- `src/components/unseen/StickyHeightSync.tsx`
- `id="sticky-stack"` is the measurement target.
- Divider/shadow details were tuned repeatedly; avoid changing unless requested.

## Routes

- Gallery: `src/app/gallery/page.tsx`
- Archive: `src/app/archive/page.tsx`
- Product full view: `src/app/product-view/page.tsx` (driven by query params `item`, `mode`, `back`)
- Additional routes/components exist for immersive/product work in `src/app`.

## Product tile conventions

- Component: `src/components/unseen/ProductTile.tsx`
- Runtime mode:
- `ProductTile` is a Client Component (`"use client"`) so tile click handlers can manage grid-to-detail transition payloads.
- Gallery hover button interactivity is split into `src/components/unseen/GalleryHoverActions.tsx` (Client Component) to avoid RSC event-handler serialization errors.
- Top label:
- Gallery: uses item idx label
- Archive: `Issue 04 | <itemNumber>`
- Top label and price use the same meta typography class:
- `font-ui text-[14px] font-medium leading-5 tracking-[0.02em] text-meta`
- Brand-to-price spacing:
- Product meta block uses `gap-[8px]` between brand and price for more breathing room.
- Gallery hover (implemented):
- On hover/focus, gallery tile image applies blur (`1.8px`) and shows two centered gray pill actions (`acquire`, `save`) without layout shift.
- Grid hover action click-through is blocked: action container is tagged (`data-grid-action-hit="true"`) and tile image click-to-open ignores clicks originating from that subtree, so `acquire/save` does not open product view.
- Grid click-through guard resolves both element and text-node click targets before checking `closest(...)`, so save/acquire clicks are reliably recognized across browsers.
- Hover action wrapper uses bubble-phase click stop (not capture-phase), so nested save-flow controls (`save`, capsule select, `+`, `saved`) remain fully clickable while tile-open click-through stays blocked.
- Hover action stack (`acquire`/`save`) is positioned clearly below center to avoid covering the central product area.
- Hover action stack uses tighter vertical spacing between `acquire` and `save` pills.
- Default `acquire`/`save` pills use the same inactive background gray as the top Gallery/Archive switch (`#F5F5F6`); only the label text is darkened in default state.
- `acquire` opens `https://www.mytheresa.com` in a new tab.
- Pills use fixed Figma-like sizes (`67x33`, `65x33`).
- Product action pills now use the same soft shadow treatment as the `Issue 04` hover pill (`0 1px 2px rgba(0,0,0,0.12)`), plus a subtle line border.
- Product action pill labels use Inter Regular + `text-meta` by default, and switch to darker text + Inter Medium on pill hover/focus.
- `save` now expands into an extended capsule picker pill: default capsule label + dropdown trigger + right-aligned accent `+` confirm button.
- Hover default shows only `acquire` and `save`; the extended capsule picker appears only after clicking `save`.
- Hover interaction resets on tile leave: when re-entering a product tile, UI returns to the default `acquire`/`save` state (save-flow/dropdown closed).
- Extended save pill is non-wrapping (`whitespace-nowrap`) and must grow horizontally so capsule labels never break into multiple lines.
- Extended save pill keeps a fully rounded pill silhouette; the right `+` action is a circular 31x31 accent button with 1px inner right offset so it sits cleanly inside the pill corner.
- Extended save pill width is hug-content (no fixed/min width), so it wraps the capsule label with consistent horizontal padding.
- Capsule label switches in the expanded save pill use an animated width transition (measured old/new width) to avoid abrupt/hectic resizing.
- Capsule dropdown open/close is animated with a soft 180ms opacity/translate/scale transition (including delayed unmount on close) to avoid abrupt state changes.
- No extra hover styling in save step 2 (expanded capsule picker/dropdown/plus); hover emphasis remains on `acquire` and the primary `save` action context only.
- Selected capsule label inside the expanded save pill uses Inter Medium (`font-ui font-medium`) in accent color.
- Capsule picker defaults by current gallery edit mode (`main -> Main Capsule`, `edit1a -> Capsule 1`, `edit1b -> Capsule 2`, `edit1c -> Capsule 3`) and can be overridden via dropdown selection.
- On confirm (`+`), the save pill collapses into a compact filled-accent `saved` state with paper text.
- `saved` state is clickable; clicking it removes the item from saved storage and resets the tile to the default gray `acquire`/`save` state.
- Save confirmation persists per product in `localStorage` (`unseen:saved-items`) with selected capsule id.
- Archive tiles use a two-level hover delete interaction: product-hover shows blue circular `−`; hovering/focusing the `−` expands into a blue `delete` pill where only `delete` is visible (no minus in expanded state). Clicking `delete` (or collapsed `−`) performs delete-from-capsule.
- Expanded archive `delete` pill uses the same inner horizontal padding and width baseline as the `acquire` pill (matching text-to-edge spacing).
- In archive hover, `acquire` button label shifts to accent blue on button hover/focus (instead of ink).
- Brand:
- Gallery: `text-ink`
- Archive: `text-accent`

## Grid/Immersive toggle (under divider)

- Component: `src/components/unseen/ViewToggle.tsx`
- Current style:
- `text-[13px]`, medium, subdued color
- Active underline: `1px`, subtle (`bg-meta/75`)

## Immersive view (horizontal + clickwheel)

- Main component: `src/components/unseen/ImmersiveView.tsx`
- Routes:
- Gallery immersive: `src/app/gallery/immersive/page.tsx`
- Archive immersive: `src/app/archive/immersive/page.tsx`
- Both immersive routes now use `ReturnScrollRestore` and mount `StickyShell` + `ImmersiveView`.
- Immersive routes are scroll-locked vertically (`height: var(--viewport-h)` + `overflow-hidden` on route main), so this view has no vertical page scroll.
- Immersive view now enforces hard runtime page lock: `html/body` overflow+overscroll suppression, `body` fixed-position scroll freeze, and capture-phase prevention for `wheel`/`touchmove`/scroll keys, eliminating residual mm-level vertical drift.
- To prevent browser back/forward swipe on horizontal trackpad gestures in immersive mode, a capture-phase native `wheel` guard (`passive:false`) blocks horizontal-intent deltas at window level while the view is mounted.
- Immersive route main now also spans true viewport width (`100dvw` with viewport-margin alignment), preventing right-edge white gutter bars.
- A reinforced overscan/bleed is applied (`+6px` width with `-3px` per-side offset) on immersive route shell and product stage to eliminate right-edge sub-pixel seams reliably.
- Horizontal interaction remains active via stage wheel/touch handling; stage touch-action is constrained to `pan-x`.
- Row behavior:
- Horizontal 5-slot stage (`far-left`, `left`, `center`, `right`, `far-right`) with center item larger and far items partially clipped to signal horizontal browsing.
- White-space emphasis is larger between center and near items than between near and far items (focus weighting on center card).
- Slot spacing is tuned wider so near items sit closer to outer lanes, while far-left/far-right are intentionally half-cut at the viewport edges.
- All five products keep the same visual sharpness (no reduced opacity/blur treatment on side slots); focus hierarchy is driven by size + spacing only.
- Stage adds subtle left/right paper gradient edge-fades so outer products visually fade out while exiting the screen boundary.
- Fadeout side products use a full-viewport stage (`100dvw`) with zero side padding at screen edges.
- Stage viewport-centering now uses viewport-margin alignment (`margin-left/right: calc(50% - 50dvw)`) instead of translate offset, preventing left-shift drift when parent containers are narrower than viewport.
- Immersive slot math uses the measured row-stage width (`ResizeObserver` on stage node), not only window width, so center/far/near positions remain symmetric to the actual rendered stage at all breakpoints.
- Slot distribution is now computed from runtime viewport width: center card is pinned at exact viewport center, near cards sit on symmetric half-distance lanes, and far cards are anchored to both edges with a small equal overshoot for consistent left/right edge crop.
- Edge anchoring now uses measured stage-center offset vs viewport center, so left/right edge crop remains matched even if stage geometry shifts by sub-pixels/layout context.
- Only focus card scales differently; side cards (`1/2/4/5`) now share identical dimensions (same size as previous near cards), keeping peripheral rhythm uniform.
- Immersive card motion now separates concerns: outer slot animates horizontal translate, while inner image container uses CSS variable scale (`--scale`) for smoother focus in/out scaling behavior.
- Far edge cards are positioned to be roughly half-cut at left/right viewport edges, reinforcing the in/out horizontal flow cue.
- Edge fade overlay width is also viewport-derived, so edge crop/fade behavior stays consistent across screen sizes.
- Edge fade is intentionally very subtle and narrow, so edge cards remain readable while still blending into the boundary.
- Immersive row scale is reduced by ~30% overall (focus + side slot dimensions and row stage height) so the full composition sits lower with more breathing room.
- Clickwheel/iPod control is reduced by ~60% overall (to ~40% of prior size) so it remains fully visible in-frame below the product row.
- Follow-up sizing pass: immersive product row was increased again by ~20% (from the reduced state), and clickwheel/iPod was also increased by ~20% to rebalance visibility and readability.
- Latest wheel adjustment: clickwheel is nudged slightly higher (earlier in the vertical flow) and scaled up by ~5% for better presence.
- Latest wheel adjustment: clickwheel is scaled up again by ~20% for stronger presence while preserving interaction zones.
- Wheel left/right symbols now use filled double-triangle glyphs (not outline chevrons) for clearer directional affordance.
- Clickwheel shadow now matches the same subtle pill hover shadow token (`0 1px 2px rgba(0,0,0,0.12)`).
- Clickwheel hover feedback is now zone-specific only (no whole-wheel hover highlight): only `menu`, left/right arrows, and center button animate when hovering their respective wheel zones.
- Center click circle uses a very dark idle treatment (`dark gray` fill, near-black border) and brightens/slightly scales only when hovering the center zone.
- Menu-zone hover emphasis was increased further (clearer scale/lift response) while keeping the rest of the wheel static.
- Clickwheel zone hit-testing now scales with wheel size (dynamic center radius) so `left/right/menu/center` click zones stay correct after size changes.
- Only centered item shows metadata text:
- Product info row sits below the product stage in one horizontal line:
- Left: pipe ID (`|01|`) in meta color
- Center: brand (visually centered)
- Right: price in meta color
- Left ID and right price use matching horizontal insets from the centered brand, preserving symmetric spacing (recently reduced for a tighter row).
- Product info row now uses strict equal-gap geometry against the visible clickwheel lane (focus-image->text gap equals text->clickwheel gap exactly while wheel is visible).
- A hard vertical spacing floor is enforced in immersive lane geometry (`min 10px` gap ~= 50% of large-screen baseline), and shrinking view heights first pull the product row upward before allowing tighter compression.
- If lane space is still tight after upward row shift, immersive card dimensions are scaled down modestly (bounded floor) before any text/iPod overlap can occur, keeping product-text-iPod ordering stable across extreme width/height changes.
- Gap scaling behavior is now two-phase: keep a stable baseline gap through normal/medium widths while focus product scales, then increase gap only on very large viewport widths.
- Non-centered items intentionally show no ID/brand/price text.
- Navigation behavior:
- Trackpad/mouse wheel on stage navigates left/right through items with velocity-sensitive transition duration (faster wheel input = faster slide cadence).
- Touch swipe on stage also moves left/right.
- Wheel behavior was further smoothed: deltas are normalized+damped, step threshold increased, and a short step cooldown is applied so minor scroll input does not skip multiple products.
- Wheel smoothing was tightened again (stronger delta damping, higher step threshold, longer cooldown, plus a brief nav-lock after each step) to prevent jumpy multi-step leaps while preserving both-direction scrolling.
- Wheel delta parsing now prioritizes true horizontal intent (`deltaX`) when present, so horizontal trackpad gestures follow the same navigation logic/profile as horizontal mouse-wheel input.
- Wheel speed now scales by input intensity: stronger/faster wheel/trackpad deltas shorten cooldown/nav-lock and switch into rapid navigation profile, so fast scroll gestures move products noticeably faster like rapid clicking.
- Fast opposite-direction wheel input now triggers near-immediate reversal: direction-flip detection clears wheel lock/cooldown and uses rapid mode so left-right changes respond almost instantly.
- Stage now supports direct pointer dragging (mouse + touch): drag left/right advances products in stepped horizontal lanes with velocity-responsive timing.
- Drag now supports continuous scrub behavior: while holding and dragging, slot position/size interpolation follows drag progress directly (speed/distance-driven focus in/out), instead of relying only on auto-triggered snap steps.
- Continuous scrub now supports longer uninterrupted drags across multiple products in one gesture; item mapping follows drag progression live while held.
- Scrub distance scaling was reduced further so full-width drag sweeps traverse fewer items (target roughly 4-5 products instead of large multi-skip jumps).
- Scrub updates now apply a light low-pass interpolation to drag progress, reducing micro-jitter and restoring smoother focus in/out flow while dragging.
- Drag scrub smoothing is now stronger and per-frame progress change is capped, ensuring products still pass through center zoom gradients (in/out scaling) during fast drags instead of flattening/skipping visual size transitions.
- Commit to focus now happens on release via nearest-step snap from accumulated drag progress (instead of mid-drag stepping), so products flow continuously while dragging and only lock into place when released.
- Drag release no longer auto-flings to the next item; if threshold was not crossed, cards settle back to center (user-controlled transition intent).
- Release motion is intentionally calmer: threshold-cross commits use longer easing/duration, and near-threshold drags return with a soft non-aggressive settle.
- Release commit/return timings were lengthened again and commit settle now uses a double-rAF handoff before recentering to avoid hard one-frame snap artifacts.
- Post-drag click suppression remains to prevent accidental product-open clicks while finishing a drag gesture.
- Drag sensitivity is intentionally much slower now (higher threshold, longer hold-latency, larger cooldown, max one step per move cycle) so quick glides do not skip many products.
- Drag hold-latency was increased again (`~220ms` with slightly larger early movement allowance) to further calm the initial drag pickup.
- Drag behavior is intentionally calmer/lagged: increased step threshold + longer step cooldown + short hold-latency gate reduce hectic jumps on small mouse movements.
- Row drag no longer uses pointer capture on pointer-down, improving click-to-focus reliability for side cards while preserving horizontal drag interaction.
- Drag initiation/updates are bound on the full immersive section (entire area below divider line), not just the product row; iPod wheel + category menu are explicitly exempt from section-drag capture.
- Immersive section now uses a consistent drag cursor language (`grab` idle, `grabbing` while active) across the full draggable area, avoiding fallback to normal pointer between elements.
- Native browser image dragging is explicitly disabled in immersive stage (`draggable={false}` + stage-level `dragstart` preventDefault), so product images cannot be torn/pulled out of the page.
- Clickwheel behavior:
- Black iPod-style wheel under row with center button area + ring zones.
- Left/right zones move prev/next item.
- Top `menu` zone toggles category pills.
- `menu` label is also an explicit clickable button on the wheel (pointer-safe), so category pills open reliably on direct menu click.
- Wheel top label now animates `menu -> x` on toggle; open state shows `x` as close affordance and closes the category pill bar on click.
- Center action opens focused product view.
- Keyboard support on wheel: `ArrowLeft`, `ArrowRight`, `ArrowUp` (menu toggle), `Enter` (open focused item).
- Category pills:
- Categories: `OUTER`, `UPPER`, `LOWER`, `SILHOUETTE`, `GROUND`, `ARTIFACTS`.
- One category is always active; menu pills are shown/hidden via wheel top `menu`.
- Category menu container is styled as a long rounded pill bar (`rounded-full`) with active category highlighted in white.
- Menu-triggered category pill bar is intentionally compacted (smaller container and smaller capsule buttons) to reduce visual dominance under the product row.
- Menu-triggered category pill bar is fixed-positioned above the clickwheel (not in normal document flow), preventing vertical layout shifts and preserving stable stage/info spacing.
- Menu open/close animation is anchored to the wheel/menu area (bottom-origin transform): pills now unfold upward from the menu with smooth fade + scale + slight lift for clearer “emerging from menu” motion.
- Menu pill bar sits much tighter above the clickwheel (reduced vertical offset) for a denser iPod-stack composition.
- Archive immersive keeps same category model, populated from current capsule items grouped by their source section.
- Hover/click behavior:
- Immersive cards reuse `GalleryHoverActions` (same `acquire/save/saved` in gallery mode and `acquire/delete` interaction in archive mode).
- In immersive, hover blur + pill actions are enabled only on the centered focus product; left/right side products do not expose hover actions.
- Focus-product hover is delayed and zone-gated: hover actions activate after a short delay (~140ms) only when pointer is inside a centered inner zone of the focus card (not merely near outer bounds).
- Click-through guard is preserved (`data-grid-action-hit`) so action pills do not trigger open.
- Click on non-focused side product no longer opens product view; it first shifts that clicked item into center focus.
- Product view opens from immersive only when the clicked product is already the centered focus item (or via clickwheel center/Enter).
- Click-to-focus now follows simple carousel semantics: clicking a non-focused card moves that target smoothly into center in one continuous transition (no timer-chained handoff phases).
- Arrow/menu navigation and non-focused card clicks share the same single-step motion profile (same easing + duration family), so focus in/out remains consistent and non-hectic.
- Rapid-click chaining is now enabled for card clicks + iPod left/right controls: repeated quick clicks shorten transition duration dynamically and continue motion flow instead of waiting for fully static focus settle after each step.
- Direct card-click navigation is explicitly one-step directional (`left click -> -1`, `right click -> +1`); helper far-edge slots are non-clickable to prevent ambiguous jump directions.
- Click-vs-drag arbitration is hardened: tiny pointer movement now resolves as click (no drag-settle animation side effects), and a short navigation lock prevents double-triggered focus moves from overlapping handlers.
- Immersive carousel rendering is now constrained to the core 5 visible slots (`-2..+2`) for click/scroll stability; extended helper slots were removed to eliminate background wrap/fly artifacts during left-direction transitions.
- Focus navigation now uses a virtual track index (unbounded) with modulo item lookup, so wrap-around categories (especially 5/6-item sets) no longer animate the same DOM item from one edge directly to the opposite edge.
- Edge-slot interpolation now uses soft extrapolation (instead of hard clamp at `-2/+2`), so outer products enter/exit with the same smooth progression as inner slots and do not appear to “snap fully in” too early.
- Gallery and Archive immersive now share the same carousel-item normalization: per-category item lists are loop-expanded to a stable minimum count for motion math consistency, so both modes keep equivalent click/scroll behavior quality.
- Focus in/out calmness was tuned further with slower easing and longer durations for click-to-focus sequencing, plus softer wheel/drag cadence to reduce visual aggression.
- Visible immersive cards now use stable item-instance keys (instead of focus-index-coupled keys), reducing remount flicker and improving slot-to-slot animation continuity.
- Vertical immersive rhythm now uses a shared responsive gap token between stage->info and info->menu lane; on narrower desktop widths this gap can shrink progressively down to ~50% of the large-screen value (and not beyond).
- Immersive row top offset is now viewport-responsive: as desktop width shrinks, the product row can move upward by up to ~80% of the configured top padding so composition stays under the divider while preserving wheel visibility.
- Clickwheel is viewport-fixed with increased bottom safe-padding; when viewport reduction makes wheel-to-text spacing too tight, the wheel (and menu pills) auto-hide to prevent visual collision.
- Bottom safe-padding for the fixed clickwheel was increased to keep more breathing room from the lower screen edge.
- Product open/transition behavior:
- Card click opens existing `/product-view` (same route as grid view).
- Immersive open writes the same transition payload keys (`unseen:product-view-transition`, optional text payload, `img` query param), so current zoom-in/zoom-out choreography remains shared with grid flow.
- Immersive state (`category`, focused `itemId`, archive `capsule`) is persisted in session storage (`unseen:immersive-state`) and restored on return for continuity.
- Immersive still consumes `unseen:return-focus-item` payloads for hygiene, but does not hide cards on return (to prevent visible product pop/disappear artifacts).

## Right category navigation (scroll/spy)

- Active file: `src/components/unseen/RightCategoryNav.tsx`
- Current mode: **FINAL 2** (left-side navigation)
- Positioning:
- Mounted as fixed overlay in `src/app/gallery/page.tsx`
- Left side: `left-5`
- Vertical placement: `top: calc(var(--sticky-h) + (var(--viewport-h) - var(--sticky-h)) / 2 - 32px)`
- Scrollspy:
- Uses `IntersectionObserver`
- Activation offset constant: `CATEGORY_FOCUS_OFFSET_PX = 200`
- Performance sync update (latest):
- Added `requestAnimationFrame`-based sync on window scroll in `RightCategoryNav.tsx` for immediate active-category updates while scrolling.
- Auto-scroll lock now releases on real user input (`wheel`, `touchstart`, `keydown`) to avoid "behind" behavior.
- Auto-scroll lock timeout reduced to `650ms` (from `1200ms`), and nav motion duration reduced to `150ms`.
- Click calming (expanded state):
- When clicking a category from the expanded list, visible active-label swap is slightly delayed (`140ms`) with a short suppression window (`260ms`) so the change feels calmer and less hectic.
- Core scrollspy correctness remains immediate; only the visual label swap is softened for expanded-click transitions.
- Click behavior:
- Smooth scroll to section (`scrollIntoView`)
- Hover behavior:
- Expanded list on hover/focus
- Close delay on leave (`180ms`) to prevent accidental collapse at edges
- Active label:
- `The–<Category>` (Inter + Instrument Serif), fixed center lane
- Vertical marker line on the left of label
- Marker line:
- Collapsed height: `26px`
- Expanded height: fixed `236px`
- Position changes dynamically with active category

## Saved navigation variants

- Version 1 backup: `src/components/unseen/RightCategoryNavV1.tsx`
- Version 2 backup: `src/components/unseen/RightCategoryNavV2.tsx`
- FINAL 1 backup: `src/components/unseen/RightCategoryNav_FINAL1.tsx` (right-side version)
- FINAL 2 active: `src/components/unseen/RightCategoryNav.tsx` + `src/app/gallery/page.tsx` (left-side version)
- Gallery FINAL 1 snapshot: `src/app/gallery/page_FINAL1.tsx`

## Layout spacing currently in gallery

- File: `src/app/gallery/page.tsx`
- Section scroll target offset:
- `scrollMarginTop: calc(var(--sticky-h) + 200px)`
- Section-to-section spacing:
- `mb-[236px]`
- Product row spacing within section:
- `gap-y-[148px]`
- Desktop grid columns:
- `lg:grid-cols-3`
- Grid shifted right to leave space for left nav:
- `lg:pl-[220px]`

## Product full view trigger behavior

- In `ProductTile`, clicking item id label, product image area, or brand/price meta opens product full view.
- Route pattern: `/product-view?item=<itemId>&mode=<gallery|archive>&back=<currentPathWithQuery>`.
- Route now also carries `img=<clickedItemImgSrc>` so product full view can reliably render the exact clicked product image as image 1.
- Grid open now stores return scroll context in `sessionStorage` (`unseen:return-scroll`: `backHref` + `scrollY`), and close navigation uses `router.push(backHref, { scroll: false })`.
- `src/components/unseen/ReturnScrollRestore.tsx` remains as lightweight fallback scroll restore when returning via `push` paths; it now runs minimal one-shot attempts to avoid visible jitter.
- Return scroll restore now retries via `requestAnimationFrame` for up to ~2s until page height can accommodate the target `scrollY`, preventing fallback-to-top when content/sticky layout finishes after initial mount.
- `src/app/product-view/page.tsx` resolves `searchParams` asynchronously (Next 16 compatible) so `item`/`img` query values are read reliably.
- Hover action pills are excluded from this navigation via click propagation stop in `GalleryHoverActions`.
- Product full view resolves product data from `src/data/mockCatalog.ts` and uses nearby catalog items as right-column related visuals.
- Grid-to-detail image handoff now stores source image rect in `sessionStorage` and runs a smooth shared-element-like zoom transition in `ProductImageRail` for matching `productId`.
- The stored image source rect is captured from the rendered tile `img` bounds (fallback: image container), improving start-position accuracy of the zoom origin.
- `ProductImageRail` also resolves image 1 src from the same fresh transition payload as a client-side fallback, ensuring clicked grid image remains image 1 reliably.
- Grid-to-detail text handoff now uses a calmer `ProductInfoTransition` enter animation on the left info block (subtle fade + small vertical settle), with slightly increased start latency (~140ms) and longer settle timing for a smoother appearance.
- Closing product full view via the `x` now runs reverse transitions (image + left info block) back toward the original grid source rects before routing to `back`.
- Product view supports white-space click-to-close: any click outside the left info block and outside product image hit areas triggers the same close flow as the top-right `x`.
- Left action pills are explicitly part of the non-closing hit area (`data-pv-info-hit="true"`), so clicking `acquire/save/saved` or capsule controls never triggers white-space close.
- The close `x` is viewport-fixed (independent from page scroll/layout flow) and sits tighter in the top-right corner with constant top/right padding.
- Close behavior tuning: on reverse transition, the left text block exits quickly (fast fade/translate), while the image returns with a longer, smoother zoom track to the grid position.
- Transition payloads are no longer eagerly removed after enter animation; reverse-close consumes the same payload keys with freshness checks.
- Product view image in/out zoom now uses transform-based compositor animation (translate3d + scale) instead of animating `left/top/width/height`, reducing visible jank/hitching.
- Image zoom transitions now enforce **uniform scale** (single factor from width/height fit), preserving product aspect ratio and preventing stretch/distortion during both zoom-in and zoom-out.
- Zoom-in now uses FLIP on the live detail `<img>` node (invert transform from stored grid rect, then play to identity) to avoid end-handoff popping.
- FLIP cleanup for zoom-in is now `transitionend`-driven (with timeout fallback) instead of fixed-duration cleanup, preventing first-click end jumps when initial render delays animation start.
- On close, the left info block now exits quickly via direct fade/blur/translate on the live node, while the product image performs the smoother longer reverse zoom back to grid.
- Close transition now routes back almost immediately while a fixed image overlay continues the reverse zoom, so grid reveal and zoom-out run simultaneously (prevents late static grid jump).
- Enter transition setup for product image/text now uses `useLayoutEffect` (instead of `useEffect`) to avoid first-frame jump/glitch on click before transforms are applied.
- Zoom-in no longer uses an overlay handoff layer; it animates directly on the rendered detail image for a stable end-state.
- Close handoff now triggers route navigation on next animation frame when reverse image animation starts, improving click-to-transition continuity and reducing micro-stutter.
- To reduce transition jank, text enter/close transitions now avoid blur filters and use transform+opacity only (compositor-friendlier).
- Reverse zoom-out image overlay now uses a strict full-distance FLIP move directly to the stored grid rect (no early cut/fade), matching zoom-in motion style for calmer close handoff.
- Reverse zoom-out now takes its start rect from the actual rendered detail `<img>` bounds (fallback: image wrapper) to prevent late-size jump caused by wrapper-vs-image geometry mismatch.
- Transition payload now carries `aspectRatio` from the clicked tile image; source rect capture in `ProductTile` uses the image’s contain-fitted rect inside the tile box (not raw container bounds), reducing geometry mismatch.
- Enter zoom in `ProductImageRail` now uses a fixed overlay handoff from stored source rect to the detail contain rect, with a very short static end-hold (~12ms) and then a tiny overlap crossfade (live image starts first, overlay fades right after) to avoid white-flash handoff glitches.
- Enter zoom-in timing in `ProductImageRail` is tuned slightly slower/softer (around ~780ms) for a calmer first-view arrival.
- Enter zoom-in end handoff now uses a longer overlay-to-live overlap window (~280ms): live image is made visible first and held while overlay fades out, reducing residual end-of-zoom brightness/glitch artifacts.
- During zoom-in enter flight, product-view scrolling is temporarily locked (same lock style as return zoom-out). Early wheel/touch/key intent is captured and replayed via a short velocity-based assist-scroll right after handoff completion, so users can start scrolling immediately at the unlock moment without dragging the flying image.
- Enter zoom-in endpoint alignment now uses the real live `<img>` bounding rect as target (fallback: contain-fit rect), and overlay source prefers `currentSrc`; this reduces end-of-zoom handoff mismatch/final-frame reload artifacts.
- Product image 1 in detail view now initializes intrinsic ratio from transition payload (`aspectRatio`) and keeps that ratio stable during zoom-in handoff; reveal waits for live image readiness before swapping from overlay to static node, reducing last-frame “rescale/reload” artifacts.
- Main-image aspect-ratio sync on product change now runs in `useLayoutEffect` (not `useEffect`) so ratio corrections happen before paint and do not create visible end-of-zoom resize/squeeze artifacts.
- Zoom-in FLIP motion now uses uniform scaling (single factor) with center-aligned target fitting, instead of separate `scaleX/scaleY`; this removes subtle last-frame width squeeze/stretch artifacts before the static detail image state.
- Zoom-in FLIP now uses exact endpoint geometry (`scaleX/scaleY` to live image rect) for final alignment, and end handoff intentionally keeps a brief live/overlay overlap window to mask final-frame pop/loading artifacts.
- Product view close now has two paths:
- If product image 1 is currently in viewport: use reverse image-return overlay to stored grid rect with full endpoint alignment while left text fades out.
- Reverse image-return overlay is clipped to the actually visible grid viewport (below sticky header, via `sticky-stack` bounds), so portions flying into non-visible regions correctly disappear under/behind sticky UI.
- Product image-return close animation is currently aligned to the zoom-in track timing (~780ms) and now uses a very short end-settle window (~24ms effective) with near-direct cleanup at landing (no extra ghost fade on the flying layer), while destination grid product reveal is delayed further (lead window ~180ms) to avoid mid-flight double-image artifacts.
- During this static end-hold, any real user scroll/input (`wheel`, `touchmove`, `scroll`, `keydown`) now dismisses the overlay immediately to prevent “dragging along” while the page moves.
- If active scroll intent is already present when reverse flight lands, the end-hold is skipped and the overlay is removed/unlocked immediately, preventing the in-flight element from visually sticking while user scroll continuation begins.
- Dismiss listeners are now attached during the flight already; if user input happens just before landing, overlay removal is triggered immediately on/after finish instead of waiting for a later event.
- Route-back trigger is now immediate on close start (`~0ms` delay), and destination-image reveal no longer has a minimum delay clamp, so overlap appears earlier in the timeline while preserving motion speeds.
- If user is scrolled to images 2/3/4 and image 1 is not in view: skip image-return and run a full product-view fade-out overlay.
- For both close paths, a persistent bridge layer is driven by `ReturnTransitionBridge` (mounted in root layout), triggered by `unseen:return-transition-start`; it is now clipped to start **below** the sticky stack so sticky header/nav do not get faded during return.
- Return bridge now uses Web Animations with explicit cancel/reset handling and **opacity-only** transitions (no backdrop blur), reducing end-of-return shadow/glitch artifacts.
- Return bridge timings are tuned to `raise ~110ms`, `hold ~220ms`, `fall ~1700ms` with subtle global fade (~0.05 target opacity), but for the image-return path (`canUseImageReturn`) the bridge is effectively disabled (targetOpacity/hold/fall set to 0) so only the flying image transition is visible, reducing mid-zoom-out layer conflicts.
- On reverse image-return close, the destination grid product image is temporarily hidden via session key (`unseen:return-focus-item` with `itemId` + `hideUntil`), so the flying overlay lands without double-image overlap; `hideUntil` is now aligned to `flight duration + settle window` (minus reveal lead), which reduces mid-flight ghost/double renders from early destination reappearance.
- Close-to-grid handoff primarily uses exact reverse FLIP endpoint alignment; the only tile-level adjustment is temporary hide/reveal of the matched destination image to prevent double-visibility during landing.
- In the 2/3/4-images close path (no image-return), the product-view fade-out overlay is tuned slightly shorter again (~520ms) while keeping early full-opacity drop-off.
- Return transition polish: close prefers `router.back()` (history return) with near-immediate latency (~16ms) after close starts; `push(backHref)` remains fallback. Sticky header/nav are not animated during return.
- Reverse zoom-out flight start is now frame-aligned (`requestAnimationFrame`) with compositor hints (`backface-visibility`, `translateZ(0)`, `contain`) on the motion layer/image, and close navigation has a tiny start delay (~24ms) to reduce first-moment hitching.
- During close return, page scroll is temporarily locked (html/body overflow + touch/overscroll suppression) from close-start; unlock is event-driven (`unseen:return-flight-finished`) and emitted at flight-end (before overlay settle fade). To avoid missed-event delays across route swaps, a session flag (`unseen:return-flight-finished-flag`) is also written and checked on mount; fallback timeout is shortened (~900ms).
- Return lock bootstrap now also clears any stale prior `unseen:return-flight-finished-flag` before setting a new lock, preventing accidental immediate unlock on a new close cycle (which could otherwise let the flying return image get dragged by early scroll).
- While return-lock is active, pre-unlock user scroll intent (wheel/touch/key) is captured both before and after route swap and persisted via `sessionStorage` (`unseen:return-scroll-intent` with direction + timestamp + magnitude). On unlock, a longer velocity-based assist-scroll bridge (rAF-driven) starts, and for a short grace window it keeps ingesting live wheel/touch/key input so continuous scroll attempts carry through seamlessly without forcing the user to stop and restart the gesture.
- Return-lock now also installs capture-phase hard blockers for `wheel`, `touchmove`, and scroll keys (`preventDefault`) until flight-finished unlock, so users cannot physically drag the in-flight return image while still preserving intent capture for post-unlock assist-scroll.
- `ProductInfoTransition` now force-resets inline transition styles (opacity/transform/transition/will-change) on fallback and cleanup, preventing cases where text stayed invisible after interrupted/strict re-renders.
- Product full view action row uses `src/components/unseen/ProductActionRow.tsx` and mirrors product-grid action logic:
- Gallery mode: `acquire` + two-step `save` flow (capsule picker, plus confirm, `saved` toggle)
- Archive mode: `acquire` + two-level delete hover interaction

## Product full view layout

- Product detail page: `src/app/product-view/page.tsx`
- Top-left id label uses pipe format (`|01|`) instead of square bracket format.
- Pipe label in product full view uses the same inner spacing treatment as product-grid IDs (`|` + `px-[2px]` number + `|`).
- Product full view title row is a single combined line: `|01|–Title`, using Inter for id/dash and Instrument Serif (italic) for title.
- In this combined title row, the ID block (`|01|`) now matches title scale/color (30px, ink) rather than small meta styling.
- ID + title live in one shared title textbox (`max-w-[460px]`) and follow the `Issue-04` typographic layout style with a slightly reduced scale (`text-[28px]`, `leading-none`), Inter with `tracking-[-0.06em]` for id/dash, Instrument Serif italic for title.
- Within that title row, Inter parts (id + dash) are set a subtle step smaller (`26px`) than the overall title scale.
- In that row, the dash spacing before title is slightly expanded for better legibility, while pipe glyphs remain slightly smaller to reduce vertical protrusion.
- Dash-to-pipe spacing is fine-tuned slightly tighter (`-ml-[2px]`, `px-[2px]`) for a closer `|01|–` lockup.
- The combined ID/title row is left-aligned (`justify-start`, `text-left`) and shares the same left edge as brand/price and description blocks.
- ID, dash, and title in that row use middle alignment (`items-center`) for a centered inline lockup.
- Divider line under title is removed; increased whitespace is used between title row and brand/price row.
- Title-to-brand/price spacing is intentionally generous (currently `mt-16`) to keep a calmer editorial rhythm.
- Product text column is intentionally narrower (`max-w-[460px]` for brand/price and description), and price is right-aligned to the same right edge as the description block.
- Product description body in full view uses Inter Regular (`font-normal`).
- Brand/price row, description, and action pills are now in one vertical stack with unified spacing (`gap-8`) between each row.
- Title uses `font-instrument` at `30px`, followed by a full divider line.
- Brand (left) and price (right) align on one row to divider width.
- Description is plain full-width paragraph text (no cue/Q blocks shown below).
- Action row uses same pill visual logic as grid actions (`acquire` + `save`), with archive-mode `acquire` hover using accent.
- Left text/info column is sticky on desktop; right image column is scroll-driven.
- Product full view uses symmetric horizontal padding (`px-10 sm:px-14 md:px-24 lg:px-28`) so left text-block inset and right image-to-edge inset match.
- On desktop, left sticky info block and first right-side product image align to the same vertical lane used by the left active category nav in product grid (derived from `--sticky-h` / `--viewport-h` center-lane positioning).
- Left sticky info block is shifted slightly higher via lane offset (`... / 2 - 260px`) for product full view default composition.
- Right image rail on desktop is horizontally centered in its column (not right-aligned).
- First right-side product image is vertically center-aligned with the left sticky text block in the default desktop view (not top-aligned).
- First right-side product image in default desktop view is intentionally shifted much higher (`lg:-mt-[180px]`) for stronger top emphasis.
- Right side renders main product image plus three additional images; numeric scroll anchor nav (1/2/3/4) has been removed.
- Desktop spacing between left text block and right image rail is increased for more whitespace separation.
- Main (first) product image in full view is reduced again and capped with explicit maximums (`max-w-[560px]`, `max-h-[68vh]`) so it does not overscale on very large screens; following detail images remain larger (`max-w-[562px]`).
- Main (first) product image in full view is loaded with high priority (`priority`, `fetchPriority=high`) and explicit `sizes` so it appears immediately on open.
- Vertical spacing between the first image and following images in the right rail is increased (larger `space-y` rhythm).
- Right image rail is now rendered via `src/components/unseen/ProductImageRail.tsx` (client component).
- A small gray downward scroll hint (`>`, rotated) appears centered below the first image only while no following image section is visible in the viewport; it fades out once any following image enters view.
- The scroll hint now has a subtle looping bob animation (gentle down/up) to improve discoverability.
- The scroll hint animation is now transform-only (bob movement without opacity keyframes) so hide/show opacity state remains reliable.
- The scroll hint is also one-time dismissible by user scroll: after the first meaningful page scroll, it stays hidden for the remainder of the view session.
- Dismiss triggers are robust: scroll delta, wheel/touch movement, or downward navigation keys (`ArrowDown`, `PageDown`, `Space`, `End`) all hide the hint permanently for the session.
- Image rail fade/blur is edge-only and image-column-scoped: top/bottom overlays are viewport-fixed (`top:0` / `bottom:0`) and width-matched to the measured rail bounds, so fade appears exactly at screen edges on the image column only.
- Edge fade is tuned to be much subtler and smoother: taller overlays (`h-10`) with low-opacity gradient stops (`from-paper/38`, `via-paper/14`) and very light blur (`0.6px`).
- Additional detail images currently sourced from:
- `public/mock/product-detail/01a.jpeg`
- `public/mock/product-detail/01b.jpeg`
- `public/mock/product-detail/01c.jpeg`
- In product full view image 1, a cue pill is anchored directly under the cursor while hovering.
- Cue display is limited to a defined inner product zone (not the outer white margins), so pills do not appear before entering the product area.
- Cue source uses all available comma-separated cue tokens from palette/surface/structure/accent (deduplicated), so full cue sets (typically 8+) are available.
- Cursor-follow is rAF-driven with LERP smoothing via refs (`translate3d` updates on the pill DOM node), avoiding React state updates on every pointer move.
- Cue switching is sequential loop-based (not position-indexed): while moving inside the active zone, cues advance in fixed order and wrap infinitely.
- Cue progression speed is movement-adaptive by travel distance/speed, with stronger low-vs-high velocity spread: slow hover has higher latency, while fast hover still advances cues quickly.
- Cue text transition remains smooth (~240ms in/out with slight translateY), and pill styling keeps a visible soft shadow.
- Cue pill is text-hugged again (no fixed max text width) with consistent horizontal padding around each cue label.
- Cue pill has no gray outline; fill is black by default and switches to accent blue once the product is in `saved` state (live-synced via `unseen:saved-items-updated` + storage checks).
- Cue active-zone top inset is reduced (starts around top 8% of image box) so upper image areas are included in hover logic.
- Cue pills are gated to fully settled full-view mode only: cues are disabled during zoom-in enter transition and immediately disabled again when zoom-out close starts (`unseen:product-view-closing`), so no cue display appears mid-transition.

## Mode switch hover

- In the top Gallery/Archive `ModePill`, hovering the inactive segment now darkens to `#E6E6E8` (instead of the previous lighter hover).

## Gallery edit mode state

- Component: `src/components/unseen/GalleryEditNav.tsx`
- Edit tab selection is URL-synced using `?edit=<tabId>` (default tab removes the param).
- This URL state is consumed by hover save-pill logic to resolve default capsule target.
- Active edit underline is now static per active button (no moving indicator animation), preventing underline glide artifacts during product-view close/return transitions.

## Working rules for next chats

- Preserve local font loading (no Google font fetching).
- Keep sticky measurement mechanism (`StickyHeightSync`) intact.
- Any change agreed with the user in chat must be reflected in this `AGENTS.md` in the same work session (keep this file up to date continuously).
- If editing nav behavior, preserve:
- click-to-scroll
- observer active-state sync
- edge-safe hover open/close
- If restoring old nav versions, copy from the saved variant files above.

## Quick checks

- Typecheck:
- `npx tsc --noEmit`
- Dev server:
- `npm run dev`

## Backend handoff notes

- Detailed backend integration checklist for capsules + saved products is stored at:
- `docs/backend-integration-checklist.md`
