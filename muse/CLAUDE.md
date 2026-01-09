# CLAUDE.md

Mythos IDE - AI-powered creative writing environment. "Story as code" with entity tracking, World Graph for relationships, AI agents for feedback.

## Commands

```bash
# Dev
bun install && bun run dev
bun run dev:expo:web    # Expo web app
bun run typecheck       # All packages

# Single package
bun run --filter @mythos/expo typecheck

# Task tracking (beads)
bd ready | bd create "Title" -p 1 | bd close <id>
```

## Architecture

See `docs/UI_ARCHITECTURE.md` for full details.

### Stack
- **Frontend**: Expo SDK 54 + Router 6, React Native 0.81, Zustand
- **Backend**: Convex (primary), Qdrant (vectors), PostHog (analytics)
- **AI**: OpenRouter, DeepInfra (embeddings)

### Monorepo
```
apps/
  expo/           # Universal app (web, iOS, macOS)
  tauri/          # macOS desktop app
packages/
  state/          # Zustand stores (AI, workspace, layout, command palette)
  commands/       # Command registry and definitions
  analytics/      # Typed event definitions
  theme/          # Design tokens (colors, typography, spacing, shadows)
  core/           # Domain types, World Graph, Zod schemas
  manifest/       # Project tree logic (chapters, entities, memories)
  prompts/        # AI prompts
```

### Expo App Structure (`apps/expo/`)
```
app/              # Expo Router (file-based)
src/
  design-system/  # Local tokens + re-exports from @mythos/state
    colors.ts     # Light/dark palette
    tokens.ts     # Spacing, sizing, radii, typography
    theme.ts      # useTheme() hook
  components/
    layout/       # AppShell, Sidebar (resizable)
    ai/           # AIPanel, MuseAvatar, dropdowns
```

## Design System

All design tokens in `apps/expo/src/design-system/`:

```typescript
// Colors
import { useTheme } from '@/design-system';
const { colors, isDark } = useTheme();
// colors.bgApp, colors.text, colors.accent, colors.border

// Entity colors (same in both themes)
entityColors.character  // purple
entityColors.location   // green
entityColors.item       // amber

// Tokens
spacing[4]  // 16px
radii.lg    // 12px
typography.sm  // 13
```

## AI Panel System

Notion-inspired AI chat in `src/components/ai/`:

| Component | Purpose |
|-----------|---------|
| `AIPanel` | Main chat (sticky/floating/detached) |
| `AIFloatingButton` | FAB when panel hidden |
| `MuseAvatar` | AI persona with breathing animation |
| `ModelSelector` | Model picker dropdown |
| `ContextScope` | Context source toggles |
| `QuickActions` | Writer-focused action cards |
| `AIPanelInput` | Rich input with @ mentions |

### AI Store (`@mythos/state`)
```typescript
import { useAIStore, useLayoutStore, useCommandPaletteStore } from '@mythos/state';

const { selectedModel, enabledScopes, sendMessage } = useAIStore();
// Models: auto, claude-sonnet, claude-opus, gemini-flash, gpt-4o
// Scopes: scene, chapter, project, entities, world, notes
```

## Layout

Resizable panels in `AppShell`:
- Sidebar: 200-400px, drag to resize
- AI Panel: 320-600px, drag to resize
- Breakpoints: mobile (<768), tablet (768-1024), desktop (>1024)

```typescript
import { useLayoutStore, LAYOUT_SIZING } from '@mythos/state';

const { sidebarWidth, setSidebarWidth, aiPanelWidth, setAIPanelWidth } = useLayoutStore();
```

## Key Patterns

**Single source of truth**:
- State stores → `@mythos/state` (AI, workspace, layout, command palette)
- Commands → `@mythos/commands` (registry and definitions)
- Analytics → `@mythos/analytics` (typed events)
- Theme → `@mythos/theme` (colors, typography, spacing, shadows)
- Entity config → `@mythos/core/entities/config.ts`
- AI prompts → `@mythos/prompts`
- Tier limits → `convex/lib/tierConfig.ts` (memory retention, quotas, features)

**File size limit**: Keep files under 800 LOC.

**No AI slop**: Clean, concise code. No unnecessary comments.

## Environment

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
OPENROUTER_API_KEY=
DEEPINFRA_API_KEY=
QDRANT_URL=
QDRANT_API_KEY=
```

## Infrastructure

**Dashboards:**
- Convex: https://dashboard.cascada.vision/
- PostHog: https://posthog.cascada.vision/

**Services (Hetzner VPS 78.47.165.136):**
- Qdrant: `qdrant.cascada.vision`
- PostHog: `posthog.cascada.vision`
- Convex API: `convex.cascada.vision`
- Collection: `saga_vectors` (4096 dims)

## Current Phase

**Phase 1: Foundation** ✅
- Expo SDK 54 + Router 6
- Design tokens, theme hook
- AppShell with resizable panels
- AI Panel with Muse avatar

**Phase 2: MLP UI** 🔜
- Editor component
- Entity forms/cards
- Chat message list
- Tool execution cards

**Self-Hosted: Convex, Posthog, Qdrant, BetterAuth:**
```bash
ssh -i ~/.ssh/hetzner_orchestrator root@78.47.165.136
# Root prefers key-only (initial password: Hereclitus.Tao480!)
```