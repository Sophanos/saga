# Coherence Model: Enterprise to Individual

> **Last Updated:** 2026-01-14
>
> **Goal:** Enable consistent voice and messaging from enterprise-wide policies down to individual flow mode sessions, with appropriate strictness at each level.

---

## Design Principle

| Level | Approach | Embeddings |
|-------|----------|------------|
| **Enterprise** | Strict, explicit, curated | Minimal (~10 vectors) |
| **Department** | Inherited + domain-specific | Moderate (~100 vectors) |
| **Project** | Context-aware, flexible | On-demand (~100 vectors) |
| **Individual** | Detection-based, adaptive | Session only (~500 vectors) |

**Strictness decreases, flexibility increases** as you go down the hierarchy.

---

## Full Hierarchy

```
Enterprise (org-level)
├── Hub (curated source of truth)
├── Audiences (internal/external/confidential)
├── Voice baseline (centroid)
│
├── Departments (silos)
│   ├── Engineering
│   ├── Product
│   ├── Design
│   └── Marketing
│
├── Cross-cutting functions
│   ├── Internal Comms
│   ├── Sales
│   └── Support
│
└── Projects (work context)
    ├── Inherits from department/enterprise
    ├── Sections (persona per folder)
    │   ├── /design → designer facet
    │   ├── /docs → writer facet
    │   └── /specs → engineer facet
    │
    └── Sessions (flow mode)
        └── Hot context for real-time checks
```

---

## Part 1: Enterprise Level

### Hub (Source of Truth)

The "approved export" from all departments:

```
Enterprise Hub
├── Product facts (what we build, how it works)
├── Approved messaging (how we talk about it)
├── Policies (what we can/can't say)
├── Terminology (approved terms + variants)
├── Decisions (why we decided X)
└── Pricing/terms (commercial facts)
```

- Departments **feed into** Hub via Knowledge PRs
- Cross-cutting functions **read from** Hub
- Hub is curated, not a dump of everything

### Audiences (Guardrails)

```
Audiences
├── Internal
│   ├── All employees
│   ├── Department-specific
│   └── Leadership-only
│
├── External
│   ├── Public (website, marketing)
│   ├── Customers (sales, support)
│   └── Partners (technical, commercial)
│
└── Confidential
    ├── Legal/compliance
    ├── Pre-announcement
    └── Security-sensitive
```

Each audience has:
- **Allowed** content (can reference)
- **Forbidden** content (must not leak)
- **Required** disclaimers (must include)

### How Functions Use It

| Function | Reads from | Checks against | Flags |
|----------|------------|----------------|-------|
| **Department** | Own + Hub | Own profile | Internal inconsistencies |
| **Internal Comms** | Hub | Internal audience | Cross-dept conflicts |
| **External Comms** | Hub | External audience | Confidential leaks |
| **Sales** | Hub + Product | External audience | Unapproved claims |
| **Support** | Hub + Product | Customer audience | Outdated info |

### Department → Hub Flow

Departments don't write directly to Hub. They propose via Knowledge PRs:

```
1. Engineering updates API docs
2. System detects: "This affects external messaging"
3. Creates PR: "Update Hub product facts?"
4. Comms/Product reviews and approves
5. Hub updated → available to cross-cutting functions
```

**Principle:** Departments own depth. Hub owns breadth.

---

## Part 2: Project Level

### The Reality

Users don't create one project per persona. Real projects are mixed:
- One project with design + writing + specs
- Need flexibility without complexity

### Solution: Unified Profile + Facets

One project, multiple facets activated contextually:

```
Project
├── Primary persona (from template)
├── Unified profile (all facets present)
│
├── Sections (override active facet)
│   ├── /design → designer facet active
│   ├── /story → writer facet active
│   └── /specs → engineer facet active
│
└── Detection (infer when not explicit)
```

### Facet Structure

| Facet | Fields |
|-------|--------|
| **writer** | characterVoices, worldFacts, timelineEvents, narrativeStyle |
| **engineer** | apiContracts, adrs, techTerms, codePatterns |
| **architect** | systemInvariants, serviceContracts, decisionRecords |
| **designer** | componentNames, designTokens, platformVariants |
| **product** | requirements, acceptanceCriteria, stakeholderCommitments |
| **comms** | brandVoice, audienceRules, messagingGuidelines |

### Detection Logic

