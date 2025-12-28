# Mythos IDE – Architecture Review & Gap Analysis (saga/muse)

## 0) Executive Summary

The Mythos IDE is a monorepo (Turborepo + Bun) with clear separation between domain (`packages/core`), editor (`packages/editor`), AI (`packages/ai`), persistence (`packages/db`), shared UI (`packages/ui`), and the web shell (`apps/web`).

### Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Core Interactivity (EntityHUD + Mode Toggle) | **COMPLETE** |
| Phase 2 | Dynamics System (Event Stream + Causal Chains) | **COMPLETE** |
| Phase 3 | Coach / Writing Analysis | **COMPLETE** |
| Phase 4 | AI Integration & Auto-fix Linter | **COMPLETE** |

---

## 1) Current Implementation (What Exists Today)

### 1.1 Repo Layout (High-level)

- **apps/web**
  - Three-pane layout (Manifest / Canvas / Console)
  - Console tabs: Chat, Linter, Dynamics, Coach
  - Tiptap editor rendering via `@mythos/editor`
  - Zustand stores: project, document, world, editor, linter, ui, dynamics, analysis
  - Writer/DM mode toggle with mode-aware UI

- **packages/core**
  - Entity domain types + Zod schemas (`src/entities/`, `src/schema/`)
  - `WorldGraph` for entity/relationship graph + conflict detection
  - Story structs (scenes/chapters/arcs) (`src/story/`)
  - Dynamics module (`src/dynamics/`) - Interaction types, EventStream class
  - Analysis types (`src/analysis/`) - SceneMetrics, StyleIssue, WritingAnalysis
  - HUD types (`src/entities/hud-types.ts`) - CharacterHudData, ItemHudData, LocationHudData

- **packages/editor**
  - Tiptap extensions:
    - `EntityMark` (wrap spans with data attributes)
    - `EntitySuggestion` ("@" mention suggestions)
    - `SceneBlock` wrapper node

