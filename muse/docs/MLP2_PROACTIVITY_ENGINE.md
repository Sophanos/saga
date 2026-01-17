# MLP2: Proactivity Engine (Silent by Default)

Reference: [MLP1 Roadmap](./MLP1_ROADMAP.md) · [Living Memory OS](./MLP1_LIVING_MEMORY_OS.md) · [Coherence Spec](./COHERENCE_SPEC.md)

MLP2 adds **proactivity without interruptions**: Muse runs background analysis as you write or ingest large corpora, then surfaces results as a **Pulse** (read-only signals) and **Knowledge PR drafts** (reviewable changes). No silent high-impact edits.

---

## Repo status (Phase 1.5 groundwork)

- `analysisJobs` outbox table exists with scheduling + dedupe fields.
- `ai/analysisJobs.ts` implements enqueue/claim/finalize/failure/backoff + stale requeue/cleanup.
- `ai/analysis/processAnalysisJobs.ts` runner with bounded concurrency + cron backstop.
- Document updates enqueue `detect_entities` jobs and schedule the runner.
- Handlers emit `pulseSignals` for entity detection, lint, clarity, and policy checks.

---

## Sequencing note (planning)

- MLP1 is validated on Expo web only (no Tauri).
- MLP2 is deferred until after MLP1 and is planned before any Tauri development begins.
- A refactor pass (web architecture consolidation) is scheduled between MLP1 and MLP2; Tauri development follows after MLP2.

---

## Product promise (keep it honest)

- **Flow Mode stays distraction-free.** Muse can be proactive in the background, but it must not interrupt the writer.
- **Proactivity never means silent mutation.** The default output is: *signals + reviewable PRs*.
- **Users stay in control.** All proactive actions should be pausable, scoped (document/project), and budgeted.
- **Strategic bet:** be the “compiler for project truth” (types, invariants, diffs, review, provenance, deterministic gates). Avoid competing as “enterprise search with connectors”; connectors are evidence/ingest, not the moat.

---

## USP amplifiers (MLP2+)

These features compound the “compiler” positioning while staying compatible with governed autonomy.

- **Impact PRs (best next USP)**: “You changed X → here are the downstream PRs required to keep the model coherent.” (Incremental rebuild, without needing deep connectors.)
- **Watchlists + invariants (“policies as code”, light)**: projects declare truth constraints (e.g., “owners must exist”, “only one leader”, “API version matches docs”) and proactivity enforces them as signals + PR drafts.
- **Citations everywhere (trust primitive)**: allow important node properties and decision/policy items to be backed by `{ sourceUri, excerptHash }`, so the Living Model is auditable (not just “memory”).
- **Permission-scoped Pulse/PRs**: for teams, all signals/PRs must respect visibility scopes; this becomes a real moat vs generic RAG.
- **Tracked-changes export as PR output (DOCX)**: generate a DOCX with Track Changes representing a merged PR (or a PR draft). Great for writers and compliance workflows.

MLP1 note: MLP1 already has PR mechanics and canon citations; these items are primarily MLP2+ (proactivity, permissions, external change, exports).

---

## Research backlog (USP validation)

Use these as explicit research spikes to validate demand, UX, and operational cost:

- **Impact PRs:** validate whether “downstream PRs from a single change” feels magical or noisy; test on real projects.
- **Policy/invariant watchlists:** confirm that teams can author useful constraints without heavy setup; evaluate false-positive rate.
- **Citations everywhere:** test if trace links change review behavior and trust; measure how often users click into sources.
- **Permission-scoped Pulse/PRs:** validate team needs for scoped visibility and approval; ensure it does not slow review.
- **Tracked-changes exports:** validate external workflow fit (editors, legal, compliance) and acceptable DOCX fidelity.

---

## Proactivity modes (per project + per user)

1. **Off**: no background analysis; only manual tools.
2. **Silent** (default for writers / Flow Mode): background jobs run, results go to Inbox only (Pulse section).
3. **Assistive**: lightweight inline affordances (badges/counters), still no popups.
4. **Active** (opt-in): prompts the user when critical issues are found (never writes without approval).

