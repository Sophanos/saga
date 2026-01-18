# Coherence System: Implementation Spec

> Generated via /interview-ask on 2026-01-12
> Based on: docs/ENTERPRISE_COHERENCE.md

## Overview

A 4-tier coherence system for Mythos IDE that maintains consistent voice, facts, and style from project-level down to real-time Flow Mode sessions. **Writers first** — both as target users and feature priority (writer facet before product/comms facets).

## Problem Statement

Writers struggle with consistency across long-form projects: character voice drift, world fact contradictions, timeline errors, and personal style tics. Current tools either interrupt flow (spell-check style) or require manual cross-referencing. This system provides **silent, real-time coherence checking** that surfaces signals without breaking creative focus.

---

## Scope & Phasing

### MVP Boundary

No enterprise/department layers. Focus on:
- **Project profile** (per project)
- **Individual profile** (cross-project, per user)
- **Session vectors** (Flow Mode speed layer)

### Implementation Phases

| Phase | Focus | Deliverables |
|-------|-------|--------------|
| **1** | Project profiles for writers | Terminology map, overuse patterns, section activation |
| **2** | Session vectors for Flow Mode | Active doc + entities + style memories, fast checks |
| **3** | Individual profile pipeline | Voice centroid + personal overuse across projects |
| **4** | UX & controls | In-flow signals, Pulse panel, settings, opt-in/reset |

---

## Technical Approach

### Architecture

```
Project Profile (Convex)
├── Writer facet (characterVoices, worldFacts, timeline, narrativeStyle)
├── Terminology map (entities + user extensions)
├── Overuse patterns (static + corpus + personal baselines)
└── Section activation rules (folder + file override)

Individual Profile (Convex)
├── Personal voice centroid (aggregated from project centroids)
├── Personal overuse patterns
└── Preferences (excluded projects; ignore rules live in coherenceIgnores)

Session Vectors (Convex vector search)
├── Current doc embeddings
├── Mentioned entities (top 50)
├── Recent style memories (top 30)
├── Active facet context (top 20)
└── Relevant policies

Durable Corpus (Qdrant)
└── Full project embeddings for heavy RAG
```

### Data Model

#### Project Profile

```typescript
// convex/schema.ts

projectProfiles: defineTable({
  projectId: v.id("projects"),

  // Primary persona (from template on creation)
  primaryPersona: v.union(
    v.literal("writer"),
    v.literal("engineer"),
    v.literal("designer"),
    v.literal("product"),
    v.literal("comms")
  ),

  // Universal fields
  voiceCentroid: v.optional(v.array(v.float64())),
  terminologyMap: v.optional(v.object({
    approved: v.array(v.object({
      term: v.string(),
      variants: v.array(v.string()),
      definition: v.optional(v.string()),
      entityId: v.optional(v.id("entities")), // Link to Project Graph
    })),
    forbidden: v.array(v.object({
      term: v.string(),
      replacement: v.string(),
      reason: v.optional(v.string()),
    })),
  })),

  overusePatterns: v.optional(v.array(v.object({
    word: v.string(),
    frequency: v.number(),
    baseline: v.number(),
    ratio: v.number(),
    source: v.union(v.literal("static"), v.literal("corpus"), v.literal("personal")),
  }))),

  // Facets
  facets: v.optional(v.object({
    writer: v.optional(v.object({
      characterVoices: v.array(v.object({
        characterId: v.id("entities"),
        name: v.string(),
        voiceCentroid: v.array(v.float64()),
        rules: v.optional(v.object({
          prefer: v.array(v.string()),
          avoid: v.array(v.string()),
          never: v.array(v.string()),
          tone: v.optional(v.string()),
          lengthGuardrails: v.optional(v.object({
            minSentence: v.number(),
            maxSentence: v.number(),
          })),
        })),
        examples: v.array(v.object({
          text: v.string(),
          documentId: v.optional(v.id("documents")),
          location: v.optional(v.string()),
        })),
        confidence: v.number(),
        updatedAt: v.number(),
      })),
      worldFacts: v.array(v.object({
        id: v.string(),
        type: v.union(v.literal("entity"), v.literal("rule"), v.literal("law")),
        content: v.string(),
        entityId: v.optional(v.id("entities")),
        isCanon: v.boolean(),
        sources: v.array(v.id("documents")),
      })),
      timelineEvents: v.array(v.object({
        id: v.string(),
        description: v.string(),
        when: v.optional(v.string()), // Relative or absolute
        order: v.number(), // Sequence position
        characters: v.array(v.id("entities")),
        source: v.union(v.literal("explicit"), v.literal("extracted")),
        documentId: v.optional(v.id("documents")),
      })),
      narrativeStyle: v.optional(v.object({
        pov: v.optional(v.string()),
        tense: v.optional(v.string()),
        tone: v.optional(v.string()),
      })),
    })),
    // Other facets added later: engineer, designer, product, comms
  })),

  // Section-based activation
  sections: v.optional(v.array(v.object({
    path: v.string(), // Folder or file path pattern
    activeFacets: v.array(v.string()),
    overrides: v.optional(v.any()),
  }))),

  // Settings
  settings: v.optional(v.object({
    preset: v.union(v.literal("minimal"), v.literal("balanced"), v.literal("strict")),
    enabledChecks: v.array(v.string()),
    thresholds: v.optional(v.any()),
  })),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_project", ["projectId"]),
```

#### Individual Profile

```typescript
individualProfiles: defineTable({
  userId: v.string(),

  // Computed from writing across projects
  personalVoiceCentroid: v.optional(v.array(v.float64())),
  vocabularyFingerprint: v.optional(v.array(v.float64())),

  // Personal overuse (across all projects)
  personalOveruse: v.optional(v.array(v.object({
    word: v.string(),
    frequency: v.number(),
    baseline: v.number(),
    ratio: v.number(),
  }))),

  // Writing patterns
  writingPatterns: v.optional(v.object({
    avgSentenceLength: v.number(),
    passiveVoiceRatio: v.number(),
    adverbRatio: v.number(),
  })),

  // User preferences
  excludedProjects: v.array(v.id("projects")), // Don't include in profile
  // Ignore rules live in coherenceIgnores with scope="user"

  // Refresh tracking
  lastComputedAt: v.number(),
  projectCentroids: v.array(v.object({
    projectId: v.id("projects"),
    centroid: v.array(v.float64()),
    weight: v.number(),
  })),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"]),
```

#### Session Vectors

```typescript
sessionVectors: defineTable({
  projectId: v.id("projects"),
  documentId: v.optional(v.id("documents")),
  userId: v.string(),
  sessionId: v.string(),

  // Vector data
  // Vector data (dimensions must match the active embedding model)
  embedding: v.array(v.float64()),

  // Metadata
  kind: v.union(
    v.literal("document"),
    v.literal("entity"),
    v.literal("style_memory"),
    v.literal("facet_context"),
    v.literal("policy")
  ),
  sourceId: v.string(),
  content: v.string(), // Original text for display

  createdAt: v.number(),
  expiresAt: v.number(),
})
  .index("by_session", ["sessionId"])
  .index("by_project_user", ["projectId", "userId"])
  .index("by_expires_at", ["expiresAt"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 4096, // Qwen3-Embedding-8B; use a separate table/index per dimension
    filterFields: ["projectId", "documentId", "userId", "sessionId", "kind"],
  }),
```

Implementation note (2026-01-18):
- Flow runtime sessions live in Convex (`flowRuntimeSessions`) with `coherenceSignals` for audit.
- Session vectors are stored in Qdrant (`saga_sessions` by default) to avoid Convex vector dimension limits.

#### Coherence Signals

