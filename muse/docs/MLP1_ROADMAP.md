# MLP 1: AI Co-Author Roadmap

> **Last Updated:** 2026-01-11 (Onboarding flow spec; Landing page → Expo web migration plan; Expo web <> Tauri v2 strategy) | **Target:** Expo Web + macOS first, then iOS/iPad
>
> See also: [Living Memory OS](./MLP1_LIVING_MEMORY_OS.md)
> See also: [MLP2 Proactivity Engine](./MLP2_PROACTIVITY_ENGINE.md)

## Summary

Mythos evolves into a **Project Knowledge System** with an AI co-author layer:
- Role-agnostic templates (Writer is one) for domain specialization
- Auto-extraction of entities, relationships, project context (Project Graph)
- Writer style adaptation via embeddings
- Real-time feedback (show-don't-tell, dialogue, tension)
- Tool-based workspace manipulation
- Thread persistence with full context
- Offline-first + real-time sync (Figma model)
- **Focus Mode** — distraction-free writing, AI silent unless invoked
- **Sortiermaschine** — auto-organize entities, relationships, project context (Project Graph)

## Templates (Project Knowledge System)

- Templates define default registry types, document kinds, and capability sets.
- Registry overrides remain per-project (template provides the base; projects can diverge).
- No schema churn required: types, properties, and metadata are validated against the resolved registry.

## Supabase → Convex Migration (MLP1)

All Supabase → Convex migration work is complete.
Reference: `../DB_MIGRATION_REPORT.md`.


### Recent Updates (2026-01-11)

- AI-generated Project Graph templates (no standard template list); registry resolution keyed by `project.templateId`.
- Projects/documents now support `templateId`, `metadata`, and `settings` (template IDs reference AI-generated templates); org/team schema scaffolding added for enterprise access control.
- Project Graph approvals now driven by registry `riskLevel` + per-type identity fields (legacy writer fields still optional).
- AI task routing expanded with `review`/`generation` plus product/engineering/design/comms task slugs; `coach`/`creative` aliased.
- UI updates: registry lock/unlock controls added in settings; entity create/edit now supports schema-driven properties.
- UI gaps: no AI template generation flow yet, no org/team management UI, no registry editor UI; Project Graph filters are registry-driven but template icon/color coverage is incomplete for non-writer templates; schema-driven property/relationship metadata editors are still missing; universal entity profile page (overview/graph/mentions/documents/history) not yet implemented.
- Phase 3 MCP Citations Integration: citations schema added to mutating tools; memories/citations resources discoverable via `saga://projects/{id}/memories` and `saga://projects/{id}/citations`; proposal-first routing for governed tool calls (`muse/packages/mcp-server/src/tools.ts`, `muse/packages/mcp-server/src/resources.ts`, `muse/packages/mcp-server/src/index.ts`).
- Phase 4 Clarity/Policy Coach fully implemented (see 2026-01-10 notes for details).

### Recent Updates (2026-01-10)

- Phase 1: Project Graph (`projectTypeRegistry` + `create_node`/`update_node`/`create_edge`/`update_edge` + registry-aware approvals) (`muse/convex/projectTypeRegistry.ts`, `muse/convex/lib/typeRegistry.ts`, `muse/convex/ai/tools/projectGraphTools.ts`, `muse/convex/ai/tools/projectGraphHandlers.ts`, `muse/convex/ai/agentRuntime.ts`)
- Phase 2: Knowledge PRs (`knowledgeSuggestions` + `suggestionId` in streams + tool-result resolution) (`muse/convex/knowledgeSuggestions.ts`, `muse/convex/schema.ts`, `muse/convex/ai/agentRuntime.ts`)
  - Expo Web UI: “Changes to review” panel (open via editor More menu → “Version history” and Cmd+K) (`muse/apps/expo/src/components/knowledge/*`, `muse/packages/editor-webview/src/components/EditorShell.tsx`, `muse/packages/commands/src/definitions/navigation.ts`)
- Phase 3: Integrations (MCP)
  - Expanded MCP tool surface + project defaults (`SAGA_PROJECT_ID`) for external clients (`muse/packages/mcp-server/src/index.ts`, `muse/packages/mcp-server/src/tools.ts`)
  - Added `commit_decision` + image tooling to MCP (`search_images`, `find_similar_images`, `analyze_image`, `create_entity_from_image`, `illustrate_scene`) (`muse/packages/mcp-server/src/tools.ts`)
- Phase 3: Canon Promotion + Citations
  - Contradiction resolution now promotes user choices into pinned canon memories (`commit_decision`) (`muse/convex/ai/tools.ts`, `muse/convex/ai/canon.ts`)
  - Linter consumes pinned canon decisions and emits `canonCitations` for jump-to-canon UX (`muse/convex/ai/lint.ts`, `muse/convex/ai/prompts/linter.ts`, `muse/apps/web/src/components/modals/ConsistencyChoiceModal.tsx`)
- Phase 4: Clarity/Policy Coach ✅
  - Coach mode selector (Writing / Clarity / Policy) with mode-aware UI rendering (`muse/apps/web/src/components/console/CoachView.tsx`)
  - Clarity check prompt with readability metrics + issue taxonomy (`muse/convex/ai/prompts/clarity.ts`, `muse/convex/ai/tools.ts`)
  - Policy check prompt with conflict/unverifiable/not-testable/gap taxonomy (`muse/convex/ai/prompts/policy.ts`, `muse/convex/ai/tools.ts`)
  - Writing coach now fetches pinned canon (decisions + policies) for canon-aware analysis (`muse/convex/ai/coach.ts`, `muse/convex/ai/prompts/coach.ts`)
  - Two-step approval modal for pinning policies (`muse/apps/web/src/components/modals/PinPolicyModal.tsx`)
  - Analysis store extended with coachMode, policyIssues, policyCompliance, policySummary state (`muse/apps/web/src/stores/analysis.ts`)
  - Expo Quick Actions: added `clarity_check` and `policy_check` actions (`muse/packages/state/src/ai.ts`, `muse/apps/expo/src/components/ai/QuickActions.tsx`, `muse/apps/expo/src/components/ai/AIPanel.tsx`)
  - **UI Polish (2026-01-11):**
    - Mode-aware analysis hook: `useContentAnalysis` accepts `mode` param, runs correct backend tool per mode (`muse/apps/web/src/hooks/useContentAnalysis.ts`)
    - `executePolicyCheck` added to agent runtime client (`muse/apps/web/src/services/ai/agentRuntimeClient.ts`)
    - `PolicyCheckArgs`/`PolicyCheckResult` types added to agent-protocol (`muse/packages/agent-protocol/src/tools.ts`)
    - Policy issue types added to `StyleIssueType` + `canonCitations` to `StyleIssue` (`muse/packages/core/src/analysis/types.ts`)
    - Mode-specific issue filtering in `StyleIssuesList` with mode-appropriate empty states
    - Canon citation navigation (jump-to-canon) for policy issues with `onJumpToCanon` callback
    - E2E test IDs per contract: `coach-issue-*`, `clarity-issue-*`, `policy-issue-*`, `coach-apply-fix-*`, `coach-pin-policy-*`, `coach-jump-canon-*`

### UI Integration (Design Checklist)

**Phase 1: Project Graph**
- Project settings: type registry editor (`projectTypeRegistry`) for entity/relationship types, risk levels, and optional JSON schema.
- Graph UI: generic node/edge create/edit that supports `type: string` + `properties`, with schema-driven forms when available. (Entity form done; relationship metadata editor pending.)
- Approvals UX: surface risk level + approval requirement at the point of change.
- Universal entity profile page: overview + graph + mentions + documents + history (spec in `docs/UNIVERSAL_ENTITY_PROFILE.md`).

### Phase 1: Project Graph UX (Expo Web + Tauri v2) — Implementation Plan

**Goal:** Editable Project Graph with registry-enforced validation and risk-aware approvals, running in Expo Web and shipped via Tauri v2.

#### Graph UX (CRUD)
- [ ] Add “Open Project Graph” secondary UI path in editor (`data-testid="editor-open-project-graph"`)
- [ ] Graph: create entity (button/FAB → EntityFormModal)
- [ ] Graph: create relationship (connect nodes → RelationshipFormModal)
- [ ] Graph: edit relationship (edge click → RelationshipFormModal)
- [ ] (Optional but recommended) Graph: delete entity/relationship with confirmation

#### Schema-driven editors
- [ ] Extract reusable JSON Schema object editor component (supports enum, string, number/int, boolean, array<string>, raw JSON fallback)
- [ ] Relationship metadata editor (schema-driven + raw JSON fallback)

#### Registry-driven UI (template-safe)
- [ ] EntityFormModal type selector driven by resolved registry (not WRITER_ENTITY_TYPES)
- [ ] Fill icon/color defaults for non-writer templates (product/engineering/design/comms)
- [ ] Add relationship filters and “focus mode” (depth-based neighborhood)

#### Validation + error contract
- [ ] Ensure entity/relationship mutations validate type + schema (AJV reject-only) and return Graph API error codes
- [ ] Client-side Convex error parser that surfaces `INVALID_TYPE`, `SCHEMA_VALIDATION_FAILED`, `REGISTRY_LOCKED`, etc.

#### Approvals (AI graph writes)
- [ ] Persist approval preview payloads for create/update entity/relationship tool calls
- [ ] Approvals UI supports entity/relationship diffs + risk rationale + approve/reject
- [ ] Applying an approval executes the tool, updates graph state, and logs activity

#### Expo Web + Tauri v2 integration
- [ ] Port or package Project Graph for Expo Web (web-only dependency surface)
- [ ] Make ELK layout + ReactFlow styling compatible with Expo Web bundling
- [ ] Tauri v2 shell points to Expo Web (`build.devUrl`, `build.frontendDist`, beforeDev/beforeBuild commands)

#### E2E testability
- [ ] Add missing `data-testid` coverage for: entity modal, relationship modal, registry editor, approvals panel, create/delete actions

**Phase 2: Knowledge PRs**
- Knowledge PRs inbox: unified review queue across `document`/`entity`/`relationship`/`memory` with filters + batch actions (label: “Changes to review”; opened from editor “Version history” menu item).
- Diff/preview: document diff + property/edge diff + JSON Patch view for opaque operations.
- History/rollback: revision timeline for accepted suggestions across graph + memory, with provenance links.

**Phase 3: Integrations + Citations (MCP)**
- Integrations settings: connect/disconnect, scopes, status, and audit for external sources.
- Evidence viewer: show source documents/excerpts and canon citation metadata; deep-link from lint/coach issues.
- Promote-to-model: promote evidence into the Living Model by creating a Knowledge PR with attached citations.

**Phase 4: Clarity/Policy Coach**
- Coach mode selector (Writing / Clarity / Policy) with taxonomy-aware labels.
- Issue UI: ambiguity/unverifiable/not-testable/policy-conflict categories while preserving the same “issue + suggested fix” structure.

### Phase 2: Knowledge PRs - Remaining Tasks (Production Hardening)

Goal: make Knowledge PRs a production-grade review surface: every PR is actionable, diffs are readable, approvals are safe, rollbacks are reliable, and provenance is navigable.

#### P0 - Production blockers (ship before beta)

1) ✅ Document PRs must be actionable (fix write_content approval UX)
   - ✅ Expo: "Open in editor" button replaces disabled Approve; navigates with `pendingWriteContent` state
   - ✅ Web: "Open in editor" button in KnowledgePRsView (was already present)
   - ✅ Backend: `resolveWriteContentFromEditor` action marks suggestion resolved + creates revision
   - ✅ EditorShell: `pendingWriteContent` prop applies content + calls `onWriteContentApplied`
   - ✅ Layout store: `PendingWriteContent` type + `setPendingWriteContent`/`clearPendingWriteContent`

