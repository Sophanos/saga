# Mythos IDE - Architecture Review & Strategic Analysis

> Last Updated: December 2024

## Executive Summary

Mythos IDE is an **AI-powered creative writing environment** that treats **"story as code"**. It combines the structured data model of Notion with the AI assistance of Cursor.ai, purpose-built for fiction writers, world-builders, and TTRPG game masters.

**Core Philosophy:**
- Entities as variables (Characters, Locations, Items, Magic Systems, Factions)
- Relationships as dependencies (18 typed relationship categories)
- Consistency as type checking (AI linter catches contradictions)
- Genre-agnostic (14 templates, expandable to 30+)

---

## 1. Implementation Status

### Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Core Interactivity (EntityHUD + Mode Toggle) | **Complete** |
| Phase 2 | Dynamics System (Event Stream + Causal Chains) | **Complete** |
| Phase 3 | Coach / Writing Analysis | **Complete** |
| Phase 4 | AI Integration & Auto-fix Linter | **Complete** |
| Phase 5 | RAG Chat & Semantic Search | **Complete** |
| Phase 6 | Import/Export (EPUB, DOCX, PDF, Markdown) | **Complete** |
| Phase 7 | Authentication (Supabase + Google OAuth) | **Complete** |

### MLP Readiness: 85%

**Ready:**
- Core editor with entity mentions
- 7 entity types with relationships
- AI Chat (RAG), Search, Linter, Coach, Dynamics
- Multi-format import/export
- Authentication flow
- Landing page with pricing tiers

**Gaps for MLP:**
- Onboarding flow (guided tour, sample project)
- Template picker UI (14 templates defined, no selector)
- Usage dashboard (word count, AI calls, billing)
- Collaboration UI wiring (backend 100% done)

---

## 2. Architecture Overview

### Monorepo Structure (Turborepo + Bun)

```
saga/muse/
├── apps/
│   ├── web/           # React SPA (Vite + Tiptap + Zustand)
│   ├── mobile/        # Expo React Native (partial)
│   └── website/       # Marketing landing page
├── packages/
│   ├── core/          # Domain types, World Graph, templates, schemas
│   ├── editor/        # Tiptap extensions (EntityMark, SceneBlock, Linter)
│   ├── ai/            # AI agents (Linter, Coach, Detector, Dynamics)
│   ├── db/            # Supabase client, queries, migrations, mappers
│   ├── ui/            # Shared React components
│   ├── theme/         # Design tokens (colors, typography, spacing)
│   ├── prompts/       # Consolidated AI prompts
│   ├── state/         # Zustand stores (auth, project, collaboration, offline)
│   ├── storage/       # Platform storage abstraction (web/native)
│   └── sync/          # Offline sync engine (Dexie/SQLite)
├── supabase/
│   └── functions/     # Edge functions (ai-chat, ai-search, ai-lint, etc.)
└── tooling/           # Shared configs (Tailwind, ESLint, TypeScript)
```

### Key Architectural Patterns

1. **Single Source of Truth**
   - Entity config: `@mythos/core/entities/config.ts`
   - Severity config: `@mythos/core/analysis/severity-config.ts`
   - Theme tokens: `@mythos/theme`
   - AI prompts: `@mythos/prompts` (edge functions re-export)

2. **Persistence Hooks Factory**
   - `usePersistenceState()` for shared loading/error state
   - `createPersistenceHook<T>()` factory for CRUD hooks
   - Unified `PersistenceResult<T>` return type

3. **API Client Base**
   - `callEdgeFunction<TReq, TRes>()` unified HTTP client
   - `ApiError` base class for domain errors

4. **DB Mappers**
   - All type conversions in `@mythos/db/mappers/`
   - `mapDb*To*()` and `mapCore*ToDb*()` functions

---

## 3. Feature Deep-Dive

### 3.1 Entity System

| Entity Type | Key Properties |
|-------------|----------------|
| **Character** | 16 Jungian archetypes, traits (strength/weakness/shadow), status (health/mood), visual description, backstory, goals, fears |
| **Location** | Parent hierarchy, climate, atmosphere, inhabitants, connections |
| **Item** | Category (weapon/armor/artifact/key), rarity, owner, abilities |
| **Magic System** | Rules, limitations, costs, users, spells |
| **Faction** | Leader, members, headquarters, goals, rivals, allies |
| **Event** | Timeline markers |
| **Concept** | Abstract themes |

**Relationships (18 types):**
Interpersonal (knows, loves, hates, married_to, allied_with, enemy_of), Familial (parent_of, child_of, sibling_of), Power/Action (killed, created, owns, guards, rules, serves, member_of), Ability (weakness, strength)

