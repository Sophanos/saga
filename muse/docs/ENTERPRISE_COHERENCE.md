# Coherence Model: Enterprise to Individual

> **Last Updated:** 2026-01-12
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

# Part 1: Enterprise Level

## The Problem

Enterprises aren't flat:

```
Enterprise
├── Departments (silos)
│   ├── Engineering
│   ├── Product
│   ├── Design
│   └── Marketing
│
├── Cross-cutting functions
│   ├── Internal Comms (speaks TO all departments)
│   ├── Sales (speaks ABOUT all products)
│   └── Support (answers FOR all teams)
│
└── External audiences (customers, partners, public)
```

**Challenge:** Cross-cutting functions need coherence ACROSS silos, not just within one.

---

## Architecture: Hub + Audience Model

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

Who can hear what:

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

---

## How Functions Use It

| Function | Reads from | Checks against | Flags |
|----------|------------|----------------|-------|
| **Department** | Own + Hub | Own profile | Internal inconsistencies |
| **Internal Comms** | Hub | Internal audience | Cross-dept conflicts |
| **External Comms** | Hub | External audience | Confidential leaks |
| **Sales** | Hub + Product | External audience | Unapproved claims |
| **Support** | Hub + Product | Customer audience | Outdated info |
| **Legal** | All | Confidential rules | Compliance issues |

---

## Department → Hub Flow

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

## Cross-Cutting Function Flow

### Sales Writing Proposal

```
1. Pulls from Hub:
   - Product facts
   - Pricing/terms
   - Approved messaging

2. Checks against External audience:
   - No internal-only info?
   - No confidential pricing?
   - Claims match approved?

3. Flags:
   - "This feature isn't announced yet"
   - "Pricing differs from approved sheet"
   - "Competitor claim needs evidence"
```

### Internal Comms Writing Announcement

```
1. Pulls from Hub:
   - Decision record
   - Approved messaging
   - Department inputs

2. Checks against Internal audience:
   - Appropriate for all-hands?
   - Conflicts with department messaging?
   - Leadership approval needed?

3. Flags:
   - "Engineering announced differently"
   - "Contains external-only messaging"
   - "Missing context from Product"
```

### Support Writing Response

```
1. Pulls from Hub:
   - Product facts
   - Known issues
   - Approved workarounds

2. Checks against Customer audience:
   - Matches current docs?
   - Workaround still valid?
   - Escalation needed?

3. Flags:
   - "This was fixed in v2.3"
   - "Contradicts knowledge base"
   - "Requires legal disclaimer"
```

---

## Hierarchy Summary

```
Enterprise
│
├── Hub (curated truth)
│   ├── Facts (what's true)
│   ├── Messaging (how to say it)
│   └── Policies (what's allowed)
│
├── Audiences (who hears what)
│   ├── Internal
│   ├── External
│   └── Confidential
│
├── Departments (domain depth)
│   ├── Own profile + rules
│   ├── Feed into Hub via PRs
│   └── Inherit enterprise baseline
│
└── Projects (work context)
    ├── Inherit from department
    ├── Section-based facets
    └── Session vectors for speed
```

---

## Profile Schema

```
EnterpriseProfile {
  id
  name

  // Hub content
  hub: {
    facts: Fact[]
    messaging: ApprovedMessage[]
    policies: Policy[]
    terminology: TermMap
    decisions: Decision[]
  }

  // Audience rules
  audiences: {
    internal: AudienceRules
    external: AudienceRules
    confidential: AudienceRules
  }

  // Baseline for drift detection
  voiceCentroid: vector
  driftThreshold: number
}

AudienceRules {
  allowed: string[]      // Topics/facts that can be shared
  forbidden: string[]    // Must not leak
  required: string[]     // Must include (disclaimers, etc.)
  reviewers: string[]    // Who approves for this audience
}

DepartmentProfile {
  id
  enterpriseId
  name

  // Inherits enterprise baseline
  inherits: ["hub", "audiences", "voiceCentroid"]

  // Department-specific
  domainFacts: Fact[]
  domainTerms: TermMap
  domainPolicies: Policy[]

  // Can tighten, not loosen
  audienceOverrides: Partial<AudienceRules>
}

ProjectProfile {
  id
  departmentId?
  enterpriseId?

  // Active facets based on content/location
  facets: {
    writer?: WriterFacet
    engineer?: EngineerFacet
    designer?: DesignerFacet
    product?: ProductFacet
    comms?: CommsFacet
  }

  // Section overrides
  sections: {
    [path: string]: {
      activeFacets: string[]
      overrides?: Partial<Facet>
    }
  }
}
```

