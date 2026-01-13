# MLP 1: Living Memory OS

> **Last Updated:** 2026-01-12
>
> **Goal:** Turn "what the project knows" into a first-class, reviewable system: documents + project graph + pinned memories, with approval-based changes ("Knowledge PRs") and clear provenance.

## What this is

MLP1 is building a **Living Memory OS** for a project:

- **Documents** are the narrative surface (what writers write).
- **Project Graph** (entities + relationships) is the structured surface (what the system can reason about).
- **Pinned memories** (decisions/policies) are the canonical surface (what must stay consistent).
- **Knowledge PRs** are the review surface (how changes become trusted).

This keeps the AI **silent unless invoked**, and keeps **high-impact changes reviewable**.

## Change capture → Knowledge PR (MLP1)

If a teammate says “Leader X changed”, that statement should not live only in chat. In MLP1 it must be **captured via an explicit mutation path**, for example:

- Update a node/edge in the Project Graph (entity/relationship change).
- Pin a canon memory / policy decision (Decision Ledger).
- Edit a document (writer change).

Once the change is **inside Muse**, the AI/runtime can propose follow‑up Knowledge PRs using the existing approval + `knowledgeSuggestions` flow.

### Change detection vs “change capture” (MLP1)

- MLP1 does **not** automatically notice external sources changing (Notion/Office/etc).
- A change must enter Muse (user edit, import/capture, tool call) before it can be modeled, linted, or turned into a Knowledge PR.
- Once a change is inside Muse, the system can safely propagate it through reviewable PRs (future: “Impact PRs” in MLP2).

## Review UX (“Changes to review”)

**Labeling**

- Use **“Changes to review”** for the panel header and Cmd+K command.
- Keep the editor menu item label **“Version history”** as the entry point (webview menu).

**Primary entry points (Expo Web)**

- Editor webview: More menu → **“Version history”** opens the “Changes to review” panel.
- Cmd+K: **“Changes to review”** command opens the same panel.

**What you can do**

- See a unified inbox of pending suggestions across `document` / `entity` / `relationship` / `memory`.
- Review preview/diff (where possible).
- Approve/reject single items or batch selections.
- Undo accepted graph/memory changes when rollback metadata is available.

**E2E selectors (stable hooks)**

- `knowledge-open` (editor menu item)
- `knowledge-pr-row` (list row)
- `knowledge-pr-details` (details panel)

## Provenance and audit

Every suggestion should be traceable:

- **Actor** (user vs agent)
- **Tool** + toolCallId
- **Model** + thread/stream identifiers (when available)
- **Target** (document/entity/relationship/memory identifiers)

This is required for:

- Trust (“why is the AI asking me this?”)
- Debugging (“where did this change come from?”)
- Rollback (“undo only what this approval applied”)

## Rollback / history (MLP1)

- **Graph + memory changes** can support rollback when applied via the approval runner, by storing rollback metadata alongside the suggestion result.
- **Document changes** remain editor-surface operations (apply/reject from the editor UI), so "undo" is not handled through the Knowledge PR runner in MLP1.

---

## Unified Profile (MLP1.5 / MLP2)

A cached, fast-access representation of style + context for real-time checks during Flow Mode.

### Existing Analysis Infrastructure

Already built and categorized:

| Mode | Issue Types | Location |
|------|-------------|----------|
| **consistency** | character, world, plot, timeline | `convex/ai/lint.ts` |
| **clarity** | ambiguous_pronoun, cliche, filler_word, dangling_modifier | `convex/ai/prompts/clarity.ts` |
| **policy** | policy_conflict, unverifiable, not_testable, policy_gap | `convex/ai/prompts/policy.ts` |
| **style** | telling, passive, adverb, repetition | `convex/ai/coach.ts` |
| **logic** | magic_rule_violation, causality_break, knowledge_violation | `convex/ai/tools.ts` |

Style memories already stored in Convex + Qdrant (`convex/ai/style.ts`, 180-day TTL).