### 3.2 AI Capabilities

| Agent | Function | Provider |
|-------|----------|----------|
| **RAG Chat** | Context-aware assistant using vector search | DeepInfra + Qdrant + OpenRouter |
| **Semantic Search** | Meaning-based search across docs/entities | DeepInfra (Qwen3-Embedding-8B) + Qdrant |
| **Consistency Linter** | Catches plot holes, timeline errors, contradictions | OpenRouter (Gemini 2.0 Flash) |
| **Writing Coach** | Show-don't-tell, tension, sensory balance, style | OpenRouter (Gemini 2.0 Flash) |
| **Entity Detector** | Auto-detects entities from pasted text | OpenRouter |
| **Dynamics Extractor** | Tracks character interactions | OpenRouter |
| **Genesis Wizard** | Project scaffolding from description | OpenRouter |

**Vector Infrastructure:**
- Embeddings: DeepInfra Qwen3-Embedding-8B (4096 dimensions)
- Vector DB: Qdrant (saga_vectors collection on Hetzner)
- Reranking: Qwen3-Reranker-4B (optional)

### 3.3 World Graph

In-memory graph structure with:
- `nodes: Map<string, Entity>`
- `edges: Map<string, Relationship>`
- `adjacency: Map<string, Set<string>>`

**Conflict Detection:**
- Genealogy conflicts (incest warnings)
- Relationship contradictions (loves AND hates same target)
- Timeline inconsistencies
- Location contradictions
- Power scaling issues
- Visual description inconsistencies

### 3.4 Writer/DM Mode

| Aspect | Writer Mode | DM Mode |
|--------|-------------|---------|
| HUD Content | Narrative threads, arcs, foreshadowing | Stats, health, power level, hidden notes |
| Dynamics | Visible interactions only | All interactions including hidden |
| Focus | Prose quality, pacing | Game mechanics, secrets |

### 3.5 Collaboration System (80% Complete)

**Backend (Complete):**
- `project_members` table with roles (owner/editor/viewer)
- `project_invitations` with email tokens
- `activity_log` with triggers
- Row-Level Security policies
- Supabase Realtime channels

**Frontend (Needs Wiring):**
- `CollaboratorsBar.tsx` - avatar stack, invite button
- `InviteMemberModal.tsx` - email invitation form
- `ActivityFeed.tsx` - real-time activity stream
- `useCollaboration.ts` - hook for state management

### 3.6 Offline Sync Engine (80% Complete)

**Architecture:**
- Local-first writes to IndexedDB (web) / SQLite (native)
- Mutation queue for pending changes
- Background sync every 30 seconds
- Supabase Realtime for pull
- Conflict resolution strategies (server_wins, client_wins, merge, manual)

**Files:**
- `packages/sync/src/syncEngine.ts`
- `packages/sync/src/web/dexieDb.ts`
- `packages/sync/src/native/sqliteDb.ts`

---

## 4. USPs / Competitive Advantages

### 4.1 Killer Features

1. **"Story as Code" Philosophy**
   - No other writing tool treats narrative with this structural rigor
   - Entities as typed variables with validation

2. **AI Consistency Linter**
   - Catches "Marcus has blue eyes in Ch.3 but brown in Ch.12"
   - Auto-fix suggestions with one-click apply
   - **This is the #1 WOW feature**

3. **Writer/DM Mode Toggle**
   - Unique dual-persona approach
   - Writers see narrative; GMs see mechanics

4. **18 Typed Relationships**
   - Not just "related" but knows, loves, hates, killed, guards
   - Conflict detection on relationship logic

5. **Show-Don't-Tell Meter**
   - Real-time prose quality feedback
   - Letter grades (A-F) with specific fixes

6. **Genre-Aware Templates**
   - Epic Fantasy, D&D Campaign, Manga Novel, Visual Novel
   - Each customizes entity types, linter rules, UI

### 4.2 Comparison to Competitors

| Feature | Notion | Scrivener | Mythos |
|---------|--------|-----------|--------|
| Structured entities | Manual DBs | Tags only | **Typed system** |
| Relationship tracking | Manual | None | **18 types + graph** |
| AI writing feedback | None | None | **Coach + Linter** |
| Consistency checking | None | None | **Auto-detection** |
| Genre templates | None | Basic | **14 specialized** |
| DM/hidden info layer | None | None | **Built-in** |

---

## 5. Opportunities Roadmap

### 5.1 Immediate (MLP Launch)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Onboarding flow (3-step wizard) | 2 days | High |
| P0 | Template picker UI | 1 day | High |
| P0 | Usage dashboard (word count, AI calls) | 2 days | High |
| P1 | Wire collaboration UI | 1 day | Medium |
| P1 | Subscription billing (Stripe) | 3 days | Critical |