---

## Coherence Checks by Level

| Level | Check | Signal |
|-------|-------|--------|
| **Enterprise** | Policy compliance | "Violates company policy X" |
| **Enterprise** | Audience leak | "Contains internal-only info" |
| **Enterprise** | Voice drift | "15% deviation from brand voice" |
| **Department** | Domain consistency | "Contradicts engineering docs" |
| **Department** | Term alignment | "Use 'customers' not 'users'" |
| **Cross-cutting** | Hub alignment | "Differs from approved messaging" |
| **Cross-cutting** | Cross-dept conflict | "Marketing says X, Product says Y" |
| **Project** | Facet-specific | Per persona rules |

---

## Embedding Strategy

| Scope | What | When | Size |
|-------|------|------|------|
| **Enterprise** | Voice centroid, key policies | On setup | ~10 vectors |
| **Hub** | Approved facts, messaging | On change | ~100 vectors |
| **Department** | Domain facts | On change | ~100 vectors |
| **Project** | Active context | On open | ~100 vectors |
| **Session** | Hot subset | On flow mode | ~500 vectors |

**Principle:** Embed depth where attention is. Hub stays small and curated.

---

## Implementation Path

| Component | Status | Notes |
|-----------|--------|-------|
| Enterprise profile schema | Planned | Convex table |
| Hub curation flow | Planned | Knowledge PR → Hub |
| Audience rules engine | Planned | Check middleware |
| Department → Hub PRs | Planned | Auto-detect external impact |
| Cross-cutting checks | Planned | Hub + Audience validation |
| Voice drift detection | Planned | Centroid comparison |

---

## Open Questions

1. **Hub curation:** Who decides what goes in Hub? Product? Comms? Committee?
2. **Audience boundaries:** How granular? (all-internal vs dept-internal)
3. **Conflict resolution:** When departments disagree, who wins?
4. **Versioning:** Hub history for "what was approved when?"
5. **Access control:** Row-level security for confidential?

---

---

# Part 2: Project Level

## The Reality

Users don't create one project per persona. Real projects are mixed:
- One project with design + writing + specs
- Rarely separate projects per discipline
- Need flexibility without complexity

## Solution: Unified Profile + Facets

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

## Facet Structure

All facets present in profile, activated by context:

| Facet | Fields |
|-------|--------|
| **writer** | characterVoices, worldFacts, timelineEvents, narrativeStyle |
| **engineer** | apiContracts, adrs, techTerms, codePatterns |
| **architect** | systemInvariants, serviceContracts, decisionRecords |
| **designer** | componentNames, designTokens, platformVariants |
| **product** | requirements, acceptanceCriteria, stakeholderCommitments |
| **comms** | brandVoice, audienceRules, messagingGuidelines |
| **marketing** | campaignThemes, competitorPositioning, claimEvidence |
| **sales** | proposalTemplates, pricingRules, objectionResponses |

## Detection Logic

How to know which facet is active (no explicit tagging needed):

| Signal | Weight | Example |
|--------|--------|---------|
| **Folder path** | High | `/design/*` → designer |
| **Document metadata** | High | `type: spec` → engineer |
| **File extension** | Medium | `.figma`, `.sketch` → designer |
| **Content analysis** | Medium | Code blocks → engineer |
| **Recent activity** | Low | Last 5 docs were specs → engineer |