```typescript
coherenceSignals: defineTable({
  projectId: v.id("projects"),
  documentId: v.id("documents"),
  userId: v.string(),
  sessionId: v.optional(v.string()),

  // Signal details
  type: v.union(
    v.literal("entity_consistency"),
    v.literal("voice_drift"),
    v.literal("overuse"),
    v.literal("timeline_violation"),
    v.literal("world_fact_conflict")
  ),
  severity: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),

  // Location (stable anchors preferred; offsets are fallback)
  anchorStart: v.optional(
    v.object({
      blockId: v.string(),
      offset: v.number(),
    })
  ),
  anchorEnd: v.optional(
    v.object({
      blockId: v.string(),
      offset: v.number(),
    })
  ),
  from: v.optional(v.number()),
  to: v.optional(v.number()),
  text: v.string(),

  // Details
  message: v.string(),
  explanation: v.optional(v.string()),
  suggestion: v.optional(v.string()),
  canonSource: v.optional(v.object({
    documentId: v.id("documents"),
    location: v.string(),
    content: v.string(),
  })),

  // State
  status: v.union(
    v.literal("active"),
    v.literal("ignored_once"),
    v.literal("ignored_always"),
    v.literal("fixed"),
    v.literal("canon_updated")
  ),

  createdAt: v.number(),
  resolvedAt: v.optional(v.number()),
})
  .index("by_document", ["documentId", "status"])
  .index("by_session", ["sessionId"])
  .index("by_project_user", ["projectId", "userId"]),
```

#### Ignore Rules

```typescript
coherenceIgnores: defineTable({
  // Scope
  scope: v.union(v.literal("project"), v.literal("user")),
  projectId: v.optional(v.id("projects")),
  userId: v.string(),

  // Rule
  type: v.string(), // Check type to ignore
  pattern: v.optional(v.string()), // Specific pattern (e.g., word)
  reason: v.optional(v.string()),

  createdAt: v.number(),
})
  .index("by_project", ["projectId"])
  .index("by_user", ["userId"]),
```

---

## API / Interfaces

### Flow Mode Actions

```typescript
// convex/ai/flow/startSession.ts
export const startSession = action({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    // 1. Generate session ID
    // 2. Load project profile
    // 3. Embed current document chunks
    // 4. Load top 50 mentioned entities from Project Graph
    // 5. Load top 30 recent style memories
    // 6. Load top 20 active facet context vectors
    // 7. Load relevant policies
    // 8. Write all to sessionVectors table
    // 9. Return session ID
  },
});

// convex/ai/flow/searchSession.ts
export const searchSession = action({
  args: {
    sessionId: v.string(),
    query: v.string(),
    filters: v.optional(v.object({
      kinds: v.optional(v.array(v.string())),
    })),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Embed query
    // 2. Vector search with session filter
    // 3. Return ranked results
  },
});

// convex/ai/flow/runChecks.ts
export const runChecks = action({
  args: {
    sessionId: v.string(),
    documentId: v.id("documents"),
    content: v.string(),
    cursorPosition: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Extract recent paragraph/sentence
    // 2. Run parallel checks:
    //    - Entity consistency (search session for conflicts)
    //    - Overuse detection (compare to patterns)
    //    - Voice drift (compare to centroid)
    // 3. Return signals with anchorStart/anchorEnd when possible (blockId + offset),
    //    fallback to from/to offsets for best-effort mapping
  },
});

// convex/ai/flow/endSession.ts
export const endSession = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Delete session vectors (best-effort)
    // 2. Sweep expired session vectors via cron (expiresAt backstop)
    // 3. Sync any new learnings to main corpus (async)
    // 4. Update user overuse patterns (async)
  },
});
```

### Profile Management

```typescript
// convex/ai/coherence/profiles.ts
export const getProjectProfile = query({...});
export const updateProjectProfile = mutation({...});
export const bootstrapFromContent = action({...}); // Scan existing docs

export const getIndividualProfile = query({...});
export const refreshIndividualProfile = action({...}); // Manual refresh
export const resetIndividualProfile = mutation({...}); // Clear and restart
export const exportIndividualProfile = action({...}); // GDPR export
export const deleteIndividualProfile = mutation({...}); // GDPR delete
```

### Signal Actions

```typescript
// convex/ai/coherence/signals.ts
export const ignoreSignal = mutation({
  args: {
    signalId: v.id("coherenceSignals"),
    scope: v.union(v.literal("once"), v.literal("always")),
  },
});

export const fixSignal = action({
  args: {
    signalId: v.id("coherenceSignals"),
  },
  // Returns suggested edit
});

export const updateCanon = mutation({
  args: {
    signalId: v.id("coherenceSignals"),
    newCanonValue: v.string(),
  },
  // Updates source of truth
});
```

---

## UX Specification

### Visual Design

#### Underline Style
- **Type:** Thin solid colored underline (clean, low-noise)
- **Colors:** Brand-aligned palette with low opacity per check type:
  - Entity consistency: `accent.blue` at 60% opacity
  - Voice drift: `accent.purple` at 60% opacity
  - Overuse: `accent.amber` at 60% opacity
  - Timeline violation: `accent.red` at 60% opacity
- **Individual users:** Respect theme settings (dark/light)

#### Bottom Status Bar (Flow Mode)
- **Content:** Count + expandable preview
- **Display:** `"3 signals"` - expands on hover/click to show list
- **Position:** Bottom of editor, minimal height (24px)
- **Behavior:** Click to expand, not auto-expand

### Interactions

#### Inline Popover (on underline click)
```
┌─────────────────────────────────────┐
│ ⚠️ Marcus has blue eyes, not brown  │
│                                     │
│ Source: Chapter 2, paragraph 4      │
│ "His blue eyes narrowed..."         │
│                                     │
│ [Ignore once] [Ignore always]       │
│ [Fix] [Update canon] [Explain more] │
└─────────────────────────────────────┘
```

**Actions:**
- **Ignore once:** Dismiss this instance
- **Ignore always:** Add to ignore rules (project or user level)
- **Fix:** Apply suggested correction
- **Update canon:** Change source of truth to match current text
- **Explain more:** Expand with full context, related signals

#### Pulse Panel (Flow Mode exit)

**Trigger:** Slide-over panel from right when exiting Flow Mode

**Grouping:** By type → sorted by severity within each type

```
┌─────────────────────────────────────┐
│ Coherence Review           [Close]  │
├─────────────────────────────────────┤
│ Entity Consistency (2)              │
│ ├─ 🔴 Marcus eye color (line 45)   │
│ └─ 🟡 Tavern name spelling (ln 78) │
│                                     │
│ Overuse (3)                         │
│ ├─ 🟡 "however" × 4 in 2 paragraphs│
│ ├─ 🟡 "very" × 3                   │
│ └─ 🟢 "just" × 2                   │
│                                     │
│ Voice Drift (1)                     │
│ └─ 🟡 Sarah's dialogue (line 102)  │
│                                     │
│ [Ignore all overuse] [Done]         │
└─────────────────────────────────────┘
```

**Bulk actions:** "Ignore all of type" only (fixes/updates stay per-item)

### Settings UI

**Location:** Project Settings → Coherence tab

**Structure:**
```
Coherence Settings
├── Enable coherence [toggle]
├── Preset: [Minimal ▼] [Balanced] [Strict]
│
├── ▼ Advanced
│   ├── Checks
│   │   ├── Entity consistency [✓]
│   │   ├── Voice drift [✓]
│   │   ├── Overuse detection [✓]
│   │   ├── Timeline violations [✓]
│   │   └── World fact conflicts [✓]
│   │
│   ├── Sensitivity
│   │   ├── Voice drift threshold: [0.75 ▼]
│   │   └── Overuse ratio threshold: [2.0 ▼]
│   │
│   └── Facet activation
│       └── [Section rules editor]
│
└── Individual Profile
    ├── [View my profile]
    ├── [Refresh profile]
    ├── [Reset profile]
    └── Excluded projects: [Select...]
```

### States

| State | Display |
|-------|---------|
| **Loading session** | Bottom bar: "Warming coherence..." (no blocking) |
| **Session ready** | Bottom bar: "0 signals" |
| **Signals found** | Bottom bar: "N signals" with type breakdown on hover |
| **Check running** | No visible indicator (silent) |
| **Check timeout** | Silent skip, logged |
| **Session error** | Bottom bar: "Coherence offline" (non-blocking) |

---

## Edge Cases

1. **Character speaks after death:** Timeline check flags sequence violation
2. **Same name, different characters:** Link to Project Graph entity ID, not string match
3. **Intentional voice drift:** "Update canon" to evolve character voice
4. **Imported project with no profile:** Bootstrap on first coherence enable
5. **Very long document:** Chunk and process in batches, prioritize visible area
6. **Cross-project entity conflict:** Entities scoped to project, no cross-project checks
7. **Concurrent edits (collaboration):** Session per user, signals per user
8. **Undo after fix:** Editor undo works normally, signal reappears on next check
9. **Orphaned sessions:** Cleanup via expiresAt + cron backstop

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Session vector load fails | Enter Flow Mode anyway, retry async, "Coherence offline" indicator |
| Check times out (<50ms) | Skip silently, log for debugging |
| Embedding API fails | Fall back to cached embeddings if available, else skip |
| Profile compute fails | Keep existing profile, retry on next scheduled run |
| Qdrant unavailable | Session vectors still work (Convex), heavy RAG degraded |