2) ✅ Server-side preflight validation + conflict detection (block unsafe approvals)
   - ✅ `preflightSuggestion` validates tool args, registry constraints, target resolution
   - ✅ Preflight persisted on suggestion; UI blocks Approve when status is `invalid`/`conflict`
   - ✅ Fingerprint-based conflict detection for entity/relationship updates
   - ✅ `rerunPreflight` mutation for manual recheck without applying
   - ✅ "Rebase required" callout + "Recheck" button in both Expo + Web UIs

3) ✅ Rollback hardening + explicit rolled-back state + audit events
   - ✅ Idempotency guard (returns `alreadyRolledBack: true` on duplicate calls)
   - ✅ Explicit `rolledBackAt`, `rolledBackByUserId`, `resolution="rolled_back"` fields
   - ✅ Activity events emitted on rollback success/failure
   - ✅ After snapshots stored at apply-time for updates
   - ✅ `getRollbackImpact` query shows cascade warnings (relationships affected)
   - ✅ `cascadeRelationships` param required for entity.create rollback with relationships
   - ❌ UI confirmation modal not yet implemented

4) ⏳ Inbox scalability: server-side filters + pagination
   - ✅ Backend `listByProject` supports cursor, status, targetType, riskLevel, toolName filters
   - ✅ Indexes added for efficient filtering
   - ❌ UIs still use `limit=200`; need cursor-based paging implementation

#### P1 - Important (post-beta)

5) Web parity for graph diffs (entity + relationship + metadata)
   - Expo has field-by-field diffs; port to KnowledgePRsView.tsx

6) JSON Patch visualization for normalizedPatch
   - Add `JsonPatchView` component for opaque operations

7) Provenance + citations deep-links
   - Add "Copy provenance" on Web; "Open memory" navigation in Expo
   - Expo already shows provenance IDs; need actionable links

8) Inbox UX upgrades (filters, shortcuts, batch actions)
   - Add target-type filter chips to UI
   - Keyboard shortcuts for approve/reject
   - Web batch selection (Expo already supports)

#### P2 - Nice-to-have / strategic cleanup

9) Unify documentSuggestions vs knowledgeSuggestions
   - Either migrate or build unified query/feed

10) Late-apply anchoring for write_content
   - Richer selection anchors or fuzzy matching for deferred apply

### Recent Updates (2026-01-11)

**Knowledge PRs Production Hardening:**
- Backend: `rerunPreflight` mutation, `getRollbackImpact` query, `cascadeRelationships` rollback param
- Expo: "Open in editor" for write_content, "Rebase required" + "Recheck" button, editor resolve path
- Web: "Rebase required" + "Recheck" button for preflight conflicts
- Packages: `PendingWriteContent` state in @mythos/state, `pendingWriteContent` props in EditorShell
- Typecheck fixes: style-decoration.ts, knowledgeSuggestions.ts, auth.ts

### Recent Updates (2026-01-09)

**P1 Performance Stabilization:**
- Cursor presence throttling + focus gating to reduce write amplification
- AI presence keepalive during long-running streaming responses
- Embedding job deduplication to prevent redundant queue churn

**E2E Coverage (04–08):**
- Deterministic Convex E2E harness (fixtures + saga scripts + embeddings)
- Playwright specs for Project Graph, AI streaming, RAG, collaboration, and billing

**Writer Tools (from user feedback):**
- Focus Mode with Zen UI, timers, word goals, brainstorm prompts
- Grammar/Style via DeepL API (German) + LLM fallback
- Name generator with culture/style matching
- Logic validation (optional, background, configurable)
- Exa web search for research/fact-checking

---

## Writer Feedback Insights

> Source: German writing Discord (2026-01-09)

### What Writers Want

| Need | Mythos Feature | Status |
|------|----------------|--------|
| "Sortiermaschine" (auto-organize) | Project Graph + entity detection | ✅ Have |
| Grammar without changing meaning | DeepL API + approval-based | 🔲 P2 |
| Name lists | Name generator tool | 🔲 P2 |
| Logic checks (biology, math) | Validation tool (optional) | 🔲 P2 |
| Master document / artbook | Project = book, entities = artbook | ✅ Have |
| Idea collection WITHOUT judgment | Focus Mode (AI silent) | 🔲 P1 |
| Physical notebook feel | Simple UI, offline-first | ✅ Have |

### What Writers DON'T Want

| Anti-pattern | Our Approach |
|--------------|--------------|
| AI plotting without permission | Approval-based suggestions only |
| AI evaluating/judging ideas | Focus Mode = no AI unless asked |
| Changing meaning of text | DeepL preserves intent; approval required |
| Constant interruptions | Proactive features are opt-in, background |

### Onboarding Flow (First-Run)

> **Implementation order:** Flow Mode (Zustand) → review → integrate into Onboarding
> **Full spec:** `~/.claude/plans/serene-doodling-dolphin.md` (Phase 0)

**Trigger:** First app use

**Steps:**
1. **Welcome** - "Let's set up your writing environment"
2. **Flow Mode** - "Focus Mode" (distraction-free) vs "Full View" (all panels)
3. **Focus Level** (if Flow Mode) - Sentence / Paragraph / No dimming
4. **Typewriter Scrolling** - Keep cursor centered on/off
5. **AI & Notifications** - Quiet / Gentle Nudges / Always Available
6. **Confirmation** - Summary + "Change anytime in Settings"

**State (Zustand):**
```typescript
// packages/state/src/onboarding.ts
interface OnboardingState {
  completed: boolean;
  currentStep: number;
  selections: {
    flowModeDefault: boolean;
    focusLevel: "none" | "sentence" | "paragraph";
    typewriterScrolling: boolean;
    notificationMode: "quiet" | "gentle" | "always";
  };
  completeOnboarding: () => void;
  skipOnboarding: () => void;
}
```

**Components:** `apps/web/src/components/onboarding/` (OnboardingModal, step components, preview)

**Persistence:** localStorage for `completed`, preferences written to `flow` store

### Export/Import System (Centralize to `@mythos/io`)

> **Status:** Built in `apps/web/src/services/`, needs centralization for Tauri/Expo reuse

#### Current Implementation

```
apps/web/src/services/
├── export/
│   ├── index.ts              # exportStory() orchestrator
│   ├── types.ts              # ExportOptions, ExportFormat
│   ├── ir.ts                 # Intermediate representation
│   ├── storyTree.ts          # Document tree ordering
│   ├── formats/              # docx, epub, markdown, pdf renderers
│   ├── tiptap/               # TipTap JSON → IR conversion
│   └── glossary/             # Entity glossary generation
├── import/
│   ├── index.ts              # importStory() orchestrator
│   ├── types.ts              # ImportOptions, ImportFormat
│   ├── parsers/              # docx, epub, markdown, plaintext
│   └── tiptap/               # IR → TipTap JSON conversion
```

#### Supported Formats

| Format | Export | Import |
|--------|--------|--------|
| Markdown | ✅ | ✅ |
| DOCX | ✅ | ✅ |
| PDF | ✅ | ❌ |
| EPUB | ✅ | ✅ |
| Plain text | ❌ | ✅ |

#### Migration Plan: `@mythos/io` Package

| Step | Task | Priority |
|------|------|----------|
| 1 | Create `packages/io/` with package.json | P2 |
| 2 | Move export/ and import/ from apps/web | P2 |
| 3 | Platform-aware `download.ts` (web vs Tauri dialog) | P2 |
| 4 | Platform-aware `fileReader.ts` (web vs Tauri fs) | P2 |
| 5 | Update apps/web imports to `@mythos/io` | P2 |
| 6 | Wire up in Tauri + Expo | P2 |

#### Platform Adaptation