System combines signals → activates relevant facets → runs appropriate checks.

## Project Profile Schema

```
ProjectProfile {
  id
  departmentId?
  enterpriseId?

  // Primary persona (from template on creation)
  primaryPersona: "writer" | "engineer" | "designer" | ...

  // Universal fields
  voiceCentroid: vector
  terminologyMap: TermMap
  overusePatterns: OveruseEntry[]

  // All facets (present but not always active)
  facets: {
    writer?: WriterFacet
    engineer?: EngineerFacet
    designer?: DesignerFacet
    product?: ProductFacet
    comms?: CommsFacet
    ...
  }

  // Section-based activation
  sections: {
    [path: string]: {
      activeFacets: string[]
      overrides?: Partial<Facet>
    }
  }

  // Current context (runtime)
  activeFacets: string[]
}
```

## Onboarding Flow

When creating a new project:

```
1. "What's this project for?"
   → Multi-select: Writing, Design, Engineering, Product, Comms

2. AI suggests structure:
   "Based on your selections, I recommend:
   - /story (writer mode)
   - /design-system (designer mode)
   - /specs (engineer mode)"

3. User accepts or customizes

4. Enterprise baseline imported (if connected)

5. Project profile initialized with relevant facets
```

## Inheritance Rules

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

# Part 3: Individual / Session Level

## The Goal

Real-time checks during Flow Mode without:
- Querying full Qdrant corpus
- Breaking focus
- Slow response times

## Session Vectors (Speed Layer)

Hot subset loaded on Flow Mode enter:

```
saga_vectors (cold)          session_{projectId} (hot)
Full corpus                  Current context only
All projects                 This project only
~500ms queries               ~50ms queries
```

### What Goes in Session

- Active document embeddings
- Mentioned entities (from Project Graph)
- Recent style memories
- Relevant policy/decision canon
- Character voice centroids (fiction)
- Active facet context

### Session Lifecycle

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

## Individual Profile

Aggregated from user's activity across projects:

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

  // Growth tracking
  vocabularyGrowth: TimeseriesData
  styleEvolution: TimeseriesData
}
```

## Checks by Level (During Flow Mode)

| Check | Data Source | Speed |
|-------|-------------|-------|
| Personal overuse | Individual profile (Convex) | Instant |
| Style drift | Voice centroid (Convex) | Instant |
| Entity consistency | Session vectors (Qdrant) | ~50ms |
| World facts | Session vectors (Qdrant) | ~50ms |
| Policy compliance | Cached rules (Convex) | Instant |

## Silent Feedback in Flow Mode

Non-intrusive signals during writing:

| Signal | Display | When |
|--------|---------|------|
| Overuse warning | Subtle underline | On pattern match |
| Consistency issue | Dim highlight | On entity mention |
| Style drift | Bottom counter | Per paragraph |
| Expand details | On hover or exit | User-initiated |

**Principle:** Collect silently, surface minimally, expand on request.

---

# Part 4: Unified Schema

## Complete Profile Hierarchy

```
EnterpriseProfile {
  id, name
  hub: { facts, messaging, policies, terminology, decisions }
  audiences: { internal, external, confidential }
  voiceCentroid, driftThreshold
}

DepartmentProfile {
  id, enterpriseId, name
  inherits: ["hub", "audiences", "voiceCentroid"]
  domainFacts, domainTerms, domainPolicies
  audienceOverrides
}

ProjectProfile {
  id, departmentId?, enterpriseId?
  primaryPersona
  voiceCentroid, terminologyMap, overusePatterns
  facets: { writer?, engineer?, designer?, ... }
  sections: { [path]: { activeFacets, overrides } }
  activeFacets (runtime)
}

IndividualProfile {
  userId
  personalVoiceCentroid, vocabularyFingerprint
  personalOveruse[]
  writingPatterns, growthTracking
}