---

## Security Considerations

### Data Privacy (GDPR-ready)
- Voice centroids and writing patterns are **personal data**
- Users can **export** their individual profile (JSON)
- Users can **delete** their individual profile anytime
- Profile data deleted when user account deleted
- Embeddings call external providers (DeepInfra) via server action; require explicit AI/embedding consent gating and opt-out support

### Access Control
- Project profiles: Project members only (inherit project permissions)
- Individual profiles: User-only access
- Session vectors: Scoped to user + project + session

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Flow Mode entry | Immediate (vectors warm async) |
| Session vector query | <50ms |
| Check execution (on pause) | <100ms total |
| Session vector count | ~500 max |
| Session warmup time | <2s background |
| Profile refresh | Weekly batch + on-demand |

### Vector Store Split
- **Convex vector search:** Session vectors (hot, small, consistent)
- **Qdrant:** Durable corpus (large, persistent, heavy RAG)
- If switching embedding models (4B/0.6B), use a separate session table/index (dimension must match)

---

## Testing Strategy

### Unit Tests
- Facet detection rules (path, extension, metadata)
- Overuse calculation (static + corpus + personal)
- Weighting formula
- Check logic (entity, voice, overuse)

### Integration Tests (mocked vectors)
- Session lifecycle (start → check → end)
- Profile bootstrap from content
- Signal creation and resolution
- Ignore rule application

### E2E Tests (Playwright)
- Flow Mode enter/exit with signals
- Popover interactions (ignore, fix, update canon)
- Pulse panel bulk actions
- Settings changes
- Profile view/reset

---

## Migration & Compatibility

### For Existing Projects
- **Opt-in only:** User enables coherence in Project Settings
- **Bootstrap on enable:** Scan existing content to seed profile
- No automatic migration, no forced enablement

### For New Projects
- **Auto-scaffold:** Empty profile created on project creation
- **Template seeding:** If user picks "Writer" template, writer facet enabled
- **Detection bootstrap:** If importing content, scan to seed

---

## Acceptance Criteria

### Phase 1: Project Profiles
- [ ] Project profile table with writer facet schema
- [ ] Terminology map populated from Project Graph entities
- [ ] User can add/edit terminology entries
- [ ] Overuse patterns computed (static + corpus + personal)
- [ ] Section-based facet activation (folder + file override)
- [ ] Project Settings → Coherence tab with presets

### Phase 2: Session Vectors
- [ ] Session vectors table with Convex vector index
- [ ] `startSession` loads ~500 vectors on Flow Mode enter
- [ ] `searchSession` returns results in <50ms
- [ ] `runChecks` executes entity + overuse + voice drift checks
- [ ] `endSession` cleans up vectors
- [ ] Flow Mode entry is never blocked by session loading

### Phase 3: Individual Profile
- [ ] Individual profile computed from project centroids
- [ ] Weekly auto-refresh + manual refresh button
- [ ] User can view profile summary
- [ ] User can reset profile
- [ ] User can exclude projects from profile
- [ ] GDPR export and delete working

### Phase 4: UX
- [ ] Thin solid underlines on signals (brand-aligned colors)
- [ ] Bottom status bar with count + expandable preview
- [ ] Inline popover with full action set
- [ ] Pulse slide-over panel on Flow Mode exit
- [ ] "Ignore all of type" bulk action
- [ ] Muse can query/surface coherence signals
- [ ] Light checks outside Flow Mode, deep checks in Flow Mode

---

## Open Questions / Risks

### Cost
- **Embedding costs at scale:** Need to project costs for heavy users (many projects, long docs)
- **Mitigation:** Cache embeddings aggressively, batch computations

### Technical
- **Large project performance:** 100+ docs, 1000+ entities may stress session budget
- **Mitigation:** Prioritize by relevance, lazy-load less-used entities

### UX
- **False positives / annoyance:** Too many signals = ignored or disabled
- **Mitigation:** Start with "Minimal" preset, let users increase sensitivity

### Data
- **Model drift:** Embedding model changes break centroid comparisons
- **Mitigation:** Version centroids, re-compute on model change

### Scope
- **Cross-project entity conflicts:** Same character name in different projects
- **Decision:** Entities scoped to project, no cross-project checking (by design)

---

## Related Docs

- [Enterprise Coherence Design](./ENTERPRISE_COHERENCE.md) - Full hierarchy design
- [MLP1 Roadmap](./MLP1_ROADMAP.md) - Overall roadmap + MLP1→MLP2 bridge
- [MLP2 Proactivity Engine](./MLP2_PROACTIVITY_ENGINE.md) - Proactivity modes + Pulse integration
- [MLP1 Living Memory OS](./MLP1_LIVING_MEMORY_OS.md) - Memory architecture
- [Widgets MVP1](./WIDGETS.md) - Pre-requisite: pipeline + receipts

---

## Implementation Priority

| Step | Component | Effort | Impact |
|------|-----------|--------|--------|
| 1 | Project profile schema + table | Low | High |
| 2 | Terminology map from Project Graph | Medium | High |
| 3 | Session vectors table + index | Medium | High |
| 4 | Flow Mode session lifecycle | Medium | High |
| 5 | Entity consistency check | Medium | High |
| 6 | Overuse detection | Low | Medium |
| 7 | Voice drift check | Medium | Medium |
| 8 | Underline rendering in editor | Medium | High |
| 9 | Status bar + popover UI | Medium | High |
| 10 | Pulse panel | Medium | Medium |
| 11 | Individual profile pipeline | High | Medium |
| 12 | Settings UI | Low | Medium |
| 13 | GDPR compliance (export/delete) | Low | Low |

**Start with:** Steps 1-5 (schema + terminology + session + entity check)

---

## Persona-Aware Coherence

### Overview

The coherence system must adapt to different individual personas. Each persona has different consistency needs, and our system strength varies accordingly.

### Strength Rating Legend

| Rating | Meaning |
|--------|---------|
| ⬛⬛⬛⬛⬛ (5/5) | **Strong** — Core system designed for this |
| ⬛⬛⬛⬛⬜ (4/5) | **Good** — Minor extensions needed |
| ⬛⬛⬛⬜⬜ (3/5) | **Moderate** — Needs facet-specific work |
| ⬛⬛⬜⬜⬜ (2/5) | **Weak** — Significant gaps |
| ⬛⬜⬜⬜⬜ (1/5) | **Minimal** — Not designed for this |

---

### Persona Matrix

#### 1. Writer (Fiction/Non-fiction)

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬛⬛⬛ (5/5) — **Primary target** |
| **Use Case** | Novels, stories, scripts, long-form narrative |
| **Key Consistency Needs** | Character voice, world facts, timeline, narrative style |

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Character voice centroids | ✅ Built | Core feature |
| Voice drift detection | ✅ Built | Per-character + overall |
| World fact consistency | ✅ Built | Entities + rules |
| Timeline violations | ✅ Built | Sequence + temporal |
| Overuse detection | ✅ Built | Personal patterns |
| Dialogue attribution | ✅ Built | Entity mention trigger |
| Narrative style checks | ✅ Built | POV, tense, tone |
| Image embeddings (visual traits) | Planned | Character appearance (not MVP) |

**Facet Fields:**
```typescript
writer: {
  characterVoices: [],    // ✅ Full support
  worldFacts: [],         // ✅ Full support
  timelineEvents: [],     // ✅ Full support
  narrativeStyle: {},     // ✅ Full support
  dialoguePatterns: {},   // 🔜 Phase 2
}
```

---

#### 2. Hobbyist (Multi-interest)

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬛⬛⬜ (4/5) — **Well supported** |
| **Use Case** | Personal projects, learning, exploration, mixed disciplines |
| **Key Consistency Needs** | Personal voice, terminology across topics, style evolution |

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Personal voice centroid | ✅ Built | Individual profile |
| Cross-project patterns | ✅ Built | Aggregated overuse |
| Style evolution tracking | ✅ Built | Growth metrics |
| Multi-facet blending | ✅ Built | Weighted blend for mixed projects |
| Low-friction onboarding | ✅ Built | Auto-scaffold + templates |
| Opt-in complexity | ✅ Built | Minimal → Strict presets |