```typescript
// packages/io/src/utils/download.ts
import { platform } from '@mythos/platform';

export async function downloadBlob(blob: Blob, fileName: string) {
  if (platform.is('tauri')) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({ defaultPath: fileName });
    if (path) await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  } else {
    // Web browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

### Gaps & Considerations

| Gap | Risk | Mitigation |
|-----|------|------------|
| **Export formats** | ✅ Have DOCX, PDF, ePub, Markdown | Centralize to @mythos/io |
| **Print formatting** | Manuscript formatting matters | P3: Page layout options |
| **Backup/sync visibility** | "Is my work saved?" anxiety | Show sync status clearly |
| **Mobile writing** | iPad is popular with writers | Expo iOS after web stable |
| **Dictation/voice** | Some writers dictate | P3: Whisper integration |
| **Reading mode** | Review without editing | Simple toggle, hide toolbars |
| **Dark mode** | Essential for long sessions | ✅ Have (theme system) |
| **Font choices** | Writers have preferences | P2: Custom fonts in editor |
| **Word count goals** | Daily/weekly/project targets | Part of Focus Mode |
| **Distraction sounds** | Typewriter clicks, ambient | P3: Optional audio feedback |

### Not Considered Yet

| Feature | Why It Might Matter |
|---------|---------------------|
| **Beta readers integration** | Share drafts, collect feedback |
| **Submission tracking** | Query letters, agent responses |
| **Writing group features** | Beyond collaboration — critique circles |
| **Dictation transcription** | Voice → text workflow |
| **Research clipping** | Web clipper for sources |
| **Outline/beat sheet views** | Visual story structure |
| **Character relationship map** | Visual Project Graph |
| **Timeline visualization** | Visual chapter/event ordering |

---

## Progress Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE                              STATUS           PROGRESS        │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Editor WebView Bundle           Complete         [██████████] ✅ │
│ 2. Convex Agent Integration        Complete         [██████████] ✅ │
│ 3. Platform Integration            In Progress      [████████░░] 80%│
│    └─ Shared Packages              Complete         [██████████] ✅ │
│    └─ Web                          Complete         [██████████] ✅ │
│    └─ macOS (Tauri)                Scaffold Done    [████████░░] ✅ │
│    └─ Expo (iOS/iPad)              Partial          [██████░░░░]    │
│ 4. RAG Pipeline                    Complete         [██████████] ✅ │
│ 5. Skills + Writer Tools           Planned          [██░░░░░░░░] 20%│
├─────────────────────────────────────────────────────────────────────┤
│ 6. Auth (Better Auth)              Complete         [██████████] ✅ │
│ 7. Billing (RevenueCat)            Complete         [██████████] ✅ │
│ 8. Observability (PostHog+Clarity) Complete         [██████████] ✅ │
│ 9. Rate Limiting                   Complete         [██████████] ✅ │
│10. Tier Config Migration           Complete         [██████████] ✅ │
│11. Supabase → Convex Migration     In Progress      [█████████░] 90%│
│12. CI/CD (GitHub Actions)          Complete         [██████████] ✅ │
│13. Real-Time Collaboration         Track A Done     [████████░░] 80%│
├─────────────────────────────────────────────────────────────────────┤
│ OVERALL MLP 1                                       [█████████░] 95%│
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
                   ✅ P6 (Auth)         ✅ P8 (Observability)
                        │
                   ✅ P7 (Billing)
```

---

## Architecture

### Stack

| Layer | Tech | Endpoint |
|-------|------|----------|
| **Database** | Convex (self-hosted) | `convex.cascada.vision:3220` |
| **Vectors** | Qdrant (self-hosted) | `qdrant.cascada.vision:6333` |
| **Auth** | Better Auth (Convex local) | `convex/betterAuth/` |
| **Billing** | RevenueCat | Webhook → Convex |
| **Agent** | @convex-dev/agent | `convex/ai/` |
| **Embeddings** | DeepInfra Qwen3-8B | $0.01/1M tokens |
| **Reranker** | DeepInfra Qwen3-4B | HTTP API |
| **Analytics** | PostHog + Clarity | Self-hosted or Cloud |

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
│   Expo Web       │     macOS        │     iOS / iPad               │
│  (Metro bundler) │  (Tauri v2)      │    (Expo RN)                 │
│                  │                  │                              │
│  Landing + App   │   Expo Web host  │   react-native-webview       │
│   PRIMARY ✅     │   PRIORITY 2     │   PRIORITY 3                 │
└──────────────────┴──────────────────┴──────────────────────────────┘
```

| Platform | Status | Bundle Size | Notes |
|----------|--------|-------------|-------|
| **Expo Web** | ✅ Primary | N/A | Landing + App unified |
| **macOS** | 🔲 Next | ~5MB | Tauri v2 hosts Expo Web |
| **iOS/iPad** | 🔲 Later | ~10MB | Expo + WebView |

---

### Landing Page Migration (Vite → Expo Web)

> **Goal:** Unify landing page + auth into Expo web for Tauri v2 embedding

**Current State:**
```
apps/website/         # Vite landing (port 3001) → DELETE after migration
  src/pages/LandingPage.tsx

apps/web/             # Vite main app (port 3005) → imports from @mythos/website
  src/App.tsx         # Routes to LandingPage for unauthenticated users

apps/expo/            # Expo universal app (port 19006)
  app/(auth)/         # sign-in.tsx, sign-up.tsx
```

**Target State:**
```
apps/expo/            # Single web entry point (port 19006)
  app/
    (marketing)/      # Public routes (no auth required)
      _layout.tsx     # Marketing layout (no app chrome)
      index.tsx       # Landing page (ported from @mythos/website)
      pricing.tsx     # Pricing page
      docs.tsx        # Docs placeholder
    (auth)/           # Auth screens (existing)
      sign-in.tsx
      sign-up.tsx
    (app)/            # Authenticated app routes (existing)
      ...

apps/tauri/           # Tauri v2 shell
  src-tauri/
    tauri.conf.json   # devUrl → expo web :19006, frontendDist → expo export
```

**Migration Steps:**

| Step | Task | Priority |
|------|------|----------|
| 1 | Create `(marketing)/_layout.tsx` with minimal chrome | P1 |
| 2 | Port `LandingPage.tsx` to `(marketing)/index.tsx` | P1 |
| 3 | Port pricing/docs routes | P1 |
| 4 | Update Tauri devUrl to `:19006` (Expo web) | P1 |
| 5 | Update Tauri frontendDist to Expo export output | P1 |
| 6 | Delete `apps/website/` after verification | P2 |
| 7 | Update `apps/web/` to redirect to Expo web or deprecate | P2 |

**Expo Web + Tauri v2 Integration:**
```typescript
// apps/tauri/src-tauri/tauri.conf.json
{
  "build": {
    "devUrl": "http://localhost:19006",
    "frontendDist": "../expo-export/dist"
  },
  "app": {
    "withGlobalTauri": true
  }
}
```

**Auth Flow (Expo Web in Tauri):**
- Expo web uses `crossDomainClient` (same as current)
- Tauri deep links for OAuth callbacks: `mythos://auth/callback`
- Session persisted via `tauri-plugin-store`

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
│   ├── agentRuntime.ts              # Agent loop + dynamic approval
│   ├── threads.ts                   # Thread persistence
│   ├── streams.ts                   # SSE streaming
│   ├── rag.ts                       # Hybrid + RRF + rerank
│   ├── lexical.ts                   # Full-text search
│   ├── embeddings.ts                # Outbox + cron
│   ├── detect.ts                    # Entity detection
│   ├── lint.ts                      # Consistency linting ✅ NEW
│   ├── coach.ts                     # Writing coach ✅ NEW
│   ├── dynamics.ts                  # Character interactions ✅ NEW
│   ├── style.ts                     # Style learning ✅ NEW
│   ├── image.ts                     # Image generation ✅ NEW
│   ├── prompts/                     # AI system prompts ✅ NEW
│   │   ├── linter.ts                # Consistency analysis
│   │   ├── coach.ts                 # Writing feedback
│   │   └── dynamics.ts              # Interaction extraction
│   └── tools/
│       ├── editorTools.ts           # ask_question, write_content
│       ├── ragTools.ts              # search_context, get_entity
│       ├── ragHandlers.ts           # RAG server handlers
│       ├── projectGraphTools.ts       # Entity/relationship CRUD ✅ NEW
│       ├── projectGraphHandlers.ts    # Project graph handlers ✅ NEW
│       └── index.ts                 # Tool exports
├── lib/
│   ├── qdrant.ts                    # REST client
│   ├── rerank.ts                    # Qwen3-Reranker
│   ├── deepinfraEmbedding.ts        # Embedding model
│   ├── tierConfig.ts                # Tier limits + features
│   ├── aiModels.ts                  # Tier-aware model selection ✅ NEW
│   ├── approvalConfig.ts            # Dynamic approval rules
│   └── imageProviders.ts            # Image tier config ✅ NEW
└── crons.ts                         # 30s embedding sync
```

### Phase 3: Platform Integration (60%)

**Shared Packages** (✅ Centralized):
- `@mythos/state` - Zustand stores (AI, workspace, layout, command palette)
- `@mythos/commands` - Command registry and definitions
- `@mythos/analytics` - Typed event definitions
- `@mythos/theme` - Design tokens (colors, typography, spacing, shadows)
- `@mythos/manifest` - Project tree logic (chapters, entities, memories)

**Apps:**
- `apps/expo/` - Universal app (web, iOS, macOS) - imports from shared packages
- `apps/tauri/` - macOS desktop - scaffold complete, ready for shared packages

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

### Phase 5: Skills + Writer Tools (10%)

```
convex/ai/skills/                    # 🔲 ALL PENDING
├── index.ts                         # Tool exports
├── plan.ts                          # plan_story
├── world.ts                         # build_world
├── character.ts                     # develop_character
├── research.ts                      # research_facts (Exa)
└── analyze.ts                       # analyze_writing

