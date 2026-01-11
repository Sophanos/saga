# Convex Migration Roadmap

> See also: [UI Architecture](./UI_ARCHITECTURE.md) for Expo app structure and design system.

## Goal
Replace SyncEngine (~4000 LOC) with Convex. Consolidate AI into Convex HTTP Actions.

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1-2 | ✅ Complete | Schema, CRUD, offline client |
| 3 | 🔲 Pending | Hetzner deployment |
| 4 | 🔲 Pending | Replace SyncEngine |
| 5 | ✅ Complete | AI HTTP Actions |
| 6 | ✅ Complete | Crons infrastructure |
| 7 | 🔲 Pending | Mobile |
| 8 | 🚧 In Progress | AI Agent Tool Calls |
| 9 | 🔲 Pending | Purpose-Built Workspaces |

### File Structure

```
convex/
├── schema.ts              # 9 tables
├── convex.json            # Self-hosted config
├── http.ts                # HTTP router (/ai/saga, /ai/detect, /health)
├── crons.ts               # Scheduled jobs (cleanup, sync)
├── maintenance.ts         # Maintenance job handlers
├── lib/
│   ├── auth.ts            # Query/mutation auth helpers
│   ├── httpAuth.ts        # HTTP action auth (JWT + anon)
│   ├── streaming.ts       # SSE utilities
│   ├── qdrant.ts          # Vector search client
│   └── embeddings.ts      # DeepInfra client
├── ai/
│   ├── streams.ts         # Delta persistence + stream recovery
│   ├── saga.ts            # Streaming chat action with RAG
│   ├── detect.ts          # Entity detection
│   └── tools.ts           # Tool execution (9 tools)
├── projects.ts            # CRUD + cascade delete
├── documents.ts           # CRUD
├── entities.ts            # CRUD + relationships
└── relationships.ts       # CRUD
```

---

## Architecture

```
┌─ CLIENTS ─────────────────────────────────────────────┐
│  TanStack Query + IndexedDB (offline, last-write-wins)│
└───────────────────────┬───────────────────────────────┘
                        ▼
┌─ CONVEX (Hetzner) ────────────────────────────────────┐
│  Real-time DB    │  HTTP Actions (AI)  │  Crons      │
│  - documents     │  - /ai/saga (SSE)   │  - sync     │
│  - entities      │  - /ai/chat (SSE)   │  - cleanup  │
│  - relationships │  - /ai/detect       │             │
└──────────────────┴─────────────────────┴─────────────┘
        │                    │
        ▼                    ▼
┌─ SUPABASE ─────┐    ┌─ QDRANT ─────────┐
│  Auth (JWT)    │    │  saga_vectors    │
│  RLS tables    │    │  saga_images     │
│  Stripe hooks  │    └──────────────────┘
└────────────────┘
```

---

## Hetzner Deployment

### Server Setup
Single Hetzner VPS hosting two Convex instances:
- **Kora** — existing Convex backend in `/opt/convex` (ports 3210/3211, dashboard 6791)
- **Cascada** — Saga Convex backend in `/opt/convex-cascada` (ports 3220/3221, dashboard 6792)
- **Shared services** — Qdrant, mem0, other infra via Cloudflare Tunnel

### Endpoints
| Service | Domain |
|---------|--------|
| Convex API + HTTP Actions | `convex.cascada.vision` |
| Qdrant | `qdrant.cascada.vision` |
| Cert/Auth | `cascada.kora.vision` |

### Docker Compose Structure (Hetzner)
```
/opt/convex/                 # Kora Convex instance
└── docker-compose.yml
/opt/convex-cascada/         # Cascada Convex instance
├── docker-compose.yml
├── .env
└── convex-data/
/opt/qdrant/                 # Qdrant + mem0 stack
└── docker-compose.yml
/etc/systemd/system/
└── cloudflared.service      # Cloudflare Tunnel
```

### Cloudflare Tunnel Ingress (Zero Trust)
```
convex.cascada.vision        -> http://localhost:3221  # Convex site proxy (HTTP actions)
qdrant.cascada.vision     -> http://localhost:6333
```