**What's Missing:**
- Learning path suggestions (detect skill gaps)
- Goal tracking (not coherence, different feature)

**Facet Fields:**
```typescript
hobbyist: {
  // Uses weighted blend of other facets
  activeFacets: ["writer", "researcher"], // Dynamic
  learningGoals: [],      // 🔜 Future
  skillProgress: {},      // 🔜 Future
}
```

---

#### 3. Creative (Visual + Written)

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬛⬛⬜ (4/5) — **Good with extensions** |
| **Use Case** | Design docs, creative briefs, visual storytelling, concept art |
| **Key Consistency Needs** | Visual-verbal alignment, brand consistency, mood coherence |

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Image embeddings | Planned | Cross-modal consistency (future) |
| Terminology map | ✅ Built | Design language |
| Voice consistency | ✅ Built | Brand voice |
| Visual-text alignment | Planned | Requires visual embeddings + checks |
| Mood/tone detection | ✅ Built | Via style analysis |
| Color/style references | 🔜 Planned | Need visual facet |

**What's Missing:**
- Visual consistency checks (color palette drift, style coherence)
- Moodboard integration
- Asset naming conventions

**Facet Fields:**
```typescript
creative: {
  moodCentroid: vector,         // 🔜 Planned
  colorPalette: [],             // 🔜 Planned
  visualStyle: {},              // 🔜 Planned
  assetNamingRules: [],         // 🔜 Planned
  brandVoice: {},               // ✅ Reuse from comms
}
```

---

#### 4. Product Manager

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬛⬜⬜ (3/5) — **Needs facet work** |
| **Use Case** | Full PM toolkit: PRDs, roadmaps, specs, stakeholder updates, release notes |
| **Key Consistency Needs** | Cross-department sync, feature naming, requirement conflicts, metrics alignment |

**Pain Points (from ChatPRD analysis):**
- Communication bottleneck between departments
- Doc sync issues (ideas → presentation → selling)
- Feature naming drift across docs
- Requirement conflicts across features
- Metrics/KPI definition inconsistency
- Benchmarking and analysis consistency

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Terminology map | ✅ Built | Feature names, user terms |
| Overuse detection | ✅ Built | Avoid jargon overload |
| Feature entity linking | 🔜 Planned | Every mention → single source |
| Cross-doc feature search | 🔜 Planned | Find all mentions of feature X |
| Requirement conflict detection | 🔜 Planned | Value conflicts, contradictions, dependency violations |
| Auto-suggest canonical name | 🔜 Planned | "AI Search" → suggest "Smart Search" |
| Stakeholder extract + confirm | 🔜 Planned | AI extracts, user confirms commitments |
| Metrics definition consistency | 🔜 Planned | DAU means same thing everywhere |
| Metrics target alignment | 🔜 Planned | Goal is 10K DAU in doc A, 15K in doc B |
| Acceptance criteria validation | 🔜 Planned | Format + testability + coverage + test linking |
| External doc import | ✅ Existing | Import from Notion/Confluence (snapshots) |
| Live sync (future) | 🔜 Planned | MCP integration for real-time sync |

**Facet Fields:**
```typescript
product: {
  // Feature terminology with canonical names
  featureTerminology: v.array(v.object({
    canonicalName: v.string(),
    variants: v.array(v.string()), // "AI Search", "Intelligent Search"
    entityId: v.optional(v.string()), // Link to Project Graph entity
    definition: v.optional(v.string()),
    status: v.union(v.literal("planned"), v.literal("in_progress"), v.literal("shipped"), v.literal("deprecated")),
  })),

  // Requirements with conflict detection
  requirements: v.array(v.object({
    id: v.string(),
    title: v.string(),
    description: v.string(),
    documentId: v.id("documents"),
    featureId: v.optional(v.string()),
    priority: v.union(v.literal("p0"), v.literal("p1"), v.literal("p2"), v.literal("p3")),
    dependencies: v.array(v.string()), // Other requirement IDs
    conflicts: v.array(v.object({ // Detected conflicts
      withRequirementId: v.string(),
      conflictType: v.union(
        v.literal("value_conflict"),      // Same thing, different values
        v.literal("contradiction"),        // Mutually exclusive statements
        v.literal("dependency_violation")  // Depends on deprioritized item
      ),
      description: v.string(),
      resolved: v.boolean(),
    })),
  })),

  // Stakeholder commitments (AI extracted, user confirmed)
  stakeholderCommitments: v.array(v.object({
    id: v.string(),
    stakeholder: v.string(),
    commitment: v.string(),
    context: v.string(), // Where this was stated
    documentId: v.id("documents"),
    extractedAt: v.number(),
    confirmedBy: v.optional(v.string()),
    confirmedAt: v.optional(v.number()),
    status: v.union(v.literal("extracted"), v.literal("confirmed"), v.literal("rejected")),
  })),

  // Metrics/KPI consistency
  metrics: v.array(v.object({
    id: v.string(),
    name: v.string(), // "DAU", "Conversion Rate"
    definition: v.string(), // What exactly does this measure
    formula: v.optional(v.string()),
    source: v.optional(v.string()), // Where data comes from
    targets: v.array(v.object({
      documentId: v.id("documents"),
      target: v.string(), // "10K", "5%"
      timeframe: v.optional(v.string()),
    })),
    targetConflicts: v.array(v.object({ // Detected target misalignment
      docA: v.id("documents"),
      docB: v.id("documents"),
      targetA: v.string(),
      targetB: v.string(),
    })),
  })),

  // Acceptance criteria
  acceptanceCriteria: v.array(v.object({
    id: v.string(),
    requirementId: v.string(),
    criterion: v.string(),
    format: v.union(v.literal("given_when_then"), v.literal("checkbox"), v.literal("freeform")),
    testable: v.boolean(), // AI assessment: is this testable?
    testabilityIssue: v.optional(v.string()), // "Too vague: 'should be fast'"
    linkedTests: v.array(v.string()), // Test case IDs
  })),

  // Priority framework
  priorityFramework: v.object({
    levels: v.array(v.object({
      priority: v.string(), // "p0", "p1", etc.
      definition: v.string(),
      slaWeeks: v.optional(v.number()),
    })),
    enforcementLevel: v.union(v.literal("suggest"), v.literal("warn"), v.literal("require")),
  }),

  // External doc imports
  externalImports: v.array(v.object({
    source: v.union(v.literal("notion"), v.literal("confluence"), v.literal("google_docs"), v.literal("other")),
    externalId: v.string(),
    lastImported: v.number(),
    localDocId: v.id("documents"),
    syncStatus: v.union(v.literal("snapshot"), v.literal("pending_sync"), v.literal("live")),
  })),
}
```

**Checks:**
- `feature_name_variant`: Using non-canonical feature name
- `requirement_value_conflict`: Same entity, different values
- `requirement_contradiction`: Mutually exclusive requirements
- `requirement_dependency_broken`: Depends on deprioritized/cut feature
- `stakeholder_unconfirmed`: Extracted commitment not confirmed
- `metric_definition_drift`: Same metric, different definitions
- `metric_target_conflict`: Different targets for same metric
- `acceptance_untestable`: Criterion is too vague to test
- `acceptance_no_test`: Criterion has no linked test
- `priority_inconsistent`: Same feature different priority in different docs

---

#### 5. Engineer

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬛⬜⬜ (3/5) — **Needs facet work** |
| **Use Case** | Full toolkit: ADRs, API specs, guides, runbooks, postmortems, RFCs |
| **Key Consistency Needs** | Code-doc sync, decision context, cross-system consistency |

**Pain Points (all equally problematic):**
- Code-doc drift (doc says v1, code is v3)
- Decision context loss (why did we choose X?)
- Cross-system inconsistency (auth flow differs between docs)

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Terminology map | ✅ Built | Technical terms, team-configurable strictness |
| Overuse detection | ✅ Built | Redundant explanations |
| Schema import | 🔜 Planned | TypeScript/OpenAPI as source of truth |
| Code search validation | 🔜 Planned | Validate docs against codebase |
| ADR bidirectional linking | 🔜 Planned | ADR ↔ affected docs |
| API schema + versioning | 🔜 Planned | Schema accuracy + errors + versioning |
| Version-aware runbooks | 🔜 Planned | Flag deprecated features |
| Breaking change impact | 🔜 Planned | Which docs reference changed endpoint? |