convex/ai/tools/
├── creativeTools.ts                 # 🔲 Name generator, brainstorm prompts
├── validationTools.ts               # 🔲 Logic checker, timeline validator
└── researchTools.ts                 # 🔲 Exa web search integration
```

#### Focus Mode (Distraction-Free Writing) ✅ P1

> *"Ideen sammeln ohne das ein Computer diese bewertet"* — Writer feedback

| Component | Description | Platform | Status |
|-----------|-------------|----------|--------|
| **Zen UI** | Full-screen overlay, vignette effect, minimal header | Expo web + Tauri | ✅ Done |
| **Timer modes** | Pomodoro (25/5), Sprint (15min), Custom with work/break phases | Expo web + Tauri | ✅ Done |
| **Word goals** | Session word count with goal progress bar | Expo web + Tauri | ✅ Done |
| **Focus levels** | Sentence/paragraph/none toggle (UI ready, editor extension pending) | Expo web + Tauri | 🔲 Phase 2 |
| **Typewriter scrolling** | Keep cursor vertically centered | Expo web + Tauri | 🔲 Phase 2 |
| **Session stats** | Words written, time focused, WPM, pomodoros completed | Expo web + Tauri | ✅ Done |
| **Summary modal** | Stats + encouragement on exit | Expo web + Tauri | ✅ Done |
| **"What If" cards** | Random prompts: "What if the villain is right?", "What if they fail?" | Expo web → Tauri | 🔲 Phase 2 |
| **Technique prompts** | "Describe using only sounds", "Write the opposite emotion" | Expo web → Tauri | 🔲 Phase 2 |
| **Notification queue** | AI insights queued during flow, shown on exit | Expo web + Tauri | 🔲 Phase 2 |
| **Breakthrough alerts** | Subtle corner pulse for critical notifications | Expo web + Tauri | 🔲 Phase 2 |

**Keyboard shortcuts:**
- `⌘⇧Enter` — Toggle Flow Mode
- `Escape` — Exit Flow Mode (shows summary)

**Implementation (2026-01-11):**
- Store: `@mythos/state/flow.ts` — Flow store with timer, session, preferences
- Expo: `apps/expo/src/components/flow/` — FlowOverlay, FlowHeader, FlowToggleButton, FlowSummaryModal
- Tauri: `apps/web/src/components/flow/` — Same components adapted for web
- CSS: `packages/ui/src/styles/globals.css` — Flow animations and styling
- Shortcuts: Added to `useGlobalShortcuts.ts` (web) and `useKeyboardShortcuts.ts` (expo)

**Key principle:** AI stays completely silent unless explicitly invoked. No suggestions, no analysis, no interruptions.

**Phase 2 enhancements (to make it better than Notion's focus mode):**
- Editor integration: ProseMirror plugin for real sentence/paragraph dimming
- Typewriter scroll extension for cursor centering
- "What If" and technique prompt cards for brainstorming
- Notification queue with breakthrough alerts for time-sensitive items
- Daily/weekly streak tracking with PostHog integration

#### Grammar & Style Polish 🔲 P2

| Option | Pros | Decision |
|--------|------|----------|
| **DeepL Write API** | Excellent German, 500k chars/month free | ✅ Primary for German users |
| **LLM (existing)** | Multi-language, context-aware, style suggestions | ✅ Fallback + advanced style |
| **Harper** | Fast local, Apache-2.0 | ⚠️ Reference for highlight UX only (English-only, German too hard) |

**Highlight UX (Harper-style):**
- Underline squiggles for issues (red = error, yellow = suggestion)
- Hover tooltip with explanation + fix options
- Right-click context menu: "Fix", "Ignore", "Add to dictionary"
- Batch "Fix all" for repeated issues

**Integration:**
```
User writes → Idle 2s → DeepL/LLM check (background)
                              ↓
                    Highlight issues in editor
                              ↓
                    User clicks → Apply fix or dismiss
```

#### Name Generator Tool 🔲 P2

```typescript
// convex/ai/tools/creativeTools.ts
generateNames({
  type: "character" | "location" | "item" | "faction",
  culture: "Germanic" | "Japanese" | "Fantasy" | "Sci-Fi" | ...,
  count: 10,
  constraints: "starts with K" | "two syllables" | ...
}) → string[]
```

Uses project's existing entities + world style for consistency.

#### Logic Validation Tool 🔲 P2

| Feature | Description | Configurable |
|---------|-------------|--------------|
| **Timeline checker** | "Day 3 can't be before Day 1" | ✅ On/off in settings |
| **Math execution** | LLM writes Python → sandboxed eval → result | ✅ On/off |
| **Biology/physics** | "Humans can't survive 30 days without water" | ✅ On/off |
| **World rules** | Validate against user-defined magic system rules | ✅ On/off |

**Proactive validation behavior:**
- **NOT blocking** — runs in background after idle
- **NOT immediate** — batched every few minutes or on document save
- **User controls** — configurable in onboarding + settings:
  - "Check my logic as I write" (background, non-blocking)
  - "Only check when I ask" (manual trigger)
  - "Never check logic" (full creative freedom)

**Configured via onboarding** (see Onboarding Flow section)

#### Exa Web Search 🔲 P2

```typescript
// convex/ai/tools/researchTools.ts
webSearch({
  query: "Victorian era clothing for nobility",
  type: "historical" | "scientific" | "general"
}) → { title, url, excerpt }[]
```

- Cost: ~$0.001/search
- Use cases: historical accuracy, research, fact-checking
- Integrated as agent tool: "Is this historically accurate?" → triggers search

---

## Migration: Supabase → Convex

### Tables to KEEP in Supabase (Optional)

| Table | Reason |
|-------|--------|
| `activity_log` | High-volume append-only |
| `ai_request_logs` | Analytics (or migrate to PostHog) |

### AI Endpoints Migration

| Current Endpoint | Target | Status |
|------------------|--------|--------|
| `ai-chat` | `convex/ai/agentRuntime.ts` | ✅ Done |
| `ai-agent` | `@convex-dev/agent` | ✅ Done |
| `ai-detect` | `convex/ai/detect.ts` | ✅ Done |
| `ai-embed` | `convex/ai/embeddings.ts` | ✅ Done |
| `ai-search` | `convex/ai/rag.ts` | ✅ Done |
| `ai-lint` | `convex/ai/lint.ts` | ✅ Done |
| `ai-coach` | `convex/ai/coach.ts` | ✅ Done |
| `ai-dynamics` | `convex/ai/dynamics.ts` | ✅ Done |
| `ai-genesis` | `convex/ai/genesis.ts` | 🔲 P2 |
| `ai-learn-style` | `convex/ai/style.ts` | ✅ Done |
| `ai-image*` | `convex/ai/image.ts` | ✅ Done |

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
  desiredContentHash: v.optional(v.string()),
  processedContentHash: v.optional(v.string()),
  dirty: v.optional(v.boolean()),
  processingRunId: v.optional(v.string()),
  processingStartedAt: v.optional(v.number()),
  nextRunAt: v.optional(v.number()),
  failedAt: v.optional(v.number()),
  queuedAt: v.optional(v.number()),
  updatedAt: v.number(),
  createdAt: v.number(),
})
```

### Retry Logic

- Max 5 retries: 30s, 1m, 2m, 4m, 8m (exponential backoff)
- `nextRunAt` gates debounce + retry backoff
- Processing lease requeues stuck jobs (stale processing recovery)
- After 5 failures: status = `failed`, requires manual retry

### Vector Delete Outbox

- Server-side deletes enqueue `vectorDeleteJobs` for documents/entities
- Jobs are reclaimed if they remain `processing` past the lease window

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
| **Project Type Registry** | Project settings UI for `projectTypeRegistry` (types, risk levels, optional JSON schema) |
| **Knowledge PRs Inbox** | Unified review queue for `knowledgeSuggestions` across graph/memory/docs with batch actions |
| **Diff/Preview** | Document diff + graph/memory patch preview (incl. JSON Patch / property diffs) |
| **Integrations (MCP)** | Connection management (scopes, status, audit) and MCP tool transparency |
| **Graph/Memory History** | Revision timeline + rollback UX for entities/relationships/memories |
| **Coach Modes** | Writing / Clarity / Policy mode selector and taxonomy-aware issue UI |

---

## Remaining Work

### MLP1 Ship Checklist (Writer-First)

| Task | Status | Notes |
|------|--------|-------|
| Focus Mode MVP (AI silent unless invoked) | ✅ | Zen UI, timer, word goals, session stats (2026-01-11) |
| Focus sessions (timer + word goals) | ✅ | Pomodoro/sprint/custom, session stats, summary modal (2026-01-11) |
| Living Model UI entry points | ✅ | Cmd+K “Changes to review” + editor More menu (“Version history”) opens review panel; home entry point TBD |
| Knowledge PRs review UX (polish) | ✅ (MVP, not production-ready) | Approve/reject + batch actions + provenance + undo (graph/memory); document apply remains editor UI |
| Project Graph editor UX | 🔲 | Create/edit nodes/edges; registry-aware type picker + properties editor |
| Lint → “jump to canon” UX | 🔲 | Canon citations link to Decision Ledger items |
| Clarity/Policy Coach UX | ✅ | Mode selector + taxonomy-aware issues + two-step pin approval modal |
| E2E coverage for new surfaces | 🔲 | Stable `data-testid` hooks per `muse/docs/E2E_TESTABILITY_CONTRACT.md` |

### P1: Living Model UI (Design)

