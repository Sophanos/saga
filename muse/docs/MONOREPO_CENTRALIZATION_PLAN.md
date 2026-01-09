# Monorepo Centralization Plan

> **Created:** 2026-01-09 | **Status:** ✅ Complete | **Priority:** P1

## Overview

Consolidate platform-agnostic code from `apps/expo/` into shared packages for reuse across Web, Tauri (macOS), and Expo (iOS/Android). This reduces code duplication and establishes a single source of truth for state management, commands, and design tokens.

**Savings achieved:** ~1,000 LOC consolidated

---

## Architecture After Centralization

```
packages/
├── state/                    # ✅ Zustand stores (platform-agnostic)
│   ├── ai.ts                 # Thread/message/model state
│   ├── workspace.ts          # Tool execution, questions, panels
│   ├── commandPalette.ts     # Command palette UI state
│   ├── layout.ts             # Sidebar/panel dimensions
│   ├── project.ts            # (existing)
│   ├── collaboration.ts      # (existing)
│   └── ...
│
├── commands/                 # ✅ NEW: Command system
│   ├── types.ts              # Command, CommandCategory, CommandContext
│   ├── registry.ts           # CommandRegistry class
│   └── definitions/
│       ├── entity.ts         # Entity commands
│       ├── navigation.ts     # Navigation commands
│       └── general.ts        # General commands
│
├── theme/                    # ✅ Design tokens (enhanced)
│   ├── colors.ts             # Light/dark palettes
│   ├── spacing.ts            # Spacing, radii, z-index
│   ├── typography.ts         # Font families, sizes, weights
│   ├── shadows.ts            # Platform-aware shadows (RN + CSS)
│   ├── theme.ts              # getTheme() utility
│   └── index.ts
│
├── analytics/                # ✅ NEW: Typed event definitions
│   ├── events.ts             # OnboardingEvents, AgentEvents, etc.
│   ├── client.ts             # AnalyticsClient interface
│   └── index.ts
│
└── (existing packages)
    ├── consent/              # GDPR consent (already exists)
    ├── auth/                 # Better Auth + RevenueCat
    ├── core/                 # Domain types
    ├── convex-client/        # Convex + offline
    └── editor-webview/       # TipTap bundle
```

---

## ✅ Phase 1: State Store Extraction (Complete)

### 1.1 AI Store

**Location:** `packages/state/src/ai.ts`

```typescript
// Key exports
export type AIModel = 'auto' | 'claude-sonnet' | 'claude-opus' | 'gemini-flash' | 'gpt-4o';
export type ContextScope = 'scene' | 'chapter' | 'project' | 'entities' | 'world' | 'notes';
export type QuickAction = 'search' | 'lint' | 'continue' | 'character' | 'brainstorm' | 'arc';

export const AI_MODELS: Record<AIModel, { label: string; badge?: string; icon: string; modelId: string }>;
export const CONTEXT_SCOPES: Record<ContextScope, { label: string; icon: string }>;
export const QUICK_ACTIONS: Record<QuickAction, { ... }>;

export const useAIStore = create<AIState>(...);
export const useCurrentThread = () => ...;
export const useHasMessages = () => ...;
```

**Note:** `AI_MODELS` includes `modelId` mapping to OpenRouter IDs (e.g., `'anthropic/claude-sonnet-4'`).

### 1.2 Workspace Store

**Location:** `packages/state/src/workspace.ts`

```typescript
// Imports shared types from @mythos/core
import type { PanelType, WorldBuilderTab, QuestionOption, ToolCallStatus } from '@mythos/core';

export const useWorkspaceStore = create<WorkspaceState>(...);
export const usePendingQuestions = () => ...;
export const useActivePanel = () => ...;
export const useFocusedEntity = () => ...;
export const useGraphConfig = () => ...;
export const useToolExecutions = () => ...;
```

### 1.3 Command Palette Store

**Location:** `packages/state/src/commandPalette.ts`

```typescript
export type CommandCategory = 'entity' | 'ai' | 'navigation' | 'general';
export type CommandFilter = 'all' | CommandCategory;

export const useCommandPaletteStore = create<CommandPaletteStore>(...);
export const useCommandPaletteOpen = () => ...;
export const useCommandPaletteQuery = () => ...;
export const useCommandPaletteFilter = () => ...;
```

### 1.4 Layout Store

**Location:** `packages/state/src/layout.ts`

```typescript
export const LAYOUT_SIZING = {
  sidebarDefault: 260,
  sidebarCollapsed: 60,
  sidebarMin: 200,
  sidebarMax: 400,
  aiPanelDefault: 380,
  aiPanelMin: 320,
  aiPanelMax: 600,
  headerHeight: 48,
  bottomBarHeight: 56,
} as const;

export type ViewMode = 'home' | 'project';
export type AIPanelMode = 'hidden' | 'side' | 'floating' | 'full';

export const useLayoutStore = create<LayoutState>(...);
export const useSidebarCollapsed = () => ...;
export const useAIPanelMode = () => ...;
```

---

## ✅ Phase 2: Commands Package (Complete)

**Location:** `packages/commands/`

### Package Structure

```
packages/commands/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── registry.ts
    └── definitions/
        ├── index.ts
        ├── entity.ts
        ├── navigation.ts
        └── general.ts
```

### Usage

```typescript
import { commandRegistry, registerAllCommands } from '@mythos/commands';
import type { Command, CommandCategory, CommandContext } from '@mythos/commands';

// Register all built-in commands
registerAllCommands();

// Search commands
const results = commandRegistry.search('create character', { projectId: '123', hasSelection: false });

// Get by category
const entityCommands = commandRegistry.byCategory('entity');
```

---