| Signal | Weight | Example |
|--------|--------|---------|
| **Folder path** | High | `/design/*` → designer |
| **Document metadata** | High | `type: spec` → engineer |
| **File extension** | Medium | `.figma`, `.sketch` → designer |
| **Content analysis** | Medium | Code blocks → engineer |
| **Recent activity** | Low | Last 5 docs were specs → engineer |

### Inheritance Rules

```
Enterprise baseline
    ↓ inherit
Department profile (if exists)
    ↓ inherit + extend
Project profile
    ↓ override per section
Section facet
```

**Can tighten, not loosen:** Project can be stricter than enterprise, not looser.

---

## Part 3: Individual / Session Level

### Session Vectors (Speed Layer)

Hot subset loaded on Flow Mode enter:

```
saga_vectors (cold)          session_{projectId} (hot)
Full corpus                  Current context only
All projects                 This project only
~500ms queries               ~50ms queries
```

#### What Goes in Session

- Active document embeddings
- Mentioned entities (from Project Graph)
- Recent style memories
- Relevant policy/decision canon
- Character voice centroids (fiction)
- Active facet context

#### Session Lifecycle

```
1. Enter Flow Mode
   └── Load relevant vectors into session collection

2. During writing (on pause ~2s)
   └── Query session for checks (fast)

3. Exit Flow Mode
   └── Sync learnings back to main corpus
   └── Show Pulse signals

4. Idle timeout
   └── Cleanup session collection
```

### Individual Profile

```
IndividualProfile {
  userId

  // Computed from their writing
  personalVoiceCentroid: vector
  vocabularyFingerprint: vector

  // What THEY overuse (not generic lists)
  personalOveruse: [
    { word: "however", frequency: 12, baseline: 4, ratio: 3.0 }
    { word: "essentially", frequency: 8, baseline: 2, ratio: 4.0 }
  ]

  // Writing patterns
  avgSentenceLength: number
  passiveVoiceRatio: number
  adverbRatio: number
}
```

### Checks by Level (During Flow Mode)

| Check | Data Source | Speed |
|-------|-------------|-------|
| Personal overuse | Individual profile (Convex) | Instant |
| Style drift | Voice centroid (Convex) | Instant |
| Entity consistency | Session vectors (Qdrant) | ~50ms |
| World facts | Session vectors (Qdrant) | ~50ms |
| Policy compliance | Cached rules (Convex) | Instant |

---

## Part 4: Schema Reference

### Enterprise Profile

```typescript
EnterpriseProfile {
  id, name

  hub: {
    facts: Fact[]
    messaging: ApprovedMessage[]
    policies: Policy[]
    terminology: TermMap
    decisions: Decision[]
  }

  audiences: {
    internal: AudienceRules
    external: AudienceRules
    confidential: AudienceRules
  }

  voiceCentroid: vector
  driftThreshold: number
}

AudienceRules {
  allowed: string[]      // Topics/facts that can be shared
  forbidden: string[]    // Must not leak
  required: string[]     // Must include (disclaimers, etc.)
  reviewers: string[]    // Who approves for this audience
}
```

### Project Profile

```typescript
ProjectProfile {
  id
  departmentId?
  enterpriseId?

  primaryPersona: "writer" | "engineer" | "designer" | ...

  voiceCentroid: vector
  terminologyMap: TermMap
  overusePatterns: OveruseEntry[]

  facets: {
    writer?: WriterFacet
    engineer?: EngineerFacet
    designer?: DesignerFacet
    product?: ProductFacet
    comms?: CommsFacet
  }

  sections: {
    [path: string]: {
      activeFacets: string[]
      overrides?: Partial<Facet>
    }
  }

  activeFacets: string[] // runtime
}
```

---

## Part 5: Weighting & Models

### Vector Weighting by Hierarchy

```
Query: "What's our pricing model?"

Results (after hierarchy weighting):
1. Enterprise hub (0.85 × 1.5 = 1.28) ← wins
2. Project doc (0.89 × 1.0 = 0.89)
3. Old department doc (0.87 × 0.8 = 0.70)
```

| Source | Base Weight | Boost Conditions |
|--------|-------------|------------------|
| **Enterprise hub** | 1.5 | Policy/messaging queries |
| **Department canon** | 1.2 | Domain-specific queries |
| **Project pinned** | 1.0 | Default |
| **Project general** | 0.8 | Older content |
| **Individual patterns** | 0.6 | Style queries boost to 1.2 |

### Final Score Formula