| Task | Status | Notes |
|------|--------|-------|
| Project Type Registry screen | 🔲 | Manage types, risk levels, optional JSON schema; drives create/edit and approvals |
| Project Graph editor UX | 🔲 | Node/edge create/edit for `type` + `properties` (schema-driven when available) |
| Knowledge PRs inbox UX | ✅ (MVP, not production-ready) | Expo Web right-panel (“Changes to review”) + web console view; filters, selection, batch approve/reject |
| Knowledge PR diff/preview components | ✅ (MVP, not production-ready) | Entity/relationship diffs + memory preview + raw + normalized JSON Patch; write_content diff (selection/context excerpt) |
| Knowledge history + rollback UX | ✅ (MVP, not production-ready) | Undo supported for accepted suggestions with rollback metadata (graph/memory) |
| Integrations settings UX | 🔲 | Connections, scopes, status, and audit trail for external sources |
| Evidence + citations UX | 🔲 | Knowledge PR detail shows citations (Expo + web console); jump-to-canon from lint/coach still missing |
| Promote-to-model flow UX | 🔲 | From evidence/context inspector → create Knowledge PR with citations |
| Coach mode selector UX | ✅ | Writing / Clarity / Policy modes with mode-specific content + issue taxonomy |

### P2: Collaboration UI (Expo Web)

| Task | Status | Notes |
|------|--------|-------|
| Expo-web UI for revision history or activity feed | 🔲 | Add to EditorShell layout for web-only experience |
| Revision history/restore UI | 🔲 | Subtle, integrated panel (no modal spam) |
| Activity feed UI | 🔲 | Designed as a low-noise, contextual feed |

### MLP3: Writer Studio (Exploration)

These build on the Living Model + Decision Ledger + Knowledge PRs to help writers iterate into new media formats.

| Idea | Why it matters |
|------|----------------|
| Manga/storyboard generation | Turn scenes into panels, beats, captions, and shot composition references |
| Series bible / lorebook compiler | Auto-compile canon, characters, factions, timeline into a shareable bible |
| Presentation/pitch deck generator | Convert project truth into a clean pitch deck with citations to canon |
| Trailer / series video planning | Scene → shot list → storyboard frames; future: video generation toolchain |
| World simulation agent | Maintain consistent world state over time and propose canon updates as PRs |

### Research Spikes (Product Teams)

| Spike | Goal | Notes |
|------|------|------|
| GitHub integration (evidence + change events) | Improve “what changed” understanding and drift detection for product teams | Treat as evidence/ingest + citations + Impact PRs; avoid “index everything” positioning |

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

**Philosophy:** Treat desktop as **capability-based**, not platform forks. No `.tauri.ts` proliferation.

| Step | Task | Status |
|------|------|--------|
| 1 | Point Tauri devUrl to Expo Web (`:19006`) | 🔲 |
| 2 | Test all features in WebView context | 🔲 |
| 3 | Create `@mythos/platform` capability layer | 🔲 |
| 4 | Production: Expo export → Tauri resources | 🔲 |
| 5 | Native macOS menus via Tauri Menu API | 🔲 |
| 6 | Code signing + notarization | 🔲 |
| 7 | Auto-updater integration | 🔲 |

#### `@mythos/platform` Capability Layer

Single abstraction for platform capabilities (no scattered `.tauri.ts` files):

```
packages/platform/
├── src/
│   ├── index.ts              # Platform detection + capability exports
│   ├── capabilities/
│   │   ├── storage.ts        # Persistent key-value storage
│   │   ├── fs.ts             # File system access
│   │   ├── menus.ts          # Native menus (Tauri only)
│   │   ├── updater.ts        # Auto-update (Tauri only)
│   │   └── window.ts         # Window controls
│   └── adapters/
│       ├── tauri/            # Tauri plugin implementations
│       ├── web/              # Web API implementations
│       └── native/           # React Native implementations
```

**Capability Matrix:**

| Capability | Web | Tauri | React Native |
|------------|-----|-------|--------------|
| `storage` | localStorage | `tauri-plugin-store` | SecureStore/AsyncStorage |
| `fs` | File System Access API | `tauri-plugin-fs` | react-native-fs |
| `menus` | ❌ | Native AppKit menus | ❌ |
| `updater` | ❌ | `tauri-plugin-updater` | App Store |
| `window` | ❌ | `@tauri-apps/api/window` | ❌ |

**Usage:**

```typescript
import { storage, fs, platform } from '@mythos/platform';

// Auto-selects correct implementation
await storage.set('recentProjects', projectIds);
const data = await fs.readFile(path);

if (platform.capabilities.menus) {
  menus.setApplicationMenu(writerMenus);
}
```

#### Native macOS Menus (Tauri v2 Menu API)

Ship expected Mac affordances via `@tauri-apps/api/menu`:

```typescript
// packages/platform/src/adapters/tauri/menus.ts
import { Menu, MenuItem, Submenu } from '@tauri-apps/api/menu';

const fileMenu = await Submenu.new({
  text: 'File',
  items: [
    await MenuItem.new({ text: 'New Project', accelerator: 'CmdOrCtrl+N', action: 'new_project' }),
    await MenuItem.new({ text: 'Open...', accelerator: 'CmdOrCtrl+O', action: 'open_project' }),
    await MenuItem.new({ text: 'Export...', accelerator: 'CmdOrCtrl+Shift+E', action: 'export' }),
  ],
});

const editMenu = await Submenu.new({
  text: 'Edit',
  items: [
    await MenuItem.new({ text: 'Undo', accelerator: 'CmdOrCtrl+Z', action: 'undo' }),
    await MenuItem.new({ text: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', action: 'redo' }),
    { item: 'Separator' },
    await MenuItem.new({ text: 'Find...', accelerator: 'CmdOrCtrl+F', action: 'find' }),
  ],
});

const viewMenu = await Submenu.new({
  text: 'View',
  items: [
    await MenuItem.new({ text: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', action: 'toggle_sidebar' }),
    await MenuItem.new({ text: 'Zen Mode', accelerator: 'CmdOrCtrl+Shift+F', action: 'zen_mode' }),
    await MenuItem.new({ text: 'AI Panel', accelerator: 'CmdOrCtrl+J', action: 'toggle_ai' }),
  ],
});
```

#### Code Signing + Notarization (macOS)

**Required for distribution** (avoid "app is damaged" warnings):

```json
// apps/tauri/src-tauri/tauri.macos.conf.json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAMID)",
      "providerShortName": "TEAMID",
      "entitlements": "./entitlements.plist",
      "minimumSystemVersion": "10.15"
    }
  }
}
```

| Task | Tool | Notes |
|------|------|-------|
| Code signing | `codesign` | Apple Developer Certificate |
| Notarization | `notarytool` | Required for Gatekeeper |
| Stapling | `stapler` | Offline verification |
| CI automation | GitHub Actions | `tauri-action` handles this |

#### Auto-Updater (Tauri v2)

```typescript
// packages/platform/src/adapters/tauri/updater.ts
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForUpdates() {
  const update = await check();
  if (update) {
    await update.downloadAndInstall();
    await relaunch();
  }
}
```

**Update server options:**
- GitHub Releases (free, recommended)
- S3/CloudFlare R2 (self-hosted)
- Custom endpoint

#### Platform-Specific Config Overlays

Tauri v2 supports config merging for platform-specific settings:

```
apps/tauri/src-tauri/
├── tauri.conf.json           # Base config (all platforms)
├── tauri.macos.conf.json     # macOS: signing, entitlements, sandbox
├── tauri.windows.conf.json   # Windows: installer, code signing
└── tauri.linux.conf.json     # Linux: AppImage, deb settings
```

#### Expo iOS/iPad (Future)

| Task | Status |
|------|--------|
| MythosEditor WebView wrapper | 🔲 |
| Touch keyboard handling | 🔲 |
| Offline queue sync | 🔲 |
| iPad trackpad/mouse support | 🔲 |

#### Web → Shared Packages Refactor (Post-MLP1)

After Expo-web is finalized, migrate remaining `apps/web/` code to shared packages.

**Move to `@mythos/state`:**

| File | Notes |
|------|-------|
| `stores/navigation.ts` | Navigation state |
| `stores/projectSelection.ts` | Selected project |
| `stores/chatSessionStorage.ts` | Chat persistence |

**Move to `@mythos/platform`:**

| File | Capability |
|------|------------|
| `stores/memory.ts` | `storage` adapter |
| File open/save logic | `fs` adapter |

**Keep platform-specific:**

| File | Reason |
|------|--------|
| `stores/undo.ts` | Editor UX - needs client-side speed |
| `stores/history.ts` | Session stats - sync aggregates to Convex |

### Phase 5: Skills + Polish

**Skills approach (generalizable, writer-first):**
- Skills are reusable task presets built on shared primitives (RAG, lint, coach, summary).
- Start with writer workflows, but keep taxonomy extensible to product/engineering/design/comms.
- Each skill should define: goal, inputs, guardrails, tool chain, expected output schema, and UI surface.
- Prefer new skills only when existing lint/coach/summary tasks cannot express the intent.

| Skill | Focus | Purpose | Effort |
|-------|-------|---------|--------|
| `plan_story` | Writer | Plot arcs, beat sheets | 4h |
| `build_world` | Writer | Factions, magic, geography | 4h |
| `develop_character` | Writer | Arc, motivation, backstory | 3h |
| `research_facts` | Writer | RAG + web search synthesis | 3h |
| `analyze_writing` | Writer | SDT, pacing, tension | 2h |
| `summarize_brief` | General | Short brief for any project | 2h |
| `review_requirements` | Product | PRD clarity + gaps review | 3h |
| `draft_tech_spec` | Engineering | Spec outline + risks | 3h |
| `audit_design_system` | Design | Token/UX consistency checks | 3h |
| `check_brand_voice` | Comms | Tone consistency + edits | 2h |

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