SessionContext {
  projectId, documentId, userId
  loadedVectors: string[]  // IDs in session collection
  activeFacets: string[]
  checksRun: CheckResult[]
}
```

## Coherence Checks Summary

| Level | Strictness | Checks |
|-------|------------|--------|
| **Enterprise** | Strict | Policy, audience, voice baseline |
| **Department** | Inherited + domain | Domain terms, domain facts |
| **Project** | Contextual | Facet-specific, section-aware |
| **Individual** | Adaptive | Personal overuse, style drift |
| **Session** | Real-time | Fast subset of above |

---

## Implementation Path

| Component | Location | Status |
|-----------|----------|--------|
| Enterprise profile schema | `convex/enterprise.ts` | Planned |
| Hub curation flow | `convex/hub.ts` | Planned |
| Audience rules engine | `convex/ai/audienceCheck.ts` | Planned |
| Department profiles | `convex/departments.ts` | Planned |
| Project facets | `convex/projectProfiles.ts` | Planned |
| Section detection | `convex/ai/facetDetection.ts` | Planned |
| Individual profile | `convex/ai/individualProfile.ts` | Planned |
| Session vectors | `convex/ai/sessionVectors.ts` | Planned |
| Voice centroid compute | `convex/ai/voice.ts` | Planned |
| Flow mode integration | `packages/state/src/flow.ts` | Extend |

---

# Part 5: Profile Fields Reference

## Enterprise Profile Fields

| Field | Purpose | Type |
|-------|---------|------|
| **voiceCentroid** | Brand voice embedding | vector |
| **terminologyMap** | Approved terms + variants | map |
| **driftThreshold** | Max allowed deviation (e.g., 15%) | number |
| **policyCanon** | Global must-follow rules | Policy[] |
| **styleGuide** | Tone, formality, patterns | StyleGuide |
| **audienceRules** | What can be said to whom | AudienceRules |

## Persona-Specific Profile Fields

| Persona | Fields |
|---------|--------|
| **Writer** | characterVoices, worldFacts, timelineEvents, narrativeStyle, dialoguePatterns |
| **Engineer** | apiContracts, adrs, techTerms, codePatterns, dependencyMap |
| **Architect** | systemInvariants, serviceContracts, decisionRecords, boundaryDefinitions |
| **Designer** | componentNames, designTokens, platformVariants, interactionPatterns |
| **PM** | requirements, acceptanceCriteria, stakeholderCommitments, priorityFramework |
| **Marketing** | campaignThemes, competitorPositioning, claimEvidence, channelGuidelines |
| **Sales** | proposalTemplates, pricingRules, objectionResponses, competitorBattlecards |
| **Comms** | brandVoice, audienceSegments, messagingFramework, crisisProtocols |
| **Support** | knowledgeBase, escalationPaths, responseTemplates, knownIssues |
| **Legal** | complianceRules, disclaimerTemplates, approvalWorkflows, riskCategories |
| **Researcher** | sourceRegistry, citationRules, methodologyStandards, findingsFormat |

## Field Type Definitions

```
StyleGuide {
  tone: "formal" | "casual" | "technical" | "friendly"
  formality: 1-5
  sentenceLength: { min, max, target }
  vocabularyLevel: "simple" | "standard" | "advanced"
  avoidPatterns: string[]
  preferPatterns: string[]
}

TerminologyMap {
  approved: { term: string, variants: string[], definition: string }[]
  forbidden: { term: string, replacement: string, reason: string }[]
  domainSpecific: { term: string, context: string }[]
}

PolicyCanon {
  id: string
  rule: string
  severity: "must" | "should" | "may"
  scope: "all" | "external" | "internal"
  exceptions: string[]
  source: string
}

