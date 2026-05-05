# The Unseen Mobile Contract (iPhone First)

This document defines the mandatory rules for mobile behavior so all mobile work remains consistent, high-end, and regression-safe.

## 1) Mobile Identification Rules

Use capability + width, not user-agent device names, as the primary selector.

- `mobileWidth`: viewport width `<= 767px`
- `touchPrimary`: `(hover: none) and (pointer: coarse)`
- `mobileExperience`: `mobileWidth && touchPrimary`

UA/device-specific checks are allowed only as targeted fallbacks for known browser bugs.

## 2) Primary Target Viewports

Design and QA for these iPhone CSS viewport sizes:

1. `390 x 844` (primary reference)
2. `375 x 812`
3. `430 x 932`

## 3) Route Scope and Rollout Order

Implement mobile behavior route-by-route in this exact order:

1. `/gallery`
2. `/product-view`
3. `/archive`
4. `/onboarding` and `/profile`
5. `/gallery/immersive` and `/archive/immersive`

Do not work on later routes before the current route is stable on real iPhone Safari.

## 4) Architecture Rule

For each route:

- Keep one shared controller/state layer for business logic and data flow.
- Render either desktop or mobile view from a wrapper.
- Keep shared payload formats and URL/query contracts identical.

Pattern:

- `RouteController` (shared data, params, save-state, navigation)
- `RouteDesktopView`
- `RouteMobileView`
- `RouteWrapper` chooses mobile/desktop via `mobileExperience`

## 5) UX and Motion Principles (App-like Browser Feel)

- Touch-first interactions; no hover dependency in mobile experience.
- Stable visual rhythm with tokenized spacing and safe-area handling.
- Motion uses `transform` + `opacity` only; avoid layout-thrashing animations.
- Keep transitions calm and short; no abrupt state jumps.
- Ensure all primary actions are thumb-reachable.

## 6) iOS Browser Technical Requirements

- Use dynamic viewport units (`dvh`/`dvw`) where relevant.
- Respect safe areas via `env(safe-area-inset-top/right/bottom/left)`.
- Prevent iOS input zoom by keeping input font-size at least `16px`.
- Resolve gesture conflicts explicitly (vertical scroll vs horizontal swipe).

## 7) QA Gate Per Route (Required)

Before moving to the next route, verify:

1. Desktop behavior is unchanged (no regression).
2. iPhone Safari real-device pass.
3. iPhone Chrome real-device pass.
4. Core flow pass: navigation, actions, open/close, back behavior, scroll restore.
5. Performance pass: no obvious jank during interactions and transitions.

## 8) Delivery Rule

Ship in small incremental PRs:

1. Foundation (detection + tokens + wrappers, minimal visual change)
2. Route-specific mobile behavior
3. Route QA and polish

No large multi-route mobile merges.
