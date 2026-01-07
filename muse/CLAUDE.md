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
  web/            # Legacy React SPA (deprecated)
packages/
  core/           # Domain types, World Graph, Zod schemas
  theme/          # Design tokens (colors, typography, spacing)
  ui/             # Shared components
  db/             # Supabase client (legacy)
  prompts/        # AI prompts
```

### Expo App Structure (`apps/expo/`)
```
app/              # Expo Router (file-based)
src/
  design-system/  # Tokens, theme hook, layout store
    colors.ts     # Light/dark palette
    tokens.ts     # Spacing, sizing, radii, typography
    theme.ts      # useTheme() hook
    layout.ts     # Sidebar/AI panel state (Zustand)
  components/
    layout/       # AppShell, Sidebar (resizable)
    ai/           # AIPanel, MuseAvatar, dropdowns
  stores/
    ai.ts         # Chat threads, model selection, context scope
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

### AI Store (`stores/ai.ts`)
```typescript
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
const { sidebarWidth, setSidebarWidth, aiPanelWidth, setAIPanelWidth } = useLayoutStore();
```

## Key Patterns

**Single source of truth**:
- Colors/tokens → `@/design-system`
- Entity config → `@mythos/core/entities/config.ts`
- AI prompts → `@mythos/prompts`

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

- Qdrant: `qdrant.cascada.vision` (Hetzner VPS)
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