AudienceRules {
  allowed: string[]      // Topics/facts that can be shared
  forbidden: string[]    // Must not leak
  required: string[]     // Must include (disclaimers)
  tone: StyleGuide       // Audience-specific tone
  reviewers: string[]    // Who approves
}
```

## Inheritance & Override Rules

| Field | Enterprise | Department | Project | Can Override? |
|-------|------------|------------|---------|---------------|
| voiceCentroid | Set | Inherit | Extend | Tighten only |
| terminologyMap | Set | Extend | Extend | Add, not remove |
| policyCanon | Set | Extend | Extend | Tighten only |
| driftThreshold | Set | Override | Override | Can tighten |
| styleGuide | Set | Override | Override | Yes |
| audienceRules | Set | Extend | N/A | Tighten only |

**Principle:** Lower levels can tighten constraints, not loosen them.

---

# Part 6: Weighting & Models

## Vector Weighting by Hierarchy

When querying, weight results by source level:

```
Query: "What's our pricing model?"

Results (before weighting):
1. Project doc (similarity: 0.89)
2. Enterprise hub (similarity: 0.85)
3. Old department doc (similarity: 0.87)

Results (after hierarchy weighting):
1. Enterprise hub (0.85 × 1.5 = 1.28) ← wins
2. Project doc (0.89 × 1.0 = 0.89)
3. Old department doc (0.87 × 0.8 = 0.70)
```

### Weight Matrix

| Source | Base Weight | Boost Conditions |
|--------|-------------|------------------|
| **Enterprise hub** | 1.5 | Policy/messaging queries |
| **Department canon** | 1.2 | Domain-specific queries |
| **Project pinned** | 1.0 | Default |
| **Project general** | 0.8 | Older content |
| **Individual patterns** | 0.6 | Style queries boost to 1.2 |

### Implementation in Qdrant

```
Qdrant payload:
{
  "content": "...",
  "level": "enterprise" | "department" | "project",
  "pinned": true | false,
  "updatedAt": timestamp,
  "facets": ["comms", "product"]
}

Query with filter + boost:
- Filter: facets contains active facet
- Boost: level weight × recency decay × pinned bonus
```

## Re-ranking with LLM

Two-stage retrieval:

```
Stage 1: Vector search (fast, broad)
└── Get top 50 candidates from Qdrant

