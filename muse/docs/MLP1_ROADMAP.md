# MLP 1: AI Co-Author Roadmap

> Last Updated: 2026-01-11 (Flow Mode extensions; template builder enhancements; web research tools; ask_question multi-tab UI)
> Target: Expo Web + macOS first, then iOS/iPad
>
> See also: [Living Memory OS](./MLP1_LIVING_MEMORY_OS.md)
> See also: [MLP2 Proactivity Engine](./MLP2_PROACTIVITY_ENGINE.md)

## Purpose

Compact roadmap and status snapshot for MLP1. Keep detailed specs in code or design docs; use this as the source of truth for scope, status, and next steps.

## Summary (What MLP1 ships)

- Project Knowledge System: templates, registries, Project Graph, and schema validation.
- AI co-author with explicit approvals; Focus Mode keeps AI silent unless invoked.
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
| Supabase -> Convex Migration | Done | 100 |
| Real-Time Collaboration | In progress | 80 |
| Overall MLP 1 | In progress | 95 |

## Recent Updates (condensed)

**2026-01-11 (night)**
- Flow Mode: added FlowFocus extension (iA Writer-style sentence/paragraph dimming), TypewriterScroll extension, FlowTimerPanel with break reminders, EditorMetrics store for word count tracking.
- Template Builder: enhanced with project type selection, PhaseIndicator for build phases, ProgressiveTemplatePreview for live preview, domain-specific questions per project type.
- Website: removed deprecated `apps/website/` (landing page moved to `apps/web/src/pages/`).

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

### P0 Blockers (ship before beta)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Rollback Confirmation Modal | ✅ Done | `RollbackConfirmModal.tsx` in Web + Expo; queries `getRollbackImpact`, shows cascade warnings |
| 2 | Server-side Pagination | ✅ Done | PAGE_SIZE=50; Web "Load more" button, Expo FlatList `onEndReached` |

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

## AI Tools Overview

### Active Tools (Registered)

| Category | Tool | Purpose | Approval |
|----------|------|---------|----------|
| **Human-in-the-Loop** | `ask_question` | Multi-tab question UI with rich options | User input |
| | `write_content` | Propose content changes | User approval |
| | `commit_decision` | Save decisions to memory | User approval |
| **Internal Search (RAG)** | `search_context` | Search project docs/entities/memories | Auto |
| | `read_document` | Read specific document | Auto |
| | `search_chapters` | Search chapters | Auto |
| | `search_world` | Search entities | Auto |
| | `get_entity` | Get specific entity | Auto |
| **Web Research** | `web_search` | Search the internet (Parallel Web) | Auto |
| | `web_extract` | Extract full page content from URL | Auto |
| **Entity Management** | `create_entity` | Create character, location, item, etc. | Risk-based |
| | `update_entity` | Update entity properties | Risk-based |
| | `create_relationship` | Connect entities | Risk-based |
| | `update_relationship` | Modify relationship | Risk-based |
| | `create_node` / `update_node` | Graph nodes | Risk-based |
| | `create_edge` / `update_edge` | Graph edges | Risk-based |
| **Templates** | `generate_template` | Create project template | User approval |

### Planned Tools (Defined, Not Wired)

| Tool | Purpose | Generalization Notes |
|------|---------|---------------------|
| `check_consistency` | Find contradictions in content | Works for any domain with structured data |
| `detect_entities` | Extract entities from text | Already general - works for any content type |
| `check_logic` | Validate against defined rules | Rename to `validate_constraints`? |
| `clarity_check` | Analyze content quality | Rename to `analyze_quality`? |
| `name_generator` | Generate contextual names | Keep for creative workflows |
| `genesis_world` | Bootstrap project structure | Rename to `bootstrap_project`? |
| `search_images` | Search project image assets | Ready to wire up |
| `generate_image` | Generate images | Ready to wire up |
| `delete_entity` / `delete_relationship` | Delete operations | Ready to wire up |

### Tool Implementation Paths

- Tool definitions: `convex/ai/tools/*.ts`
- Agent runtime: `convex/ai/agentRuntime.ts`
- Type definitions: `packages/agent-protocol/src/tools.ts`
- Client executors: `apps/web/src/tools/executors/*.ts`
- Client registry: `apps/web/src/tools/registry.ts`

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

**Platform shells**
- `muse/apps/expo/`
- `muse/apps/tauri/src-tauri/tauri.conf.json`
- `muse/apps/tauri/src-tauri/tauri.macos.conf.json`
- `muse/apps/expo/app/(marketing)/`

## Risks / Gaps

- Registry editor UI missing; blocks non-writer template management.
- Relationship metadata editor pending; limits schema-complete graphs.
- Universal entity profile page not implemented.
- Template icon/color defaults incomplete for non-writer templates.
- Web entity/relationship diffs missing (Expo has them).
