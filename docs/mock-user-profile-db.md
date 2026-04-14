# Mock User Profile DB (Test Setup)

## Current Test Setup

- Source file: `src/data/mockUsers.ts`
- Seeded user: `userId = 1` (`Juna`)
- Reference set: `30` images under `public/mock/users/juna/reference-set`

## Profile Fields (Mock)

- `name`
- `email`
- `password` (mock plain text only, never for production)
- `onboardingUploadSourcePath`
- `referenceSetForMainEdit` (30 images)
- `vector` (placeholder; backend engine later)
- `tasteDescription` (LLM-generated placeholder content for test)
- `tasteAttributes` (LLM-generated placeholder content for test)
- `futureUserBehavior` (placeholder)

## Planned Real Backend Mapping

1. Onboarding writes `name`, `email`, and uploaded reference images.
2. Vector engine computes and persists `vector`.
3. LLM taste engine computes and persists `tasteDescription`.
4. LLM taste engine computes and persists `tasteAttributes`.
5. Later: user behavior pipeline writes `futureUserBehavior`.

## Important

This setup is intentionally a mock layer for UI/flow testing only.
Final integration must target the real production database with secure auth and hashed passwords.
