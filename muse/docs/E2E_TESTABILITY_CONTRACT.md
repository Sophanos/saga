# E2E Testability Contract (MLP1)

## Purpose
Keep Playwright E2E tests stable across Expo Web and Tauri Web by guaranteeing a small, consistent set of selectors and deterministic UI states.

## Scope
Applies to MLP1 journeys (auth, editor, entities/world graph, AI chat, RAG, collaboration, billing) and upcoming P1/P2 writer tools (Focus Mode, grammar/style, logic checks).

## Contract
- Every E2E-relevant interactive control must expose a stable `data-testid` (Expo uses `testID`, which maps to `data-testid` on web).
- Test IDs must be semantic and stable; never depend on visible copy, translated text, or placeholder text.
- Error and empty states must expose a single container test ID (e.g., `auth-error`).
- Dynamic lists must expose stable row IDs (e.g., `entity-row-<id>`), not index-based selectors.
- Provide a deterministic E2E path behind `E2E_TEST_MODE` for AI/embeddings and other non-deterministic APIs.
- For keyboard-only shortcuts, expose a secondary UI path so tests can reach the same state without relying on key combos.

## Naming Conventions
- `auth-*` for login/signup/reset/signout
- `editor-*` for editor surface, focus mode, writing tools
- `chat-*` for AI panel + streaming
- `world-graph-*` for entity graph
- `billing-*` for subscription UI

## Focus Mode + Writer Tools (MLP1 Roadmap)
- Focus Mode toggle, timers, word goals, and session stats must each have a test ID.
- Writer tools (grammar, logic, name generation) must expose test IDs for trigger controls, result panels, and approval/undo actions.

## Test Hygiene
- Prefer `getByTestId()` in Playwright; use text/placeholder selectors only as a fallback.
- For seeded test data, use `PLAYWRIGHT_RUN_ID` and deterministic fixtures to keep state reproducible.
- Avoid Convex codegen types in E2E fixtures; use `anyApi` and string IDs.
- Playwright runs TypeScript directly; do not rely on precompiled `.compiled` output.
