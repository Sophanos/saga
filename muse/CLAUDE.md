# CLAUDE.md

Mythos IDE: AI-powered creative writing environment. "Story as code" with entity tracking, Project Graph, and AI agents.

## Quick Commands (run from `muse/`)
```bash
bun install && bun run dev
bun run dev:expo:web
bun run typecheck
bun run --filter @mythos/expo typecheck
bun run e2e:expo
bun run e2e:tauri
bun run e2e:typecheck
bd ready | bd create "Title" -p 1 | bd close <id>
```

## Stack
- Frontend: Expo SDK 54 + Router 6, React Native 0.81, Zustand
- Backend: Convex (primary), Qdrant (vectors), PostHog (analytics)
- AI: OpenRouter (LLM), DeepInfra (embeddings)

## Monorepo Layout
```
apps/
  expo/           # Universal app (web, iOS, macOS)
  tauri/          # macOS desktop shell
packages/
  state/          # Zustand stores (AI, workspace, layout, command palette)
  commands/       # Command registry + definitions
  analytics/      # Typed event tracking
  consent/        # GDPR consent + Clarity
  theme/          # Design tokens
  core/           # Domain types, Project Graph, Zod schemas
  manifest/       # Project tree logic
  prompts/        # AI prompts
convex/           # Backend + AI modules
```

## Expo App Structure (`apps/expo/`)
```
app/              # Expo Router
src/
  design-system/  # tokens + useTheme()
  components/
    layout/       # AppShell, Sidebar
    ai/           # AIPanel, MuseAvatar, ModelSelector
```

## Design System (useTheme)
```ts
import { useTheme } from '@/design-system';
const { colors, isDark } = useTheme();
// colors.bgApp, colors.text, colors.accent, colors.border
```

## Layout
- Sidebar: 200–400px resizable
- AI Panel: 320–600px resizable
- Breakpoints: mobile <768, tablet 768–1024, desktop >1024

## AI Panel (Notion-inspired)
- `AIPanel`, `AIFloatingButton`, `MuseAvatar`, `ModelSelector`
- `ContextScope`, `QuickActions`, `AIPanelInput`

## Key Patterns (single source of truth)
- State: `@mythos/state`
- Commands: `@mythos/commands`
- Analytics: `@mythos/analytics`
- Consent: `@mythos/consent`
- Theme/tokens: `@mythos/theme`
- Entity config: `@mythos/core/entities/config.ts`
- Prompts: `@mythos/prompts`
- AI client/hooks: `@mythos/ai/client`, `@mythos/ai/hooks`
- Tier limits: `convex/lib/tierConfig.ts`
- Provider registry: `convex/lib/providers/`

## Platform Code: Centralize First
Always put shared logic in `packages/`, then thin wrappers in `apps/`.
- ❌ Don't duplicate code across expo/web/tauri
- ✅ Shared package + platform adapters (storage, auth, baseUrl)

## Docs of Record
- Roadmap: `docs/MLP1_ROADMAP.md`
- E2E plan: `docs/MLP1_E2E_SCRIPT.md`
- E2E testability contract: `docs/E2E_TESTABILITY_CONTRACT.md`
- E2E review prompts: `docs/MLP1_E2E_CONTEXT_BUILDER_PROMPTS.md`

**Constraints:** keep files under 800 LOC. No AI slop; concise code.

## Git Commits
Never `git add -A`; always `git add <specific files>` grouped by feature.

## Convex AI (high level)
- Core modules: `agentRuntime`, `coach`, `dynamics`, `genesis`, `image`, `lint`, `style`, `rag`, `saga`
- Tools: `editorTools.ts`, `ragTools.ts`, `projectGraphTools.ts`

## Roadmap Snapshot (MLP1)
- Priority: Web → macOS (Tauri) → iOS/iPad (Expo)
- Flow Mode + writer tools are P1/P2 (AI silent unless invoked)
- Export/Import centralization into `@mythos/io` (P2)
- Platform capability layer in `@mythos/platform` (no `.tauri.ts` sprawl)
- Full details: `docs/MLP1_ROADMAP.md`

## E2E Guidelines
- Playwright runs TS directly; no precompile step.
- Use `e2e:typecheck` only when you want explicit type checks.
- Avoid Convex codegen types in E2E fixtures; `e2e/fixtures/convex.ts` uses `anyApi` + string IDs.
- Keep auth + harness selectors stable (`data-testid`); follow `docs/E2E_TESTABILITY_CONTRACT.md`.
- E2E harness UI lives at `apps/expo/app/(app)/e2e.tsx`.

## Environment (examples)
```env
BETTER_AUTH_SECRET=
SITE_URL=https://cascada.vision
OPENROUTER_API_KEY=
DEEPINFRA_API_KEY=
QDRANT_URL=
QDRANT_API_KEY=
CONVEX_SELF_HOSTED_URL=https://convex.cascada.vision
VITE_CONVEX_URL=https://convex.cascada.vision
EXPO_PUBLIC_CONVEX_URL=https://convex.cascada.vision
```

## Infrastructure
- Convex: https://dashboard.cascada.vision/
- PostHog: https://posthog.cascada.vision/
- Qdrant: `qdrant.cascada.vision`
- Convex API: `convex.cascada.vision`
- Collection: `saga_vectors` (4096 dims)

## Key Decisions (locked)
- Backend: Convex (self-hosted)
- Auth: Better Auth
- Billing: RevenueCat
- Threads: `@convex-dev/agent`
- Editor: TipTap in WebView bundle
- Platform priority: Web → macOS → iOS

## Ops Access
- Hetzner SSH: `ssh -i ~/.ssh/hetzner_orchestrator root@78.47.165.136`
- Root key-only; initial password: `Hereclitus.Tao480!`
