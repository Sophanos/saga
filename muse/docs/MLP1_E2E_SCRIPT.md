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

## Environment Variables
Required:
- `CONVEX_URL` (dedicated E2E deployment for backend polling/setup; do not rely on the default fallback)
- `EXPO_PUBLIC_CONVEX_URL` / `EXPO_PUBLIC_CONVEX_SITE_URL` (as required by local dev)
- `EXPO_PUBLIC_E2E=true` (enable the Expo E2E harness route)
- `E2E_TEST_MODE=true` (enable deterministic E2E harness paths)
- `E2E_TEST_SECRET` / `PLAYWRIGHT_E2E_SECRET` (shared secret for Convex E2E mutations/actions)
- `QDRANT_URL` (required for E2E-06 RAG pipeline)

Optional / recommended:
- `PLAYWRIGHT_START_SERVERS=true` (auto-start Expo/Tauri web servers)
- `PLAYWRIGHT_CONVEX_URL` (override Convex URL for tests)
- `PLAYWRIGHT_EXPO_URL` (default `http://localhost:19006`)
- `PLAYWRIGHT_TAURI_URL` (default `http://localhost:1420`)
- `VITE_E2E=true` (disable autosave unload prompts + embeddings for web/tauri E2E)
- `PLAYWRIGHT_TARGETS` (comma list of projects for storage setup, e.g. `expo-web,tauri-web`)
- `PLAYWRIGHT_RUN_ID` (stable E2E user suffix)
- `PLAYWRIGHT_E2E_PASSWORD` (override default E2E password)
- `E2E_MOCK_AI=true` (recommended for CI reliability)
- `OPENROUTER_API_KEY` (only if not using mock mode)

Notes from local runs:
- Expo E2E requires `EXPO_PUBLIC_E2E=true` to expose the harness route and sign-in flow.
- If you source `.env` in a shell, ensure values with `|` or spaces are quoted or exported safely; otherwise `source`/`set -a` can fail.
- If you pass env inline to `bun run e2e`, that overrides `.env` cleanly without shell parsing issues.

## E2E-01: Infrastructure
### Scope
- Playwright multi-project config (`expo-web`, `tauri-web`)
- Global setup to create storageState per origin
- Auth + Convex fixtures
- Polling utilities for debounced autosave and eventual consistency

### Artifacts
- `muse/e2e/playwright.config.cjs`
- `muse/e2e/tsconfig.json` (optional typecheck config)
- `muse/e2e/global-setup.ts`
- `muse/e2e/fixtures/auth.ts`
- `muse/e2e/fixtures/convex.ts`
- `muse/e2e/utils/wait-for.ts`

### Notes
- Playwright runs TypeScript directly; there is no precompile step.
- E2E fixtures use `anyApi` to avoid Convex codegen type graph; IDs are treated as strings.

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
- E2E harness IDs: `e2e-project-id-value`, `e2e-document-id-value`.
- Editor selectors: `editor-view`, `editor-surface`, `editor-title`, `editor-document-id`.
- Autosave selectors: `autosave-status` (text + `data-status`), `autosave-error`.
- Prefer verifying persistence by polling Convex (`e2e.getDocumentForE2E`) rather than relying on timeouts.

## E2E-04: Entity Detection + World Graph
### Scenarios
1. Provide text containing entities (“Elena walked to the Citadel.”)
2. Trigger detection via the detect-and-persist action
3. Persist detected entities into Convex `entities`
4. Run detection again with an alias variant; assert idempotency + alias merge
5. Open World Graph and verify entity nodes + counts
6. Toggle a type filter and verify counts + visibility update
7. Verify at least one relationship edge label renders

### Artifacts
- `muse/e2e/entities.spec.ts`
- `muse/convex/e2e.ts` (detection fixtures)
- `muse/apps/web/src/components/world-graph/*` (test ids)