### Cascada Convex Environment Variables
```env
# Convex public endpoints
CONVEX_CLOUD_ORIGIN=https://convex.cascada.vision
CONVEX_SITE_ORIGIN=https://convex.cascada.vision
NEXT_PUBLIC_DEPLOYMENT_URL=https://convex.cascada.vision
PORT=3220
SITE_PROXY_PORT=3221
DASHBOARD_PORT=6792

# Instance configuration
INSTANCE_NAME=cascada-convex
INSTANCE_SECRET=<generated>

# AI Providers
OPENROUTER_API_KEY=
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=

# Supabase integration
SUPABASE_URL=<from-supabase>
SUPABASE_SERVICE_ROLE_KEY=<from-supabase>

# Internal HMAC secrets
KORA_HMAC_SECRET=<shared-secret>
```

### Deployment Commands
```bash
# SSH to Hetzner
ssh root@<hetzner-ip>

# Deploy/update
cd /opt/convex-cascada
docker compose up -d

# View logs
docker compose logs -f backend

# Convex CLI (local dev)
bunx convex dev --url https://convex.cascada.vision
```

---

## Completed: Phases 1-2 ✅

**Convex Backend** (`muse/convex/`):
- `schema.ts` — 9 tables (projects, documents, entities, relationships, mentions, captures, presence, generationStreams, aiUsage)
- `lib/auth.ts` — JWT validation, access helpers
- CRUD modules with auth: projects, documents, entities, relationships
- `convex.json` — Self-hosted config

**Client Package** (`muse/packages/convex-client/`):
- `ConvexOfflineProvider` with TanStack Query
- IndexedDB cache + offline mutation queue
- Hooks: `useConvexQueryWithCache`, `useConvexMutationWithQueue`

**Web Integration** (`muse/apps/web/src/providers/`):
- `ConvexProvider.tsx` — Supabase JWT → Convex auth

---

## Phase 3: Deployment & Migration

- [x] Set up cascada Convex in `/opt/convex-cascada` (ports 3220/3221, dashboard 6792)
- [x] Configure Cloudflare Tunnel for `convex.cascada.vision` → `http://localhost:3221`
- [ ] Get API token from `cascada.kora.vision`
- [ ] Generate types: `bunx convex dev`
- [ ] Migration script: Supabase → Convex (one-time)
- [ ] Dual-write: Convex primary, Supabase shadow

---

## Phase 4: Replace SyncEngine

- [ ] Wire `useEntities` → Convex query (first hook)
- [ ] Replace Zustand sync with Convex subscriptions
- [ ] Feature flag `USE_CONVEX` to toggle sources
- [ ] Delete `packages/sync/` (~2,749 LOC)

---

## Phase 5: AI → Convex HTTP Actions ✅ Complete

**HTTP Router** (`convex/http.ts`):
- Routes: `/ai/saga` (SSE), `/ai/detect` (JSON), `/health`
- CORS preflight handling
- Auth validation via `lib/httpAuth.ts`

**Streaming Infrastructure** (`convex/lib/`):
- `streaming.ts` — SSE utilities (mirrors Supabase Edge patterns)
- `httpAuth.ts` — Supabase JWT + anonymous trial validation
- `qdrant.ts` — Qdrant REST client with retry logic
- `embeddings.ts` — DeepInfra embedding client

**AI Actions** (`convex/ai/`):
- `streams.ts` — Delta persistence for stream recovery
- `saga.ts` — Main streaming chat with RAG context
- `detect.ts` — Entity detection action
- `tools.ts` — Tool execution (9 tools: detect_entities, check_consistency, genesis_world, generate_template, clarity_check, name_generator, commit_decision, search_images, find_similar_images)

**Client Integration** (`apps/web/src/services/`):
- `config.ts` — Feature flag `VITE_USE_CONVEX_AI` to toggle endpoint
- `ai/agentRuntimeClient.ts` — Updated to use `getAIEndpoint()` for Convex routing

### Remaining Cleanup

- [ ] Test end-to-end with `VITE_USE_CONVEX_AI=true`
- [ ] Delete `supabase/functions/ai-*` (~15 functions, ~3,000 LOC) after validation

---

## Phase 6: Background Tasks ✅ Complete