**Facet Fields:**
```typescript
engineer: {
  // API & Schema
  apiContracts: v.array(v.object({
    id: v.string(),
    name: v.string(),
    schemaSource: v.optional(v.string()), // Path to OpenAPI/TypeScript
    version: v.string(),
    endpoints: v.array(v.object({
      path: v.string(),
      method: v.string(),
      requestSchema: v.optional(v.any()),
      responseSchema: v.optional(v.any()),
      errorCodes: v.array(v.string()),
    })),
    lastSynced: v.number(),
  })),

  // Architecture Decision Records
  adrs: v.array(v.object({
    id: v.string(),
    title: v.string(),
    status: v.union(v.literal("proposed"), v.literal("accepted"), v.literal("deprecated"), v.literal("superseded")),
    context: v.string(),
    decision: v.string(),
    consequences: v.array(v.string()),
    affectedDocs: v.array(v.id("documents")), // Bidirectional links
    supersededBy: v.optional(v.string()),
    createdAt: v.number(),
  })),

  // Technical terminology (configurable strictness)
  techTerms: v.array(v.object({
    term: v.string(),
    variants: v.array(v.string()),
    definition: v.string(),
    strictness: v.union(v.literal("suggest"), v.literal("warn"), v.literal("error")),
  })),

  // Code patterns & conventions
  codePatterns: v.array(v.object({
    name: v.string(),
    pattern: v.string(), // Regex or example
    context: v.string(), // When to apply
  })),

  // Version tracking for runbooks
  versionAwareness: v.object({
    currentVersion: v.string(),
    deprecatedFeatures: v.array(v.object({
      feature: v.string(),
      deprecatedIn: v.string(),
      removedIn: v.optional(v.string()),
      migration: v.optional(v.string()),
    })),
  }),

  // Breaking change tracking
  breakingChanges: v.array(v.object({
    id: v.string(),
    version: v.string(),
    description: v.string(),
    affectedEndpoints: v.array(v.string()),
    migrationGuide: v.optional(v.id("documents")),
    impactedDocs: v.array(v.id("documents")), // Auto-computed
  })),
}
```

**Checks:**
- `api_schema_drift`: Doc endpoint doesn't match imported schema
- `adr_context_missing`: Decision referenced without ADR link
- `terminology_violation`: Using non-approved term (strictness-based)
- `version_outdated`: Runbook references deprecated feature
- `breaking_change_impact`: Doc affected by breaking change needs update

---

#### 6. Designer

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬜⬜⬜ (2/5) — **Significant gaps** |
| **Use Case** | Design systems, component specs, UX documentation |
| **Key Consistency Needs** | Component naming, design tokens, platform variants |

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Terminology map | ✅ Built | Component names |
| Image embeddings | Planned | Visual consistency (future) |
| Token consistency | 🔜 Planned | Color/spacing drift |
| Platform variants | 🔜 Planned | iOS vs Android vs Web |
| Interaction patterns | 🔜 Planned | Consistent behaviors |
| Accessibility checks | 🔜 Planned | A11y compliance |

**What's Missing:**
- Design token validation (using wrong token)
- Component naming convention enforcement
- Figma/Sketch integration for visual checks
- Responsive breakpoint consistency

**Facet Fields:**
```typescript
designer: {
  componentNames: [],           // 🔜 Planned
  designTokens: {},             // 🔜 Planned
  platformVariants: [],         // 🔜 Planned
  interactionPatterns: [],      // 🔜 Planned
  accessibilityRules: [],       // 🔜 Planned
}
```

---

#### 7. Researcher

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬛⬜⬜ (3/5) — **Moderate, needs citations** |
| **Use Case** | All research: academic papers, user research, market analysis, literature reviews |
| **Key Consistency Needs** | Citation accuracy, source validity, methodology consistency, claim-evidence linking |

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Terminology map | ✅ Built | Research terms |
| Source tracking | ⚠️ Partial | Can use Project Graph |
| Citation format + accuracy | 🔜 Planned | APA/MLA/Chicago + quote accuracy |
| Citation recency | 🔜 Planned | Flag old sources |
| Broken link detection | 🔜 Planned | Validate URLs still work |
| Evidence strength scoring | 🔜 Planned | Primary vs secondary source |
| Flag unreliable sources | 🔜 Planned | Known questionable sources |
| Methodology + reproducibility | 🔜 Planned | Template + terminology + method validation |
| Contradictions as findings | 🔜 Planned | Track contradictions explicitly |
| Optional artifact links | 🔜 Planned | Link to raw data (low friction) |
| Literature review analysis | 🔜 Planned | Duplicates + gaps + recency + citation network |

**Facet Fields:**
```typescript
researcher: {
  // Source registry with validity tracking
  sourceRegistry: v.array(v.object({
    id: v.string(),
    title: v.string(),
    authors: v.array(v.string()),
    publication: v.optional(v.string()),
    year: v.number(),
    url: v.optional(v.string()),
    doi: v.optional(v.string()),
    type: v.union(
      v.literal("primary"),
      v.literal("secondary"),
      v.literal("tertiary")
    ),
    reliability: v.union(
      v.literal("verified"),
      v.literal("unverified"),
      v.literal("flagged")
    ),
    lastChecked: v.optional(v.number()),
    broken: v.optional(v.boolean()),
  })),

  // Citation rules
  citationRules: v.object({
    format: v.union(
      v.literal("apa"),
      v.literal("mla"),
      v.literal("chicago"),
      v.literal("ieee"),
      v.literal("custom")
    ),
    customFormat: v.optional(v.string()),
    requireDoi: v.boolean(),
    maxAge: v.optional(v.number()), // Years before flagging as old
  }),

  // Claim-evidence linking with strength
  claimEvidenceLinks: v.array(v.object({
    claimId: v.string(),
    claimText: v.string(),
    documentId: v.id("documents"),
    location: v.string(),
    evidenceSourceId: v.string(), // References sourceRegistry
    evidenceStrength: v.union(
      v.literal("strong"),    // Primary source, direct evidence
      v.literal("moderate"),  // Secondary source
      v.literal("weak"),      // Tertiary or indirect
      v.literal("missing")    // No evidence linked
    ),
    notes: v.optional(v.string()),
  })),

  // Methodology standards
  methodologyStandards: v.object({
    templateId: v.optional(v.string()),
    requiredSections: v.array(v.string()),
    statisticalMethods: v.array(v.object({
      name: v.string(),
      validFor: v.array(v.string()), // Data types
    })),
    reproducibilityChecks: v.array(v.string()),
  }),

  // Contradiction tracking (contradictions become findings)
  contradictions: v.array(v.object({
    id: v.string(),
    sourceA: v.string(),
    sourceB: v.string(),
    claimA: v.string(),
    claimB: v.string(),
    resolution: v.optional(v.union(
      v.literal("sourceA_preferred"),
      v.literal("sourceB_preferred"),
      v.literal("synthesis"),
      v.literal("acknowledged_conflict")
    )),
    notes: v.optional(v.string()),
    isExplicitFinding: v.boolean(), // Promoted to research finding
  })),

  // Literature review analysis
  literatureReview: v.optional(v.object({
    fieldKeywords: v.array(v.string()),
    coverageGaps: v.array(v.string()), // Missing key papers
    duplicateSources: v.array(v.array(v.string())), // Groups of duplicates
    citationNetwork: v.optional(v.any()), // Citation relationships
  })),

  // Artifact links (optional, low friction)
  artifacts: v.array(v.object({
    id: v.string(),
    name: v.string(),
    type: v.union(v.literal("dataset"), v.literal("code"), v.literal("survey"), v.literal("other")),
    path: v.optional(v.string()),
    url: v.optional(v.string()),
    linkedClaims: v.array(v.string()),
  })),
}
```

**Checks:**
- `citation_format_invalid`: Citation doesn't match selected format
- `citation_accuracy`: Quote doesn't match source
- `source_outdated`: Source older than maxAge threshold
- `source_broken`: URL no longer accessible
- `source_unreliable`: Known questionable source
- `claim_no_evidence`: Claim without linked evidence
- `claim_weak_evidence`: Claim supported only by weak source
- `methodology_missing_section`: Required section missing
- `contradiction_unresolved`: Sources contradict, no resolution
- `literature_gap`: Missing key papers in field