Implementation note: these modes are UI policy; the backend always produces the same artifacts (signals + PR drafts) and the client decides how/when to surface them.

---

## User journeys

### Writer (Flow Mode, “proactive but silent”)

- Writer types for a while → on idle/save, Muse runs background checks.
- Pulse counter increments quietly (no popups).
- When the writer exits Flow Mode (or opens Inbox via bell / Cmd+K), they see:
  - “New entities detected (3)”
  - “Possible canon contradiction (1)”
  - “Clarity issues (5)”
  - “Knowledge PRs ready to review (2)”
- The writer reviews/merges PRs when they choose.

### Writer (paste/import a whole book)

- User pastes/ingests a large corpus → ingestion pipeline starts.
- UI shows progress (“indexing”, “summarizing”, “extracting entities”, “drafting PRs”).
- Output is staged:
  - document digests
  - entity/node candidates (deduped)
  - relationship candidates
  - decision/policy candidates
  - contradictions to resolve (with canon citations if available)

### Product/Engineering (spec drift)

- Ingest PRDs/RFCs/tickets/runbooks (via upload, paste, or MCP).
- Proactivity produces:
  - “Spec drift” signals (contradiction candidates)
  - PR drafts to align docs with the Project Graph and Decision Ledger
  - prompts to pin canonical decisions (Decision Ledger) where ambiguity exists

### Comms/Support (Clarity + Policy)

- Draft FAQ/release notes/macros → background clarity/policy coach runs.
- Pulse shows:
  - ambiguity/unverifiable/not-testable/policy-conflict issues
  - PR drafts to fix copy and link claims back to canon decisions

---

## What “proactive” produces (artifacts)

### A) Pulse signals (read-only)

Short-lived, non-blocking items that answer: “what should I look at next?”

Examples:
- “New nodes suggested (7)”
- “Two entities look duplicated”
- “Runbook contradicts pinned policy”
- “This requirement is not testable”

### B) Knowledge PR drafts (reviewable mutations)

When proactivity crosses from “signal” to “change”, it becomes a draft PR:
- create/update node
- create/update edge
- propose/pin decision/policy (Decision Ledger)
- propose doc edits (optional)

These reuse the existing `knowledgeSuggestions` pattern and approval gating:
- `muse/convex/knowledgeSuggestions.ts`
- `muse/convex/ai/agentRuntime.ts`

---

## Architecture overview (Convex-native)

### Triggers (when to run jobs)

- **Idle-on-write**: schedule after user stops typing (e.g., 2–5s) or on save.
- **Big ingest**: on paste/import, schedule a multi-stage pipeline with progress.
- **Periodic digests**: nightly or hourly per project (optional).

### Scheduling strategy (dynamic + crons)

- **Dynamic scheduling** (per project/doc): use Convex scheduling (`ctx.scheduler.runAfter`) to enqueue work when events happen.
- **Cron backstop**: use `muse/convex/crons.ts` to process any missed/queued jobs and to run periodic maintenance/digests.

Existing cron infrastructure: `muse/convex/crons.ts`

### Pipeline pattern (unified analysis outbox + workers)

Unify embeddings + detection + coherence into a single **analysis outbox**. One runner, multiple job kinds, shared scheduling, backoff, and quotas.

**Outbox table (MLP2):** `analysisJobs` in `muse/convex/schema.ts`
- common fields: `projectId`, `documentId?`, `kind`, `status`, `attempts`, `payload`, `scheduledFor`, `contentHash`, `createdAt`, `updatedAt`
- indexes: by `status + scheduledFor`, by `projectId + kind`

**Runner:** `muse/convex/analysis/processAnalysisJobs.ts`
- selects queued jobs (by runAfter), marks running, dispatches to handlers with bounded concurrency
- retries with exponential backoff; emits Pulse signals on persistent error

