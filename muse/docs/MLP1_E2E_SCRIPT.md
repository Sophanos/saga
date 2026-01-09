# MLP1 E2E Script

## Purpose
This document defines the end-to-end (E2E) test plan for MLP1 and outlines future E2E phases (E2E-05 through E2E-08). It is written to be executable by Playwright (web) and extensible to desktop-native automation later.

## Targets
- Expo Web app (primary): `http://localhost:19006` (or `:8081` depending on dev mode)
- Tauri Dev (web content validation): `http://localhost:1420`

Note: “Tauri native shell” automation is not covered by Playwright alone in a robust way. When we need OS-level coverage, we will add a WebDriver-based native harness.

## Test Data Rules
- All E2E data must be isolated to a dedicated Convex deployment and (if applicable) a dedicated Qdrant namespace.
- Projects created by E2E must be named with a prefix: `E2E/<suite>/<timestamp>` for easy cleanup.
- Use unique emails per run: `e2e+<runId>@example.com`.

## Required Environment Variables
- `PLAYWRIGHT_EXPO_URL` (optional) default `http://localhost:19006`
- `PLAYWRIGHT_TAURI_URL` (optional) default `http://localhost:1420`
- `PLAYWRIGHT_WEB_URL` (optional) default `http://localhost:5173` (only for web-spa project)
- `PLAYWRIGHT_TARGETS` (optional) comma list of projects for storage setup (e.g. `expo-web,tauri-web`)
- `CONVEX_URL` (required for backend polling/setup)
- `EXPO_PUBLIC_CONVEX_URL` / `EXPO_PUBLIC_CONVEX_SITE_URL` (as required by local dev)
- `OPENROUTER_API_KEY` (only if not using mock mode)
- `E2E_MOCK_AI=true` (recommended for CI reliability)
- `EXPO_PUBLIC_E2E=true` (enable the Expo E2E harness route)

## E2E-01: Infrastructure
### Scope
- Playwright multi-project config (`expo-web`, `tauri-web`, optional `web-spa`)
- Global setup to create storageState per origin
- Auth + Convex fixtures
- Polling utilities for debounced autosave and eventual consistency

### Artifacts
- `muse/e2e/playwright.config.ts`
- `muse/e2e/global-setup.ts`
- `muse/e2e/fixtures/auth.ts`
- `muse/e2e/fixtures/convex.ts`
- `muse/e2e/utils/wait-for.ts`

## E2E-02: Authentication
### Scenarios
1. Unauthenticated access to `/` redirects to `/sign-in`
2. Sign-up creates account and lands on `/`
3. Sign-in lands on `/`
4. Sign-out returns to `/sign-in`
5. Invalid credentials show an error message

### Dependencies / Notes
- Must have a visible sign-out UI control with a stable test id.
- Better Auth email verification must remain disabled in test environments.

## E2E-03: Projects + Documents + Editor Persistence
### Scenarios
1. Create a project (via E2E harness)
2. Create a document under the project
3. Open editor for that document
4. Type content; wait until content is visible and persisted
5. Reload; verify content is still present

### Dependencies / Notes
- If the Sidebar is still using mocks, either:
  - wire it to Convex queries/mutations, or
  - use the E2E-only harness screen to create/select projects and documents.
- Editor must expose a stable locator for typing (e.g., `data-testid="editor-surface"`).
- Prefer verifying persistence by polling Convex (`api.documents.get`) rather than relying on timeouts.

## E2E-04: Entity Detection + World Graph
### Scenarios
1. Provide text containing entities (“Elena walked to the Citadel.”)
2. Trigger detection via the detect-and-persist action
3. Persist detected entities into Convex `entities`
4. Verify entities exist
5. Optionally open World Graph view and verify nodes + counts

### Dependencies / Notes
- Detection must have a deterministic mock mode for CI (`E2E_MOCK_AI=true`).
- A single backend entrypoint should exist for “detect + persist” to avoid duplicating logic in UIs.
- World Graph UI tests are best run against the `@mythos/web` app (optional `web-spa` project).

---

# Future Phases

## E2E-05: AI Agent Chat + Streaming
### Goal
Validate that the AI panel streams responses reliably and attaches tool calls/results correctly.

### Scenarios
1. Start a new thread; send a message; verify streamed tokens appear in UI
2. Verify tool-call chunk rendering (if using generationStreams)
3. Verify thread mapping is created in `sagaThreads`
4. Verify retry/fallback behavior (if configured) does not break UI state

### Dependencies
- Stable test selectors for AI panel input/output
- Deterministic mock model mode for CI (optional but strongly recommended)

## E2E-06: RAG Pipeline (Embeddings → Qdrant → Search)
### Goal
Validate that content changes lead to embedding jobs and that search retrieves expected results.

### Scenarios
1. Create doc with unique phrase; wait for embedding job completion
2. Search for phrase; verify top result is the doc
3. Update doc; verify embedding refresh and search results update
4. Delete doc/project; verify vector delete jobs execute

### Dependencies
- Observable embedding job status in UI or accessible via Convex queries
- Dedicated test Qdrant instance/collection isolation
- Deterministic embedding mode for CI if required

## E2E-07: Real-Time Collaboration
### Goal
Validate multi-user editing: presence, cursors, and synchronized doc state.

### Scenarios
1. Two browser contexts sign in as two users
2. Both open same document
3. User A types; user B sees updates
4. Presence indicators show both users
5. Conflict-free merges across edits

### Dependencies
- Two test accounts
- Collaboration UI selectors and a stable way to open same doc in both contexts

## E2E-08: Billing + Tier Limits
### Goal
Validate feature gating and usage limits (free/pro entitlements).

### Scenarios
1. Free user cannot access premium features (or sees upgrade prompt)
2. Pro user can access premium features
3. Usage counters increment and enforce limits
4. Subscription status changes are reflected in UI

### Dependencies
- Test-mode RevenueCat/Stripe configuration
- A deterministic way to set subscription state (admin action or webhook replay)
- Clear UI selectors for gated features and upgrade prompts

---

## How to Run
- Install browsers: `bun run e2e:install`
- Expo E2E: `bun run e2e:expo`
- Tauri (web content) E2E: `bun run e2e:tauri`
- Web SPA (World Graph): `bun run e2e:web` (start `@mythos/web` dev server separately)
- Full suite: `bun run e2e`

## Output
- HTML report: `playwright-report/`
- Test artifacts: `test-results/`