---

#### 8. Marketing

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬛⬜⬜ (3/5) — **Needs claim validation** |
| **Use Case** | Full content toolkit: campaigns, blogs, emails, ads, case studies, landing pages |
| **Key Consistency Needs** | Brand voice, claim accuracy, competitor positioning, channel adaptation |

**Pain Points (all equally problematic):**
- Voice drift (formal in one place, casual in another)
- Claim inconsistency ("fastest" vs "most reliable")
- Outdated messaging (old taglines, deprecated features)

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Voice consistency | ✅ Built | Brand voice centroid |
| Terminology map | ✅ Built | Approved messaging |
| Overuse detection | ✅ Built | Buzzword fatigue |
| Claim library + evidence | 🔜 Planned | Every claim needs proof |
| Legal/compliance flags | 🔜 Planned | Auto-flag risky claims |
| Competitive claim validation | 🔜 Planned | Validate claims when mentioning competitors |
| Channel + audience matrix | 🔜 Planned | Twitter=casual, LinkedIn=professional, B2B vs B2C |
| Campaign theme consistency | 🔜 Planned | Theme + CTA + visual-verbal alignment |
| Product entity links | 🔜 Planned | Auto-flag when product changes |
| Compliance workflow | 🔜 Planned | Approval workflow for sensitive claims |
| Brand guardrails for variants | 🔜 Planned | A/B variants can't violate brand |

**Facet Fields:**
```typescript
marketing: {
  // Approved claim library with evidence
  claimLibrary: v.array(v.object({
    id: v.string(),
    claim: v.string(),
    category: v.union(
      v.literal("performance"),
      v.literal("feature"),
      v.literal("comparison"),
      v.literal("testimonial"),
      v.literal("statistic")
    ),
    evidence: v.object({
      type: v.union(v.literal("data"), v.literal("testimonial"), v.literal("third_party"), v.literal("internal")),
      source: v.string(),
      url: v.optional(v.string()),
      validUntil: v.optional(v.number()),
    }),
    legalReview: v.optional(v.object({
      status: v.union(v.literal("approved"), v.literal("pending"), v.literal("rejected")),
      reviewedBy: v.optional(v.string()),
      reviewedAt: v.optional(v.number()),
      notes: v.optional(v.string()),
    })),
    requiresDisclaimer: v.boolean(),
    disclaimer: v.optional(v.string()),
  })),

  // Competitor positioning rules
  competitorPositioning: v.array(v.object({
    competitorId: v.string(),
    competitorName: v.string(),
    allowedClaims: v.array(v.string()), // What we can say
    forbiddenClaims: v.array(v.string()), // What we can't say
    requiresEvidence: v.boolean(),
    lastVerified: v.number(), // When competitive claims were checked
  })),

  // Channel + audience matrix
  channelGuidelines: v.array(v.object({
    channel: v.union(
      v.literal("twitter"),
      v.literal("linkedin"),
      v.literal("email"),
      v.literal("blog"),
      v.literal("landing_page"),
      v.literal("ad"),
      v.literal("press_release")
    ),
    audience: v.union(v.literal("b2b"), v.literal("b2c"), v.literal("developer"), v.literal("enterprise")),
    voiceProfile: v.object({
      tone: v.union(v.literal("formal"), v.literal("professional"), v.literal("casual"), v.literal("playful")),
      maxLength: v.optional(v.number()),
      emojiAllowed: v.boolean(),
      hashtagRules: v.optional(v.string()),
    }),
  })),

  // Campaign theme tracking
  campaigns: v.array(v.object({
    id: v.string(),
    name: v.string(),
    theme: v.string(),
    keyMessages: v.array(v.string()),
    primaryCTA: v.string(),
    secondaryCTAs: v.array(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    assets: v.array(v.id("documents")),
    performanceMetrics: v.optional(v.any()),
  })),

  // Product entity links for auto-update
  productLinks: v.array(v.object({
    productEntityId: v.string(), // From Project Graph or external
    productName: v.string(),
    currentVersion: v.optional(v.string()),
    deprecatedFeatures: v.array(v.string()),
    linkedContent: v.array(v.id("documents")),
  })),

  // A/B variant guardrails
  variantRules: v.object({
    allowedVariations: v.array(v.string()), // What can vary: "cta", "headline", "image"
    fixedElements: v.array(v.string()), // What must stay consistent: "value_prop", "brand_voice"
    brandGuardrails: v.array(v.string()), // Rules variants can't break
  }),

  // Brand voice (extends base voice centroid)
  brandVoice: v.object({
    centroid: v.optional(v.array(v.float64())),
    styleGuide: v.optional(v.object({
      tone: v.string(),
      vocabulary: v.array(v.string()),
      avoidWords: v.array(v.string()),
    })),
  }),
}
```

**Checks:**
- `claim_no_evidence`: Claim made without evidence in library
- `claim_expired`: Evidence validity date passed
- `claim_needs_legal`: Claim requires legal review
- `competitor_forbidden_claim`: Using forbidden comparison
- `competitor_unverified`: Competitive claim not recently verified
- `channel_voice_mismatch`: Tone doesn't match channel guidelines
- `campaign_cta_inconsistent`: CTA differs from campaign standard
- `product_outdated`: Content references deprecated feature
- `variant_brand_violation`: A/B variant breaks brand guardrail

---

#### 9. Communications (Comms)

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬜⬜⬜ (2/5) — **Critical for enterprise, needs Hub** |
| **Use Case** | Full comms: internal announcements, external press, crisis comms, executive comms |
| **Key Consistency Needs** | Cross-department sync, audience rules, embargo timing, single source of truth |

**Pain Points (especially painful for enterprises):**
- Engineering says X, Marketing says Y
- Timing misalignment (announced before ready)
- Audience confusion (internal leaks to external)
- Priority conflicts across departments

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Voice consistency | ✅ Built | Brand voice centroid |
| Terminology map | ✅ Built | Approved messaging |
| Audience-aware suggestions | 🔜 Planned | Warnings + suggestions based on audience |
| Hub alignment (configurable) | 🔜 Planned | Strictness varies by content type |
| Embargo workflow gates | 🔜 Planned | Can't publish until date |
| Cross-dept conflict detection | 🔜 Planned | Flag when depts contradict |
| Configurable precedence | 🔜 Planned | Rules for who wins conflicts |
| Crisis mode | 🔜 Planned | Elevated checks during crisis |
| Executive + brand voice blend | 🔜 Planned | Per-executive voice profiles |
| Divergence acknowledgment | 🔜 Planned | Require explicit ack of internal/external diff |
| Message impact analysis | 🔜 Planned | Track where message was used |