- **packages/ai**
  - Vercel AI SDK + Gemini provider
  - `ConsistencyLinter` agent (returns JSON issues)
  - `GenesisWizard` scaffolding agent
  - `WritingCoach` agent (tension, sensory, pacing, mood, show-don't-tell)

- **packages/db**
  - Supabase schema + queries for projects/entities/documents/mentions
  - Migrations:
    - `001_initial.sql` - projects, entities, relationships, documents, mentions
    - `002_interactions.sql` - interactions table with RLS
    - `003_pgvector.sql` - document embeddings, semantic/hybrid search
    - `004_analysis.sql` - scene_analysis table with history functions

- **packages/ui**
  - Button/Input/Card/ScrollArea + globals.css theme tokens

### 1.2 Implemented Features

#### Phase 1 - Core Interactivity
- `ui.mode: "writer" | "dm"` in Zustand store
- `ModeToggle.tsx` - toggles between Writer/DM with icons
- `useMode.ts` - returns mode, isDM, isWriter, setMode, toggleMode
- `useEntityClick.ts` - handles entity span clicks, calculates position
- `useHudPosition.ts` - viewport boundary logic with placement fallbacks
- `AsciiHud.tsx` - mode-aware rendering for Character/Item/Location entities
- Header integration with ModeToggle component

#### Phase 2 - Dynamics System
- `packages/core/src/dynamics/types.ts` - InteractionType, Interaction, EventStreamSnapshot
- `packages/core/src/dynamics/event-stream.ts` - causal chain querying, temporal proximity, hidden detection
- `packages/db/src/migrations/002_interactions.sql` - interactions table with RLS
- `packages/db/src/queries/interactions.ts` - CRUD + getInteractionsByEntity, getHiddenInteractions
- `apps/web/src/stores/dynamics.ts` - Zustand store with selectors
- `DynamicsView.tsx` - timeline view, hidden/hostile badges, insights panel

#### Phase 3 - Coach / Writing Analysis
- `packages/core/src/analysis/types.ts` - SceneMetrics, StyleIssue, WritingAnalysis
- `packages/ai/src/prompts/coach.ts` - WRITING_COACH_SYSTEM, QUICK_COACH_PROMPT
- `packages/ai/src/agents/writing-coach.ts` - validation, normalization, grade conversion
- `apps/web/src/stores/analysis.ts` - metrics, issues, insights, lastAnalyzedHash
- `apps/web/src/hooks/useWritingAnalysis.ts` - debounced auto-analysis with hash deduplication
- `CoachView.tsx` - integrates all subcomponents
- `TensionGraph.tsx` - bar chart with gradient colors
- `SensoryHeatmap.tsx` - 5-sense grid with balance visualization
- `ShowDontTellMeter.tsx` - letter grade, progress bar, feedback
- `StyleIssuesList.tsx` - issue cards with type badges
- `packages/db/src/migrations/003_pgvector.sql` - document embeddings, semantic search
- `packages/db/src/migrations/004_analysis.sql` - scene_analysis table
- `packages/db/src/queries/analysis.ts` - CRUD + metrics aggregation

---

## 2) Target Prototype Features (Expected Behaviors)

From the prototype, the IDE should support:

1. **EntitySpan click** → opens HUD near cursor, supports mode-dependent fields
2. **Scene Context Bar** always visible (between Header and workspace):
   - "In Scene" cast badges
   - tension state and mood
   - quick analysis stats
3. **Dynamics View** in right console (tab):
   - timeline dots + action arrows (Source → Verb → Target)
   - hidden interactions highlighted (purple)
   - "Dynamics Insight" summary
4. **Coach View** in right console (tab):
   - show-don't-tell meter
   - tension arc graph
   - sensory heatmap
5. **Writer/DM Mode Toggle** in header:
   - DM shows mechanical stats, hidden interactions
   - Writer focuses on narrative threads, prose metrics
6. **Enhanced Linter**
   - multiple issue categories: consistency, style, graph insights
   - issue-level "Auto-Fix" actions (where safe)

---

## 3) Optional Enhancements (Future Work)

### 3.1 Scene Context Bar
- `apps/web/src/components/canvas/SceneContextBar.tsx`
- "In Scene" cast badges with entity avatars
- Quick tension/mood display from analysis store
- Active character indicators

### 3.2 Dynamics Extraction AI Agent
- `packages/ai/src/agents/dynamics-extractor.ts`
- Auto-extract interactions from prose text
- Populate dynamics store automatically
- Detect hidden/hostile interactions

### 3.3 Entity Avatars
- `apps/web/src/components/canvas/EntityAvatar.tsx`
- Visual character/item/location thumbnails
- Used in SceneContextBar and HUD

### 3.4 Advanced Linter Features
- Fix preview modal before applying
- Undo/redo for applied fixes
- Issue severity trends over time

---

## 4) Implementation Roadmap (Updated)

### Phase 1 — Core Interactivity (EntityHUD + mode toggle)
**Status: COMPLETE**

Implemented:
- `ui.mode: "writer" | "dm"` in Zustand
- `ModeToggle` in Header
- Entity click handler with HUD positioning
- Mode-aware HUD rendering (Writer: threads, narrative; DM: stats, hidden notes)

Files:
- `apps/web/src/stores/index.ts`
- `apps/web/src/components/Header.tsx`
- `apps/web/src/components/ModeToggle.tsx`
- `apps/web/src/hooks/useMode.ts`
- `apps/web/src/hooks/useEntityClick.ts`
- `apps/web/src/hooks/useHudPosition.ts`
- `apps/web/src/components/hud/AsciiHud.tsx`
- `packages/core/src/entities/hud-types.ts`

---

### Phase 2 — Dynamics System (Event stream + causal chains)
**Status: COMPLETE**

Implemented:
- `packages/core/src/dynamics/*` with EventStream class
- DB table + queries (interactions)
- `dynamics` store slice
- `DynamicsView` tab in Console
- Timeline visualization with interaction types

Files:
- `packages/core/src/dynamics/types.ts`
- `packages/core/src/dynamics/event-stream.ts`
- `packages/core/src/dynamics/index.ts`
- `packages/db/src/migrations/002_interactions.sql`
- `packages/db/src/queries/interactions.ts`
- `apps/web/src/stores/dynamics.ts`
- `apps/web/src/components/console/DynamicsView.tsx`

---

### Phase 3 — Coach / Writing Analysis
**Status: COMPLETE**

Implemented:
- `WritingCoach` agent + prompts
- `analysis` store slice with hash deduplication
- `CoachView` with all subcomponents
- Debounced analysis (1000ms) with content hash comparison
- DB persistence for scene analysis history

Files:
- `packages/ai/src/prompts/coach.ts`
- `packages/ai/src/agents/writing-coach.ts`
- `packages/core/src/analysis/types.ts`
- `apps/web/src/stores/analysis.ts`
- `apps/web/src/hooks/useWritingAnalysis.ts`
- `apps/web/src/components/console/CoachView.tsx`
- `apps/web/src/components/console/TensionGraph.tsx`
- `apps/web/src/components/console/SensoryHeatmap.tsx`
- `apps/web/src/components/console/ShowDontTellMeter.tsx`
- `apps/web/src/components/console/StyleIssuesList.tsx`
- `packages/db/src/migrations/003_pgvector.sql`
- `packages/db/src/migrations/004_analysis.sql`
- `packages/db/src/queries/analysis.ts`

---

### Phase 4 — AI Integration & Auto-fix Linter
**Status: COMPLETE**

Implemented:
- Editor fix primitives (replaceText, removeText, insertText, jumpToPosition)
- `LinterView.tsx` with issue grouping by severity/type
- `useLinterFixes.ts` hook with debounced auto-linting
- ConsistencyLinter agent wired to linter store
- Auto-fix actions with per-issue and batch fix support
- Jump-to-location functionality

Files:
- `packages/editor/src/fixes/index.ts`
- `packages/editor/src/fixes/replaceText.ts`
- `packages/editor/src/fixes/removeText.ts`
- `packages/editor/src/fixes/insertText.ts`
- `packages/editor/src/fixes/jumpToPosition.ts`
- `apps/web/src/components/console/LinterView.tsx`
- `apps/web/src/hooks/useLinterFixes.ts`
- `apps/web/src/stores/index.ts` (enhanced linter slice)

---

## 5) Architectural Guardrails

1. **Keep "domain entities" clean**
   - HUD-specific and DM-stats in projection layer (`hud-types.ts`), not base `Entity`

2. **Use stable shared types**
   - Shared "Interaction", "SceneMetrics", "StyleIssue" types in `packages/core`
   - UI + AI depend on those shapes

3. **Debounce AI calls**
   - 1000ms debounce implemented
   - Hash-based content deduplication prevents redundant analysis
   - Manual "Run" button available

4. **Document positions**
   - Tiptap position offsets for precise fixes
   - Line/column mapping for display

---

## 6) Optional Enhancements Plan

All core phases (1-4) are complete. Below are optional enhancements prioritized by impact:

### Priority 1: Scene Context Bar
**Goal:** Show active scene context between Header and Canvas

**Deliverables:**
- `apps/web/src/components/canvas/SceneContextBar.tsx`
- `apps/web/src/components/canvas/EntityAvatar.tsx`
- Integration with analysis store for tension/mood
- Integration with dynamics store for active cast

**Features:**
- Cast badges showing characters in current scene
- Quick tension indicator (color-coded bar)
- Current mood display
- Click avatar → open entity HUD

### Priority 2: Dynamics Extraction Agent
**Goal:** Auto-populate event stream from prose

**Deliverables:**
- `packages/ai/src/agents/dynamics-extractor.ts`
- `packages/ai/src/prompts/dynamics.ts`
- Integration with dynamics store
- Manual trigger + auto-extract on scene change

**Features:**
- Extract character interactions from text
- Detect interaction types (neutral/hostile/hidden/passive)
- Identify causal chains
- Flag potential hidden interactions for DM review

### Priority 3: Enhanced Analysis Persistence
**Goal:** Track writing metrics over time

**Deliverables:**
- Dashboard for historical metrics
- Scene-by-scene comparison view
- Trend graphs for tension/sensory/show-don't-tell

### Priority 4: Advanced Linter UX
**Goal:** Polish the linting experience

**Deliverables:**
- Fix preview modal with diff view
- Undo stack for applied fixes
- Bulk ignore by rule type
- Custom rule configuration

---