**Job kinds (core set)**
- `embedding_generation` (text embeddings; payload targetType = document/entity/memory/memory_delete)
- `detect_entities` (entity extraction + mentions)
- `coherence_lint` (canon + contradiction lints)
- optional: `digest_document`, `clarity_policy_check`, `decision_candidates`

Note: CLIP image embeddings still run on the asset path (`convex/ai/imageEmbeddings.ts`).

**Task-driven model routing**
All handlers resolve models through `llmTaskConfigs` (not hard-coded):
- Config source: `muse/convex/schema.ts` → `llmTaskConfigs`
- Resolver: `muse/convex/lib/providers/taskConfig.ts`
- Runtime: `muse/convex/ai/modelRouting.ts` + `muse/convex/ai/llmExecution.ts`

This keeps model swaps safe and centralized, and allows BYOK override for text tasks (OpenRouter).

### Data products (tables)

Add two lightweight tables:
- `pulseSignals` (new): signals for Pulse (severity, kind, summary, links to doc/project, optional `suggestionId`)
- `digestSnapshots` (optional): persisted summaries (document/project), used to keep AI context small

Keep using:
- `knowledgeSuggestions`: PR lifecycle (`muse/convex/knowledgeSuggestions.ts`)
- `activityLog`: audit trail (`muse/convex/schema.ts`)
- `projectTypeRegistry`: type + risk gates (`muse/convex/projectTypeRegistry.ts`, `muse/convex/lib/typeRegistry.ts`)
- Qdrant pinned memories as canon/policy: (`muse/convex/ai/tools.ts`, `muse/convex/ai/canon.ts`)

---

## Proactive done right: three Ambient patterns that won’t break flow

### Pattern 1: Post-Flow Pulse Card (MLP1.5)

Trigger on **Flow exit** / idle end (not cron).

Shows:
- what changed (new entities, updated entities, contradictions, new media)
- 1–3 suggested actions (all behind Knowledge PRs)
- snooze/ignore/accept (no interruptions, no guilt)

This is the ambient reveal surface the Artifact Panel should become.

### Pattern 2: Canon + Contradiction Lints (high leverage, low UI)

Add a lightweight `canonClaims` table and run a lint pass:
> “Document says X; canon says Y; here are both spans.”

Output becomes a Knowledge PR:
- update canon
- mark as intentional divergence

This is meaning integrity, not “AI help.”

Implementation notes (current):
- `canonClaims` table lives in `muse/convex/schema.ts`
- Minimal API in `muse/convex/canonClaims.ts`
- Optional backfill from pinned memories: `muse/convex/migrations/backfillCanonClaimsFromMemories.ts`

### Pattern 3: Cross-modal grounding (CLIP + text)

Make images first-class in the graph:
- auto-suggest entity links for uploaded images
- generate a “Media board” artifact grouped by semantic clusters

This turns “Notice: Image + Text embeddings” into experiential UI.

---

## Decision lock: Unified vectors (Option B)

We will move to a single Qdrant collection with **named vectors** (text + image + sparse), replacing the dual-collection fusion approach.

**Why now:** no active users → minimal migration risk.

**Migration plan (high-level):**
1) Create unified collection (e.g., `saga_unified`) with named vectors:
   - `text_qwen` (4096, cosine)
   - `image_clip` (512, cosine)
   - `sparse_bm25` (optional)
2) Dual-write new content to old + unified collections.
3) Backfill existing content into unified collection.
4) Switch query aggregator to unified collection.
5) Remove dual-write + deprecate old collections.

---

## External sources: change detection (Notion/Office/MCP) without “index everything”

Goal: when a teammate updates a source-of-truth (“Leader changed”, “Policy updated”, “Spec revised”), Muse should notice, flag drift, and propose a reviewable update to the Living Model.

MLP1 note: Muse can only react to changes that enter Muse. MLP2 adds the missing “notice it happened elsewhere” ingest loop.

### Ingestion patterns (pick one per connector)

