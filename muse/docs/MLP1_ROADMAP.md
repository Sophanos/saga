# MLP 1: AI Co-Author Roadmap

> Last Updated: 2026-01-15 (Billing status review: 20% → 75%)
> Target: Expo Web + macOS first, then iOS/iPad
>
> See also: [Living Memory OS](./MLP1_LIVING_MEMORY_OS.md)
> See also: [MLP2 Proactivity Engine](./MLP2_PROACTIVITY_ENGINE.md)
> See also: [Coherence Spec](./COHERENCE_SPEC.md) (persona-aware consistency)
> See also: [Rhei GPT Context](./GPT_RHEI_CONTEXT.md) (messaging + prompts)
> See also: [Landing Page Spec](./LANDING_PAGE_SPEC.md) (design + animations)

## Purpose

Compact roadmap and status snapshot for MLP1. Keep detailed specs in code or design docs; use this as the source of truth for scope, status, and next steps.

## Summary (What MLP1 ships)

- Project Knowledge System: templates, registries, Project Graph, and schema validation.
- AI co-author with explicit approvals; Focus Mode keeps AI silent unless invoked.
- Widgets & Artifacts (MVP1): command → preview → confirm → inline insert or saved artifact, with receipts by default.
- Knowledge PRs: review queue, diffs, approvals, and rollback.
- Web Research: `web_search` + `web_extract` for real-world reference lookup (Parallel Web SDK).
- MCP integrations and citations for external tool access and evidence.
- Offline-first plus real-time sync for collaboration.
- Platform focus: Expo Web first, macOS (Tauri v2) next, iOS/iPad later.

## Status Snapshot