## ✅ Phase 3: Theme Consolidation (Complete)

### New Additions

**Shadows (`packages/theme/src/shadows.ts`):**

```typescript
export interface ShadowDefinition {
  // React Native format
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
  // CSS format (for web)
  boxShadow: string;
}

export const shadows = {
  none: { ... },
  sm: { ... },
  md: { ... },
  lg: { ... },
  xl: { ... },
  inner: { ... },
};

export function getNativeShadow(shadow: Shadow);
export function getWebShadow(shadow: Shadow): string;
```

**Theme Utility (`packages/theme/src/theme.ts`):**

```typescript
export type ColorScheme = 'light' | 'dark';

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
  accent: typeof accent;
  entity: typeof entity;
  spacing: typeof spacing;
  shadows: typeof shadows;
  // ... full theme object
}

export function getTheme(colorScheme: ColorScheme): Theme;
```

### Platform-Specific Hook Usage

```typescript
// apps/expo - React Native
import { useColorScheme } from 'react-native';
import { getTheme } from '@mythos/theme';

export function useTheme() {
  const colorScheme = useColorScheme() ?? 'dark';
  return getTheme(colorScheme);
}

// apps/tauri - Web
import { getTheme } from '@mythos/theme';

export function useTheme() {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setColorScheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', (e) => setColorScheme(e.matches ? 'dark' : 'light'));
  }, []);

  return getTheme(colorScheme);
}
```

---

## ✅ Phase 4: Analytics Package (Complete)

**Location:** `packages/analytics/`

### Package Structure

```
packages/analytics/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── events.ts         # Typed event definitions
    └── client.ts         # AnalyticsClient interface
```

### Typed Event Definitions

```typescript
import { OnboardingEvents, AgentEvents, WritingEvents, BillingEvents, FeatureEvents } from '@mythos/analytics';

// All events return { event: string; properties?: Record<string, unknown> }
OnboardingEvents.signUpStarted('google');
OnboardingEvents.projectCreated(projectId, 'fantasy');

AgentEvents.chatStarted(projectId, threadId, 'claude-sonnet');
AgentEvents.streamCompleted(threadId, durationMs, tokenCount);

WritingEvents.sessionStarted(projectId, documentId);
WritingEvents.entityCreated(entityId, 'character', 'detection');

BillingEvents.subscriptionStarted('pro', 'app_store');
BillingEvents.trialEnded('pro', true);

FeatureEvents.commandExecuted('entity.create.character');
FeatureEvents.modelChanged('claude-opus');
```

### Analytics Client Interface

```typescript
export interface AnalyticsClient {
  init(): Promise<void>;
  identify(userId: string, properties?: Record<string, unknown>): void;
  track(event: string, properties?: Record<string, unknown>): void;
  trackEvent(payload: EventPayload): void;
  reset(): void;
  optIn(): void;
  optOut(): void;
  isFeatureEnabled(flagKey: string): boolean;
  // ...
}

// No-op client for when analytics is disabled
export const createNoopClient = (): AnalyticsClient => new NoopAnalyticsClient();
```

---

## ✅ Phase 5: Verification (Complete)

All packages pass typecheck. App migration complete.

---

## How to Use in Apps

```typescript
// State management
import {
  useAIStore,
  useLayoutStore,
  useWorkspaceStore,
  useCommandPaletteStore,
  LAYOUT_SIZING,
  AI_MODELS,
} from '@mythos/state';

// Commands
import { commandRegistry, registerAllCommands } from '@mythos/commands';

// Theme
import { getTheme, shadows, getNativeShadow } from '@mythos/theme';

// Analytics
import { AgentEvents, WritingEvents, createNoopClient } from '@mythos/analytics';
```

---

## Migration Checklist

### Phase 1: State Stores ✅
- [x] Create `packages/state/src/ai.ts`
- [x] Create `packages/state/src/workspace.ts`
- [x] Create `packages/state/src/commandPalette.ts`
- [x] Create `packages/state/src/layout.ts`
- [x] Update `packages/state/src/index.ts` exports
- [x] Run typecheck - **PASS**

### Phase 2: Commands Package ✅
- [x] Create `packages/commands/` directory structure
- [x] Create `package.json` with dependencies
- [x] Create command types, registry, and definitions
- [x] Export from `packages/commands/src/index.ts`
- [x] Run typecheck - **PASS**

### Phase 3: Theme Consolidation ✅
- [x] Create `packages/theme/src/shadows.ts`
- [x] Create `packages/theme/src/theme.ts` with `getTheme()`
- [x] Update `packages/theme/src/index.ts` exports
- [x] Run typecheck - **PASS**

### Phase 4: Analytics Package ✅
- [x] Create `packages/analytics/` directory structure
- [x] Create typed event definitions
- [x] Create `AnalyticsClient` interface
- [x] Run typecheck - **PASS**

### Phase 5: App Migration ✅
- [x] Update Expo app imports to use shared packages
- [x] Update Tauri app imports to use shared packages
- [x] Remove duplicate files from apps
- [x] Update `CLAUDE.md` with new imports
- [x] Verify all platforms build

---

## Files Deleted (Migration Complete)

- `apps/expo/src/stores/` directory (ai.ts, workspace.ts, commandPalette.ts)
- `apps/expo/src/design-system/layout.ts`
- `apps/expo/src/commands/` directory

---

## Success Criteria

1. **Single source of truth**: ✅ All state stores in `@mythos/state`
2. **No duplication**: ✅ Command system in `@mythos/commands`
3. **Type safety**: ✅ All exports properly typed
4. **Build passes**: ✅ All packages typecheck
5. **Apps work**: ✅ Expo and Tauri migrated to shared packages