## Phase 8: Observability (PostHog + Clarity) ✅ COMPLETE

> **Status:** Complete | **Priority:** P1

### Files Created

```
packages/consent/                # @mythos/consent - Shared GDPR consent
├── src/
│   ├── index.ts                 # Main exports
│   ├── types.ts                 # ConsentState, ConsentCategories
│   ├── storage.ts               # LocalStorage/Memory adapters
│   ├── manager.ts               # ConsentManager class
│   ├── hooks.tsx                # React hooks + ConsentProvider
│   └── adapters/
│       ├── posthog.ts           # PostHog consent adapter
│       └── clarity.ts           # Clarity consent adapter

apps/tauri/src/lib/
├── analytics.ts                 # PostHog client SDK + typed events
├── clarity.ts                   # Microsoft Clarity integration
└── consent.ts                   # Uses @mythos/consent

apps/expo/src/lib/
├── analytics.ts                 # PostHog client SDK (web only)
├── clarity.ts                   # Microsoft Clarity (web only)
└── consent.ts                   # Uses @mythos/consent

convex/lib/
└── analytics.ts                 # Server-side PostHog (fetch-based)
```

### Client-Side (Tauri) ✅

```typescript
// apps/tauri/src/lib/analytics.ts
import posthog from 'posthog-js';

export function initAnalytics() { /* ... */ }
export function identify(userId: string, properties?: Record<string, unknown>) { /* ... */ }
export function track(event: string, properties?: Record<string, unknown>) { /* ... */ }

// Typed event helpers
export const OnboardingEvents = { signUpStarted, signUpCompleted, projectCreated, ... };
export const AgentEvents = { chatStarted, toolApproval, chatCompleted };
export const WritingEvents = { sessionStarted, entityMentioned, aiAssist, exported };
```

### Server-Side (Convex) ✅

```typescript
// convex/lib/analytics.ts - fetch-based (Convex-compatible)
export async function trackServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>);

export const ServerAgentEvents = {
  streamStarted,      // AI stream begins
  ragContextRetrieved, // RAG results count
  streamCompleted,    // Duration + tokens
  streamFailed,       // Error tracking
};
```

### Microsoft Clarity ✅

Session replays for desktop (Tauri). Linked to PostHog user IDs.

```typescript
// apps/tauri/src/lib/clarity.ts
export function initClarity();
export function identifyClarity(userId: string);
export function setClarityTag(key: string, value: string);
```

### Tasks

| Task | Status |
|------|--------|
| PostHog client SDK (Tauri) | ✅ |
| PostHog client SDK (Expo web) | ✅ |
| Microsoft Clarity integration | ✅ |
| Centralized consent (`@mythos/consent`) | ✅ |
| Server-side analytics (Convex) | ✅ |
| Agent runtime tracking | ✅ |
| PostHog deployment (Hetzner) | ✅ |
| Convex env vars configured | ✅ |

### PostHog Self-Hosted Deployment

**Server:** `78.47.165.136` (Hetzner VPS)
**URL:** https://posthog.cascada.vision/
**Stack:** Docker Compose (hobby deployment)

| Component | Status |
|-----------|--------|
| PostHog containers | ✅ Running |
| ClickHouse database | ✅ Configured |
| Redis | ✅ Running |
| Celery workers | ✅ Running |
| Nginx reverse proxy | ✅ Cloudflare SSL |
| API key configured | ✅ `phc_9O9...` |

### Environment Variables

```env
# Tauri/Vite client
VITE_POSTHOG_API_KEY=phc_...
VITE_POSTHOG_HOST=https://posthog.cascada.vision
VITE_CLARITY_PROJECT_ID=...

# Expo client (web only)
EXPO_PUBLIC_POSTHOG_API_KEY=phc_...
EXPO_PUBLIC_POSTHOG_HOST=https://posthog.cascada.vision
EXPO_PUBLIC_CLARITY_PROJECT_ID=...

# Convex server
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://posthog.cascada.vision
```

---

## Phase 9: Rate Limiting ✅ COMPLETE

### Files Created

```
convex/lib/
├── rateLimiting.ts              # @convex-dev/rate-limiter config
│   ├── rateLimiter              # RateLimiter instance
│   ├── createUsageHandler()     # Agent UsageHandler with DB tracking
│   ├── checkAiRateLimits()      # Pre-flight checks for AI requests
│   ├── MODEL_PRICING            # Cost calculation table
│   └── calculateCostMicros()    # Cost estimation

convex/
├── convex.config.ts             # Added rate-limiter component
├── aiUsage.ts                   # Usage tracking mutations/queries
│   ├── trackUsage               # Internal mutation
│   ├── getUserUsage             # User billing period usage
│   ├── getThreadUsage           # Per-thread usage
│   └── getProjectUsage          # Project-level summary
```

### Rate Limits Configured

| Limit | Algorithm | Rate | Period | Shards |
|-------|-----------|------|--------|--------|
| `login` | token bucket | 5/min | 1 min | - |
| `failedLogin` | token bucket | 3/15min | 15 min | - |
| `signup` | fixed window | 3/hr | 1 hour | - |
| `aiRequest` | token bucket | 20/min | 1 min | - |
| `aiTokenUsage` | token bucket | 50k/min | 1 min | 10 |
| `globalAiTokenUsage` | token bucket | 500k/min | 1 min | 50 |
| `sendMessage` | token bucket | 30/min | 1 min | - |
| `webhook` | token bucket | 1000/min | 1 min | 10 |
| `embedding` | token bucket | 100/min | 1 min | - |

### Best Practices Applied

- **Reserve pattern**: `check()` before with estimate, `limit()` after with actual
- **Dual limits**: Per-user AND global for token usage
- **Sharding**: High-throughput limits use shards (QPS/2 formula)
- **UsageHandler**: Integrated with @convex-dev/agent for automatic tracking
- **Cost tracking**: Microdollars per request stored in DB

---

## Phase 10: Tier Configuration ✅ COMPLETE

### Files Created

```
convex/
├── schema.ts                    # Added tierConfigs table
├── tiers.ts                     # CRUD queries/mutations
│   ├── listActive               # Get active tiers
│   ├── getByTier                # Get specific tier
│   ├── create/update            # Manage tiers
│   ├── seedDefaults             # Populate initial data
│   └── resetToDefaults          # Reset to hardcoded values

convex/lib/
├── tierConfig.ts                # Types, defaults, helpers
│   ├── TierConfig               # Full tier type
│   ├── TIER_DEFAULTS            # Hardcoded fallback
│   ├── getTierDefaults()        # Get without DB
│   ├── dbToTierConfig()         # Convert DB → typed
│   ├── isAIFeatureEnabled()     # Check AI feature
│   ├── isFeatureEnabled()       # Check general feature
│   └── checkQuota()             # Validate limits
```

### Tier Schema

```typescript
tierConfigs: {
  tier: string,                    // "free" | "pro" | "team" | "enterprise"
  name: string,
  description?: string,
  priceMonthlyCents: number,
  priceYearlyCents: number,
  ai: { tokensPerMonth, callsPerDay, concurrentRequests, models[] },
  aiFeatures: { chat, lint, coach, detect, search, webSearch, imageGeneration, styleAdaptation },
  memory: { retentionDays, maxPerProject, maxPinned },
  embeddings: { operationsPerDay, maxVectorsPerProject, queuePriority },
  projects: { maxProjects, maxDocumentsPerProject, maxEntitiesPerProject, maxWordsPerMonth, storageMB },
  collaboration: { enabled, maxCollaboratorsPerProject },
  features: { prioritySupport, customModels, apiAccess, exportEnabled },
  metadata: any,
  isActive: boolean,
}
```

### Supabase → Convex Mapping

| Supabase Field | Convex Location |
|----------------|-----------------|
| `tier` | `tier` |
| `tokens_included` | `ai.tokensPerMonth` |
| `ai_chat_enabled` | `aiFeatures.chat` |
| `ai_lint_enabled` | `aiFeatures.lint` |
| `max_projects` | `projects.maxProjects` |
| `max_collaborators_per_project` | `collaboration.maxCollaboratorsPerProject` |
| `priority_support` | `features.prioritySupport` |
| `custom_models` | `features.customModels` |

### AI Provider System (`convex/lib/providers/`) ✅ NEW

Database-driven AI provider and task configuration with Vercel AI SDK integration.

```
convex/lib/providers/
├── types.ts           # Modalities, tasks, adapters
├── imageContexts.ts   # Image generation contexts
├── registry.ts        # Provider factory + Vercel AI SDK
├── taskConfig.ts      # Task → model routing
├── seed.ts            # Default data seeding
└── index.ts           # Re-exports
```

#### AI Modalities & Tasks

| Modality | Tasks |
|----------|-------|
| **text** | chat, lint, coach, detect, dynamics, style, thinking, creative, summarize |
| **image** | image_generate, image_edit, image_analyze, image_upscale |
| **audio** | tts, stt, voice_clone (future) |
| **video** | video_generate, video_edit (future) |
| **world** | world_generate, world_simulate (future) |

#### Provider Adapters

| Adapter | SDK | Use Case |
|---------|-----|----------|
| `vercel-openai` | `@ai-sdk/openai` | OpenAI direct |
| `vercel-anthropic` | `@ai-sdk/anthropic` | Anthropic direct |
| `vercel-google` | `@ai-sdk/google` | Google AI direct |
| `vercel-deepinfra` | `@ai-sdk/deepinfra` | DeepInfra (SDK) |
| `openrouter` | `@ai-sdk/openai` (baseURL) | OpenRouter gateway |
| `deepinfra-openai` | `@ai-sdk/openai` (baseURL) | DeepInfra (OpenAI-compat) |
| `custom-fetch` | Raw fetch | Reranker, embeddings |