| Area | Status | % |
|------|--------|---|
| Editor WebView Bundle | Done | 100 |
| Convex Agent Integration | Done | 100 |
| Platform Integration | In progress (Web done; Tauri scaffold; Expo partial) | 80 |
| RAG Pipeline | Done | 100 |
| Web Research Tools | Done | 100 |
| Image Pipeline + CLIP Embeddings | Done | 100 |
| Planning Tools + Sub-Agents | Done | 100 |
| Supabase -> Convex Migration | Done | 100 |
| Real-Time Collaboration | In progress | 80 |
| Widgets & Artifacts + Async (MVP1) | In progress ([details](#phase-5-widgets--artifacts--async-mvp1)) | 90 |
| App Store Pricing + RevenueCat | In progress ([details](./PRICING_REVENUECAT_SETUP.md)) | 75 |
| Overall MLP 1 | In progress | 97 |

## Recent Updates (condensed)

**2026-01-15 (Artifacts Phase 2 completion)**
- Batch PDF export: offscreen rendering with `batchRenderArtifacts()` utility; renders each artifact to PNG/SVG before PDF assembly.
- Thread summarization: `convex/ai/summarizeThread.ts` action with `estimateThreadTokens`, `shouldAutoSummarize`, `getThreadUsageEstimate`.
- ChatUsageIndicator: "Summarize" button appears when context is high (>6k tokens), triggers thread summarization.
- ArtifactReceiptExtension: `updateArtifactReceipt()` and `removeArtifactReceipt()` commands added.
- Collaboration tools HITL: `add_comment` and `delete_document` classified as knowledge suggestions for HITL approval.

**2026-01-15 (Artifacts backend + client)**
- Backend: `artifacts`, `artifactVersions`, `artifactMessages`, `artifactOps` tables; CRUD + staleness queries in `convex/artifacts.ts`.
- Lifecycle: `setStatus` state machine with audit metadata; Canvas marks artifacts `applied`, panels can mark `saved`.
- Engine: domain ops → JSON Patch with rev test in `packages/core/src/artifacts/engine.ts`.
- Iteration: OpenRouter-backed artifact iteration action (persists messages + versions).
- Collaboration tools: `view_version_history`, `delete_document`, `search_users`, `view_comments`, `add_comment` - fully wired (Convex + client executors + agentRuntime).
- Soft-delete: `documents.deletedAt`/`deletedByUserId`; `comments` table for collaboration.
- Client: Compare mode (Web side-by-side/diff, Expo stacked) + inline artifact receipt block (insert + refresh).
- Cross-artifact references: Artifact Panel shows outgoing refs + backlinks + graph view; copy `artifact://{artifactId}#{elementId}` links.
- Export: runtime PNG/SVG/JSON across renderers + Artifact Panel PDF/SVG export + batch PDF/JSON with full artifact rendering.
- Chat input: monthly usage chip + per-message token estimate (heuristic) + "Summarize" button for high-context threads.
- Deep links: Expo `rhei://project/.../artifact/{artifactKey}` routes + membership-gated access check.
- Staleness: `external` status for web/github sources (can't track).

**2026-01-14 (BYOK settings UI, main aa266e7)**
- BYOK settings UI: Web SettingsModal OpenRouter section + Expo AI Settings section.
- Preferred model: `/billing-preferred-model` endpoint, public mutations for Expo, `preferredModel` in billing snapshot + Zustand store.
- Expo: `useBilling` hook (Convex React), billing mode toggle, API key input, model picker (radio-style).
- UX: warning banner re async operations using managed infrastructure.

**2026-01-14 (Billing production readiness, main 380833a)**
- Stripe web billing: `/stripe-checkout` + `/stripe-portal` routes, `/webhooks/stripe` signature verification, billing customer mapping.
- RevenueCat hardening: idempotent events + ordering guard, billing-issue → grace period, dual-secret support.
- Billing core: canonical subscription updates, entitlement-first tier resolution, snapshot uses DB tier overrides.
- BYOK: `x-openrouter-key` passthrough, quota bypass for BYOK, per-user preferred model stored + used.
- Quota enforcement: preflight checks + max_tokens clamp + monthly counters; usage handler writes `billingUsagePeriods`.  

**2026-01-14 (Planning tools + Image pipeline)**
- Planning tools: `write_todos` (Claude Code style - full state replacement), `spawn_task` (sub-agent spawner).
- Sub-agents: research/analysis/writing agents with scoped tools and system prompts.
- Frontend: `TodoListCard` (progress bar + checklist), `SpawnTaskCard` (expandable output).
- Image pipeline: shared `ImagePicker` component (upload/URL/assets tabs), client-side validation (5MB, PNG/JPG/GIF/WebP).
- Editor `/image` command: inserts `ImagePlaceholder` block; click opens `ImageInsertModal`.
- Image embeddings: CLIP via DeepInfra → Qdrant `saga_images` collection (512-dim vectors).
- Chat attachments: drag-drop, paste, URL embed with server-side validation in `http.ts`.
- Protocol: `TodoItem` with status, `SubAgentType`, `WriteTodosArgs/Result`, `SpawnTaskArgs/Result`.
- Schema: `agentTodos` table with status field; `getByThread`/`getByProject` queries.

**2026-01-11 (AI centralization)**
- `@mythos/ai/client`: shared streaming, SSE parsing, tool execution
- `@mythos/ai/hooks`: useApiKey (adapter pattern), useTemplateBuilderAgent
- Platform wrappers: Expo AsyncStorage, Web localStorage
- AITemplateBuilder added to Expo workspace wizard

**2026-01-11 (schema alignment)**
- Schema alignment: `@mythos/core` Project schema now matches Convex template IDs (`writer`, `product`, `engineering`, `design`, `comms`, `custom`).
- Discriminated union: `projectSchema` for strict typing by template; `looseProjectSchema` for store state with partial writer config.
- Shared mapper: `mapConvexProjectToCoreProject()` and `createProjectFromBootstrap()` in `@mythos/core/mappers/convex`.
- Expo fixes: removed `as any` hacks from `CreateWorkspaceWizard`, `ProjectPickerDropdown`, and `e2e.tsx`.
- State stores: updated to use `LooseProject` for flexible config access.
- Template builder: extracted `projectTypes.ts` to `@mythos/core/templateBuilder` (shared between web/mobile).
- Convex bootstrap: now returns created project record (no extra fetch needed).

**2026-01-11 (late night)**
- Expo workspace creation: Notion-style project switcher dropdown + multi-step wizard (template → name).
- New components: `ProjectPickerDropdown`, `CreateWorkspaceWizard`, `useProjects` hook.
- Sidebar: click project name → dropdown; "+" button → wizard; sign out in dropdown.
- Template categories: Work (`product`) / Daily Life (`writer`) / Learning (`comms`) / AI Builder (placeholder).

**2026-01-11 (night)**
- Widgets MVP1: widget capability kind + shared contract, Convex schema + `/ai/widgets` stream, web wedge (Cmd+K filter, slash menu, progress/preview, receipts).
- Widgets MVP1: inline apply markers + highlight + revert overlay, receipts source picker, artifacts list/detail with staleness badges.
- Flow Mode: FlowFocus extension (iA Writer dimming), TypewriterScroll, FlowTimerPanel with break reminders.
- Template Builder: project type selection, PhaseIndicator, ProgressiveTemplatePreview, domain-specific questions.
- Project setup: unified `project_manage` tool; bootstrap generates template; `seed` flag controls starter content.
- Website: removed `apps/website/` (landing moved to `apps/web/src/pages/`).

**2026-01-11 (late evening)**
- Web Research: `web_search` + `web_extract` tools via Parallel Web SDK; auto-execute (no approval needed); agent can search web and extract full page content for research.
- Ask Question: unified schema with multi-tab UI; single question = inline, multiple = tabbed navigation; rich options with label+description; freeform always available.
- System prompt: updated with Human-in-the-Loop and Research Tools guidance.
- Tool registry: added `webSearchExecutor` + `webExtractExecutor` with summaries.

**2026-01-11 (evening)**
- P0 fix: Rollback confirmation modal added for Web + Expo; queries `getRollbackImpact`, shows cascade warnings, displays affected relationships.
- P0 fix: Cursor-based pagination for Knowledge PRs (PAGE_SIZE=50); Web uses "Load more" button, Expo uses FlatList with `onEndReached`.
- Flow Mode: timer visibility controls, auto-hide when running, reveal at threshold, selectedDurationMin/revealThresholdMin state.
- Auth: Tauri OAuth adapter (`tauriAuth.ts`), variable shadowing fixes in AuthScreen.
- Expo: marketing routes + web auth redirects (`(marketing)/`, `sign-in.web.tsx`, `sign-up.web.tsx`).
- Config: Tauri now points to apps/web (port 3005); env vars for Expo web redirects.

**2026-01-11 (earlier)**
- Project Graph templates: registry resolution keyed by `project.templateId`; projects/documents support `templateId`, `metadata`, and `settings`; org/team schema scaffolding added.
- Approvals + routing: approvals driven by registry `riskLevel` + per-type identity fields; AI task routing expanded with `review`/`generation` plus product/engineering/design/comms slugs.
- Knowledge PRs hardening: `rerunPreflight`, `getRollbackImpact`, `cascadeRelationships`, editor resolve path for write_content, conflict recheck UI.
- Clarity/Policy Coach fully implemented.

**2026-01-10**
- Phase 1: Project Graph (`projectTypeRegistry` + `create_node`/`update_node`/`create_edge`/`update_edge` + registry-aware approvals).
- Phase 2: Knowledge PRs (`knowledgeSuggestions` + `suggestionId` in streams + tool-result resolution); Expo Web "Changes to review" panel.
- MCP integrations: expanded tool surface + `SAGA_PROJECT_ID`; added `commit_decision` + image tooling (`search_images`, `find_similar_images`, `analyze_image`, `create_entity_from_image`, `illustrate_scene`).
- Canon promotion + citations: contradiction resolution promotes user choices into pinned canon (`commit_decision`); linter emits `canonCitations` for jump-to-canon UX.
- Clarity/Policy Coach: mode selector, prompts, canon-aware analysis, pin modal, analysis store updates, Expo quick actions, UI polish.

## Phase Checklist

| Phase | Goal | Status | Link |
|------|------|--------|------|
| 1 | Project Graph UX (Expo Web + Tauri v2) | In progress | [Phase 1](#phase-1-project-graph-ux-plan) |
| 2 | Knowledge PRs review surface + hardening | In progress | [Phase 2](#phase-2-knowledge-prs-hardening) |
| 3 | Integrations + Citations (MCP) | Planned | [Phase 3](#phase-3-integrations--citations) |
| 4 | Clarity/Policy Coach | Complete | [Phase 4](#phase-4-claritypolicy-coach) |
| 5 | Widgets & Artifacts + Async (MVP1) | In progress (90%) | [Phase 5](#phase-5-widgets--artifacts--async-mvp1) |

## UI Integration Analysis (MLP1 Phase 1)

Overall completion: ~75% - core features done, P0 blockers resolved.

**Done (13 items)**
- EntityFormModal, RelationshipFormModal, JsonSchemaObjectEditor
- Project Graph CRUD: create/edit entity, create/edit relationship
- "Open Project Graph" in editor + command palette
- Registry-driven type selector + lock/unlock in settings
- Client-side Convex error parser
- Expo Web Project Graph components
- Knowledge PRs inbox (Web + Expo) with cursor-based pagination
- Rollback confirmation modal (Web + Expo) with impact analysis
- Coach mode selector + PolicyCompliancePanel

**Missing (3 items)**
- Registry editor UI - no UI to edit types/schemas
- Graph delete with confirmation - optional but recommended
- Universal entity profile page - spec exists, no implementation

**Partial (4 items)**
- Relationship filters on graph (only entity type filters exist)
- Focus mode / depth-based neighborhood
- Icon/color defaults for non-writer templates
- Approvals UI diffs + risk rationale

## Phase 1: Project Graph UX Plan

Goal: editable Project Graph with registry-enforced validation and risk-aware approvals, running in Expo Web and shipped via Tauri v2.

- Graph UX: open Project Graph, create/edit entity, create/edit relationship, delete with confirmation.
- Schema-driven editors: JSON Schema object editor; relationship metadata editor.
- Registry-driven UI: type selector from resolved registry, icon/color defaults for non-writer templates, relationship filters + focus mode.
- Validation + error contract: AJV reject-only and explicit error codes (`INVALID_TYPE`, `SCHEMA_VALIDATION_FAILED`, `REGISTRY_LOCKED`).
- Approvals: persist previews, show diffs + risk rationale, apply approvals via tool calls and activity log.
- Expo Web + Tauri v2: bundle compatibility (ELK layout + ReactFlow), Tauri v2 shell points to Expo Web.
- E2E testability: add stable `data-testid` coverage for modals, registry editor, approvals, create/delete.


## Phase 2: Knowledge PRs Hardening

Goal: production-grade review surface where every PR is actionable, diffs are readable, approvals are safe, rollbacks are reliable, and provenance is navigable.

### P1 Important (post-beta)

| # | Item | Status | Action Needed |
|---|------|--------|--------------|
| 3 | Web Entity/Relationship Diffs | Expo done | Port DiffList from Expo `KnowledgeSuggestionDetails.tsx` to Web `KnowledgePRsView.tsx` |
| 4 | JSON Patch Viewer | Not started | Create `JsonPatchView` component for `normalizedPatch` |
| 5 | Provenance Deep-links | Partial | Add "Open memory" navigation in Expo, add provenance section in Web |
| 6 | Activity Query in Web | Missing | Port `activity.listBySuggestion` integration from Expo to Web |

### P2 Nice-to-have

| # | Item | Status | Notes |
|---|------|--------|-------|
| 7 | Unified Suggestions | Not started | Requires migration or unified query across `documentSuggestions` + `knowledgeSuggestions` |
| 8 | Late-apply Anchoring | Basic | `selectionText` stored but fuzzy re-anchoring not implemented |

## Phase 3: Integrations + Citations

- Integrations settings: connect/disconnect, scopes, status, and audit.
- Evidence viewer: show source documents/excerpts and canon citation metadata; deep-link from lint/coach issues.
- Promote-to-model: promote evidence into the Living Model via Knowledge PRs with citations.

## Phase 4: Clarity/Policy Coach

- Coach mode selector (Writing / Clarity / Policy) with taxonomy-aware labels.
- Issue UI: ambiguity/unverifiable/not-testable/policy-conflict categories while preserving the "issue + suggested fix" structure.

## Phase 5: Widgets & Artifacts + Async (MVP1)

Goal: keyboard-first widget execution pipeline: **command → preview → confirm → inline insert or saved artifact**, with **receipts by default**, **async notifications**, and **no entity mutations**.

Docs:
- Artifact spec: [ARTIFACTS_SPEC.md](./ARTIFACTS_SPEC.md)
- Widget spec: [WIDGETS.md](./WIDGETS.md), [WIDGETS_UX_FLOW.md](./WIDGETS_UX_FLOW.md)
- Implementation plan: [WIDGETS_MVP1_IMPLEMENTATION_PLAN.md](./WIDGETS_MVP1_IMPLEMENTATION_PLAN.md)
- Convex components: `@convex-dev/workpool`, `@convex-dev/workflow`, `@convex-dev/expo-push-notifications`

### Done (75%)

| Component | What's Shipped | Files |
|-----------|----------------|-------|
| **Artifact Schema** | `artifacts`, `artifactVersions`, `artifactMessages`, `artifactOps` tables | `convex/schema.ts` |
| **Artifact CRUD** | create, updateContent, appendMessage, applyOp, getByKey, list | `convex/artifacts.ts` |
| **Artifact Lifecycle** | `setStatus` mutation + transition enforcement + audit fields | `convex/artifacts.ts`, `convex/schema.ts` |
| **Artifact Engine** | Domain ops → JSON Patch, revision test, optimistic concurrency | `packages/core/src/artifacts/engine.ts` |
| **Artifact Iteration (AI)** | OpenRouter-backed iteration action + persisted message history | `convex/ai/artifactIteration.ts` |
| **Compare Mode** | Split view / diff views (Web), stacked compare (Expo) | `packages/state/src/artifact.ts`, `apps/*/src/components/artifacts/` |
| **Staleness** | Source tracking, `checkStaleness` query, external source handling | `convex/artifacts.ts` |
| **Receipts Block (v1)** | Inline `artifactReceipt` editor node with staleness, sources, commands | `packages/editor/src/extensions/artifact-receipt.ts`, `apps/web/src/components/canvas/Canvas.tsx` |
| **Collaboration Tools** | view_version_history, delete_document, view_comments, add_comment, search_users (agent + backend + client) | `convex/ai/tools/collaborationTools.ts`, `convex/ai/agentRuntime.ts`, `convex/revisions.ts`, `convex/comments.ts`, `convex/documents.ts`, `convex/users.ts` |
| **Tool Executors** | Client-side executors wired to Convex | `apps/web/src/tools/executors/` |
| **Artifact Renderers** | prose (+ dialogue/lore/code/map variants), table, diagram, timeline, chart, outline, entityCard (11 types) | `apps/web/src/components/artifacts/runtime/` |
| **Thread Summarization** | Token estimation, auto-summarization thresholds, summarize action, new thread with summary | `convex/ai/summarizeThread.ts` |
| **Artifact Sync** | Expo hydration from Convex | `apps/expo/src/hooks/useArtifactSync.ts` |
| **Canvas Integration** | Insert artifact content, revision with artifactVersionId | `apps/web/src/components/canvas/Canvas.tsx` |
| **Artifact Export** | Runtime PNG/SVG/JSON + Artifact Panel PDF export + batch JSON (batch PDF is text-first) | `apps/web/src/components/artifacts/ArtifactPanel.tsx`, `apps/web/src/services/export/artifacts/pdf.ts`, `apps/web/src/components/artifacts/runtime/` |
| **Artifact References (v0)** | References/backlinks + graph view in Artifact Panel | `apps/web/src/components/artifacts/ArtifactReferences.tsx`, `apps/web/src/components/artifacts/ArtifactGraph.tsx` |

### Missing (25%)

| Component | What's Needed | Priority |
|-----------|---------------|----------|
| **Widget Execution Pipeline** | `widgetExecutions` table, `/ai/widgets` streaming, progress UI, preview modal, slash menu | P0 |
| **Async Infrastructure** | `notificationInbox` table, workpool for long jobs, in-app toasts + inbox | P0 |
| **Receipts Block (v1)** | Done - TipTap extension with staleness, sources, commands | Complete |
| **Deep Linking (Web)** | URL routing, navigation from artifact links, copy link UI | P2 |
| **Batch PDF (rendered)** | Offscreen runtime render per artifact (SVG/PNG) + page-per-artifact PDF assembly | P2 |
| **Platform Push** | Expo push, Web push (VAPID), Tauri OS notifications | P3 (post-MLP1) |

### MLP1 Gap Analysis (What's Missing)

| Area | Item | Priority | Complexity | Effort | Notes |
|------|------|----------|------------|--------|-------|
| **Widgets (P0)** | Widget execution pipeline | P0 | High | 2-3 weeks | `widgetExecutions` table, `/ai/widgets` streaming, progress UI, preview modal |
| | Slash menu widget trigger | P0 | Medium | 3-5 days | Editor integration, filter UI, keyboard navigation |
| **Async (P0)** | Notification inbox | P0 | Medium | 1 week | `notificationInbox` table, inbox UI, toast integration |
| | Workpool for long jobs | P0 | High | 1-2 weeks | `@convex-dev/workpool` setup, job status tracking |
| **Artifacts (P1)** | Receipts block v1 | P1 | Medium | 3-5 days | Source picker, stable UX, stale badge |
| | Batch PDF (rendered) | P2 | High | 1-2 weeks | Offscreen runtime render, SVG/PNG capture, PDF assembly |
| **Deep Links (P1)** | Web URL routing | P2 | Medium | 3-5 days | React Router integration, artifact/{key} routes |
| | Copy link UI | P2 | Low | 1-2 days | Menu items, clipboard integration |
| **Billing (P1)** | RevenueCat native SDK | P1 | Medium | 1 week | iOS/macOS device testing |
| | App Store products | P1 | Low | 2-3 days | Dashboard config, entitlement mapping |
| | E2E purchase flow | P1 | Medium | 3-5 days | Real device testing, error handling |
| **Platform (P2)** | Expo push | P3 | Medium | 1 week | `@convex-dev/expo-push-notifications` |
| | Web push (VAPID) | P3 | Medium | 1 week | Service worker, subscription flow |
| | Tauri OS notifications | P3 | Low | 2-3 days | Native API bridge |
| **Graph (P2)** | Registry editor UI | P2 | High | 2 weeks | Type/schema editor, validation UI |
| | Graph delete cascade | P2 | Medium | 3-5 days | Cascade policy, cleanup handlers |
| | Universal entity profile | P2 | Medium | 1 week | Profile page, relationship view |
| **Knowledge PRs (P1)** | Web entity/rel diffs | P1 | Medium | 3-5 days | Port DiffList from Expo |
| | JSON Patch viewer | P1 | Low | 2-3 days | `JsonPatchView` component |
| | Provenance deep-links | P1 | Low | 2-3 days | "Open memory" navigation |
| **AI Tools (P2)** | Image generation tools | P2 | Medium | 1 week | Wire `generateImageTool`, `illustrateSceneTool` |
| | Image search tools | P2 | Low | 2-3 days | Wire `search_images`, `find_similar_images` |
| **Export (P2)** | ePub export | P2 | High | 2 weeks | Publishing workflow, metadata |
| | Manuscript compile | P2 | High | 2 weeks | Scrivener-style output |

### Missing UI Components

| Area | Component | Priority | Complexity | Effort | Notes |
|------|-----------|----------|------------|--------|-------|
| **Collaboration Tools** | `AddCommentApprovalCard` | P1 | Low | 1-2 days | HITL approval UI in AI chat for `add_comment` tool |
| | `DeleteDocumentApprovalCard` | P1 | Low | 1-2 days | HITL approval UI with destructive warning styling |
| | `VersionHistoryResultCard` | P1 | Medium | 2-3 days | Display version history in chat, diff preview, restore action |
| | `CommentsResultCard` | P1 | Low | 1-2 days | Display comments list in chat with author, timestamp, selection context |
| | `UserSearchResultCard` | P1 | Low | 1 day | Display user search results for @mention picker |
| **Widgets** | Widget progress indicator | P0 | Medium | 2-3 days | Spinner/progress bar during widget execution |
| | Widget preview modal | P0 | Medium | 3-5 days | Preview artifact before confirm/apply |
| | Slash menu widget picker | P0 | Medium | 3-5 days | `/widget` filter UI with categories, keyboard nav |
| | Widget error state | P0 | Low | 1 day | Error display with retry action |
| **Artifacts** | Receipts source picker | P1 | Medium | 2-3 days | Dropdown/modal to select artifact sources |
| | Artifact staleness badge | P1 | Low | 1 day | Visual indicator for stale artifacts |
| | Artifact compare toggle | P1 | Low | 1 day | Button to toggle split/diff view modes |
| **Async/Notifications** | Notification inbox panel | P0 | Medium | 3-5 days | Inbox UI with filters, mark read, actions |
| | Toast notification system | P0 | Medium | 2-3 days | In-app toast for async job completion |
| | Job status indicator | P0 | Low | 1-2 days | Status badge for running background jobs |
| **Knowledge PRs** | `DiffList` (Web) | P1 | Medium | 3-5 days | Port from Expo `KnowledgeSuggestionDetails.tsx` |
| | `JsonPatchView` | P1 | Low | 2-3 days | Render `normalizedPatch` as readable diff |
| | Provenance link | P1 | Low | 1 day | "Open memory" / "View source" navigation |
| | Rollback impact preview | P1 | Low | 1-2 days | Show affected entities before rollback |
| **Project Graph** | Registry editor modal | P2 | High | 1-2 weeks | CRUD for entity/relationship types, JSON Schema editor |
| | Entity profile page | P2 | Medium | 1 week | Full entity view with relationships, history, mentions |
| | Delete confirmation modal | P2 | Low | 1-2 days | Cascade warning, affected items list |
| | Relationship filters | P2 | Medium | 2-3 days | Filter graph by relationship type (only entity filters exist) |
| | Focus mode / depth selector | P2 | Medium | 2-3 days | Neighborhood-based graph filtering |
| **Deep Links** | Copy link menu items | P2 | Low | 1 day | "Copy link to block/artifact" in context menus |
| | Link preview tooltip | P2 | Low | 1-2 days | Hover preview for `rhei://` links |
| **Editor** | Heading toolbar buttons | P2 | Low | 1 day | ## / ### buttons like Ulysses (currently only shortcuts) |
| | Image placeholder menu | P2 | Low | 1 day | Click handler for `/image` block |

**UI Effort Total (P0):** ~3-4 weeks for blocking UI
**UI Effort Total (P1):** ~2-3 weeks for complete experience
**UI Effort Total (P2):** ~4-5 weeks for polish items

**Complexity Key:** Low = straightforward implementation, Medium = moderate architecture, High = significant design/coordination

**Effort Key:** Assumes single developer, includes testing. Actual time varies by familiarity.

**Priority Key:**
- **P0**: Blocks MLP1 launch
- **P1**: Required for complete MLP1 experience
- **P2**: Nice-to-have for MLP1, can ship after
- **P3**: Post-MLP1 / MLP2 scope

## Billing & Monetization (75%)

**Done:**
- Stripe: `/stripe-checkout`, `/stripe-portal` routes; webhook signature verification; `billingCustomers` mapping.
- RevenueCat: webhook processing (idempotent + ordering guard); grace period handling; dual-secret support.
- Billing core: canonical subscription updates; entitlement-first tier resolution; `subscriptions`, `subscriptionEvents`, `billingUsagePeriods` tables.
- BYOK: `x-openrouter-key` passthrough; quota bypass; preferred model stored + used; `/billing-mode`, `/billing-preferred-model` endpoints.
- Quota enforcement: preflight checks + max_tokens clamp; `useQuotaGuard` hook (Web + Expo); usage warning toasts.
- UI: `PaywallModal` (Craft-inspired Pro/Team); `useBilling` hook; BYOK settings (Web SettingsModal + Expo AI Settings).

**Remaining:**
- RevenueCat native SDK testing on iOS/macOS devices.
- App Store Connect product configuration (identifiers, pricing).
- RevenueCat dashboard product setup + entitlement mapping.
- End-to-end purchase flow testing on real devices.

## AI Tools Overview

### Active Tools (19 registered in agentRuntime.ts)

| Category | Tool | Purpose | Approval |
|----------|------|---------|----------|
| **Human-in-the-Loop** | `ask_question` | Multi-tab question UI with rich options | User input |
| | `write_content` | Propose content changes | User approval |
| | `commit_decision` | Save decisions to memory | User approval |
| **Search (RAG)** | `search_context` | Search docs/entities/memories (use `scope` param) | Auto |
| | `read_document` | Read full document content | Auto |
| | `get_entity` | Get entity details + relationships | Auto |
| **Web Research** | `web_search` | Search the internet (Parallel Web) | Auto |
| | `web_extract` | Extract full page content from URL | Auto |
| **Entity Management** | `graph_mutation` | Create/update/delete entities + relationships | Risk-based |
| **Analysis** | `analyze_content` | Unified analysis (entities/consistency/logic/clarity/policy) | Auto |
| | `analyze_image` | Extract visual details from image | Auto |
| **Project Setup** | `project_manage` | Bootstrap project (template + seed flag) | User approval |
| | `generate_template` | Create template draft (used internally) | User approval |
| **Planning** | `write_todos` | Track tasks with status (Claude Code style) | Auto |
| | `spawn_task` | Run sub-agent (research/analysis/writing) | Auto |
| **Collaboration** | `view_version_history` | View document revision history | Auto |
| | `view_comments` | List comments on a document | Auto |
| | `search_users` | Search project members for @mentions | Auto |
| | `add_comment` | Add comment to document | User approval |
| | `delete_document` | Soft-delete a document | User approval |

### Defined but Not Registered

| Tool | Location | Status |
|------|----------|--------|
| `generateImageTool` | projectGraphTools.ts | Handler exists, not wired to agent |
| `illustrateSceneTool` | projectGraphTools.ts | Handler exists, not wired to agent |
| `analyzeImageTool` | projectGraphTools.ts | Handler exists; tool not registered in agent |
| `search_images` | tools.ts handler | Ready to wire |
| `find_similar_images` | tools.ts handler | Ready to wire |

### Removed Tools (Consolidated)

| Tool | Replacement |
|------|-------------|
| `search_chapters` | `search_context({ scope: "documents" })` |
| `search_world` | `search_context({ scope: "entities" })` |
| `genesis_world` | `project_manage({ action: "bootstrap" })` |

### Planned Tools (Not Wired)

| Tool | Purpose | Notes |
|------|---------|-------|
| `graph_mutation` delete | Delete entities/relationships | Needs cascade policy + cleanup |

### Consolidation (Delivered)

| Legacy set | Replacement | Notes |
|------------|-------------|-------|
| 8 entity/graph tools | `graph_mutation` | Single tool with action + target |
| 4 analysis tools | `analyze_content` | Mode-based analysis tool |

### Tool Implementation Paths

- Tool definitions: `convex/ai/tools/*.ts`
- Tool handlers: `convex/ai/tools.ts` (executeToolWithContext)
- Agent runtime: `convex/ai/agentRuntime.ts` (tools object)
- Type definitions: `packages/agent-protocol/src/tools.ts`
- Client executors: `apps/web/src/tools/executors/*.ts`
- Client registry: `apps/web/src/tools/registry.ts`

### Sub-Agents (native)

Factory in `convex/ai/agentRuntime.ts`:

| Agent | Tools | System Prompt Focus |
|-------|-------|---------------------|
| **research** | web_search, web_extract, search_context, read_document, get_entity | Citations-first, summarize sources |
| **analysis** | analyze_content, search_context, read_document, get_entity | Structured issues + recommendations |
| **writing** | search_context, read_document, get_entity | Proposed edits + rationale |

Flow: `spawn_task` → `createSubAgent(spec)` → tool loop (4 iterations) → return output.

### Image Pipeline

| Component | Location | Purpose |
|-----------|----------|---------|
| `ImagePicker` | `packages/ui/src/components/image-picker.tsx` | Shared upload/URL/assets picker |
| `ImageInsertModal` | `apps/web/src/components/shared/ImageInsertModal.tsx` | Modal wrapper for editor |
| `ImagePlaceholder` | `packages/editor/src/extensions/image-placeholder.ts` | Notion-style "Add image" block |
| `embedImageAsset` | `convex/ai/imageEmbeddings.ts` | CLIP embedding via DeepInfra |
| `deepinfraImageEmbedding` | `convex/lib/providers/deepinfraImageEmbedding.ts` | CLIP API client |

Storage flow:
```
Upload → Convex _storage → projectAssets table → Qdrant saga_images (CLIP 512-dim)
```

Env vars:
- `QDRANT_IMAGE_COLLECTION=saga_images`
- `QDRANT_IMAGE_VECTOR_NAME=image`

## Platform Strategy

- Editor bundle built once in `packages/editor-webview/` and used across platforms.
- Priority order: Expo Web -> macOS (Tauri v2) -> iOS/iPad (Expo + WebView).

**Landing Page Migration (Vite -> Expo Web)**
1. ✅ Create `(marketing)/_layout.tsx` with minimal chrome.
2. ✅ Port `LandingPage.tsx` to `apps/web/src/pages/LandingPage.tsx`.
3. Port pricing/docs routes.
4. Update Tauri `devUrl` to Expo Web `:19006`.
5. Update Tauri `frontendDist` to Expo export output.
6. ✅ Deleted `apps/website/` (2026-01-11).

## Onboarding Flow (First Run)

Trigger: first app use.

1. Welcome - set up writing environment.
2. Flow Mode - choose Focus Mode vs Full View.
3. Focus Level - sentence / paragraph / none (if Flow Mode).
4. Typewriter Scrolling - keep cursor centered on/off.
5. AI + Notifications - quiet / gentle / always available.
6. Confirmation - save selections; change anytime in Settings.

State: stored in localStorage for completion; preferences written to the flow store.
Paths: `muse/apps/web/src/components/onboarding/`, `muse/packages/state/src/progressive.ts`, `muse/packages/state/src/flow.ts`.

## Export/Import (Centralize to @mythos/io)

Status: built in `apps/web/src/services/`, needs centralization for Tauri/Expo reuse.
Current paths: `muse/apps/web/src/services/export/*`, `muse/apps/web/src/services/import/*`.

1. Create `packages/io/` with package.json.
2. Move export/ and import/ from apps/web.
3. Add platform-aware `download.ts` and `fileReader.ts`.
4. Update apps/web imports to `@mythos/io`.
5. Wire up Tauri + Expo.

## Key Implementation Paths (selected)

**Project Graph + registry**
- `muse/convex/projectTypeRegistry.ts`
- `muse/convex/lib/typeRegistry.ts`
- `muse/convex/ai/tools/projectGraphTools.ts`
- `muse/convex/ai/tools/projectGraphHandlers.ts`
- `muse/apps/web/src/components/modals/EntityFormModal.tsx`
- `muse/apps/web/src/components/modals/EntitySuggestionModal.tsx`
- `muse/apps/expo/src/components/project-graph/`

**Knowledge PRs**
- `muse/convex/knowledgeSuggestions.ts`
- `muse/convex/schema.ts`
- `muse/apps/web/src/components/console/KnowledgePRsView.tsx`
- `muse/apps/expo/src/components/knowledge/*`
- `muse/packages/editor-webview/src/components/EditorShell.tsx`
- `muse/packages/commands/src/definitions/navigation.ts`

**MCP + citations**
- `muse/packages/mcp-server/src/index.ts`
- `muse/packages/mcp-server/src/tools.ts`
- `muse/packages/mcp-server/src/resources.ts`
- `muse/convex/ai/canon.ts`
- `muse/convex/ai/lint.ts`
- `muse/convex/ai/tools.ts`

**Coach (Writing / Clarity / Policy)**
- `muse/apps/web/src/components/console/CoachView.tsx`
- `muse/apps/web/src/components/modals/PinPolicyModal.tsx`
- `muse/convex/ai/coach.ts`
- `muse/convex/ai/prompts/clarity.ts`
- `muse/convex/ai/prompts/policy.ts`
- `muse/convex/ai/prompts/coach.ts`
- `muse/packages/core/src/analysis/types.ts`
- `muse/packages/agent-protocol/src/tools.ts`

**Focus Mode (Flow)**
- `muse/packages/state/src/flow.ts`
- `muse/packages/state/src/editorMetrics.ts`
- `muse/packages/editor-webview/src/extensions/flow-focus.ts`
- `muse/packages/editor-webview/src/extensions/typewriter-scroll.ts`
- `muse/packages/editor-webview/src/styles/flow.css`
- `muse/apps/expo/src/components/flow/*`
- `muse/apps/web/src/components/flow/*`
- `muse/convex/flowSessions.ts`
- `muse/apps/web/src/hooks/useGlobalShortcuts.ts`

**Planning Tools + Sub-Agents**
- `muse/convex/ai/tools/planningTools.ts` (write_todos, spawn_task schemas)
- `muse/convex/ai/todos.ts` (createTodos, getByThread, getByProject)
- `muse/convex/ai/agentRuntime.ts` (getSubAgentSpec, createSubAgent, tool handlers)
- `muse/packages/agent-protocol/src/tools.ts` (TodoItem, TodoStatus, SubAgentType)
- `muse/apps/web/src/components/console/AISidebar/TodoListCard.tsx`
- `muse/apps/web/src/components/console/AISidebar/SpawnTaskCard.tsx`
- `muse/apps/web/src/tools/executors/writeTodos.ts`
- `muse/apps/web/src/tools/executors/spawnTask.ts`

**Image Pipeline**
- `muse/packages/ui/src/components/image-picker.tsx` (shared ImagePicker)
- `muse/apps/web/src/components/shared/ImageInsertModal.tsx`
- `muse/packages/editor/src/extensions/image-placeholder.ts`
- `muse/convex/ai/imageEmbeddings.ts` (embedImageAsset, deleteImageEmbeddings)
- `muse/convex/lib/providers/deepinfraImageEmbedding.ts` (CLIP client)
- `muse/convex/projectAssets.ts` (saveAsset, storeFromUrl)
- `muse/apps/web/src/components/console/AISidebar/ChatInput.tsx` (drag-drop, paste)

**Platform shells**
- `muse/apps/expo/`
- `muse/apps/tauri/src-tauri/tauri.conf.json`
- `muse/apps/tauri/src-tauri/tauri.macos.conf.json`
- `muse/apps/expo/app/(marketing)/`

**Workspace/Project Creation (Expo)**
- `muse/apps/expo/src/components/projects/ProjectPickerDropdown.tsx`
- `muse/apps/expo/src/components/projects/CreateWorkspaceWizard.tsx`
- `muse/apps/expo/src/hooks/useProjects.ts`
- `muse/apps/expo/src/components/layout/Sidebar.tsx`

**Workspace/Project Creation (Web - reference)**
- `muse/apps/web/src/components/projects/ProjectPickerSidebar.tsx`
- `muse/apps/web/src/components/modals/TemplatePickerModal/`
- `muse/apps/web/src/stores/navigation.ts`

## Risks / Gaps

- Registry editor UI missing; blocks non-writer template management.
- Relationship metadata editor pending; limits schema-complete graphs.
- Universal entity profile page not implemented.
- Template icon/color defaults incomplete for non-writer templates.
- Web entity/relationship diffs missing (Expo has them).
- Canvas heading shortcuts (##, ###) missing from toolbar; add formatting buttons like Ulysses.

## MLP1 → MLP2 Bridge (Recommended Path)

Finish MLP1, then bridge to MLP2 Proactivity via Coherence:

| Step | Deliverable | Spec |
|------|-------------|------|
| 1 | Widgets MVP1 pipeline + approvals + receipts | [WIDGETS.md](./WIDGETS.md) |
| 2 | Universal Entity Profile page | [Planned] |
| 3 | Phase 1.5 async jobs/notifications (workpool + inbox) | [Phase 1.5](#phase-15-async--notifications) |
| 4 | Pulse + Coherence checks (MLP2 entry) | [COHERENCE_SPEC.md](./COHERENCE_SPEC.md), [MLP2](./MLP2_PROACTIVITY_ENGINE.md) |

**Coherence phases (writer-first):**
1. Project profiles + session vectors (Flow Mode speed layer)
2. Individual profile pipeline (voice centroid + overuse)
3. UX: underlines + status bar + Pulse panel
4. Expand to other personas (Researcher → Product → Engineer → Marketing/Comms)

## Schema Sync Issues

**✅ RESOLVED: Convex ↔ @mythos/core Project type mismatch**
- Fixed: `@mythos/core` now uses `projectTemplateIdSchema` with Convex IDs (`writer`, `product`, `engineering`, `design`, `comms`, `custom`).
- Old writer preset IDs (`epic_fantasy`, `wizarding_world`, etc.) moved to deprecated `writerPresetIdSchema`.
- Shared mapper `mapConvexProjectToCoreProject()` handles Convex → Core conversion with legacy field support.
- `LooseProject` type allows flexible config access; `Project` (discriminated union) for strict typing when needed.
- Expo `as any` hacks removed from `CreateWorkspaceWizard`, `ProjectPickerDropdown`.

**Template categories:**
- Convex templates: `writer`, `product`, `engineering`, `design`, `comms`, `custom`.
- Expo wizard maps: Work → `product`, Daily Life → `writer`, Learning → `comms`, AI Builder → `custom`.