### Dependencies / Notes
- Detection uses deterministic fixtures in E2E mode (`E2E_TEST_MODE=true`).
- World Graph selectors: `world-graph-view`, `wg-node-<entityId>`, `wg-edge-<relationshipId>`, `wg-entity-count`, `wg-relationship-count`, `world-graph-toggle-<type>`.
- Run on `tauri-web` (web app); Expo does not include World Graph yet.

---

# E2E-05–08 (Implemented)

## E2E-05: AI Agent Chat + Streaming
### Scenarios
1. Start a new thread; send a message; verify streamed tokens appear in UI
2. Verify tool-approval request rendering (ask_question)
3. Answer a tool approval and confirm the agent resumes streaming

### Artifacts
- `muse/e2e/ai-chat.spec.ts`
- `muse/convex/e2e.ts` (saga scripts)
- Chat selectors: `chat-open`, `chat-input`, `chat-send`, `chat-message-assistant`, `tool-approval-request`, `tool-approval-input`, `tool-approval-accept`

### Notes
- Deterministic streaming enabled in `E2E_TEST_MODE` via saga scripts.
- Runs on `tauri-web` (AI sidebar).

## E2E-06: RAG Pipeline (Embeddings → Qdrant → Search)
### Scenarios
1. Create doc with unique phrase; process embedding jobs immediately
2. Query RAG context; verify document preview contains phrase

### Artifacts
- `muse/e2e/rag.spec.ts`
- `muse/convex/e2e.ts` (`processEmbeddingJobsNow`, `retrieveRagContext`)

### Notes
- Requires `QDRANT_URL` and `E2E_TEST_MODE=true` for deterministic embeddings.
- Deterministic embeddings use a token-hash bag-of-ngrams so multi-doc retrieval stays stable.

## E2E-07: Real-Time Collaboration
### Scenarios
1. Two browser contexts sign in as two users
2. Both open same document
3. User A types; user B sees updates
4. (When editor-webview is active) remote cursor label appears

### Artifacts
- `muse/e2e/collaboration.spec.ts`
- `muse/packages/editor-webview/src/components/CollaborativeEditor.tsx` (collab editor test id)

### Notes
- Deterministic open uses `mythos:lastProjectId` + `mythos:lastDocumentId` before navigation.
- Collab selectors: `collab-editor`, `editor-surface`, `remote-cursor-<userId>`, `remote-cursor-label-<userId>`.

## E2E-08: Billing + Tier Limits
### Scenarios
1. Mock billing-subscription response; verify tier + tokens in UI
2. Upsert subscription state via E2E harness; verify tier resolution

### Artifacts
- `muse/e2e/billing.spec.ts`
- `muse/convex/e2e.ts` (`upsertSubscription`, `getUserTierForE2E`)
- Billing selectors: `project-billing-button`, `billing-modal`, `billing-current-tier`, `billing-tokens-remaining`

### Notes
- Billing snapshot served by Convex HTTP action `/api/billing-subscription`; optional `projectId` enables memory + vector usage details.

---

## How to Run
- Install browsers: `bun run e2e:install`
- Optional typecheck: `bun run e2e:typecheck`
- Expo E2E: `bun run e2e:expo`
- Tauri (web content) E2E: `bun run e2e:tauri`
- Full suite: `bun run e2e`
- Debugging helpers: `--headed`, `--ui`, `--debug`, `--last-failed`, `-g "title"`

Observed behavior (local):
- `bun run e2e -- --project=expo-web e2e/ai-chat.spec.ts` still expanded to both `expo-web` and `tauri-web` via the script. Use `e2e:expo` or update the script if you need a strict single-project run.
- Playwright runs TypeScript directly; use `bun run e2e:typecheck` if you want explicit typechecking for E2E.

## Known Issues / Remaining Work
- Global setup can time out waiting for the Expo sign-in form or auth token; ensure the Expo server is ready and auth env is set (Better Auth + Convex URLs).
  - If auth routes or selectors change, update `muse/e2e/fixtures/auth.ts`.
  - If sign-in fails, surface the error via `auth-error` and verify credentials/env.

## Output
- HTML report: `playwright-report/`
- Test artifacts: `test-results/`
