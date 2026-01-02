# Repository Guidelines

## Project Structure & Module Organization
- Root folders: `muse/` (primary monorepo), `supabase/` (root-level backend resources), `docs/` (project docs).
- Inside `muse/`: `apps/web` (React SPA), `packages/` (shared libs like `ai`, `core`, `db`, `editor`, `ui`, `theme`, `prompts`), `supabase/functions` (Edge Functions), `tooling/` (ESLint, Tailwind, TypeScript).
- Use `muse/` as the working directory for scripts and package development.

## Build, Test, and Development Commands
Run these from `muse/`:
- `bun install` — install workspace dependencies.
- `bun run dev` — start the full Turborepo dev workflow.
- `bun run --filter @mythos/web dev` — run only the web app.
- `bun run typecheck` — TypeScript checks across packages.
- `bun run lint` — ESLint checks using shared config in `tooling/`.
- `bun run build` — build all packages and apps.
- `bun run test` — run package tests via Turbo (when configured).
- `bun run --filter @mythos/core typecheck` — example of scoped checks for a single package.

## Coding Style & Naming Conventions
- Language: TypeScript across apps and packages; React in `apps/web`.
- Follow existing file formatting and ESLint rules (see `muse/tooling/eslint`).
- Keep module boundaries clear: app-specific code in `apps/`, shared logic in `packages/`.
- For Supabase functions, keep entrypoints in `muse/supabase/functions/` and name functions by purpose (e.g., `ai-lint`, `ai-chat`).

## Testing Guidelines
- Tests are orchestrated by Turbo via `bun run test`. Ensure any new test scripts are wired into the package where they live.
- No repo-wide naming convention is documented; use the testing framework’s default conventions within each package and keep them consistent.

## Task Tracking (bd)
- Use the `bd` CLI for task tracking: `bd ready`, `bd create "Title" -p 1`, `bd update <id> -s in-progress`, `bd close <id>`.
- Keep task titles concise and link related PRs/issues in task notes.

## Commit & Pull Request Guidelines
- Commit history follows Conventional Commits with scopes (e.g., `feat(chat): ...`, `fix(image): ...`, `refactor(image-tools): ...`). Keep this style.
- PRs should include: a clear summary, linked issues (if any), and screenshots for UI changes.
- Note any required env var changes in the PR description.

## Security & Configuration Tips
- Environment variables live in `muse/.env` (copy from `.env.example`). Never commit secrets.
- Supabase keys and AI provider keys are required for full functionality.
- RAG features need `DEEPINFRA_API_KEY` and `QDRANT_URL`/`QDRANT_API_KEY`; avoid logging these in client code.
