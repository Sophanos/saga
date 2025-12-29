# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mythos IDE is an AI-powered creative writing environment for fiction authors. It treats "story as code" - tracking entities (characters, locations, items, magic systems, factions) like variables, with a World Graph maintaining relationships and detecting logical inconsistencies. AI agents provide real-time writing feedback.

## Commands

```bash
# Development
bun install          # Install dependencies
bun run dev          # Start all packages in dev mode (Turborepo)

# Quality checks (run from root)
bun run typecheck    # TypeScript check across all packages
bun run lint         # ESLint across all packages
bun run build        # Build all packages

# Single package operations
bun run --filter @mythos/web dev        # Run only web app
bun run --filter @mythos/core typecheck # Typecheck only core

# Database (from packages/db)
bun run db:generate  # Regenerate Supabase types (requires SUPABASE_PROJECT_ID)
```

## Architecture

**Monorepo structure** (Turborepo + Bun workspaces):

- `apps/web` - React SPA (Vite + Tiptap editor + Zustand state)
- `packages/core` - Domain types, World Graph, story structures, Zod schemas
- `packages/editor` - Tiptap extensions (EntityMark, EntitySuggestion, SceneBlock)
- `packages/ai` - AI agents (ConsistencyLinter, WritingCoach) via Vercel AI SDK
- `packages/db` - Supabase client, queries, migrations
- `packages/ui` - Shared components (Button, Card, Input, ScrollArea, FormField, Select, TextArea)
- `packages/theme` - Cross-platform design tokens (colors, typography, spacing, semantic colors)
- `packages/prompts` - Consolidated AI prompts (coach, dynamics, linter, entity-detector)
- `tooling/` - Shared configs (Tailwind imports from @mythos/theme, ESLint, TypeScript)

## Key Concepts

**Writer/DM Mode**: Two UI modes - Writer (narrative focus) and DM (mechanical/stats focus). Mode state lives in `apps/web/src/stores/index.ts` and affects HUD display.

**Entity System**: Characters, Locations, Items, MagicSystems, Factions defined in `packages/core/src/entities/types.ts`. HUD projections (mode-specific views) in `hud-types.ts`.

**World Graph**: Entity relationship graph with conflict detection (genealogy, timeline, relationship inconsistencies) in `packages/core/src/world-graph/`.

**AI Agents**: Extend `NarrativeAgent` base class. Use `generateObject` from Vercel AI SDK with Zod schemas for structured responses. Providers: OpenRouter (primary), Gemini (fallback).

**Zustand Stores** (`apps/web/src/stores/`):
- Main store: project, document, world, editor, ui state
- `analysis.ts`: Writing metrics, style issues, insights
- `dynamics.ts`: Entity interactions and event streams

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - Database
- `OPENROUTER_API_KEY` - Primary AI provider
- `GOOGLE_GENERATIVE_AI_API_KEY` - Fallback AI provider (optional)

## Code Consolidation Patterns

**Single Source of Truth**:
- Entity config: `@mythos/core/entities/config.ts` exports `ENTITY_TYPE_CONFIG`, `getEntityColor()`, `getEntityLabel()`
- Severity config: `@mythos/core/analysis/severity-config.ts` exports `SEVERITY_CONFIG`, `getSeverityColor()`
- Theme tokens: `@mythos/theme` exports `bg`, `text`, `accent`, `entity`, `severity` colors
- AI prompts: `@mythos/prompts` is the source; `@mythos/ai` and edge functions re-export

**Persistence Hooks Factory** (`apps/web/src/hooks/usePersistence.ts`):
- `usePersistenceState(name)` - Shared loading/error state management
- `createPersistenceHook<T>()` - Factory for CRUD persistence hooks
- `PersistenceResult<T>` - Unified return type `{ data, error }`
- All persistence hooks (`useEntityPersistence`, `useRelationshipPersistence`, `useMentionPersistence`) use this

**API Client Base** (`apps/web/src/services/api-client.ts`):
- `callEdgeFunction<TReq, TRes>()` - Unified HTTP client with error handling
- `ApiError` base class extended by domain errors (`LinterApiError`, `DynamicsApiError`, `DetectApiError`)
- All AI service clients import from this base

**DB Mappers** (`@mythos/db/mappers/`):
- All DB↔Core type mappers live in `@mythos/db`
- `mapDb*To*()` and `mapCore*ToDb*()` functions

## Current State

Phases 1-3 (Core Interactivity, Dynamics, Coach) are complete. Phase 4 (Auto-fix Linter integration) is partial - the ConsistencyLinter agent exists but is not wired to the UI (using mock data). See `ARCHITECTURE_REVIEW.md` for detailed gap analysis.

**Consolidation Status (Phase 1-2 Complete)**:
- UI components consolidated to `@mythos/ui`
- Theme tokens in `@mythos/theme`, integrated with Tailwind
- Prompts consolidated to `@mythos/prompts`
- Persistence hooks using factory pattern
- API clients using shared base
- DB mappers moved to `@mythos/db`