### 5.2 Near-Term (Differentiation)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P1 | **World Graph Visualization** | 1 week | Very High |
| P1 | **Cmd+K Command Palette** | 3 days | High |
| P2 | Timeline View | 1 week | High |
| P2 | Map Integration | 2 weeks | Medium |

### 5.3 Medium-Term (World-Building Expansion)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P2 | Character Relationship Board | 1 week | High |
| P2 | Genealogy Tree View | 1 week | Medium |
| P3 | Power Scaling Tracker | 3 days | Medium |
| P3 | Magic System Simulator | 1 week | Low |

### 5.4 Long-Term (Vision Execution)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P3 | **Character Image Generation** | 2 weeks | Very High |
| P3 | **Storyboard View (Manga/Comics)** | 3 weeks | High |
| P3 | **Interactive Fiction Export (Twine/Ink)** | 1 week | Medium |
| P4 | Scene-to-Image Generation | 1 month | Very High |
| P4 | Video Script Mode | 2 weeks | Medium |

### 5.5 Progressive Disclosure Polish

The progressive disclosure system (Gardener/Architect modes) is implemented. Remaining polish:

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P1 | Tutorial overlays (coach marks for first-time features) | 2 days | High |
| P1 | Persist "never ask" preferences to Supabase | 0.5 day | Medium |
| P1 | Wire ConsistencyLinter agent to UI (currently mock data) | 2 days | High |
| P2 | Phase progression analytics (track unlock rates) | 1 day | Medium |
| P2 | Customizable unlock thresholds in settings | 1 day | Low |

**Related beads:** `muse-7r3` (Onboarding flow integration), `muse-x3g` (Progressive Structure - closed)

---

## 6. Technical Debt & Guardrails

### 6.1 Architectural Guardrails

1. **Keep domain entities clean** - HUD-specific data in projection layer only
2. **Debounce AI calls** - 1000ms debounce, hash-based deduplication
3. **Document positions** - Tiptap offsets for precise fixes
4. **Single source of truth** - No duplicated type definitions

### 6.2 Known Technical Debt

| Area | Issue | Severity |
|------|-------|----------|
| Naming | "Mythos" vs "Muse" inconsistency | Low |
| Mobile | Expo app incomplete | Medium |
| Tests | No test coverage | High |
| Docs | API documentation missing | Medium |

### 6.3 Security Considerations

- BYOK model means no API key storage (user-provided)
- Supabase RLS policies in place
- No PII in vector embeddings (content only)

---

## 7. Metrics to Track

### 7.1 Product Metrics

| Metric | Target | Purpose |
|--------|--------|---------|
| Words written/user/day | 500+ | Engagement |
| AI calls/user/session | 5-10 | Feature adoption |
| Entities created/project | 20+ | Depth of use |
| Linter issues fixed | 50%+ | AI value delivery |

### 7.2 Business Metrics

| Metric | Target | Purpose |
|--------|--------|---------|
| Free→Pro conversion | 5%+ | Monetization |
| Churn (monthly) | <5% | Retention |
| NPS | 40+ | Satisfaction |

---

## 8. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-Q4 | DeepInfra for embeddings | Cost-effective, high quality |
| 2024-Q4 | Qdrant for vectors | Self-hosted, no vendor lock-in |
| 2024-Q4 | OpenRouter for LLM | BYOK support, model flexibility |
| 2024-Q4 | Supabase for DB | Realtime, RLS, edge functions |
| 2024-Q4 | Bun + Turborepo | Fast builds, modern tooling |

---

## Appendix: File Reference

### Core Files

| Purpose | Location |
|---------|----------|
| Entity types | `packages/core/src/entities/types.ts` |
| World Graph | `packages/core/src/world-graph/index.ts` |
| Template definitions | `packages/core/src/templates/builtin.ts` |
| AI prompts | `packages/prompts/src/*.ts` |
| Edge functions | `supabase/functions/*/index.ts` |
| Main app | `apps/web/src/App.tsx` |
| Zustand stores | `apps/web/src/stores/*.ts` |

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| 001_initial | Projects, entities, relationships, documents, mentions |
| 002_interactions | Entity interactions for dynamics |
| 003_pgvector | Document embeddings, semantic search |
| 004_analysis | Scene analysis history |
| 005_flexible_kinds | Template-driven entity kinds |
| 006_profiles | User profiles |
| 007_collaboration | Project members, invitations, activity log |
| 008_offline_versioning | Version columns for sync |
