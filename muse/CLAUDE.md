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
- `packages/ui` - Shared components (Button, Card, Input, ScrollArea)
- `tooling/` - Shared configs (Tailwind, ESLint, TypeScript)

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

## Current State

Phases 1-3 (Core Interactivity, Dynamics, Coach) are complete. Phase 4 (Auto-fix Linter integration) is partial - the ConsistencyLinter agent exists but is not wired to the UI (using mock data). See `ARCHITECTURE_REVIEW.md` for detailed gap analysis.