**Cron Jobs** (`convex/crons.ts`):
- `cleanup-old-streams` — Daily at 3:00 AM UTC, removes old generation streams
- `aggregate-ai-usage` — Hourly, aggregates AI usage stats (placeholder)
- `cleanup-stale-presence` — Every 5 minutes, removes stale presence records

**Maintenance Module** (`convex/maintenance.ts`):
- `cleanupOldStreams` — Deletes completed/failed streams older than 7 days
- `aggregateAIUsage` — Placeholder for future billing aggregation
- `cleanupStalePresence` — Removes presence records not updated in 2 minutes
- `syncEmbeddings` — Placeholder for future Qdrant sync

### Future Enhancements

- [ ] Implement `syncEmbeddings` for automatic document vectorization
- [ ] Add consistency check cron for automated linting

---

## Phase 7: Mobile

- [ ] Replace expo-sqlite with Convex + AsyncStorage
- [ ] Delete mobile sync code (~420 LOC)

---

## What Stays in Supabase

| Component | Reason |
|-----------|--------|
| Auth | Existing JWT infra, client SDKs |
| RLS tables | Billing, user settings, audit logs |
| Stripe webhooks | Existing integration |

---

## Deletion Target (~6,000 LOC)

| Area | LOC |
|------|-----|
| `packages/sync/` | ~2,749 |
| `supabase/functions/ai-*` | ~3,000 |
| Mobile sync code | ~420 |

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| AI context latency | ~100ms | ~5ms |
| Sync code | 4,000+ LOC | 0 |
| AI deployments | Supabase Edge | Convex only |
| Offline | Custom | Built-in |

---

## UI Foundation Status

> Full details: [UI Architecture](./UI_ARCHITECTURE.md)

**Phase 1: Foundation** ✅ Complete
- Expo SDK 54 + Router 6
- Design tokens, theme hook (light/dark)
- AppShell with resizable panels
- AI Panel with Muse avatar, model selector, context scope

**Phase 2: MLP UI** 🔜 Open Tasks
- [ ] Editor component (placeholder or basic)
- [ ] Entity forms and cards
- [ ] Project switcher modal
- [ ] Chapter/scene tree interactions
- [ ] AI chat message list
- [ ] Tool execution cards
- [ ] Keyboard shortcuts
- [ ] Animations and polish

**Related BD Tasks:**
| ID | Priority | Title |
|----|----------|-------|
| muse-j3z | P1 | Expo UI - Convex Data Integration |
| muse-nnl | P1 | Expo UI - AI Tools Panel |
| muse-z93 | P2 | Expo UI - Native Builds (iOS/macOS) |

---

## Phase 8: AI Agent Tool Calls

Enable AI to be proactive by manipulating the UI through tool calls.

### Goal

Transform the AI from a passive responder into an active collaborator that can:
- Ask clarifying questions with structured options (0-N choices)
- Open workspace panels and focus on entities
- Create/update entities and relationships with confirmation
- Display relationship graphs and analysis results

### Architecture Pattern