### Missing: Aggregated Profile Fields

| Field | Purpose | Scope |
|-------|---------|-------|
| **Aggregate stats** | Issue counts, patterns over time | user / project |
| **Personal overuse list** | Words/phrases THIS user overuses | user |
| **Voice centroid** | Single embedding representing style | user / project |
| **Coherence baseline** | Reference voice for drift detection | enterprise / project |

### Storage Strategy

- **Qdrant**: Full vector corpus, heavy lifting (async)
- **Convex**: Cached profile, fast reads during Flow Mode
- **Refresh**: Daily scheduled job or on-demand `/refresh`

---

## Enterprise Coherence

For organizations: `enterprise` → `projects` (many), ensuring consistent voice across all outputs.

### Hierarchy

```
Enterprise (org-level)
├── Brand voice baseline (centroid)
├── Approved terminology
├── Policy canon (global)
└── Projects (inherit + override)
    ├── Project voice (can drift within bounds)
    ├── Project-specific terms
    └── Project policies
```

### Coherence Checks

| Check | Scope | Signal |
|-------|-------|--------|
| **Voice drift** | Project vs enterprise baseline | "This deviates 15% from brand voice" |
| **Term consistency** | Cross-project | "Project A says 'customers', Project B says 'users'" |
| **Policy alignment** | Project vs enterprise canon | "This conflicts with company policy X" |

### Use Cases

- **Comms**: All announcements match brand voice
- **Marketing**: Campaigns align with positioning
- **Sales**: Proposals use approved terminology
- **Docs**: Technical writing stays consistent

---

## Persona Applications

### Writer
- Personal overuse detection
- Character voice consistency
- World/timeline contradiction alerts
- Style drift from their baseline

### Product Manager
- Spec ↔ implementation drift
- Requirement contradiction alerts
- Decision provenance tracking
- Cross-doc consistency

### Engineer
- Code comment ↔ implementation alignment
- ADR (Architecture Decision Record) consistency
- API doc ↔ actual behavior drift
- Technical term consistency

### Architect
- System invariant enforcement
- Cross-service contract alignment
- Decision record coherence
- Dependency impact awareness

### Designer
- Design system terminology consistency
- Component naming alignment
- Spec ↔ implementation drift
- Cross-platform consistency (web/mobile/desktop)

### Common Pattern

All personas need:
1. **Baseline** - what's the reference voice/style?
2. **Drift detection** - how far from baseline?
3. **Consistency** - contradictions across docs?
4. **Memory** - why did we decide X?

The template registry configures which entity types and checks matter per persona.

---

## Session Vectors (Speed Layer)

For real-time checks during Flow Mode without querying full Qdrant corpus.

### Architecture

```
saga_vectors (cold)     →    session_{projectId} (hot)
Full corpus                  Current context only
~500ms queries               ~50ms queries
```

### Lifecycle

1. **On Flow Mode enter**: Load relevant entities + recent memories into session collection
2. **During writing**: Query session collection for instant checks
3. **On Flow Mode exit**: Sync any new learnings back to main corpus
4. **Cleanup**: Remove session collection after idle timeout

### What Goes in Session

- Active document embeddings
- Mentioned entities (from Project Graph)
- Recent style memories
- Relevant policy/decision canon
- Character voice centroids (fiction)

---

## Implementation Paths

| Component | Location | Status |
|-----------|----------|--------|
| Style extraction | `convex/ai/style.ts` | Done |
| Lint categories | `convex/ai/lint.ts` | Done |
| Coach/clarity | `convex/ai/coach.ts`, `convex/ai/prompts/` | Done |
| Severity config | `packages/core/src/analysis/severity-config.ts` | Done |
| Unified profile cache | `convex/ai/profile.ts` | Planned |
| Session vectors | `convex/ai/sessionVectors.ts` | Planned |
| Enterprise coherence | `convex/ai/coherence.ts` | Planned |
| Voice centroid compute | `convex/ai/voice.ts` | Planned |