#### Task Configuration

```typescript
// Task → Model mapping with fallbacks
getModelForTaskSync("lint", "pro")   // → "anthropic/claude-sonnet-4"
getModelForTaskSync("lint", "free")  // → "google/gemini-2.0-flash-001"

// Feature access checking
checkTaskAccess("lint", "free")  // → { allowed: false, upgradeRequired: true }
checkTaskAccess("lint", "pro")   // → { allowed: true }
```

#### Database Tables

| Table | Purpose |
|-------|---------|
| `llmProviders` | Provider configs (slug, baseUrl, adapterType, priority) |
| `llmTaskConfigs` | Task routing (model chain, limits, pricing, tier gating) |
| `projectImages` | AI-generated images with context awareness |

#### AI Feature Matrix by Tier

| Feature | Free | Pro | Team | Enterprise |
|---------|------|-----|------|------------|
| `chat` | ✅ | ✅ | ✅ | ✅ |
| `detect` | ✅ | ✅ | ✅ | ✅ |
| `search` | ✅ | ✅ | ✅ | ✅ |
| `lint` | ❌ | ✅ | ✅ | ✅ |
| `coach` | ❌ | ✅ | ✅ | ✅ |
| `dynamics` | ✅ | ✅ | ✅ | ✅ |
| `thinking` | ❌ | ✅ | ✅ | ✅ |
| `creative` | ❌ | ✅ | ✅ | ✅ |
| `imageGeneration` | ❌ | ✅ | ✅ | ✅ |
| `styleAdaptation` | ❌ | ✅ | ✅ | ✅ |

#### Image Generation Contexts

| Context | Aspect | Style | Tier | Storage |
|---------|--------|-------|------|---------|
| `inline` | 16:9 | concept_art | inline | document |
| `character_portrait` | 3:4 | portrait_photo | standard | entity |
| `character_full` | 2:3 | fantasy_art | premium | entity |
| `location_scene` | 16:9 | concept_art | standard | entity |
| `location_map` | 1:1 | concept_art | premium | entity |
| `item` | 1:1 | concept_art | fast | entity |
| `faction_emblem` | 1:1 | concept_art | standard | entity |
| `cover` | 2:3 | fantasy_art | ultra | project |
| `world_map` | 4:3 | concept_art | ultra | project |

#### Image Quality Tiers

| Tier | Model | Price/Image | Use Case |
|------|-------|-------------|----------|
| `inline` | `gemini-2.0-flash-preview-image-generation` | $0.003 | Chat inline |
| `fast` | `FLUX-1-schnell` | $0.003 | Quick drafts |
| `standard` | `FLUX-1-dev` | $0.01 | Default |
| `premium` | `gemini-2.0-flash-preview-image-generation` | $0.02 | High quality |
| `ultra` | `FLUX-1.1-pro` | $0.04 | Maximum quality |

---

## Phase 11: Supabase → Convex Migration (85%)

### Migration Architecture

```
convex/
├── migrations/
│   ├── index.ts                 # Migration runner + status
│   └── types.ts                 # Migration types
├── collaboration.ts             # ✅ Project members + invitations
├── projectAssets.ts             # ✅ File storage management
├── maintenance.ts               # ✅ Cleanup jobs + vector delete processing
├── memories.ts                  # ✅ AI memories CRUD + vector sync
├── account.ts                   # ✅ Account deletion cascade
├── lib/entitlements.ts          # ✅ Subscription/tier checks
└── crons.ts                     # ✅ Daily/weekly cleanup crons
```

### Schema Status

| Table | Status | Notes |
|-------|--------|-------|
| `projectMembers` | ✅ Done | Roles: owner/editor/viewer, indexes |
| `projectInvitations` | ✅ Done | Token-based, 7-day expiry |
| `projectAssets` | ✅ Done | File storage, soft delete |
| `tierConfigs` | ✅ Done | Seed from TIER_DEFAULTS |
| `memories` | ✅ Done | AI memories with Qdrant vector sync |
| `vectorDeleteJobs` | ✅ Done | Outbox for Qdrant deletions |
| `subscriptions` | ✅ Done | RevenueCat webhook sync |

### Collaboration Features

| Feature | Status |
|---------|--------|
| Permission helpers (isProjectMember, isEditor, isOwner) | ✅ |
| Project member CRUD | ✅ |
| Invitation flow (create, accept, revoke, expire) | ✅ |
| Projects list shows member projects | ✅ |
| Editor access for updates | ✅ |
| Cascade delete (members, invitations, assets) | ✅ |

### Cleanup Crons

| Cron | Schedule | Action |
|------|----------|--------|
| `expire-old-invitations` | Daily 4:00 AM UTC | Mark expired invitations |
| `cleanup-deleted-assets` | Weekly Sunday 5:00 AM UTC | Hard delete soft-deleted assets (30+ days) |
| `process-vector-delete-jobs` | Every minute | Process pending Qdrant deletions |
| `requeue-stale-vector-delete-jobs` | Every 5 minutes | Reclaim stuck vector delete jobs |
| `requeue-stale-embedding-jobs` | Every 5 minutes | Reclaim stuck embedding jobs |
| `cleanup-embedding-jobs` | Daily 1:30 AM UTC | Remove stale/failed embedding jobs |
| `purge-expired-memories` | Daily 2:00 AM UTC | Delete tier-expired memories |

### Completed Tasks (2026-01-09)

| Task | Status | Notes |
|------|--------|-------|
| Delete account button (Expo settings) | ✅ Done | `apps/expo/app/settings.tsx` |
| useStreamingEntityDetection.ts | ✅ Done | Migrated to `api.ai.detect.detectEntitiesPublic` |
| useAutoSave.ts | ✅ Done | Uses `api.documents.update` |
| useEntityPersistence.ts | ✅ Done | Uses `api.entities.*` mutations |
| useMentionPersistence.ts | ✅ Done | Stubbed (mentions schema TBD) |
| useProgressiveSync.ts (mobile) | ✅ Done | Stubbed (progressive state TBD) |
| Canvas.tsx | ✅ Done | Uses `api.documents.create` |
| InviteAcceptPage.tsx | ✅ Done | Uses `api.collaboration.*` |
| SceneListBlock.tsx | ✅ Done | Uses `api.documents.*` |
| Bridge messaging hardening (nonce + origin checks) | ✅ Done | Editor WebView + Tauri hook |
| Collaboration auth binding (project-scoped checks) | ✅ Done | Added verifyProjectAccess + listMyProjects |

### Remaining Tasks (Supabase Migration)

All Supabase → Convex migration tasks complete.

### P1: Performance Stabilization

| Task | Files | Notes |
|------|-------|-------|
| Cursor write rate reduction | `CollaborativeEditor.tsx` | 120ms → 350ms throttle, skip if unchanged, focus-gated |
| AI presence keepalive | `agentRuntime.ts` | Tick presence every ~5-10s during long streams |
| Embedding job deduplication | `embeddings.ts`, `schema.ts` | Skip if pending job exists for same target |

### P2: Notion+Cursor Product Gaps

| Task | Files | Notes |
|------|-------|-------|
| **Collaborative suggestions** | New `convex/suggestions.ts` | ✅ Done — persisted suggestions + editor hydration |
| **Version history + restore** | New `convex/revisions.ts` | ✅ Done — revision log + server-side restore |
| **Block identity layer** | New `extensions/block-id.ts` | ✅ Done — stable UUIDs on block nodes |
| **Activity log** | New `convex/activity.ts` | ✅ Done — audit trail for AI + human ops |

> **Note:** Version history must track full actor context (which user, which collaborator, which AI agent/tool) to enable proper rollback UX and audit. UI for history/restore is a major focus area.

### Backend Schema TODOs (Stubbed Hooks)

| Schema | Priority | Notes |
|--------|----------|-------|
| `mentions` table | P3 | Entity mentions in documents. Hooks stubbed in `useMentionPersistence.ts` |
| `progressiveState` table | P3 | Progressive disclosure state per project. Hooks stubbed in `useProgressiveSync.ts` |

**Migration script:** `bun scripts/analyze-db-migration.ts` generates `DB_MIGRATION_REPORT.md`

### Tables to DEPRECATE

| Table | Reason | Migration Plan |
|-------|--------|----------------|
| `activity_log` | High-volume append-only | PostHog events |
| `ai_request_logs` | Analytics | `aiUsage` table |
| `chat_sessions` | Start fresh | Agent threads |
| `profiles` | Better Auth | Already handled |

---

## Schema Additions (Compact)

| Table | Key Fields | Phase |
|-------|-----------|-------|
| `users` | (Better Auth generates) | ✅ P6 |
| `sessions` | (Better Auth generates) | ✅ P6 |
| `subscriptions` | userId, status, productId, expiresAt | ✅ P7 |
| `subscriptionEvents` | eventType, store, transactionId | ✅ P7 |
| `@mythos/consent` | ConsentManager, adapters, hooks | ✅ P8 |
| `tierConfigs` | tier, ai, aiFeatures, memory, projects | ✅ P10 |
| `aiUsage` | userId, threadId, model, tokens, costMicros | ✅ P9 |
| `llmProviders` | slug, baseUrl, adapterType, priority | ✅ P10 |
| `llmTaskConfigs` | taskSlug, modality, directModel, minTier | ✅ P10 |
| `projectImages` | projectId, context, targetType, status | ✅ P10 |
| `projectMembers` | projectId, userId, role, isOwner | ✅ P11 |
| `projectInvitations` | projectId, email, token, status, expiresAt | ✅ P11 |
| `projectAssets` | projectId, type, storageId, deletedAt | ✅ P11 |
| `memories` | projectId, category, scope, content | ✅ Done |
| `embeddingJobs` | docId, status, attempts | ✅ Done |
| `documentRevisions` | documentId, snapshotJson, actorType, actorUserId, reason | 🔲 P2 |
| `documentSuggestions` | documentId, from, to, type, content, status, agentId | 🔲 P2 |
| `activityLog` | projectId, documentId, actorType, action, summary | 🔲 P2 |