Inspired by [OpenCode](https://github.com/anomalyco/opencode) agent architecture:
- **Agent separation by intent**: "draft" vs "revise" modes (like OpenCode's build/plan)
- **Permission-based tool execution**: Explicit confirmation for destructive actions
- **Subagent delegation**: `@research`, `@editor`, `@outline` mentions for specialized tasks

### Technology Stack

| Component | Technology | Reference |
|-----------|------------|-----------|
| Streaming | Vercel AI SDK v5 `streamText` | [AI SDK Docs](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) |
| Delta Persistence | Convex Agent `DeltaStreamer` | [Convex Agent](https://github.com/get-convex/agent) |
| Tool Calling | AI SDK tool call streaming | Built-in with v5 |
| State | Zustand workspace store | Client-side |

### Key Patterns from Convex Agent

**Streaming with delta persistence:**
- Use `saveStreamDeltas: { returnImmediately: true }` for HTTP streaming
- `DeltaStreamer` for async delta writes with throttling
- `compressUIMessageChunks` for efficient delta batching

**HTTP Action streaming:**
- Return `result.toUIMessageStreamResponse()` from Convex HTTP actions
- Client subscribes to deltas via Convex real-time queries

### Tool Categories

| Category | Tools | Purpose |
|----------|-------|---------|
| **UI Control** | `ask_question`, `open_panel`, `focus_entity`, `show_graph` | Manipulate workspace |
| **Entity Ops** | `create_entity`, `update_entity`, `create_relationship` | Modify story world |
| **Analysis** | `analyze_consistency`, `suggest_connections`, `find_issues` | Proactive insights |

### ask_question Tool

Enables proactive AI assistance with flexible response types:
- **0 options**: Free-form text input
- **N options**: Single or multi-select choices
- **Context hint**: Shows what the decision affects

### File Locations

| File | Purpose |
|------|---------|
| `packages/core/src/ai/tool-types.ts` | Tool type definitions |
| `apps/expo/src/stores/workspace.ts` | Workspace state (panels, questions, focus) |
| `apps/expo/src/components/ai/AskQuestionCard.tsx` | Question UI |
| `apps/expo/src/components/ai/ToolCallCard.tsx` | Tool status display |
| `convex/ai/tools.ts` | Convex tool execution |

### Implementation Checklist

- [x] Define tool types in `packages/core/src/ai/tool-types.ts`
- [x] Create workspace store in `apps/expo/src/stores/workspace.ts`
- [x] Implement `AskQuestionCard` component
- [x] Implement `ToolCallCard` component
- [x] Extend `ChatMessage` type with tool calls
- [x] Update `MessageBubble` to render tool calls inline
- [ ] Integrate Convex Agent for streaming
- [ ] Add UI tools to Convex `ai/tools.ts`
- [ ] Wire tool responses back to AI context
- [ ] Test in all panel modes (side, floating, full)

### References

- [OpenCode Architecture](https://github.com/anomalyco/opencode) - Agent patterns, permission model
- [Convex Agent](https://github.com/get-convex/agent) - Streaming, delta persistence, threads
- [Vercel AI SDK](https://ai-sdk.dev) - `streamText`, tool calling, `toUIMessageStreamResponse`
- [Convex RAG](https://github.com/get-convex/rag) - Semantic search for context

---

## Phase 9: Purpose-Built Workspaces

Specialized environments for deep creative work.

### Goal

Create focused workspaces where writers can dive deep into specific aspects:
- Character development with AI as co-creator
- Multi-character relationship mapping
- World-building with AI-generated templates
- Plot architecture with timeline visualization

### Workspace Types

| Workspace | Purpose | Layout | AI Role |
|-----------|---------|--------|---------|
| **Character Workshop** | Deep character development | Split: entity sheet + chat | Probes motivations, suggests conflicts |
| **Relationship Mapper** | Multi-character dynamics | Graph + chat | Identifies tensions, suggests arcs |
| **World Builder** | Factions, magic, geography | Tabbed panels + chat | Validates consistency, fills gaps |
| **Plot Architect** | Timeline and structure | Timeline + chat | Finds holes, suggests foreshadowing |

### Character Workshop

Split-panel layout for focused character work:
- Left: Editable character sheet (traits, arc, relationships)
- Right: AI chat with character context pre-loaded
- AI proactively asks about inconsistencies, suggests depth

### World Builder Tabs

| Tab | Content | AI Capabilities |
|-----|---------|-----------------|
| **Factions** | Groups, alliances, rivalries | Power balance analysis |
| **Magic** | Systems, rules, costs | Rule validation, limitation suggestions |
| **Timeline** | History, events | Anachronism detection |
| **Geography** | Locations, travel | Distance/travel time logic |
| **Cultures** | Customs, languages | Consistency checking |

### Relationship Mapper

Visual graph using React Flow:
- Nodes: Characters with role indicators
- Edges: Relationship types with strength
- AI can highlight paths, suggest missing connections
- Click to open Character Workshop for any node

### Implementation Checklist

- [ ] Create `WorkspacePanel` component with mode switching
- [ ] Implement `CharacterSheet` component
- [ ] Implement `RelationshipGraph` using React Flow
- [ ] Implement `WorldBuilderTabs` component
- [ ] Add workspace mode to layout store
- [ ] Wire AI tools to workspace actions
- [ ] Add keyboard shortcuts for workspace navigation

### References

- [React Flow](https://reactflow.dev) - Graph visualization
- [Zustand](https://zustand-demo.pmnd.rs) - State management patterns
