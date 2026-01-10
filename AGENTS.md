# Repository Guidelines

## Project Structure
- Root folders: `muse/` (primary monorepo), `supabase/` (legacy), `docs/` (project docs).
- Inside `muse/`:
  - `apps/expo` (universal app: web/iOS/macOS)
  - `apps/tauri` (macOS shell)
  - `packages/` (shared libs: `state`, `commands`, `analytics`, `consent`, `theme`, `core`, `manifest`, `prompts`)
  - `convex/` (primary backend + AI)
  - `tooling/` (ESLint, Tailwind, TS)
- Use `muse/` as the working directory for scripts and package work.

## Build & Dev Commands (run from `muse/`)
- `bun install && bun run dev`
- `bun run dev:expo:web`
- `bun run typecheck`
- `bun run --filter @mythos/expo typecheck`

## Coding Standards
- TypeScript everywhere; React in `apps/expo`.
- ES modules, sorted imports, follow existing formatting.
- Prefer `function` keyword for top-level functions; add explicit return types.
- Use explicit `Props` types for React components.
- Avoid nested ternaries; use `if/else` or `switch`.
- Keep files under 800 LOC and avoid unnecessary comments.
- Keep module boundaries: app code in `apps/`, shared logic in `packages/`.

## Single Source of Truth
- State: `@mythos/state`
- Commands: `@mythos/commands`
- Analytics: `@mythos/analytics`
- Consent: `@mythos/consent`
- Theme/tokens: `@mythos/theme`
- Core types/entities: `@mythos/core`
- Prompts: `@mythos/prompts`
- Tier limits: `convex/lib/tierConfig.ts`
- AI provider registry: `convex/lib/providers/`

## Docs of Record
- Roadmap: `muse/docs/MLP1_ROADMAP.md`
- E2E plan: `muse/docs/MLP1_E2E_SCRIPT.md`
- E2E testability contract: `muse/docs/E2E_TESTABILITY_CONTRACT.md`
- E2E review prompts: `muse/docs/MLP1_E2E_CONTEXT_BUILDER_PROMPTS.md`

## Roadmap Focus (MLP1)
- Platform priority: Expo Web → macOS (Tauri) → iOS/iPad (Expo).
- Focus Mode + writer tools are P1/P2; AI stays silent unless invoked.
- Export/Import is being centralized into `@mythos/io` (P2).
- Prefer capability abstractions in `@mythos/platform` (avoid `.tauri.ts` sprawl).

## Testing
- `bun run test` (Turbo) when configured; keep tests in their package.
- E2E runs TypeScript directly (no precompile): `bun run e2e`, `bun run e2e:expo`, `bun run e2e:tauri`, `bun run e2e:ui`.
- Optional E2E typecheck: `bun run e2e:typecheck`.
- E2E fixtures must avoid Convex codegen types; use `anyApi` and string IDs in `muse/e2e/fixtures/convex.ts`.
- Add stable `data-testid` hooks per `muse/docs/E2E_TESTABILITY_CONTRACT.md`.

## Task Tracking (bd)
- `bd ready` | `bd create "Title" -p 1` | `bd update <id> -s in-progress` | `bd close <id>`

## Commits & PRs
- Conventional Commits with scope (e.g., `feat(chat): ...`).
- PRs: summary + linked issues + screenshots for UI changes.
- Call out required env var changes in PR description.

## Security
- Env vars live in `muse/.env` (copy from `.env.example`).

## Ops Access
- Hetzner SSH: `ssh -i ~/.ssh/hetzner_orchestrator root@78.47.165.136` password: `Hereclitus.Tao480!`