---

## Tools Status

### Agent Tools ✅ (All Migrated)

| Tool | Approval | Location |
|------|----------|----------|
| `ask_question` | Always | `convex/ai/tools/editorTools.ts` |
| `write_content` | Always | `convex/ai/tools/editorTools.ts` |
| `search_context` | Auto | `convex/ai/tools/ragTools.ts` |
| `read_document` | Auto | `convex/ai/tools/ragTools.ts` |
| `search_chapters` | Auto | `convex/ai/tools/ragTools.ts` |
| `search_world` | Auto | `convex/ai/tools/ragTools.ts` |
| `get_entity` | Auto | `convex/ai/tools/ragTools.ts` |
| `create_entity` | **Dynamic** | `convex/ai/tools/projectGraphTools.ts` |
| `update_entity` | **Dynamic** | `convex/ai/tools/projectGraphTools.ts` |
| `create_relationship` | **Dynamic** | `convex/ai/tools/projectGraphTools.ts` |
| `update_relationship` | **Dynamic** | `convex/ai/tools/projectGraphTools.ts` |

### Dynamic Approval Logic (`convex/lib/approvalConfig.ts`)

| Entity Type | Auto-Execute | Requires Approval |
|-------------|--------------|-------------------|
| `item`, `location`, `event`, `concept` | ✅ Low impact | |
| `character`, `faction`, `magic_system` | | ✅ High impact |

| Relationship Type | Auto-Execute | Requires Approval |
|-------------------|--------------|-------------------|
| `knows`, `located_in`, `contains` | ✅ Low impact | |
| `parent_of`, `child_of`, `allied_with`, `enemy_of`, `owns`, `serves` | | ✅ High impact |

### Remaining Tools 🔲

| Tool | Location | Priority |
|------|----------|----------|
| `genesis_world` | `convex/ai/genesis.ts` | P2 |
| `detect_entities` (streaming) | `convex/ai/detect.ts` | ✅ Done |

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
# =============================================================
# Convex (Self-Hosted on Hetzner - Cascada)
# =============================================================
CONVEX_SELF_HOSTED_URL=https://convex.cascada.vision
CONVEX_SELF_HOSTED_ADMIN_KEY=cascada-convex|<your-admin-key>

# Public URLs (used by clients)
VITE_CONVEX_URL=https://convex.cascada.vision
VITE_CONVEX_SITE_URL=https://cascada.vision

# Expo
EXPO_PUBLIC_CONVEX_URL=https://convex.cascada.vision
EXPO_PUBLIC_CONVEX_SITE_URL=https://cascada.vision

# =============================================================
# Better Auth (set in Convex env, not local)
# =============================================================
BETTER_AUTH_SECRET=         # openssl rand -base64 32
SITE_URL=https://cascada.vision
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# =============================================================
# RevenueCat
# =============================================================
REVENUECAT_WEBHOOK_SECRET=
EXPO_PUBLIC_REVENUECAT_API_KEY=

# =============================================================
# AI Providers
# =============================================================
OPENROUTER_API_KEY=sk-or-v1-<your-key>
DEEPINFRA_API_KEY=<your-key>

# =============================================================
# Qdrant (Hetzner - shared with Kora)
# =============================================================
QDRANT_URL=http://127.0.0.1:6333  # Internal, or https://qdrant.cascada.vision
QDRANT_API_KEY=kora-secure-key-2024

# =============================================================
# Analytics (PostHog + Clarity)
# =============================================================
# PostHog (self-hosted or cloud)
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://posthog.cascada.vision

# Tauri/Vite client
VITE_POSTHOG_API_KEY=phc_...
VITE_POSTHOG_HOST=https://posthog.cascada.vision
VITE_CLARITY_PROJECT_ID=...

# Expo client
EXPO_PUBLIC_POSTHOG_API_KEY=phc_...
EXPO_PUBLIC_POSTHOG_HOST=https://posthog.cascada.vision
EXPO_PUBLIC_CLARITY_PROJECT_ID=...
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

## Phase 12: CI/CD (GitHub Actions) ✅ COMPLETE

### Files Created

```
.github/workflows/
├── ci.yml                          # Typecheck, lint, test on PR/push
└── deploy-convex.yml               # Auto-deploy Convex on changes
```

### CI Workflow (`ci.yml`)

| Job | Command | Trigger |
|-----|---------|---------|
| `typecheck` | `bun run typecheck` | PR + push to main |
| `lint` | `bun run lint` | PR + push to main |
| `test` | `bunx vitest convex/ai/__tests__ --run` | PR + push to main |

### E2E (Playwright)

- Status: Infra + initial suites in place (Expo web primary; Tauri web content validation).
- Coverage: Auth, project/document create + editor persistence, detect+persist (mockable).
- Entry points: `bun run e2e:expo`, `bun run e2e:tauri`, `E2E_MOCK_AI=true`, `EXPO_PUBLIC_E2E=true`.
- Note: Project Graph UI tests are deferred until graph exists in Expo/Tauri.

### Convex Deploy Workflow (`deploy-convex.yml`)

Auto-deploys Convex when files in `convex/` change on main branch.

### GitHub Secrets Required

> **Note:** Configure these in GitHub repo settings → Secrets when ready to enable CI.

| Secret | Purpose | How to Get |
|--------|---------|------------|
| `CONVEX_DEPLOY_KEY` | Auto-deploy Convex | `npx convex deploy-key` |
| `CONVEX_URL` | E2E tests | Your Convex deployment URL |
| `OPENROUTER_API_KEY` | E2E tests (AI calls) | OpenRouter dashboard |

---

## Phase 13: Real-Time Collaboration ✅ TRACK A COMPLETE

> **Status:** Track A Complete | **Priority:** P1 | **Updated:** 2026-01-09

Figma-level multiplayer editing with AI as first-class participant.

### Strategy

**Track A (Ship Now):** `@convex-dev/prosemirror-sync` + `@convex-dev/presence` — OT-based, built for TipTap, supports server-side AI transforms.

**Track B (Future):** Yjs CRDT + custom Convex provider — swap later if needed, API boundaries designed to allow it.

### Implementation Tasks

#### 13.1 Backend (Convex)

| Task | Description | Status |
|------|-------------|--------|
| Add prosemirror-sync component | Register in `convex.config.ts`, handles OT merging | ✅ |
| Add presence component | Project + document scoped presence rooms | ✅ |
| Thread scope migration | Replace `userId` ownership with `scope: project\|document\|private` | ✅ |
| `assertThreadAccess` | New access check for shared document threads | ✅ |
| AI presence state | Publish "Muse is typing" while streaming | ✅ |

#### 13.2 Editor Integration

| Task | Description | Status |
|------|-------------|--------|
| Collaboration props | Add `projectId`, `documentId`, `user` to editor shell/bridge | ✅ |
| Sync hook | `useTiptapSync` returns extensions + status | ✅ |
| Cursor broadcast | Publish selection to presence on `onSelectionUpdate` | ✅ |
| Bridge messages | Add `connectCollaboration` / `disconnectCollaboration` | ✅ |

#### 13.3 UI Components

| Task | Description | Status |
|------|-------------|--------|
| Remote cursors | TipTap decoration plugin, colored cursor + name label | ✅ |
| Remote selections | Semi-transparent highlight for other users' selections | ✅ |
| Collaborator avatars | Toolbar showing online users + AI with status dots | ✅ |
| AI activity indicator | "Muse is writing..." with cancel button | 🔲 |
| Conflict resolution | Modal for AI vs human edit conflicts | 🔲 |

#### 13.4 Migration

| Task | Description | Status |
|------|-------------|--------|
| Replace `useCollaboration.ts` | Swap Supabase presence/postgres_changes → Convex | ✅ |
| Replace `CollaborationClient` | New `ConvexCollaborationClient` in `@mythos/sync` | 🔲 |
| Tauri iframe auth | Pass auth token via bridge, editor connects to Convex directly | ✅ |

### Files Created (Track A)

```
convex/
├── convex.config.ts                 # prosemirror-sync + presence components
├── presence.ts                      # Presence room management
├── prosemirrorSync.ts               # OT sync component
├── collaboration.ts                 # Members query + access helpers
├── ai/threads.ts                    # assertThreadAccess, document scopes
├── schema.ts                        # Updated for collaboration

packages/editor-webview/
├── src/components/
│   ├── CollaborativeEditor.tsx      # useTiptapSync + presence wrapper
│   ├── Editor.tsx                   # Bridge events, cursor updates
│   └── EditorShell.tsx              # Collaboration props
├── src/extensions/
│   ├── remote-cursor.ts             # Remote cursor decoration plugin
│   └── index.ts                     # Extension exports
└── src/bridge.ts                    # connectCollaboration messages

apps/
├── expo/app/(app)/editor.tsx        # Collaboration wiring
├── tauri/src/components/editor/
│   └── EditorWebView.tsx            # WebView collaboration props
├── tauri/src/hooks/useEditorBridge.ts
└── web/src/hooks/useCollaboration.ts # Convex presence + members
```

### Done Criteria

- [x] Two users (Expo web + Tauri) see live text sync + remote cursors
- [x] AI edits appear as collaborative operations visible to all
- [x] Supabase no longer needed for presence/sync

### Track B (Future)

Yjs CRDT + custom Convex provider — swap later if needed, API boundaries designed to allow it.

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