**Facet Fields:**
```typescript
comms: {
  // Audience rules (who can hear what)
  audienceRules: v.array(v.object({
    audienceId: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("internal_all"),
      v.literal("internal_dept"),
      v.literal("internal_leadership"),
      v.literal("external_public"),
      v.literal("external_customers"),
      v.literal("external_partners"),
      v.literal("external_press"),
      v.literal("confidential")
    ),
    allowed: v.array(v.string()), // Topics/facts that can be shared
    forbidden: v.array(v.string()), // Must not leak
    required: v.array(v.string()), // Must include (disclaimers)
    reviewers: v.array(v.string()), // Who approves
  })),

  // Hub alignment (source of truth)
  hubAlignment: v.object({
    hubId: v.optional(v.string()), // Enterprise Hub reference
    strictness: v.union(
      v.literal("suggest"),  // Soft suggestions
      v.literal("warn"),     // Warnings but allow
      v.literal("require"),  // Must align, block otherwise
      v.literal("custom")    // Per content type
    ),
    contentTypeStrictness: v.optional(v.array(v.object({
      contentType: v.string(),
      strictness: v.union(v.literal("suggest"), v.literal("warn"), v.literal("require")),
    }))),
  }),

  // Embargo and timing
  embargoRules: v.array(v.object({
    id: v.string(),
    name: v.string(),
    embargoUntil: v.number(),
    affectedContent: v.array(v.id("documents")),
    canPreview: v.array(v.string()), // Who can see before embargo
    workflowGate: v.boolean(), // Block publish until date
    dependencies: v.array(v.string()), // Other things that must happen first
  })),

  // Cross-department conflict tracking
  departmentSources: v.array(v.object({
    deptId: v.string(),
    deptName: v.string(),
    approvedMessaging: v.array(v.object({
      topic: v.string(),
      message: v.string(),
      approvedAt: v.number(),
      approvedBy: v.string(),
    })),
  })),

  // Conflict precedence rules
  precedenceRules: v.array(v.object({
    conflictType: v.string(),
    resolution: v.union(
      v.literal("hub_wins"),      // Source of truth always wins
      v.literal("newer_wins"),    // Most recent update wins
      v.literal("manual"),        // Human must resolve
      v.literal("escalate")       // Auto-escalate to owner
    ),
    escalateTo: v.optional(v.string()),
  })),

  // Crisis mode configuration
  crisisMode: v.object({
    active: v.boolean(),
    activatedAt: v.optional(v.number()),
    elevatedChecks: v.array(v.string()), // Additional checks during crisis
    requiredReviewers: v.array(v.string()), // Must approve during crisis
    restrictedTopics: v.array(v.string()), // Topics that need extra scrutiny
    crisisTemplate: v.optional(v.id("documents")),
  }),

  // Executive voice profiles
  executiveVoices: v.array(v.object({
    executiveId: v.string(),
    name: v.string(),
    role: v.string(), // CEO, CTO, CFO, etc.
    voiceCentroid: v.optional(v.array(v.float64())),
    styleNotes: v.optional(v.string()),
    blendWithBrand: v.number(), // 0-1, how much brand voice to blend
  })),

  // Internal/external divergence tracking
  divergenceTracking: v.array(v.object({
    topic: v.string(),
    internalMessage: v.string(),
    externalMessage: v.string(),
    acknowledged: v.boolean(),
    acknowledgedBy: v.optional(v.string()),
    acknowledgedAt: v.optional(v.number()),
    reason: v.optional(v.string()),
  })),

  // Message propagation tracking
  messagePropagation: v.array(v.object({
    messageId: v.string(),
    originalContent: v.string(),
    sourceDoc: v.id("documents"),
    usedIn: v.array(v.object({
      docId: v.id("documents"),
      location: v.string(),
      usedAt: v.number(),
    })),
    versions: v.array(v.object({
      version: v.string(),
      content: v.string(),
      changedAt: v.number(),
    })),
  })),
}
```

**Checks:**
- `audience_leak`: Internal-only content in external doc
- `audience_missing_required`: Required disclaimer missing for audience
- `hub_misalignment`: Content contradicts approved Hub messaging
- `embargo_violation`: Publishing before embargo date
- `cross_dept_conflict`: Engineering says X, Marketing says Y
- `precedence_unresolved`: Conflict needs manual resolution
- `crisis_missing_review`: Crisis content not reviewed
- `executive_voice_drift`: Content doesn't match executive's voice
- `divergence_unacknowledged`: Internal/external differ without acknowledgment
- `message_version_drift`: Used message differs from current version

---

#### 10. Sales

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬜⬜⬜ (2/5) — **Needs enterprise features** |
| **Use Case** | Proposals, pricing, objection handling, battlecards |
| **Key Consistency Needs** | Pricing accuracy, approved claims, objection responses |

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Terminology map | ✅ Built | Product terms |
| Voice consistency | ✅ Built | Professional tone |
| Pricing consistency | 🔜 Planned | Match approved sheet |
| Objection responses | 🔜 Planned | Approved rebuttals |
| Competitor battlecards | 🔜 Planned | Safe comparisons |
| Proposal templates | 🔜 Planned | Structure adherence |

**What's Missing:**
- Real-time pricing validation (is this quote correct?)
- Unapproved discount detection
- Contract term consistency
- Competitive claim verification

**Facet Fields:**
```typescript
sales: {
  proposalTemplates: [],        // 🔜 Planned
  pricingRules: {},             // 🔜 Planned (enterprise)
  objectionResponses: [],       // 🔜 Planned
  competitorBattlecards: [],    // 🔜 Planned
  approvedDiscounts: [],        // 🔜 Planned (enterprise)
}
```

---

#### 11. Support

| Aspect | Details |
|--------|---------|
| **System Strength** | ⬛⬛⬜⬜⬜ (2/5) — **Needs KB integration** |
| **Use Case** | Full support: articles, guides, templates, macros, runbooks |
| **Key Consistency Needs** | KB accuracy, version awareness, known issue linking, escalation |