1. **MCP push (client-side)** (recommended early)
   - The MCP client (Notion/Office/Slack/Drive toolchain) fetches deltas using the user’s auth.
   - It pushes only what’s needed to Muse: metadata + excerpt(s) + hashes + URIs (avoid full replication unless explicitly allowed).
   - Existing MCP infra: `muse/packages/mcp-server/src/index.ts`, `muse/packages/mcp-server/src/tools.ts`
2. **Polling (server-side)**
   - Convex scheduled job polls connector APIs with stored credentials (harder security surface).
3. **Webhooks**
   - External system sends change events; Convex enqueues follow-up jobs to fetch details and create signals/PR drafts.

### Minimal data model (MLP2)

- `externalSources` (new): connection config + scopes (project-scoped; user-scoped auth pointers)
- `sourceDocuments` (new): `{ sourceId, externalId, uri, title, lastSeenRevision, lastSeenHash, updatedAt }`
- `sourceChangeEvents` (new): append-only change log (`createdAt`, `kind`, `diffSummary`, links)
- `citations` (new): `{ targetType, targetId, sourceUri, excerptHash, capturedAt }`

Pragmatic bridge (quick win): reuse `captures` as an “ingest inbox” and treat external deltas as capture items:
- `captures` table exists: `muse/convex/schema.ts` (“CAPTURES”)

### What “notice it” means (runtime behavior)

- Change arrives (capture/MCP/webhook) → enqueue proactivity job(s).
- Proactivity produces:
  - **Signal**: “Source changed: X; model may be stale”
  - **Draft PR**: “Update node property Y” / “Pin policy decision Z” / “Update doc excerpt”
- User reviews in Inbox (Changes section) and merges as needed.

This preserves the USP: changes are discoverable, reviewable, and cited.

---

## Impact PRs (internal change propagation)

Goal: when a change is accepted inside Muse (a decision/policy pinned, a node updated, a relationship changed), Muse proactively drafts the *follow-up PRs* required to keep the rest of the project coherent.

Example (“Leader X changed” in a company project):
- User (or integration) updates the `leader` property on a `team`/`org` node → accepted PR.
- Proactivity engine runs impact analysis and drafts PRs like:
  - update onboarding doc references
  - update “About/Team” docs or internal SOPs
  - pin/update a policy decision if this affects approvals/ownership

---

## Permissions & visibility (teams)

If you want teams, Pulse/PRs must be permission-scoped by default:

- **Everything is filtered by membership** (project-level access helpers already exist, e.g. `muse/convex/collaboration.ts`).
- **Visibility applies to all artifacts**: documents, nodes, edges, memories, suggestions, signals.
- **Pulse respects scope**: a user sees only signals/PRs they can act on (and cannot infer hidden docs via “ghost” signals).
- **Citations respect scope**: a citation to restricted evidence is either hidden or requires explicit access (never leak excerpt text).

Implementation direction (MLP2):
- Add `visibilityScope` to `knowledgeSuggestions` + `pulseSignals` and validate with the same access helpers used for docs/projects.

---

## Quick wins (MLP2, low risk)

These upgrades increase "proactive feel" without breaking Flow Mode or requiring deep connectors:

- **Inbox with bell badge**: one quiet indicator + a single review surface (no popups).
- **Idle-on-save jobs**: schedule proactivity runs after saves (2–5s debounce), using `ctx.scheduler.runAfter` + a cron backstop (`muse/convex/crons.ts`).
- **Big paste ingestion pipeline**: show progress stages; output signals + PR drafts only.
- **Ingest inbox bridge**: reuse `captures` (`muse/convex/schema.ts`) as a staging area for external deltas (manual, MCP, or webhook-fed).

---

## Coherence System (Pulse foundation)

The **Coherence System** ([COHERENCE_SPEC.md](./COHERENCE_SPEC.md)) provides persona-aware consistency checks that feed into Pulse signals.

### Entry path (from MLP1)

| Step | Deliverable | Notes |
|------|-------------|-------|
| 1 | Widgets MVP1 | [WIDGETS.md](./WIDGETS.md) — pipeline + receipts |
| 2 | Phase 1.5 async jobs | Workpool + notifications inbox |
| 3 | Session vectors + Flow Mode checks | <50ms entity/voice/overuse checks |
| 4 | Inbox (Pulse section) + underlines | Silent signals, expand on exit |