Stage 2: LLM re-rank (precise, contextual)
└── Score each by relevance to query + hierarchy rules
└── Return top 10
```

### When to Use LLM Re-rank

| Scenario | Vector Only | + LLM Re-rank |
|----------|-------------|---------------|
| Simple lookup | ✓ | Overkill |
| Policy check | ✓ | ✓ (authority matters) |
| Cross-dept query | | ✓ (resolve conflicts) |
| Ambiguous query | | ✓ (intent clarification) |

## Model Stack (Actual)

**Provider:** DeepInfra

| Purpose | Model | Context | Price | Notes |
|---------|-------|---------|-------|-------|
| **Embedding** | Qwen3-Embedding-8B-batch | 32K | $0.005/1M | Primary, multi-lang 100+ |
| **Re-ranking** | Qwen3-Reranker | 32K | $0.005/1M | Pairs with Qwen3 |
| **Facet detection** | Rule-based + LLM fallback | - | - | See Part 7 |
| **Style analysis** | GPT-4o-mini / Qwen | - | On demand | Coach checks |
| **Voice centroid** | Qwen3-Embedding-8B | 32K | Batch compute | Daily/weekly |

**Why Qwen3-8B:**
- #1 on MTEB multilingual (70.58)
- 32K context (vs BGE-M3's 8K)
- 100+ languages including code
- Cost-efficient batch pricing

### What 70+ MTEB Score Means

| Task Category | Score Range | What It Tests |
|---------------|-------------|---------------|
| **Retrieval** | 65-75 | Finding relevant docs from corpus |
| **STS** (Semantic Similarity) | 80-90 | "Are these sentences similar?" |
| **Classification** | 75-85 | Topic/intent classification |
| **Clustering** | 45-55 | Grouping similar docs |
| **Reranking** | 55-65 | Ordering results by relevance |
| **Pair Classification** | 85-90 | Entailment, paraphrase detection |

**70+ overall = strong across all tasks**, especially:
- Cross-lingual retrieval (DE↔EN, etc.)
- Long document understanding
- Code + natural language mixing

### Model Selection Guide

| Model | Dims | Best For | Trade-off |
|-------|------|----------|-----------|
| **Qwen3-8B** | 4096 | Best quality, multi-lang | Higher latency, larger index |
| **Qwen3-4B** | 2560 | Good quality, balanced | Mid compute, smaller index |
| **Qwen3-0.6B** | 1024 | Fast, cheap | Lower quality on hard queries |

**Our choice: Qwen3-8B (4096 dims)**
- Quality > latency for coherence checks
- Already have Qdrant infra for large vectors
- Batch pricing makes cost acceptable

**Vector Store:** Qdrant (Hetzner self-hosted)
- Collection: `saga_vectors` (4096 dims)
- Session collections: `session_{projectId}` (hot subset)

## Facet Detection Models

### Option A: Rule-based (Fast, No ML)

```
Path contains "/design" → designer
File extension ".spec.md" → engineer
Content has code blocks > 30% → engineer
Content has dialogue tags → writer
```

### Option B: Small Classifier (Accurate, Cheap)

Train on labeled examples:
- Input: document content (truncated)
- Output: facet probabilities

```
{
  "writer": 0.1,
  "engineer": 0.7,  ← active
  "designer": 0.15,
  "product": 0.05
}
```

### Option C: LLM Classification (Most Accurate, Expensive)

Use sparingly for edge cases:
- New document types
- Mixed-content documents
- Override suggestions

## Voice Centroid Computation

### Simple: Mean Embedding

```
1. Get all user's content embeddings (last 90 days)
2. Compute mean vector
3. Store as voiceCentroid
4. Refresh daily/weekly
```

### Advanced: Weighted by Recency + Quality

```
1. Get embeddings with metadata
2. Weight by:
   - Recency (newer = higher)
   - Document length (longer = higher, up to limit)
   - Engagement (edited more = higher)
3. Weighted mean = voiceCentroid
```

## Drift Detection

Compare new content to centroid:

```
newEmbedding = embed(currentParagraph)
similarity = cosine(newEmbedding, voiceCentroid)

if similarity < 0.75:
  signal("Voice drift detected", 1 - similarity)
```

### Thresholds by Level

| Level | Drift Threshold | Action |
|-------|-----------------|--------|
| **Enterprise** | 0.85 | Block + require review |
| **Department** | 0.80 | Warn + suggest revision |
| **Project** | 0.75 | Soft signal |
| **Individual** | 0.70 | Info only |

---

## Open Questions

1. **Hub curation:** Who decides what goes in Hub? Product? Comms? Committee?
2. **Audience boundaries:** How granular? (all-internal vs dept-internal)
3. **Conflict resolution:** When departments disagree, who wins?
4. **Versioning:** Hub history for "what was approved when?"
5. **Access control:** Row-level security for confidential?
6. **Facet detection:** ML-based or rule-based content analysis?
7. **Session size:** How many vectors is too many for "fast"?
8. **Cross-project individual:** Aggregate style across all projects?

---

---

# Part 7: Theme Detection & Weighting Algorithm

## Overview

The core challenge: determine which facet(s) are active and weight results accordingly—fast enough for Flow Mode.

```
Input: User context (path, doc, content)
     ↓
Detection: Which facet(s) apply?
     ↓
Weighting: How to rank/blend results?
     ↓
Output: Relevant, hierarchically-correct results
```

---

## Detection Algorithm

### Stage 1: Rule-Based (Instant, No Cost)

```
Rules (evaluated in order, first match wins):