**Pain Points (all equally problematic):**
- Outdated articles (feature changed, doc didn't)
- Conflicting answers (article A vs article B)
- Missing coverage (no article for common issue)

**Feature Coverage:**

| Feature | Status | Notes |
|---------|--------|-------|
| Terminology map | ✅ Built | Product terms |
| Voice consistency | ✅ Built | Support tone |
| Product entity links | 🔜 Planned | Auto-prompt when product changes |
| Auto-suggest known issues | 🔜 Planned | Suggest when relevant |
| Auto-invalidate workarounds | 🔜 Planned | Invalidate when fix ships |
| Full escalation tracking | 🔜 Planned | Paths + SLAs + effectiveness |
| Dynamic version content | 🔜 Planned | Show version-specific steps |
| Template library + versioning | 🔜 Planned | Central library + boundaries + effectiveness |
| Tier-aware responses | 🔜 Planned | Enterprise vs free tier |
| Auto-draft KB from resolution | 🔜 Planned | Create article from ticket resolution |

**Facet Fields:**
```typescript
support: {
  // Knowledge base with product entity links
  knowledgeBase: v.array(v.object({
    id: v.string(),
    title: v.string(),
    content: v.string(),
    documentId: v.id("documents"),
    productEntityLinks: v.array(v.object({
      entityId: v.string(),
      entityName: v.string(),
      entityVersion: v.optional(v.string()),
    })),
    lastVerified: v.number(),
    needsUpdate: v.boolean(),
    updateReason: v.optional(v.string()),
  })),

  // Known issues with auto-suggestion
  knownIssues: v.array(v.object({
    id: v.string(),
    bugId: v.optional(v.string()), // External bug tracker ID
    title: v.string(),
    description: v.string(),
    affectedVersions: v.array(v.string()),
    workaround: v.optional(v.object({
      steps: v.string(),
      validUntil: v.optional(v.string()), // Version when fix ships
      autoInvalidate: v.boolean(),
    })),
    fixedIn: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("fixed"), v.literal("wont_fix")),
    keywords: v.array(v.string()), // For auto-suggestion
  })),

  // Escalation paths with effectiveness tracking
  escalationPaths: v.array(v.object({
    id: v.string(),
    name: v.string(),
    triggerConditions: v.array(v.string()), // When to escalate
    targetTeam: v.string(),
    slaMinutes: v.number(),
    coverageCheck: v.boolean(), // Ensure all issue types have paths
    effectiveness: v.optional(v.object({
      avgResolutionTime: v.number(),
      successRate: v.number(),
      lastUpdated: v.number(),
    })),
  })),

  // Version-aware dynamic content
  versionMatrix: v.object({
    currentVersion: v.string(),
    supportedVersions: v.array(v.object({
      version: v.string(),
      status: v.union(v.literal("current"), v.literal("supported"), v.literal("deprecated"), v.literal("eol")),
      eolDate: v.optional(v.number()),
    })),
    versionSpecificContent: v.array(v.object({
      contentId: v.string(),
      versions: v.array(v.object({
        version: v.string(),
        content: v.string(),
      })),
    })),
  }),

  // Response templates with versioning and effectiveness
  responseTemplates: v.array(v.object({
    id: v.string(),
    name: v.string(),
    category: v.string(),
    content: v.string(),
    variables: v.array(v.object({
      name: v.string(),
      description: v.string(),
      required: v.boolean(),
    })),
    personalizationBoundaries: v.object({
      canModify: v.array(v.string()), // Parts that can be changed
      mustKeep: v.array(v.string()), // Parts that must stay
    }),
    version: v.number(),
    effectiveness: v.optional(v.object({
      usageCount: v.number(),
      satisfactionScore: v.optional(v.number()),
      lastUsed: v.number(),
    })),
  })),

  // Tier-aware response rules
  tierRules: v.array(v.object({
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    availableFeatures: v.array(v.string()),
    responseTemplate: v.optional(v.string()), // Different templates per tier
    escalationSla: v.number(), // Different SLAs per tier
  })),

  // Auto-draft KB from resolution
  resolutionToDraft: v.object({
    enabled: v.boolean(),
    minConfidence: v.number(), // Only draft if resolution seems generalizable
    requireReview: v.boolean(),
    drafts: v.array(v.object({
      id: v.string(),
      sourceTicket: v.optional(v.string()),
      resolution: v.string(),
      suggestedTitle: v.string(),
      suggestedContent: v.string(),
      status: v.union(v.literal("draft"), v.literal("reviewed"), v.literal("published"), v.literal("rejected")),
      createdAt: v.number(),
    })),
  }),
}
```

**Checks:**
- `kb_outdated`: Article linked to changed product entity
- `kb_conflict`: Two articles contradict each other
- `kb_coverage_gap`: Common issue has no article
- `workaround_invalid`: Workaround for fixed issue
- `known_issue_match`: Content matches known issue pattern
- `escalation_missing`: Issue type has no escalation path
- `escalation_sla_risk`: Close to SLA breach
- `version_mismatch`: Content shows wrong version steps
- `template_violation`: Response violates template boundaries
- `tier_feature_mismatch`: Mentioning feature not in user's tier

---

### Strength Summary

| Persona | Rating | Primary Gap |
|---------|--------|-------------|
| **Writer** | ⬛⬛⬛⬛⬛ 5/5 | None — primary target |
| **Hobbyist** | ⬛⬛⬛⬛⬜ 4/5 | Learning path features |
| **Creative** | ⬛⬛⬛⬛⬜ 4/5 | Visual consistency checks |
| **Product** | ⬛⬛⬛⬜⬜ 3/5 | Requirement conflict detection |
| **Engineer** | ⬛⬛⬛⬜⬜ 3/5 | Schema import + code-doc sync |
| **Researcher** | ⬛⬛⬛⬜⬜ 3/5 | Citation + evidence scoring |
| **Marketing** | ⬛⬛⬛⬜⬜ 3/5 | Claim library + compliance |
| **Designer** | ⬛⬛⬜⬜⬜ 2/5 | Design system integration |
| **Comms** | ⬛⬛⬜⬜⬜ 2/5 | Hub + cross-dept sync (critical for enterprise) |
| **Sales** | ⬛⬛⬜⬜⬜ 2/5 | Pricing/enterprise features |
| **Support** | ⬛⬛⬜⬜⬜ 2/5 | KB sync + version awareness |

---

### Persona Detection

How to detect which persona a user/project is:

| Signal | Weight | Detection |
|--------|--------|-----------|
| **Template selection** | High | User picks "Writer" on project create |
| **Content analysis** | Medium | Code blocks → engineer, dialogue → writer |
| **File patterns** | Medium | `.spec.md` → engineer, `.story.md` → writer |
| **Section structure** | Medium | User stories format → product |
| **Explicit setting** | High | User sets in profile |
| **Cross-project pattern** | Low | User's other projects are mostly X |

### Persona-Aware Check Prioritization

When multiple facets active, prioritize checks by persona:

```typescript
const checkPriority: Record<Persona, CheckType[]> = {
  writer: ["entity_consistency", "voice_drift", "timeline", "overuse"],
  hobbyist: ["overuse", "voice_drift", "entity_consistency"],
  creative: ["voice_drift", "entity_consistency", "overuse"],
  product: ["terminology", "requirement_conflict", "stakeholder", "overuse"],
  engineer: ["api_schema_drift", "adr_context", "terminology", "version_outdated"],
  researcher: ["citation_accuracy", "claim_evidence", "source_validity", "methodology"],
  marketing: ["claim_evidence", "voice_drift", "channel_mismatch", "competitor"],
  comms: ["audience_leak", "hub_alignment", "cross_dept_conflict", "embargo"],
  designer: ["terminology", "component_naming", "token_consistency"],
  sales: ["pricing", "terminology", "voice_drift"],
  support: ["kb_accuracy", "version_mismatch", "known_issue", "escalation"],
};
```

---

### Cross-Cutting Coherence

Based on interview decisions:

#### Hierarchical Terminology

Terminology flows down the hierarchy, each level can extend but not contradict:

```
Enterprise (source of truth)
    ↓ inherit
Department (domain-specific extensions)
    ↓ inherit + extend
Project (project-specific terms)
    ↓ inherit + extend
Persona facet (persona-specific terms)
```

**Rule:** Lower levels can add terms, not remove or contradict parent terms.

#### Cross-Persona Conflict Resolution

| Conflict Type | Resolution |
|--------------|------------|
| **Terminology** | Higher level wins (enterprise > dept > project) |
| **Voice drift** | Configurable per content type |
| **Facts/claims** | Source of truth (Hub) wins, require acknowledgment |
| **Timing/embargo** | Strictest rule wins |
| **Audience rules** | Most restrictive wins |

```typescript
conflictResolution: {
  terminology: "hierarchy_wins",      // Enterprise > Dept > Project
  voice: "configurable",              // Per content type
  facts: "hub_wins_with_ack",         // Hub wins, require explicit acknowledgment
  timing: "strictest_wins",           // Most restrictive embargo
  audience: "most_restrictive",       // Tightest audience rule
}
```

#### Cross-Persona Visibility

| Visibility | Description |
|------------|-------------|
| **Default** | Each persona sees only their signals |
| **Read-only cross-visibility** | Can see other personas' signals (not edit) |
| **Shared dashboard** | Unified view for admins/leads |

```typescript
visibilityRules: {
  default: "own_persona_only",
  crossVisibility: "read_only",      // Can see, not resolve
  adminView: "all_personas",
}
```

#### Persona Detection (Auto-blend)

For mixed-role users, auto-detect from content + context:

```typescript
personaDetection: {
  // Signal weights
  weights: {
    templateSelection: 1.0,    // User picked "Writer" template
    explicitSetting: 1.0,      // User set in profile
    folderPath: 0.8,           // /specs/ → engineer
    fileExtension: 0.6,        // .spec.md → engineer
    contentAnalysis: 0.5,      // Code blocks → engineer
    crossProjectPattern: 0.3,  // User's other projects
  },

  // Blending rules
  blending: {
    primaryThreshold: 0.7,     // If primary > 0.7, use single facet
    blendThreshold: 0.4,       // If primary 0.4-0.7, blend top 2
    weights: "confidence_based", // Weight checks by detection confidence
  },
}
```

---

### Implementation Priority by Persona

Based on interview: Writer first (done), then Researcher/Creative → Product/Engineer → Marketing/Comms → Support/Sales.

**Note:** Comms is especially painful for **large enterprises** (single source of truth across departments). Less critical for startups.

| Phase | Personas | Facets | Rationale |
|-------|----------|--------|-----------|
| **Phase 1** | Writer ✅, Hobbyist ✅ | writer | Core target, foundation |
| **Phase 2** | Researcher, Creative | researcher, creative | Share voice/fact patterns with Writer |
| **Phase 3** | Product, Engineer | product, engineer | Documentation focus, schema import |
| **Phase 4** | Marketing, Comms | marketing, comms | Claim validation, Hub alignment |
| **Phase 5** | Support, Sales, Designer | support, sales, designer | Enterprise features, KB sync |

**Detailed Priority:**

| Step | Facet | Key Features | Effort | Enterprise? |
|------|-------|--------------|--------|-------------|
| 2.1 | **Researcher** | Citation format, evidence scoring, source tracking | Medium | No |
| 2.2 | **Creative** | Visual-text alignment, mood detection | Medium | No |
| 3.1 | **Product** | Requirement conflicts, stakeholder tracking, acceptance criteria | High | Partial |
| 3.2 | **Engineer** | Schema import, ADR linking, version-aware | High | No |
| 4.1 | **Marketing** | Claim library, legal flags, channel matrix | High | Partial |
| 4.2 | **Comms** | Audience rules, Hub alignment, embargo gates, crisis mode | Very High | **Yes** |
| 5.1 | **Support** | KB sync, version content, known issues, auto-draft | High | Yes |
| 5.2 | **Sales** | Pricing validation, battlecards | High | Yes |
| 5.3 | **Designer** | Token validation, platform variants | Medium | No |

**Enterprise Dependency:**
- Comms, Support, Sales need **Hub** (source of truth) to be fully effective
- Without enterprise layer: these facets work but miss cross-department sync
- For startups: can use project-level profiles, skip Hub