### Coherence check types (writer-first)

| Check | Signal | When |
|-------|--------|------|
| Entity consistency | "Marcus has blue eyes, not brown" | Dialogue/entity mention |
| Voice drift | "15% deviation from character voice" | Per paragraph |
| Overuse | "'however' × 4 in 2 paragraphs" | On pause (~2s) |
| Timeline violation | "Character died in Ch 3 but speaks in Ch 5" | Entity timeline cross-ref |

### Inbox integration

Coherence signals flow into Inbox (Pulse section) as read-only items:

```
Inbox (All view)
├── Pulse section
│   ├── Coherence signals (entity/voice/overuse/timeline)
│   ├── Spec drift signals (MLP2+)
│   └── External change signals (MCP/connectors)
├── Changes section
│   └── Knowledge PR drafts (from proactivity jobs)
├── Activity section
│   └── Background job completions
└── Artifacts section
    └── Stale artifact warnings
```

### Persona expansion (post-writer)

| Phase | Personas | Key Checks |
|-------|----------|------------|
| **2** | Researcher, Creative | Citation accuracy, evidence strength, visual-text |
| **3** | Product, Engineer | Requirement conflicts, API schema drift, ADR links |
| **4** | Marketing, Comms | Claim validation, audience rules, Hub alignment |
| **5** | Support, Sales | KB accuracy, version checks, known issues |

See [COHERENCE_SPEC.md](./COHERENCE_SPEC.md) for full facet schemas and check definitions.

---

## Who to target (MLP1 → MLP2)

MLP1 wedge (best fit):
- **Writers** (web + macOS): Flow Mode, World/Project Graph, governed AI edits, canon decisions with citations.

MLP2 expansion (best fit):
- **Agencies/consulting + product teams (startups → mid-sized)** who suffer from spec/runbook/policy drift and need reviewable “truth updates” more than they need a giant connector catalog.

Defer (costly early):
- **Large enterprise “search with connectors”** as a primary pitch; it’s crowded, policy-risky, and demands heavy security + connector maintenance. Use MCP as evidence/ingest, not the moat.

---

## Craft → Rhei: Proactivity Without Clutter

**Observation:** Craft has Calendar + Tasks built-in. Heavy, but users love the "everything in one place" feel.

**Rhei approach:** Replace explicit task/calendar with **Living Model + Pulse**. Proactivity surfaces what matters without manual tracking.

### How Proactivity Replaces Craft Features by Persona

| Persona | Craft Feature | Rhei Equivalent |
|---------|---------------|-----------------|
| **Writer** | Daily writing goals | Pulse: "3 chapters need review" + Flow Mode streaks |
| **Engineer** | Task lists, deadlines | Pulse: "Spec drift detected" + Knowledge PRs for ADR updates |
| **Product** | Calendar milestones | Pulse: "5 requirements unlinked to specs" + Impact PRs |
| **Comms** | Content calendar | Pulse: "Hub messaging outdated" + PR drafts for refresh |
| **Support** | Ticket tracking | Pulse: "KB article contradicts v2.3 release" |

### Design Principle

```
Craft: User manages calendar + tasks → feels organized
Rhei:  System surfaces what matters → user stays in flow
```

**Key difference:** Rhei is proactive but silent. No calendar to maintain, no tasks to check off. The Living Model tracks state; Pulse surfaces signals; Knowledge PRs propose changes.

---

## Optional bets (post-MLP2)

- **Memgraph/graph DB**: add when multi-hop traversal + impact analysis become primary UX; keep the abstraction so you can start with adjacency tables and cached traversals (see `muse/docs/MLP1_ROADMAP.md`).
- **DOCX tracked-changes export**: make "PR output" shippable (writers + compliance workflows) without rethinking the core system.
- **Connector breadth via MCP**: add Notion/Office/GitHub/SAP as *evidence sources* (delta capture + citations), not as a promise to "index everything".
