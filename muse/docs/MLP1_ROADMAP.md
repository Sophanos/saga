# MLP 1: AI Co-Author Roadmap

> **Last Updated:** 2026-01-08 | **Target:** Web + macOS first, then iOS/iPad

## Summary

Mythos transforms from a writing tool into an **AI co-author** with:
- Auto-extraction of entities, relationships, world-building
- Writer style adaptation via embeddings
- Real-time feedback (show-don't-tell, dialogue, tension)
- Tool-based workspace manipulation
- Thread persistence with full context
- Offline-first + real-time sync (Figma model)

---

## Progress Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE                              STATUS           PROGRESS        │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Editor WebView Bundle           Complete         [██████████] ✅ │
│ 2. Convex Agent Integration        Complete         [██████████] ✅ │
│ 3. Platform Integration            In Progress      [██████░░░░] 60%│
│    └─ Web                          Complete         [██████████] ✅ │
│    └─ macOS (Tauri)                Scaffold Done    [████████░░] ✅ │
│    └─ Expo (iOS/iPad)              Partial          [██████░░░░]    │
│ 4. RAG Pipeline                    Complete         [██████████] ✅ │
│ 5. Skills + Polish                 Started          [█░░░░░░░░░] 10%│
├─────────────────────────────────────────────────────────────────────┤
│ 6. Auth (Better Auth)              Complete         [██████████] ✅ │
│ 7. Billing (RevenueCat)            Complete         [██████████] ✅ │
│ 8. Observability (PostHog + Logs)  Not Started      [░░░░░░░░░░]    │
├─────────────────────────────────────────────────────────────────────┤
│ OVERALL MLP 1                                       [████████░░] 80%│
└─────────────────────────────────────────────────────────────────────┘
```

### Critical Path

```
✅ P1 (Editor) ──▶ ✅ P2 (Agent) ──▶ 🔲 P3 (Platforms)
                        │                    │
                  ✅ P4 (RAG) ──▶ 🔲 P5 (Skills)
                                             │
                        ┌────────────────────┤
                        ▼                    ▼
                   ✅ P6 (Auth)         🔲 P8 (Observability)
                        │
                   ✅ P7 (Billing)
```

---

## Architecture

### Stack

| Layer | Tech | Endpoint |
|-------|------|----------|
| **Database** | Convex (self-hosted) | `api.cascada.vision:3220` |
| **Vectors** | Qdrant (self-hosted) | `qdrant.cascada.vision:6333` |
| **Auth** | Better Auth (Convex local) | `convex/betterAuth/` |
| **Billing** | RevenueCat | Webhook → Convex |
| **Agent** | @convex-dev/agent | `convex/ai/` |
| **Embeddings** | DeepInfra Qwen3-8B | $0.01/1M tokens |
| **Reranker** | DeepInfra Qwen3-4B | HTTP API |
| **Analytics** | PostHog (self-hosted) | Hetzner |

### Data Flow

```
User writes ──▶ Entity Detection ──▶ Convex entities
     │                │
     │                └──▶ Qdrant embeddings
     │
     └──▶ Style Learning (bg) ──▶ memories table
                │
                ▼
┌─────────────────────────────────────┐
│ AI Agent (Convex Action)            │
│ ├─ RAG: hybrid + RRF + rerank       │
│ ├─ Thread: @convex-dev/agent        │
│ └─ Tools: ask, write, search        │
└────────────────┬────────────────────┘
                 │
                 ▼
Workspace Store (Zustand) ──▶ UI updates
```

---

## Platform Strategy

```
┌────────────────────────────────────────────────────────────────────┐
│              EDITOR BUNDLE (Built Once, Used Everywhere)           │
│  packages/editor-webview/                                          │
│  TipTap + ProseMirror + AI Toolkit + Bridge                        │
├────────────────────────────────────────────────────────────────────┤
│                       PLATFORM SHELLS                               │
├──────────────────┬──────────────────┬──────────────────────────────┤
│      Web         │     macOS        │     iOS / iPad               │
│   (Vite React)   │    (Tauri)       │    (Expo RN)                 │
│                  │                  │                              │
│   TipTap direct  │   Tauri WebView  │   react-native-webview       │
│   PRIMARY ✅     │   PRIORITY 2     │   PRIORITY 3                 │
└──────────────────┴──────────────────┴──────────────────────────────┘
```

| Platform | Status | Bundle Size | Notes |
|----------|--------|-------------|-------|
| **Web** | ✅ Ready | N/A | Primary development target |
| **macOS** | 🔲 Next | ~5MB | Tauri = native feel, AppKit menus |
| **iOS/iPad** | 🔲 Later | ~10MB | Expo + WebView |

---

## File Structure by Phase

### Phase 1: Editor Bundle ✅ COMPLETE

```
packages/editor-webview/
├── src/
│   ├── extensions/
│   │   ├── ai-generated-mark.ts     # Mark + status attrs
│   │   ├── suggestion-plugin.ts     # Decorations + widgets
│   │   └── ai-toolkit.ts            # Diff-first editing
│   ├── components/
│   │   └── BatchApprovalBar.tsx     # Bulk accept/reject
│   └── bridge.ts                    # Platform messaging
├── build/
│   ├── editor.bundle.js             # 785KB gzip:233KB
│   └── editor.html
└── vite.config.ts                   # IIFE bundle
```

### Phase 2: Agent Runtime ✅ COMPLETE

```
convex/
├── convex.config.ts                 # Agent component
├── ai/
│   ├── agentRuntime.ts              # Agent loop + auto-execute
│   ├── threads.ts                   # Thread persistence
│   ├── streams.ts                   # SSE streaming
│   ├── rag.ts                       # Hybrid + RRF + rerank
│   ├── lexical.ts                   # Full-text search
│   ├── embeddings.ts                # Outbox + cron
│   └── tools/
│       ├── editorTools.ts           # ask_question, write_content
│       ├── ragTools.ts              # search_context, get_entity
│       └── ragHandlers.ts           # Server handlers
├── lib/
│   ├── qdrant.ts                    # REST client
│   ├── rerank.ts                    # Qwen3-Reranker
│   └── deepinfraEmbedding.ts        # Embedding model
└── crons.ts                         # 30s embedding sync
```

### Phase 3: Platform Integration (40%)

```
apps/web/                            # ✅ COMPLETE
├── src/providers/ConvexProvider.tsx
├── src/services/ai/sagaClient.ts
└── src/hooks/useSagaAgent.ts

apps/tauri/                          # 🔲 NOT STARTED
├── src/App.tsx
├── src/components/editor/
│   └── EditorWebView.tsx            # Load editor.bundle.js
├── src/hooks/useEditorBridge.ts
└── src-tauri/
    └── src/lib.rs                   # Rust bridge commands

apps/expo/                           # ⏳ PARTIAL
├── src/components/ai/
│   ├── AIPanel.tsx                  # ✅ 3-mode panel
│   ├── AskQuestionCard.tsx          # ✅ Question UI
│   └── ToolCallCard.tsx             # ✅ Tool display
├── src/components/editor/
│   └── MythosEditor.tsx             # 🔲 WebView wrapper
├── src/hooks/
│   └── useEditorBridge.ts           # 🔲 Bridge hook
└── src/design-system/               # ✅ Complete
```

### Phase 4: RAG Pipeline ✅ COMPLETE

```
convex/
├── ai/rag.ts                        # retrieveRAGContext + chunkContext
├── ai/lexical.ts                    # Full-text BM25
├── ai/embeddings.ts                 # Outbox pattern
├── lib/rerank.ts                    # Qwen3-Reranker-4B
├── schema.ts                        # memories table
└── crons.ts                         # 30s sync interval
```

**Features:**
- Hybrid search (dense + sparse) + RRF fusion
- Chunk context expansion via Qdrant scroll (N-2, N-1, hit, N+1)
- Diff-based embedding updates (content hash)
- Graceful degradation on Qdrant failure

### Phase 5: Skills (10%)

```
convex/ai/skills/                    # 🔲 ALL PENDING
├── index.ts                         # Tool exports
├── plan.ts                          # plan_story
├── world.ts                         # build_world
├── character.ts                     # develop_character
├── research.ts                      # research_facts (Exa)
└── analyze.ts                       # analyze_writing
```

---

## Migration: Supabase → Convex

### Tables to KEEP in Supabase (Optional)

| Table | Reason |
|-------|--------|
| `activity_log` | High-volume append-only |
| `ai_request_logs` | Analytics (or migrate to PostHog) |

### AI Endpoints Migration

| Current Endpoint | Target | Priority |
|------------------|--------|----------|
| `ai-chat` | `convex/ai/chat.ts` action | P0 - Core |
| `ai-agent` | Replaced by `@convex-dev/agent` | P0 - Core |
| `ai-detect` | `convex/ai/detect.ts` action | P1 |
| `ai-embed` | `convex/ai/embed.ts` action | P1 |
| `ai-search` | `convex/ai/search.ts` action | P1 |
| `ai-lint` | `convex/ai/lint.ts` action | P1 |
| `ai-coach` | `convex/ai/coach.ts` action | P2 |
| `ai-dynamics` | `convex/ai/dynamics.ts` action | P2 |
| `ai-genesis` | `convex/ai/genesis.ts` action | P2 |
| `ai-learn-style` | `convex/ai/style.ts` action | P3 |
| `ai-image*` | `convex/ai/image.ts` action | P3 |

### Billing Logic Migration

| Current (Supabase) | Target (Convex) |
|--------------------|-----------------|
| `checkBillingAndGetKey()` | `convex/billing/check.ts` query |
| `get_billing_context` RPC | `convex/billing/context.ts` query |
| `recordAIRequest()` | `convex/billing/record.ts` mutation |
| Stripe webhook | **Remove** (use RevenueCat) |

---

## Memory & Vector Architecture

### Separation of Concerns

| Layer | Technology | Purpose | Storage |
|-------|------------|---------|---------|
| **Thread Memory** | Convex Agent (built-in) | Conversation context | Convex tables |
| **Document Corpus** | Qdrant (Hetzner) | Chapters, entities, world | `saga_vectors` |
| **Embeddings** | DeepInfra Qwen3-8B | 4096 dims, $0.01/1M | Compute only |
| **Reranking** | DeepInfra Qwen3-4B | HTTP API | Compute only |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONVEX AGENT                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Built-in Memory + Vector Search                         │   │
│  │  • textEmbeddingModel: deepinfra("Qwen3-Embedding-8B")  │   │
│  │  • Threads, messages auto-embedded                       │   │
│  │  • contextOptions.vectorSearch for thread memory         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Tool: search_documents (for Qdrant corpus)              │   │
│  │  1. embed(query) via DeepInfra                           │   │
│  │  2. qdrant.search(embedding)                             │   │
│  │  3. rerank(results) via Qwen3-Reranker-4B                │   │
│  │  4. Return top-N chunks                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐                ┌──────────────────┐
│  CONVEX         │                │  QDRANT          │
│  Thread memory  │                │  saga_vectors    │
│  Short-term     │                │  Long-term       │
└─────────────────┘                └──────────────────┘
```

### Qdrant Configuration

| Setting | Value |
|---------|-------|
| **Host** | `qdrant.cascada.vision:6333` |
| **Collections** | `saga_vectors`, `saga_images` |
| **Embedding Model** | `Qwen/Qwen3-Embedding-8B` (4096 dims) |
| **Distance** | Cosine |

### Failure Handling

| Scenario | Behavior |
|----------|----------|
| Qdrant unreachable | Tool returns error, agent uses thread context only |
| Embedding API fails | Retry 3x with backoff, graceful degradation |
| Rerank slow (>500ms) | Skip reranking, use Qdrant scores directly |

---

## Context Budgeter (100k total)

| Priority | Source | Max Tokens | Notes |
|----------|--------|------------|-------|
| 1 | System prompt + tools | 3k | Fixed overhead |
| 2 | Active doc delta | 15k | Changes since lastSeenVersion |
| 3 | Pinned docs (auto + manual) | 20k | Smart pinning included |
| 4 | RAG top-K results | 25k | After rerank, ~5 chunks |
| 5 | Thread history + summary | 30k | Rolling summary for old messages |
| 6 | Response reserve | 7k | For model output |

### Smart Pinning (Automatic, max 3)

- Editing scene with POV character → auto-pin character sheet
- Mentions location → auto-pin location doc
- References past event → auto-pin timeline
- Show in context scope UI so user can unpin

### Context Inspector UI

```
┌─────────────────────────────────────────────────────┐
│ Context: 72,450 / 100,000 tokens                    │
├─────────────────────────────────────────────────────┤
│ ▼ System + Tools           3,012 tokens             │
│ ▼ Active Document         12,847 tokens             │
│   └─ Chapter 3: The Escape (delta since v12)        │
│ ▼ Pinned Documents        18,234 tokens             │
│   ├─ Elena Vasquez (auto-pinned: POV char)       ⓧ │
│   ├─ The Citadel (auto-pinned: location)         ⓧ │
│   └─ Timeline: Act 2 (manual pin)                ⓧ │
│ ▼ RAG Results             24,891 tokens             │
│   ├─ ch1/scene-3.md (0.94) "Elena first met..."     │
│   ├─ world/factions.md (0.87) "The Order..."        │
│   └─ +2 more chunks                                 │
│ ▼ Thread History          13,466 tokens             │
│   └─ 8 messages (3 summarized)                      │
├─────────────────────────────────────────────────────┤
│ [Expand Sources] [Edit Pins] [Send Message]         │
└─────────────────────────────────────────────────────┘
```

---

## Skills System (Agent-Invocable Tools)

### Philosophy

**No slash commands.** The agent understands natural language intent and invokes skills as tools.

- User says: "Help me plan act 2" → Agent invokes `plan_story` tool
- User says: "I want to develop Elena more" → Agent invokes `develop_character` tool
- User says: "Is this historically accurate?" → Agent invokes `research_facts` tool

### Core Skills (as Tools)

| Tool Name | Description (for LLM) | What It Does |
|-----------|----------------------|--------------|
| `plan_story` | Help user plan story structure, plot arcs, beat sheets | Generates outlines, timelines |
| `build_world` | Help develop worldbuilding: factions, magic, geography | Creates/refines world elements |
| `develop_character` | Deep dive into character arc, motivation, backstory | Character analysis |
| `research_facts` | Fact-check historical accuracy, find sources | RAG + Exa web search |
| `web_search` | Search the web for current info, documentation | Exa API |
| `analyze_writing` | Analyze quality: show-don't-tell, pacing, tension | Metrics + suggestions |
| `detect_entities` | Extract characters, locations, items from text | Entity detection |
| `check_consistency` | Find plot holes, timeline issues | Consistency linting |

### Exa Web Search Integration

```typescript
// convex/ai/skills/research.ts
import Exa from 'exa-js';

const exa = new Exa(process.env.EXA_API_KEY);

export const webSearchTool = tool({
  description: 'Search web for facts, historical accuracy, research',
  parameters: z.object({
    query: z.string(),
    type: z.enum(['general', 'historical', 'scientific']).optional(),
  }),
  execute: async ({ query, type }) => {
    const { results } = await exa.searchAndContents(query, {
      livecrawl: 'always',
      numResults: 5,
      type: type === 'historical' ? 'keyword' : 'neural',
    });
    return results.map(r => ({
      title: r.title,
      url: r.url,
      excerpt: r.text.slice(0, 1500),
    }));
  },
});
```

**Cost:** ~$0.001/search

---

## Conflict Resolution + Batch Approval

### Conflict Staging Flow

```
AI insertion requested (5s soft lock)
         │
         ▼
┌──────────────────┐
│ Set soft lock    │ pendingAIWrite: { range, expiresAt: +5s }
└────────┬─────────┘
         │
User edits near target?
         │
    ┌────┴────┐
   No        Yes
    │         │
    ▼         ▼
 Insert    Stage in conflict queue
           (not in doc yet)
              │
              ▼
┌─────────────────────────────────────┐
│ Conflict Staging Panel              │
│ "AI wants to insert here, but you   │
│  edited nearby. Review the change:" │
│                                     │
│ [Your edit]    │  [AI suggestion]   │
│ "She walked"   │  "She sprinted"    │
│                                     │
│ [Keep Mine] [Use AI] [Merge] [Skip] │
└─────────────────────────────────────┘
```

### Batch Approval (Reduce Approval Fatigue)

When multiple AI suggestions are pending:

```
┌─────────────────────────────────────────────────────────────┐
│ 3 AI suggestions pending                                    │
│                                                             │
│ [Preview All] [Accept All (3)] [Reject All] [Review 1-by-1] │
└─────────────────────────────────────────────────────────────┘
```

**Auto-Batch Thresholds:**

| Scenario | Behavior |
|----------|----------|
| 1 suggestion | Inline buttons only |
| 2-5 suggestions | BatchApprovalBar + inline |
| 6+ suggestions | BatchApprovalBar only (hide inline) |
| Same paragraph | Group as single suggestion |

---

## QA Harness for RAG Quality

### Automated Test Suite

- Agent streaming E2E tests (convex-test + AI SDK mock model)
- Tool-call loop coverage (auto tools, approval tools, resume)
- ChunkContext expansion regression coverage

```typescript
// packages/qa/src/rag-harness.ts
interface RAGTestCase {
  id: string;
  projectType: 'fantasy' | 'scifi' | 'romance' | 'thriller';
  query: string;
  expectedChunks: string[];  // chunkIds that should appear
  minRelevanceScore?: number;
}

const testCases: RAGTestCase[] = [
  {
    id: 'fantasy-character-lookup',
    projectType: 'fantasy',
    query: 'What is Elena\'s motivation?',
    expectedChunks: ['elena-backstory', 'elena-arc-ch3'],
    minRelevanceScore: 0.8,
  },
  // 20-50 test cases per project type
];
```

### Metrics Tracked

| Metric | Formula | Target | Alert |
|--------|---------|--------|-------|
| **Recall@K** | (relevant in top-K) / (total relevant) | >80% | <70% |
| **MRR** | 1 / rank of first relevant | >0.6 | <0.4 |
| **Reranker Lift** | MRR(with) - MRR(without) | >0.15 | <0.05 |
| **Reranker p95** | 95th percentile latency | <500ms | >800ms |
| **Approval Rate** | approved / total | >70% | <50% |
| **Edit-before-Approve** | edited / approved | <20% | >40% |
| **Time-to-Decision** | median time | <30s | >60s |

### QA Dashboard (PostHog)

```
┌─────────────────────────────────────────────────────────────┐
│ AI Quality Dashboard (Last 7 Days)                          │
├─────────────────────────────────────────────────────────────┤
│ Approval Rate        ████████████░░░░ 78%  (target: 70%)   │
│ Edit-before-Approve  ███░░░░░░░░░░░░░ 15%  (target: <20%)  │
│ Time-to-Decision     ████████░░░░░░░░ 24s  (target: <30s)  │
│                                                             │
│ RAG Metrics:                                                │
│ Recall@5            █████████████░░░ 84%                   │
│ MRR                 ██████████░░░░░░ 0.67                  │
│ Reranker Lift       ████░░░░░░░░░░░░ +0.18                 │
│ Reranker p95        ████████░░░░░░░░ 312ms                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Security & Audit

### Permission Model

| Tool | Permission |
|------|------------|
| `ask_question`, `open_panel`, `focus_entity` | None (auto-approve) |
| `search_context`, `analyze_style` | None (read-only) |
| `write_content`, `create_entity`, `create_relationship` | Approval required |

### RLS Considerations

- All queries check `ctx.auth.getUserIdentity()`
- Qdrant queries always filter by `projectId`
- Tool calls validated against project ownership
- AI cannot access documents outside project scope
- Rate limits per user, not global

### Audit Trail

| Data | Retention | Storage |
|------|-----------|---------|
| Tool call traces | 90 days | Thread message metadata |
| Rejected AI suggestions | 90 days | Thread message metadata |
| Approval decisions | 1 year | Separate audit log (optional) |
| Aggregated metrics | Forever | PostHog |

### Rate Limits

| Limit | Threshold | Action |
|-------|-----------|--------|
| Embeddings/day | 1000 | Alert at 80%, block at 100% |
| AI calls/day | 100 (free), 1000 (pro) | Graceful degradation |
| Background tasks | 10 jobs/min | Throttle queue |

---

## Idle Save + Qdrant Sync

### Editor Autosave

```
Keystroke → Local draft (250-500ms debounce)
                │
                ▼
         Idle detected (1-2s pause)
                │
                ▼
         Push to Convex (version++)
                │
                ▼
         Enqueue embedding job
```

### Embedding Outbox Pattern

```typescript
// Already in convex/schema.ts
embeddingJobs: defineTable({
  projectId: v.id("projects"),
  targetType: v.string(),        // "document" | "entity"
  targetId: v.string(),
  status: v.string(),            // "pending" | "processing" | "synced" | "failed"
  attempts: v.number(),
  lastError: v.optional(v.string()),
  createdAt: v.number(),
})
```

### Retry Logic

- Max 5 retries: 30s, 1m, 2m, 4m, 8m (exponential backoff)
- After 5 failures: status = 'failed', requires manual retry
- Backoff resets on success

### SyncStatus UI

```
┌─────────────────────────────────────────┐
│ Documents                               │
├─────────────────────────────────────────┤
│ ● Chapter 1: Origins        ✓ Synced    │
│ ● Chapter 2: The Call       ↻ Syncing   │
│ ● Chapter 3: The Escape     ⏳ Pending  │
│ ● Chapter 4: Betrayal       ⚠ Failed    │
│   └─ [Retry] Qdrant timeout             │
└─────────────────────────────────────────┘
```

| Status | Icon | Color |
|--------|------|-------|
| `synced` | ✓ | Green |
| `pending` | ⏳ | Yellow |
| `processing` | ↻ | Blue |
| `failed` | ⚠ | Red |

---

## UI Enhancements

| Feature | Description |
|---------|-------------|
| **Context Inspector** | Token counts before sending ("Context: 72k/100k") |
| **Diff View** | Inline additions (green) / deletions (red), toggle |
| **Batch Approval** | "Approve all (3)" floating bar when multiple pending |
| **Suggestion Mode** | Stream to preview panel instead of direct insert (opt-in) |
| **Rejection Feedback** | Optional reason capture (wrong tone, etc.) for learning |
| **Tool Transparency** | "Sources" expandable with top-K chunks + scores |
| **Memory Dashboard** | "What AI learned" - style vectors, decisions, entity count |

---

## Remaining Work

### Phase 3: Platform Integration

#### Tauri macOS (Scaffold Complete)

| Task | Status |
|------|--------|
| Tauri v2 app shell | ✅ |
| Editor iframe + bridge | ✅ |
| useEditorBridge hook | ✅ |
| macOS titlebar (overlay) | ✅ |
| Asset protocol + CSP | ✅ |
| Turborepo integration | ✅ |

#### Tauri ← Expo Web Convergence (Next)

| Step | Task | Status |
|------|------|--------|
| 1 | Point Tauri devUrl to Expo Web (`:8082`) | 🔲 |
| 2 | Test all features in WebView context | 🔲 |
| 3 | Replace Tauri components with Expo Web | 🔲 |
| 4 | Production: Expo export → Tauri resources | 🔲 |
| 5 | Native menus + shortcuts | 🔲 |
| 6 | Auto-update + code signing | 🔲 |

#### Expo iOS/iPad (Future)

| Task | Status |
|------|--------|
| MythosEditor WebView wrapper | 🔲 |
| Touch keyboard handling | 🔲 |
| Offline queue sync | 🔲 |

### Phase 5: Skills + Polish

| Skill | Purpose | Effort |
|-------|---------|--------|
| `plan_story` | Plot arcs, beat sheets | 4h |
| `build_world` | Factions, magic, geography | 4h |
| `develop_character` | Arc, motivation, backstory | 3h |
| `research_facts` | RAG + Exa web search | 3h |
| `analyze_writing` | SDT, pacing, tension | 2h |

---

## Phase 6: Auth (Better Auth) ✅ COMPLETE

### Files Created

```
convex/
├── convex.config.ts                 # Better Auth component
├── auth.config.ts                   # Auth provider config
├── betterAuth.ts                    # createAuth + queries
├── lib/
│   ├── webhookSecurity.ts           # Timing-safe verification
│   └── rateLimiting.ts              # Auth rate limits

packages/auth/                       # @mythos/auth
├── src/
│   ├── client/                      # Base auth client
│   ├── expo/                        # Expo + SecureStore
│   ├── tauri/                       # Tauri + deep links
│   ├── revenuecat/                  # RevenueCat SDK wrapper
│   └── hooks/                       # React hooks

apps/expo/
├── app/(auth)/                      # Sign in/up screens
└── src/lib/auth.ts                  # Expo auth client

apps/tauri/
├── src/lib/auth.ts                  # Tauri auth client
└── src-tauri/src/lib.rs             # Deep link handler
```

### Features

- Email/password + Apple/Google OAuth
- Cross-platform sessions (Expo, Tauri, Web)
- Deep link callbacks for native OAuth
- Rate limiting on auth endpoints
- Webhook signature verification

---

## Phase 7: Billing (RevenueCat) ✅ COMPLETE

### Files Created

```
convex/
├── schema.ts                        # subscriptions, subscriptionEvents
├── subscriptions.ts                 # Webhook handler + queries
├── http.ts                          # /webhooks/revenuecat endpoint

packages/auth/src/revenuecat/        # RevenueCat SDK wrapper
├── index.ts                         # Init, login, sync, purchase

docs/
└── AUTH.md                          # Deployment guide
```

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ iOS/Android  │────▶│  RevenueCat  │────▶│   Convex     │
│ App Store    │     │  (webhooks)  │     │ subscriptions│
│ Play Store   │     │              │     │   table      │
│ Mac App Store│     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Supported Stores

| Platform | Store | IAP Plugin |
|----------|-------|------------|
| iOS | App Store | RevenueCat SDK |
| Android | Play Store | RevenueCat SDK |
| macOS | Mac App Store | tauri-plugin-iap |

### Webhook Events Handled

- `INITIAL_PURCHASE` → Create subscription
- `RENEWAL` → Update expiry
- `CANCELLATION` → Mark canceled
- `EXPIRATION` → Mark expired
- `BILLING_ISSUE` → Grace period
- `TRANSFER` → Handle user transfer

### Next: RevenueCat Dashboard Setup

1. Create project at app.revenuecat.com
2. Add iOS/Android/macOS apps
3. Configure products + entitlements
4. Set webhook URL: `https://cascada.vision/webhooks/revenuecat`

---

## Phase 8: Observability (PostHog + Error Logging)

> **Status:** Not Started | **Priority:** P1

### PostHog Integration

**Self-hosted on Hetzner** (metadata only, never content)

```
┌─────────────────────────────────────────────────────────────────┐
│ POSTHOG EVENTS (Metadata Only)                                   │
├─────────────────────────────────────────────────────────────────┤
│ Event                  │ Properties                              │
├────────────────────────┼─────────────────────────────────────────┤
│ ai_content_decision    │ decision, timeToDecisionMs, tool, model │
│ retrieval_quality      │ totalTokens, ragChunkCount, latencyMs   │
│ onboarding_step        │ step, source, goal                      │
│ feature_used           │ feature, count                          │
│ error_occurred         │ errorCode, component, stack (truncated) │
│ session_start          │ platform, tier, isAnonymous             │
└─────────────────────────────────────────────────────────────────┘
```

### Error Logging with Convex

```typescript
// convex/schema.ts
errorLogs: defineTable({
  userId: v.optional(v.id("users")),
  sessionId: v.string(),
  level: v.string(),               // "error", "warn", "info"
  message: v.string(),
  stack: v.optional(v.string()),
  context: v.optional(v.any()),    // { component, action, etc. }
  platform: v.string(),            // "web", "macos", "ios"
  appVersion: v.string(),
  createdAt: v.number(),
}).index("by_level", ["level", "createdAt"])
  .index("by_user", ["userId", "createdAt"]),
```

### Tasks

| Task | File | Effort |
|------|------|--------|
| Deploy PostHog on Hetzner | `ops/posthog/` | 4h |
| PostHog client wrapper | `packages/analytics/` | 2h |
| Error logging schema | `convex/schema.ts` | 1h |
| Error logging mutation | `convex/errorLogs.ts` | 1h |
| Web ErrorBoundary | `apps/web/src/components/ErrorBoundary.tsx` | 2h |
| Expo error handler | `apps/expo/src/utils/errorHandler.ts` | 2h |
| Error dashboard query | `convex/errorLogs.ts` | 1h |
| PostHog onboarding events | `apps/web/src/hooks/useOnboardingAnalytics.ts` | 2h |
| Quality metrics dashboard | PostHog | 3h |

### Design Journey Tracking

```typescript
// Onboarding funnel
posthog.capture('onboarding_step', {
  step: 'landing_submit',
  source: 'paste' | 'file' | 'empty',
  goal: 'import_organize' | 'proofread' | 'consistency',
});

posthog.capture('onboarding_step', {
  step: 'trial_first_ai_call',
  callsRemaining: 4,
});

posthog.capture('onboarding_step', {
  step: 'signup_completed',
  migrated: true,
});
```

### Error Flow

```
Error occurs ──▶ ErrorBoundary catches
                      │
                      ├──▶ Convex mutation (errorLogs.create)
                      │
                      └──▶ PostHog event (error_occurred)
                                │
                                ▼
                         User sees friendly UI
                         "Something went wrong. Retry?"
```

---

## Schema Additions (Compact)

| Table | Key Fields | Phase |
|-------|-----------|-------|
| `users` | (Better Auth generates) | ✅ P6 |
| `sessions` | (Better Auth generates) | ✅ P6 |
| `subscriptions` | userId, status, productId, expiresAt | ✅ P7 |
| `subscriptionEvents` | eventType, store, transactionId | ✅ P7 |
| `errorLogs` | level, message, stack, context | P8 |
| `memories` | projectId, category, scope, content | ✅ Done |
| `embeddingJobs` | docId, status, attempts | ✅ Done |

---

## Tools Status

### Convex Tools ✅ (Migrated)

| Tool | Auto-Approve | Location |
|------|--------------|----------|
| `ask_question` | Yes | `convex/ai/tools/editorTools.ts` |
| `write_content` | **No** | `convex/ai/tools/editorTools.ts` |
| `search_context` | Yes | `convex/ai/tools/ragTools.ts` |
| `read_document` | Yes | `convex/ai/tools/ragTools.ts` |
| `search_chapters` | Yes | `convex/ai/tools/ragTools.ts` |
| `search_world` | Yes | `convex/ai/tools/ragTools.ts` |
| `get_entity` | Yes | `convex/ai/tools/ragTools.ts` |

### Supabase Tools 🔲 (Need Migration)

| Tool | Location | Priority |
|------|----------|----------|
| `create_entity` | `supabase/functions/_shared/tools/` | P1 |
| `update_entity` | `supabase/functions/_shared/tools/` | P1 |
| `create_relationship` | `supabase/functions/_shared/tools/` | P1 |
| `detect_entities` | `supabase/functions/ai-detect/` | P2 |
| `check_consistency` | `supabase/functions/_shared/tools/` | P2 |
| `genesis_world` | `supabase/functions/_shared/tools/` | P3 |
| `create_entity_from_image` | `supabase/functions/_shared/tools/` | P3 |

---

## Bridge Protocol (Cross-Platform)

| Platform | Detection | To Native | From Native |
|----------|-----------|-----------|-------------|
| Web | Neither | N/A | N/A |
| Tauri | `__TAURI__` | `invoke()` | `evaluate_script()` |
| Expo | `ReactNativeWebView` | `postMessage()` | `injectJavaScript()` |

---

## Key Decisions (Locked)

| Area | Decision | Rationale |
|------|----------|-----------|
| Backend | 100% Convex | Offline-first, real-time, self-hosted |
| Auth | Better Auth | Full control, Convex native |
| Billing | RevenueCat | Required for App Store IAP |
| Threads | @convex-dev/agent | Built-in persistence + streaming |
| Reranker | DeepInfra Qwen3-4B | Cost-effective, accurate |
| Editor | WebView + TipTap | ProseMirror requires DOM |
| Diff UI | Custom SuggestionPlugin | Open source, full control |
| Platform priority | Web → macOS → iOS | Writer desktop usage |
| Privacy | Never send content to PostHog | Metadata only |

---

## Environment Variables

```env
# Convex (Self-Hosted)
CONVEX_SELF_HOSTED_URL=https://api.cascada.vision
CONVEX_SELF_HOSTED_ADMIN_KEY=

# Better Auth
BETTER_AUTH_SECRET=         # openssl rand -base64 32
SITE_URL=https://cascada.vision
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# RevenueCat
REVENUECAT_WEBHOOK_SECRET=
EXPO_PUBLIC_REVENUECAT_API_KEY=

# AI Providers
OPENROUTER_API_KEY=
DEEPINFRA_API_KEY=

# Qdrant
QDRANT_URL=https://qdrant.cascada.vision
QDRANT_API_KEY=

# PostHog (P8)
POSTHOG_API_KEY=
POSTHOG_HOST=https://posthog.cascada.vision
```

---

## Ops & Monitoring

| Service | Backup | Monitor | Location |
|---------|--------|---------|----------|
| Convex | Built-in | `/health` | Hetzner |
| Qdrant | Daily snapshot | Prometheus | Hetzner |
| PostHog | Daily DB dump | Built-in | Hetzner |

### Alert Thresholds

| Check | Threshold | Action |
|-------|-----------|--------|
| Qdrant health | 3 failures | Discord alert |
| Error rate | >5% | Discord alert |
| Embedding queue | >100 pending | Discord alert |
| AI latency p95 | >5s | Investigate |

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Approval rate | >70% | TBD |
| Edit-before-approve | <20% | TBD |
| Time-to-decision | <30s | TBD |
| RAG Recall@5 | >80% | TBD |
| Onboarding completion | >60% | TBD |

---

## References

- [Convex Agent](https://github.com/get-convex/agent)
- [Better Auth + Convex](https://labs.convex.dev/better-auth)
- [RevenueCat Expo](https://docs.revenuecat.com/docs/reactnative)
- [PostHog Self-Hosting](https://posthog.com/docs/self-host)
- [Exa API](https://docs.exa.ai)
- [TipTap Extensions](https://tiptap.dev/docs/editor/extensions)