1. PATH RULES (weight: 1.0)
   /design/*     → designer
   /specs/*      → engineer
   /docs/*       → writer
   /marketing/*  → marketing
   /sales/*      → sales
   /support/*    → support

2. FILE EXTENSION (weight: 0.9)
   .spec.md, .adr.md    → engineer
   .design.md           → designer
   .story.md, .chapter* → writer
   .campaign.md         → marketing

3. METADATA TAG (weight: 1.0)
   frontmatter.type = "spec"    → engineer
   frontmatter.persona = "..."  → direct match

4. FOLDER CONFIG (weight: 1.0)
   .muse/facet.json in folder   → explicit override
```

### Stage 2: Content Analysis (Fast, Heuristic)

If no rule match, analyze content:

```
Signals (combined score):

CODE_RATIO
  - >30% code blocks → engineer (+0.4)
  - >10% code blocks → engineer (+0.2)

DIALOGUE_RATIO
  - Has dialogue tags ("said", quotes) → writer (+0.3)

TECHNICAL_TERMS
  - API, endpoint, schema, deploy → engineer (+0.2)
  - component, token, spacing → designer (+0.2)
  - requirement, stakeholder, milestone → product (+0.2)

STRUCTURE
  - Has user stories format → product (+0.3)
  - Has ADR format → architect (+0.4)
  - Has narrative flow → writer (+0.3)
```

### Stage 3: LLM Classification (Fallback, Expensive)

Only when Stage 1+2 confidence < 0.6:

```
Prompt: "Classify this document's primary purpose.
Options: writer, engineer, designer, product, marketing, sales, comms, support
Return: { primary: string, confidence: number, secondary?: string }"

Cache result in document metadata.
```

### Detection Output

```
DetectionResult {
  primary: Facet
  primaryConfidence: number (0-1)
  secondary?: Facet
  secondaryConfidence?: number
  source: "rule" | "content" | "llm"
  cached: boolean
}
```

---

## Weighting Algorithm

### Base Weights by Hierarchy

```
HIERARCHY_WEIGHTS = {
  enterprise_hub: 1.5,
  enterprise_policy: 1.8,    // Policies always win
  department_canon: 1.2,
  project_pinned: 1.1,
  project_general: 1.0,
  session_recent: 0.9,
  individual: 0.6
}
```

### Facet Relevance Multiplier

```
If query facet matches result facet: ×1.2
If query facet ≠ result facet: ×0.7
If result has no facet tag: ×1.0
```

### Recency Decay

```
age_days = (now - updatedAt) / (1000 * 60 * 60 * 24)
recency_multiplier = max(0.5, 1.0 - (age_days / 365))
```

### Pinned Boost

```
If pinned: ×1.3
If canon: ×1.5
```

### Final Score Formula

```
final_score =
  similarity_score
  × hierarchy_weight
  × facet_relevance
  × recency_multiplier
  × pinned_boost
```

### Example

```
Query: "What's our API authentication method?"
Active facet: engineer
Results:

1. Enterprise policy doc (similarity: 0.82)
   0.82 × 1.8 × 1.0 × 0.95 × 1.5 = 2.10 ← wins

2. Project spec (similarity: 0.91)
   0.91 × 1.0 × 1.2 × 0.98 × 1.0 = 1.07

3. Old department doc (similarity: 0.88)
   0.88 × 1.2 × 1.2 × 0.70 × 1.0 = 0.89
```

---

## Multi-Facet Handling

When document spans multiple facets:

### Option A: Primary Only
Use highest confidence facet, ignore secondary.

### Option B: Weighted Blend
```
If primary.confidence > 0.8: use primary only
If primary.confidence 0.6-0.8:
  blend = 0.7 × primary + 0.3 × secondary
If primary.confidence < 0.6:
  use LLM classification
```

### Option C: Section-Level Detection
Split document by headers, detect per section.
Most accurate but expensive.

**Recommendation:** Option B for now, Option C for long documents.

---

## Caching & Warming Strategy

### What to Cache (Convex)

| Data | Table | TTL | Refresh |
|------|-------|-----|---------|
| Facet detection result | `documentMeta` | Until doc change | On save |
| Voice centroid | `profiles` | 7 days | Weekly job |
| Hierarchy weights | `config` | Manual | On admin change |
| User overuse patterns | `userProfiles` | 30 days | Daily job |
| Session context IDs | `sessions` | 1 hour | On flow exit |

### Warming Strategy

**On App Start:**
```
1. Load user profile (voice, overuse) from Convex
2. Load project profile (facets, terminology) from Convex
3. Pre-warm: nothing yet (lazy load)
```

**On Document Open:**
```
1. Check documentMeta for cached facet detection
2. If miss: run Stage 1+2 detection, cache result
3. Pre-fetch related entities from Project Graph
```

**On Flow Mode Enter:**
```
1. Create session collection in Qdrant
2. Load into session:
   - Current doc embeddings
   - Mentioned entities (top 50)
   - Recent style memories (top 30)
   - Active facet context (top 20)
   - Relevant policies (all)
3. Store session vector IDs in Convex for cleanup
```

**On Flow Mode Exit:**
```
1. Sync new learnings to main corpus
2. Update user overuse patterns (async)
3. Mark session for cleanup (Qdrant)
4. Clear session record (Convex)
```

### Convex Scheduled Jobs

```
// convex/crons.ts additions

crons.daily("refresh-voice-centroids", async (ctx) => {
  // Recompute voice centroids for active users
})

crons.daily("cleanup-stale-sessions", async (ctx) => {
  // Remove session collections older than 2 hours
})

crons.weekly("aggregate-user-patterns", async (ctx) => {
  // Compute overuse patterns from writing history
})
```

---

## Convex Research Notes

### Questions to Investigate

1. **Vector search limits**
   - Max 256 results, 64 filters
   - Workaround: use Qdrant for heavy lifting, Convex for metadata

2. **Scheduled jobs**
   - `ctx.scheduler.runAfter` for dynamic scheduling
   - `crons.ts` for recurring jobs
   - Existing: `embeddingJobs` outbox pattern

3. **Real-time subscriptions**
   - Can subscribe to profile changes
   - Use for live facet updates in UI

4. **Row-level security**
   - Needed for enterprise audience rules
   - Investigate `ctx.auth` patterns

### Existing Convex Patterns to Reuse

| Pattern | Location | Reuse For |
|---------|----------|-----------|
| Embedding outbox | `convex/ai/embeddings.ts` | Profile compute jobs |
| Memory storage | `convex/ai/style.ts` | Facet cache |
| Scheduled jobs | `convex/crons.ts` | Warming, cleanup |
| Real-time sync | `convex/collaboration.ts` | Profile subscriptions |

### New Tables Needed

```
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
  secondaryConfidence: v.optional(v.float64()),
  source: v.union(v.literal("rule"), v.literal("content"), v.literal("llm")),
  computedAt: v.number(),
})
```

---

## Implementation Priority

| Step | Component | Effort | Impact |
|------|-----------|--------|--------|
| 1 | Rule-based detection | Low | High |
| 2 | Facet cache table | Low | Medium |
| 3 | Weighting formula | Medium | High |
| 4 | Session vector warming | Medium | High |
| 5 | Voice centroid compute | Medium | Medium |
| 6 | Content-based detection | Medium | Medium |
| 7 | LLM fallback | Low | Low |
| 8 | Multi-facet blending | High | Low |

**Start with:** Steps 1-4 (rule detection + caching + weighting + sessions)

---

## Related Docs

- [MLP1 Living Memory OS](./MLP1_LIVING_MEMORY_OS.md)
- [MLP2 Proactivity Engine](./MLP2_PROACTIVITY_ENGINE.md)
- [MLP1 Roadmap](./MLP1_ROADMAP.md)