```
final_score =
  similarity_score
  × hierarchy_weight
  × facet_relevance
  × recency_multiplier
  × pinned_boost
```

### Model Stack

**Provider:** DeepInfra

| Purpose | Model | Context | Notes |
|---------|-------|---------|-------|
| **Embedding** | Qwen3-Embedding-8B | 32K | Primary, multi-lang 100+ |
| **Re-ranking** | Qwen3-Reranker | 32K | Pairs with Qwen3 |
| **Voice centroid** | Qwen3-Embedding-8B | 32K | Batch compute |

**Vector Store:** Qdrant (Hetzner self-hosted)
- Collection: `saga_vectors` (4096 dims)
- Session collections: `session_{projectId}` (hot subset)

### Drift Detection

```
newEmbedding = embed(currentParagraph)
similarity = cosine(newEmbedding, voiceCentroid)

if similarity < threshold:
  signal("Voice drift detected", 1 - similarity)
```

| Level | Drift Threshold | Action |
|-------|-----------------|--------|
| **Enterprise** | 0.85 | Block + require review |
| **Department** | 0.80 | Warn + suggest revision |
| **Project** | 0.75 | Soft signal |
| **Individual** | 0.70 | Info only |

---

## Part 6: Detection Algorithm

### Stage 1: Rule-Based (Instant, No Cost)

```
1. PATH RULES (weight: 1.0)
   /design/*     → designer
   /specs/*      → engineer
   /docs/*       → writer

2. FILE EXTENSION (weight: 0.9)
   .spec.md, .adr.md    → engineer
   .design.md           → designer

3. METADATA TAG (weight: 1.0)
   frontmatter.type = "spec"    → engineer
   frontmatter.persona = "..."  → direct match
```

### Stage 2: Content Analysis (Fast, Heuristic)

If no rule match, analyze content:

```
CODE_RATIO
  - >30% code blocks → engineer (+0.4)
  - >10% code blocks → engineer (+0.2)

DIALOGUE_RATIO
  - Has dialogue tags ("said", quotes) → writer (+0.3)

TECHNICAL_TERMS
  - API, endpoint, schema → engineer (+0.2)
  - component, token, spacing → designer (+0.2)
```

### Stage 3: LLM Classification (Fallback)

Only when Stage 1+2 confidence < 0.6. Cache result in document metadata.

---

## Part 7: Convex Tables

```typescript
// convex/schema.ts additions

profiles: defineTable({
  type: v.union(v.literal("enterprise"), v.literal("department"), v.literal("project"), v.literal("user")),
  targetId: v.string(),
  voiceCentroid: v.optional(v.array(v.float64())),
  driftThreshold: v.optional(v.float64()),
  facets: v.optional(v.any()),
  overusePatterns: v.optional(v.array(v.object({...}))),
  cachedAt: v.number(),
})

sessionContexts: defineTable({
  projectId: v.id("projects"),
  userId: v.id("users"),
  documentId: v.optional(v.id("documents")),
  qdrantCollection: v.string(),
  vectorIds: v.array(v.string()),
  activeFacets: v.array(v.string()),
  startedAt: v.number(),
  expiresAt: v.number(),
})

facetDetectionCache: defineTable({
  documentId: v.id("documents"),
  primary: v.string(),
  primaryConfidence: v.float64(),
  secondary: v.optional(v.string()),
  source: v.union(v.literal("rule"), v.literal("content"), v.literal("llm")),
  computedAt: v.number(),
})
```

---

## Implementation Status

| Component | Status |
|-----------|--------|
| Enterprise profile schema | Planned |
| Hub curation flow | Planned |
| Audience rules engine | Planned |
| Department → Hub PRs | Planned |
| Project facets | Planned |
| Section detection | Planned |
| Session vectors | Planned |
| Voice centroid compute | Planned |
| Flow mode integration | Extend existing |

---

## Open Questions

1. **Hub curation:** Who decides what goes in Hub?
2. **Audience boundaries:** How granular? (all-internal vs dept-internal)
3. **Conflict resolution:** When departments disagree, who wins?
4. **Versioning:** Hub history for "what was approved when?"
5. **Access control:** Row-level security for confidential?

---

## Related Docs

- [MLP1 Roadmap](./MLP1_ROADMAP.md)
- [MLP2 Proactivity Engine](./MLP2_PROACTIVITY_ENGINE.md)
- [Coherence Spec](./COHERENCE_SPEC.md)
