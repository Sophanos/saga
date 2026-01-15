# Widgets & Artifacts

> Last updated: 2026-01-15

**Related docs:**
- `WIDGETS_UX_FLOW.md` - Detailed UX flows, adjustment patterns, Activity Bell/Inbox UI
- `MLP1_ROADMAP.md` - Implementation status

## 1. Problem + Positioning

**Freedom with receipts.** Users can create artifacts with minimal friction, and the system attaches provenance by default.

Generative outputs are table stakes. Widgets and artifacts alone are not a defensible USP; the defensible layer is governance, provenance, the living model, and automation. We deliver governed command-to-artifact automation that stays lightweight in the UI.

**USP: Governed Command-to-Artifact Automation**
"From command to deliverable - governed, versioned, and linked to your project's living model."

**Moat:**
- Deep understanding (project graph + memory)
- Receipts by default (manifest with sources)
- Governed autonomy (explicit invocation, safe by default)
- Artifact lineage (diffable, attributable, reversible)
- Automation when asked (schedule/watch/agent)

**Artifacts with receipts means:**
- What it is (type, schema)
- Why it says what it says (sources, citations)
- What it changed (model updates, suggestions)
- Who approved it (approval trail)
- How to reproduce it (inputs, widget version, model version)

MVP1 ships a minimal subset of receipts; the full manifest expands in Future.

## 2. Principles
- Explicit invocation: AI stays silent unless asked. /watch is opt-in.
- Receipts by default: every artifact has a manifest with sources.
- Single pipeline, many lenses: writer/comms/engineer are recipes on the same core.
- Artifacts are deliverables, not chat responses.
- Progressive depth: start with simple widgets, add governance and automation later.
- Human control first: confirmations before writes, easy cancel/fork.

### UI/UX design targets (MVP1)
- One deliberate action: command -> preview -> confirm -> apply/save.
- Quiet surfaces: no stacked modals, no extra panes, no popups.
- Writing-first: output is plain Markdown, style later.
- Provenance is present but calm: receipts exist, collapsed by default.
- Keyboard-first: / and Cmd+K share the same command list and recents.
- Minimal copy: short, neutral labels and no assistant chatter.

### One Contract
All features use the same contract and stay connected:
Command -> widget recipe -> artifact deliverable -> manifest receipts.

Widgets define inputs + sources + template; artifacts store output + manifest.
In MVP1, widgets do not mutate entities. They only create inline output or artifacts.

## 3. The Pipeline

Vision: Understand -> Create -> Refine -> Govern -> Automate.

MVP1 is a slice of the vision. Govern is a confirmation modal, and Automate is out.

| Stage | MVP1 | Future |
| --- | --- | --- |
| Understand | Basic entity lookup | Semantic search, style memory, precedents |
| Create | Inline + modal output | Workspace panel, batch |
| Refine | None | Refinement loop, chat iteration |
| Govern | Confirmation modal | Policy packs, approval chains |
| Automate | None | /watch, /agent, scheduling |

### Vision flow example (end-to-end)
Example: `/create spec` from a meeting note.

1) Command invoked with selected notes.
2) Understand resolves entities and gathers relevant docs/memories/precedents.
3) Create renders the spec artifact and records inputs + sources in the manifest.
4) Refine iterates in the workspace with diffs and version history.
5) Govern applies policies and approval chains before publish.
6) Automate schedules refreshes and reacts to changes via /watch.

Output: published artifact with receipts, lineage, and staleness tracking.

## 4. Glossary
- Command: slash invocation like `/create manga`.
- Widget: typed recipe behind a command; some commands are non-widgets (e.g., `/help`).
- Artifact: saved output (inline content, document, or media) with a manifest.
- Manifest: receipts attached to an artifact (sources, status, and metadata).
- Living Model: project graph + decisions + memories + relationships.
- Entity: node in the project graph (character, feature, campaign, etc).
- Execution Marker: hidden metadata in editor linking applied text to execution ID.
- Widget Thread: conversation created for each widget execution; enables refinement and iteration.

### Widget = Thread Model

Every widget execution creates a **thread** (conversation). Widgets are not fire-and-forget; they're interactive and refinable.

```
/summarize → creates thread → user can refine → agent learns preferences
```

**Key behaviors:**
- Click inline widget block → opens AI panel with thread
- Click artifact card → opens artifact panel with thread
- User can continue conversation to refine output
- Thread history preserved for future reference
- Agent can propose learning from user interventions

See `WIDGETS_UX_FLOW.md` for detailed interaction flows.

### Widget as Agent

Widgets are agent executions. Complex widgets can spawn sub-agents for parallel or sequential work.

**Sub-agent patterns:**
- Multi-section artifact → parallel agents per section
- Research + generate → sequential agents
- Multi-entity scope → fan-out agents per entity
- Validation → generate agent + lint agent

**Visibility:** Single thread with expandable sub-task progress. User sees one conversation, can expand to see what sub-agents did.

See `WIDGETS_UX_FLOW.md` for detailed sub-agent patterns and UI.

## 5. MVP1 Spec

### Scope
- Understand: basic entity lookup by name or id.
- Create: inline output and modal preview, then save artifact.
- Refine: none (no AI refinement loop).
- Govern: confirmation modal before writes.
- Automate: none (no /watch, no scheduling).
- No entity mutations; widgets only create inline output or artifacts.

### Artifact types (MVP1)
- Text-first artifacts (markdown docs, summaries, specs, notes).
- Inline text expansions/edits.
- Diagrams and non-text media (image/audio) out of scope.

### Manifest (MVP1)
| Field | Purpose |
| --- | --- |
| type | Artifact type |
| status | draft, manually_modified |
| sources[] | Entity/doc references with `addedAt` and `manual` flag |
| createdBy | User ID |
| executionContext | { widgetId, widgetVersion, model, inputs, timestamps } |
| createdAt | Timestamp |
| sourceUpdatedAt | Stored per source for stale badge |

Manifest is shown inline as a collapsible block attached to the artifact. If there are no sources, show "No sources".

### Manual source tagging (MVP1)
- Manifest block includes an "Add sources" action.
- Source picker supports search across entities and docs; also allows paste of an ID or link.
- Selected sources append to the manifest with `addedAt` timestamp and `manual: true` flag.
- Manual sources update staleness calculation from the moment they're added.
- Users can remove incorrect sources.
- This does not mutate entities; it only updates artifact metadata.

**Source picker UI:**
- Search field with type-ahead across entities and documents.
- Paste ID or link directly into search field for quick add.
- Results grouped by type (Entities | Documents | Memories).
- Truncate long lists within each group with "Show more".
- Selected sources show as chips with remove (×) action.
- Manual sources clearly labeled with "Manually added" + `addedAt` timestamp in receipts.

### Artifact naming/titles
- **Default title:** `{Template} - {Source doc name}` or `{Template} - {Date}` if no source doc.
  - Examples: "Spec - Chapter 3 Notes", "Summary - 2026-01-11"
- **User rename:** Available in confirm modal (editable title field) and after create (inline rename in artifact header).
- **Constraints:** Title required, max 100 chars, no special characters that break file systems.

### Staleness
- Store sourceUpdatedAt when artifact is created.
- On access, compare against current source updatedAt.
- If changed, show "May be stale" badge and offer "Re-run with current context".
- **Source deletion:** Show distinct "Source missing" badge (different from "May be stale"). Block regeneration until user resolves missing sources (remove or replace), then allow re-run.

### Regeneration
- "Re-run with current context" shows diff preview against current artifact before confirming replacement.
- Old version preserved in history.
- Two options: "Re-run same" (one click, identical inputs) vs "Re-run with changes" (review/adjust inputs before regenerating).
- Same-input regenerate only in MVP1 (no refinement prompts).

### Approval flow
- Single confirmation modal before artifact is written.
- No policy packs or approval chains in MVP1.

### Output surfaces
- Inline output and modal preview only.
- No workspace panel or batch UI.

### MVP1 widgets (initial)
Inline widgets:
- `/summarize` (inline summary)
- `/expand` (inline expansion)
- `/rewrite` (tone/style rewrite) - predefined presets + custom freeform
- `/outline` (structured markdown outline with ## headers)
- `/generate name` (name suggestions via inline dropdown)

Artifact widgets (text-only):
- `create_doc` with templates: summary, brief, spec, notes, release-notes
- Command aliases: `/create summary`, `/create brief`, `/create spec`, `/create notes`, `/create release-notes`

Simple prompt widget:
- `/ai` or "Ask AI" - one-shot execution with selection + doc/project context, without saving/sharing.

### Discovery (MVP1)
- `/` opens a simple command menu with search focused.
- `Cmd+K` opens the same command palette with additional filters and parameter hints for power users.
- Show 3-5 recent widget commands at top (per-project scope).
- No recommendations, categories, or widget browser in MVP1.
- No dedicated widget shortcuts in MVP1 (avoid shortcut sprawl).

**Unknown command handling:**
- Fuzzy matching for typos: typing "summ" shows `/summarize`.
- Final option: "Ask AI: [your input]" for freeform prompt fallback.
- "Ask AI" routing: if text selected, run as inline widget (preview + apply); if no selection, open AI panel with prompt prefilled.

### UI/UX surfaces (MVP1)

#### Command menu (slash and palette)
- Minimal overlay list, search-first, close on run or Esc.
- Show 3-5 recent widget commands at top if available.
- Names only in list; description appears when item is focused/hovered.
- `/` is streamlined; `Cmd+K` shows filters and parameter hints.

#### Preview modal (governance)
- Single modal with a simple header, content preview, and two actions.
- Primary action label matches the intent: "Insert Summary", "Create Spec".
- For long content (2000+ words): truncated preview with "Show full preview" expansion.
- Editable title field for artifact naming.
- Optional Receipts disclosure is collapsed by default.
- Cancel should never write; confirm always writes.

**Confirm behavior:**
- Inline apply: modal closes optimistically, write happens in background, error toast if fails.
- Artifact create: modal shows brief "Applying..." then closes on success.

**Escape behavior:**
- Escape prompts "Discard this output?" if generated content exists.
- Cmd+Escape (or double-Escape) discards immediately without prompt.

#### Inline apply
- Apply at cursor or selection with no extra UI chrome.
- Brief inline highlight ("Applied") fades after 3-5 seconds.
- Subtle marker persists (hover to show "Applied" + "Revert" action).
- Execution marker stored as hidden metadata linking text range to execution ID for audit.
- Markers survive copy/paste within project; stripped on cross-project paste.

#### Inline progress tile
- **Position:** Contextual - anchor near insertion point for quick runs; use fixed bottom bar for longer executions to avoid jumpiness.
- **Appearance:** Thinking indicator with concise stage text, expandable for details (like ChatGPT/Grok thinking UI).
- **Stages:** "Gathering context → Generating → Formatting" (adaptive detail by tier).
- **Expandable details:** Collapsible "Show details" panel in tile for tool calls and timing.
- **Cancel:** Graceful with warning - allow cancel anytime, explicit that in-flight generation may take a moment to stop; never write partial output.

#### Artifact receipts block
- Collapsed block titled "Receipts".
- Expanded view shows type, status, createdBy, createdAt, widgetVersion, sources.
- Sources grouped by type (Entities | Documents | Memories) with expand per group.
- If sources are empty, show "No sources".
- Manual sources labeled with "Manually added" + `addedAt` timestamp.
- Include "Add sources", "Re-run same", and "Re-run with changes" actions.
- Show "May be stale" or "Source missing" badge when applicable.

### Execution visibility
- **Default:** Stage labels only ("Gathering context → Generating → Formatting").
- **Expanded:** Tool calls visible ("Reading entity: Elena → Fetching related docs → Calling LLM").
- **Debug mode:** Full agent trace (tool calls, token counts, timing) for power users.
- **Adaptive by tier:** Basic users see stages; Pro/Team see tool calls; debug mode shows full trace.
- **Persistence:** Summary in manifest (stage timings + tool call counts) for audit/provenance; full trace discarded.

### Failure handling

#### Mid-stream failure (LLM timeout, etc.)
- Keep partial output in preview state (invisible cache).
- On retry, offer "Continue" vs "Restart" options.
- Never write partial output on failure.

#### Widget execution errors
- **Tiered display:** Actionable guidance for fixable errors ("Rate limited - try again in 30s", "Context too large - reduce selection"); generic message with optional "Details" expand for system/internal errors.
- Generic error: "Could not generate preview" with Retry and Cancel actions.

#### Dashboard block refresh failure
- Show stale cached content with "Refresh failed" badge and retry action.
- Display lastRunAt and lastSuccessAt in receipts.

### Entity resolution

#### Multi-entity in selection
- Hierarchical priority: anchor on parent doc/scene as primary context, include all detected entities as secondary.
- No extra disambiguation UI unless resolution truly fails.

#### Zero entities in selection
- Warn but allow: proceed with doc/project context, save with sources=[] ("No sources").
- Nudge to "Add sources" for specificity.

#### Ambiguous entity matches
- Threshold-based: auto-pick when confidence is clearly higher; if close, ask the user.
- Simple entity picks shown inline in progress tile.
- Complex/nuanced clarifications use agent ask modal.
- High-impact ambiguity blocks before generation; low-impact proceeds with best-guess and surfaces assumption in preview/receipts.

#### Chat context carry-forward
- Widgets don't depend on ephemeral chat state.
- After chat clarification, offer "Remember this for widgets?" to persist into project memory/decisions.

### Undo and revert
- AI changes grouped as single undo unit (Cmd+Z works).
- Explicit "Revert" action available on applied highlight.
- For `/rewrite`: before/after diff shown in preview modal and accessible via execution marker.

### Double expansion warning
- If `/expand` is run on previously-expanded content, show "Previously expanded" note in preview.
- Still allow proceed.

### Permissions
- Inherit document permissions: view-only users can run read-only widgets (e.g., `/summarize`).
- Any widget that writes (inline apply / artifact save) requires edit permission.

### Concurrent execution (collaboration)
- Optimistic with warning: both collaborators can preview.
- On confirm, detect selection/document version drift.
- Warn "Content changed since preview" with diff and rebase option.

### Manual edits to artifacts
- Staleness based on sourceUpdatedAt continues to trigger.
- On regenerate, warn "will overwrite manual edits".
- Record "manually_modified" flag in manifest status.

### Context pipeline

#### Context gathering visibility
- Configurable per widget: simple widgets stay automatic; complex/high-cost widgets surface "Will use X sources" with adjust step.

#### Token budgeting
- Adaptive budget: scale by model context window + expected output size.
- Truncate least relevant first.
- Record what was omitted in receipts.

### Model selection
- Widget-defined default model.
- Users can override per-widget in settings.
- No per-execution model selector in MVP1.

### UI/UX microcopy (MVP1)
| Surface | State | Copy |
| --- | --- | --- |
| Command menu | Empty search | "No commands found" |
| Command menu | Recent header | "Recent" |
| Command menu | All header | "Commands" |
| Command menu | Fallback option | "Ask AI: {input}" |
| Preview modal | Title (inline) | "Insert Summary" |
| Preview modal | Title (artifact) | "Create Spec" |
| Preview modal | Primary action (inline) | "Insert" |
| Preview modal | Primary action (artifact) | "Create" |
| Preview modal | Secondary action | "Cancel" |
| Preview modal | Long content | "Show full preview" |
| Preview modal | Receipts disclosure | "Receipts" |
| Preview modal | Discard prompt | "Discard this output?" |
| Progress tile | Stage 1 | "Gathering context" |
| Progress tile | Stage 2 | "Generating" |
| Progress tile | Stage 3 | "Formatting" |
| Progress tile | Expand | "Show details" |
| Progress tile | Cancel warning | "Stopping... may take a moment" |
| Receipts block | Collapsed label | "Receipts" |
| Receipts block | Empty sources | "No sources" |
| Receipts block | Add sources | "Add sources" |
| Receipts block | Manual source | "Manually added {date}" |
| Receipts block | Stale badge | "May be stale" |
| Receipts block | Missing badge | "Source missing" |
| Receipts block | Regenerate same | "Re-run same" |
| Receipts block | Regenerate changes | "Re-run with changes" |
| Apply highlight | Inline apply | "Applied" |
| Apply highlight | Revert action | "Revert" |
| Apply highlight | Prior expansion | "Previously expanded" |
| Errors | Preview failure | "Could not generate preview" |
| Errors | Approval failure | "Could not apply changes" |
| Errors | Offline | "Offline - widgets unavailable" |
| Errors | Rate limit | "Rate limited - try again in {time}" |
| Errors | Context too large | "Context too large - reduce selection" |

### Interaction matrix (MVP1)
| Surface | State | Trigger | Result |
| --- | --- | --- | --- |
| Editor | Focused | `/` | Open command menu with search focused |
| Editor | Focused | `Cmd+K` | Open command palette with filters/hints |
| Command menu | Open | `Esc` | Close menu |
| Command menu | Open | `Enter` on item | Run widget, close menu |
| Command menu | Open | Click outside | Close menu |
| Command menu | Open | Arrow keys | Navigate list, show description on focus |
| Command menu | No match | Select "Ask AI" | Route based on selection state |
| Preview modal | Open | `Confirm` | Apply write or create document |
| Preview modal | Open | `Cancel` or `Esc` | Prompt if content exists, then close |
| Preview modal | Open | `Cmd+Esc` | Force close without prompt |
| Preview modal | Open | Toggle "Receipts" | Expand or collapse receipts |
| Preview modal | Open | Toggle "Show full preview" | Expand truncated content |
| Progress tile | Executing | Click "Show details" | Expand execution log |
| Progress tile | Executing | Click "Cancel" | Graceful cancel with warning |
| Receipts block | Collapsed | Click "Receipts" | Expand block |
| Receipts block | Expanded | Click "Receipts" | Collapse block |
| Receipts block | Expanded | Click "Add sources" | Open source picker |
| Receipts block | Expanded | Click "Re-run same" | Start regenerate with same inputs |
| Receipts block | Expanded | Click "Re-run with changes" | Open inputs review, then regenerate |
| Inline highlight | Visible | Hover | Show "Applied" + "Revert" |
| Inline highlight | Visible | Click "Revert" | Undo AI change |
| Suggestions dropdown | Open | Arrow keys | Navigate options |
| Suggestions dropdown | Open | Enter | Insert selected option |
| Suggestions dropdown | Open | Esc | Close dropdown |

### Receipts block layout (MVP1)
- Header row: "Receipts" label, optional "May be stale" or "Source missing" badge.
- Body row 1: type, status, createdBy, createdAt, widgetVersion (single line, small text).
- Body row 2: sources grouped by type (Entities | Documents | Memories) with counts, expand per group.
- Actions row: "Add sources", "Re-run same", "Re-run with changes".

### Dashboard (MVP1)

#### Structure
- Dashboard is a pinned artifact with `type: dashboard`.
- Composed of widget blocks, each storing: widget + inputs + sources + outputArtifactId + lastRunAt + lastSuccessAt.
- **Layout:** Vertical stack with drag-to-reorder (no grid complexity).

#### MVP1 block types
- **Recent/Pinned artifacts:** List of project artifacts with filters.
- **Project status summary:** Entity/doc counts + last updated + short "recent changes" summary.

#### Block behavior
- Manual refresh only; re-run the same widget with the same inputs.
- No scheduling or on-change refresh in MVP1.
- On refresh failure: show stale cached content with "Refresh failed" badge and retry action.

#### Navigation
- Dedicated `/dashboard` route backed by pinned dashboard artifact.
- Accessible from project nav.

### Artifacts view (MVP1)
- Dedicated Artifacts view for browsing all project artifacts.
- Search and filters (by type, status, date, staleness).
- Bulk actions: archive, delete.
- Quick actions: "Show in folder", "Open receipts".
- "Drafts / Needs review" section for artifacts requiring attention.

### Artifact lifecycle

#### Retention
- User-controlled: no auto-cleanup.
- Soft limits with nudge: after N artifacts per project, surface "You have N drafts, archive?" with bulk actions.

#### Location
- Default: source document's folder.
- Lineage always linked in receipts regardless of location.
- Easy move/reorganize after creation.

#### Entity back-links
- Relationship stored in DB (artifacts link to entities via sources).
- Queryable on-demand but not displayed in default entity view in MVP1.
- Surface "Referenced in: [artifact list]" in future.

### MVP1 flow example (manual)
Example: `/create spec` from selected notes.
1) User selects notes and runs `/create spec`.
2) System does basic entity lookup (hierarchical: parent doc primary, detected entities secondary).
3) If ambiguity is high-impact, prompt for clarification; otherwise proceed with best-guess.
4) Progress tile shows stages; user can expand for details or cancel.
5) Preview modal shows truncated content (expand available), editable title, collapsed receipts.
6) User confirms; artifact is saved with manifest (sources, executionContext, widgetVersion).
7) Optional: add sources in the manifest block.
8) If needed, user clicks "Re-run same" or "Re-run with changes" (diff preview before confirm).

### MVP1.5 flow example (toward MVP2)
Example: `/create spec` with refinement.
1) User opens artifact in the viewer and clicks refine.
2) Refinement loop runs; diffs recorded as a new version.
3) User accepts and marks Ready.
4) Dashboard blocks can refresh on open (optional).

### Widget definition structure

#### Prompt format
Structured prompt objects with typed variables:
```typescript
{
  system: string,
  user: string,
  variables: Array<{
    name: string,
    type: 'string' | 'entity' | 'selection' | 'document',
    required: boolean,
    description?: string
  }>
}
```

#### Widget config
```typescript
{
  id: string,
  name: string,
  command: string,           // e.g., "/summarize"
  type: 'inline' | 'artifact',
  prompt: StructuredPrompt,
  defaultModel: string,
  contextBudget: 'adaptive' | number,  // token limit
  clarifyOnAmbiguity: boolean,         // pause for high-impact ambiguity
  costWeight: number,                  // for rate limiting (1 = standard, 5 = expensive)
  outputSchema?: ZodSchema,            // for validation
}
```

#### Template customization (MVP1)
- Core templates system-defined.
- Per-project "Additional instructions" (prompt suffix) allowed.
- No full template editor in MVP1.

### Validation and safety
- System widgets trusted.
- Input validation: check inputs match widget schema.
- Output validation: verify output matches expected type/schema.
- Full sandbox reserved for future user-defined widgets.

### Testing approach
- Input/output fixtures for each widget.
- Assert output shape/schema and key invariants.
- No brittle golden text snapshots.

### Rate limiting
- Cost-weighted limits: single quota, expensive widgets consume more units.
- Example: `/create spec` = 5 units, `/summarize` = 1 unit.
- Soft limits: throttle at limit, don't hard block.
- Grace period with nudge to upgrade.

### Analytics events
Track full funnel with context signals:
- `widget_invoked` - command, source (/ or Cmd+K), selection_length, entity_count
- `widget_preview_shown` - duration_ms, truncated
- `widget_confirmed` - action (insert/create)
- `widget_cancelled` - stage (preview/generating), had_content
- `widget_applied` - inline/artifact, source_count
- `widget_error` - error_category, stage
- `widget_reverted` - time_since_apply_ms
- `widget_regenerated` - same_inputs (boolean), had_staleness
- `source_added` - manual (boolean), source_type
- `source_removed` - manual (boolean)

### Offline behavior
- Graceful degradation: show offline state, disable widget commands in / and Cmd+K.
- Allow browsing existing artifacts and receipts.
- No queuing for later execution.

### Execution history
- Detailed provenance per artifact in receipts.
- Project-level aggregate stats (runs per widget, success rate) for dashboard insights.
- No global cross-project execution log.

### Accessibility
- Screen reader announcements: polite for quick runs (completion only), assertive stage updates for long runs.
- All interactive elements keyboard-accessible.
- Focus management: return focus to editor after modal close.
- High contrast support for badges and highlights.

### Implementation anchors (current repo)
- Widget definitions and command registry: `muse/packages/commands/`
- Execution mode flags and capability wiring: `muse/packages/capabilities/`
- Artifact and manifest types: `muse/packages/manifest/`, `muse/packages/core/`
- Entity lookup and project context: `muse/packages/memory/`, `muse/packages/context/`
- UI surfaces (inline/modal/manifest block): `muse/packages/ui/`, `muse/packages/editor/`, `muse/packages/editor-webview/`
- Prompts: `muse/packages/prompts/`
- Backend schema and actions: `muse/convex/`
- Client access: `muse/packages/convex-client/`, `muse/packages/api-client/`
- Tier limits and gating: `muse/packages/tier-config/`

### Success metric
- Primary KPI: artifact reuse rate, weighted (linked/referenced later > re-viewed or exported).
- Secondary: widget completion rate (invoked → confirmed), revert rate, regeneration rate.

## 6. Open Questions + Decision Log

### Decision Log
| Decision | Rationale |
| --- | --- |
| Writer is the primary wedge | Differentiation via project graph + narrative workflows |
| Commands vs widgets | Commands are invocations; widgets are typed recipes |
| Minimal manifest fields | type, status, sources[], createdBy, executionContext, createdAt |
| AI silent unless invoked | /watch is explicit opt-in, not unsolicited |
| Staleness approach | Store sourceUpdatedAt; badge on access; manual re-run |
| MVP1 scope | Understand + Create only; Govern is confirm modal |
| Success metric | Artifact reuse rate |
| MVP1 artifact types | Text-only artifacts; diagrams and media deferred |
| Manifest location | Inline collapsible block attached to the artifact |
| Sources requirement | Sources optional; show "No sources" when empty |
| Status semantics | Draft and manually_modified in MVP1 |
| Entity mutations | No entity writes in MVP1 |
| Regeneration | Same-input regenerate only, with diff preview |
| KPI definition | Reuse rate weighted: links > re-views/exports |
| MVP1 widget list | Inline transforms + create_doc templates + /ai one-shot |
| Source tagging | Manual add/remove with timestamps, labeled "manually added" |
| One contract | Command -> widget -> artifact -> manifest |
| Mid-stream failure | Invisible cache for resume; offer Continue vs Restart |
| Multi-entity resolution | Hierarchical priority: parent doc primary, detected entities secondary |
| Source deletion | Distinct "Source missing" badge; block regeneration until resolved |
| Source integrity | Append-only with timestamps; manual sources labeled with addedAt |
| Zero entities | Warn but allow; proceed with doc/project context |
| Preview length | Truncated with "Show full preview" expansion |
| Recents scope | Per-project for relevance |
| Manual edits | Staleness still triggers; regenerate warns about overwriting |
| Block failure | Stale content + error badge; keep last successful output |
| Undo behavior | Single undo unit + explicit "Revert" on highlight |
| Cmd+K vs / | Same registry; Cmd+K has filters/hints, / is streamlined |
| Suggestions UI | Inline dropdown at cursor with keyboard navigation |
| Concurrent execution | Optimistic with warning on confirm if content changed |
| Permissions | Inherit doc permissions; view-only can run read-only widgets |
| Regenerate UX | Diff preview first; old version in history |
| Widget versioning | Version in manifest; no upgrade nudge |
| Artifact retention | User-controlled with soft limit nudge |
| Artifact location | Default to source doc folder; easy move after |
| Inline metadata | Hidden execution marker for audit + revert |
| Actor attribution | createdBy=userId + full executionContext object |
| Long execution | Progress with stages; collapsible details panel |
| Rewrite history | Diff in preview modal; accessible via execution marker |
| Outline format | Structured markdown (## headers) |
| Double expansion | Warn in preview; allow proceed |
| Execution visibility | Adaptive by tier; summary persisted in manifest |
| Cancel behavior | Graceful with warning; never write partial output |
| Progress tile position | Contextual: inline for short, fixed for long |
| Unknown command | Fuzzy + "Ask AI" fallback |
| Template customization | Prompt suffix only; no template editor in MVP1 |
| Sources scaling | Grouped by type with expand per group |
| Template systems | Shared prompt infrastructure; separate registries/UIs |
| Custom widgets MVP1 | /ai one-shot; no save/share |
| AI fallback routing | Context-dependent: selection → inline; no selection → AI panel |
| Context gathering | Configurable per widget |
| Disambiguation | Threshold-based; inline for simple, modal for complex |
| Clarify timing | High-impact blocks; low-impact proceeds with assumption |
| Chat context | Explicit carry-forward to project memory if user opts in |
| Escape behavior | Prompt if content; Cmd+Esc force-closes |
| Accessibility | Polite vs assertive announcements by duration |
| Error display | Tiered by error type |
| Widget shortcuts | None in MVP1 |
| Dashboard layout | Vertical stack with drag-to-reorder |
| MVP1 blocks | Artifacts + status summary |
| Dashboard nature | Pinned artifact |
| Re-run inputs | Fork option: "Re-run same" vs "Re-run with changes" |
| Status metrics | Counts + recent activity |
| Entity back-links | Queryable but not displayed |
| Marker portability | Survive within project; strip cross-project |
| Rate limits | Cost-weighted single quota |
| Prompt format | Structured objects with typed variables |
| Widget safety | System trusted; sandbox for future custom |
| Testing | Input/output fixtures |
| Context budget | Adaptive; record omissions in receipts |
| Model selection | Widget-defined with user override in settings |
| Analytics | Funnel + context signals |
| Offline | Graceful degradation; allow browsing |
| Execution history | Receipts + lightweight stats |
| Highlight duration | Fade after 3-5s; subtle marker persists |
| Confirm behavior | Optimistic for inline; wait for artifact |
| Rewrite options | Predefined + custom freeform |
| Menu verbosity | Description on focus |

### Open Questions (resolved in this spec)
- ~~What is the minimum viable entity set for "basic lookup"?~~ → Hierarchical: parent doc + detected entities
- ~~How do manual edits affect provenance and sources?~~ → Staleness still triggers; "manually_modified" flag
- ~~Are there must-have widgets missing from the MVP1 list?~~ → Added /ai one-shot
- ~~Dashboard: new artifact type or create_doc template?~~ → Pinned artifact with type=dashboard
- ~~Dashboard: per-block refresh or refresh all?~~ → Per-block manual refresh
- ~~Dashboard: allow cross-project blocks or keep scoped to project?~~ → Project-scoped
- ~~Dashboard: one pinned per project or multiple?~~ → One pinned per project
- ~~Dashboard: which block types ship in MVP1?~~ → Artifacts + status summary
- ~~Dashboard: show block manifest inline or via hover/expand?~~ → Collapsed with expand
- ~~Dashboard: how to handle failed block refresh?~~ → Stale content + error badge
- ~~Dashboard: where does the pinned dashboard live in navigation?~~ → Dedicated /dashboard route

### Remaining open questions
- Dashboard: who can edit the pinned dashboard in collaboration?
- Is inbox a block or its own pinned artifact? (deferred past MVP1)
- Goals block definition and data model (deferred past MVP1)

### Widget output versioning

Do we need separate widget output versions, or is thread + doc versioning enough?

| Approach | Pros | Cons |
|----------|------|------|
| Thread only | Simple, history is conversation | Hard to diff outputs directly |
| Thread + explicit versions | Can compare v1/v2/v3 side-by-side | More storage, more UI |
| Rely on doc versioning | Reuse existing infra | Loses pre-apply iterations |

System already has versioning on documents, artifacts, entities. Widget executions create threads which capture iteration history. Question is whether to add explicit "v1, v2, v3" snapshots for direct output comparison.

**Related decisions:**
- Artifact versioning exists (line 1597 in Future section)
- Widget version stored in manifest (executionContext.widgetVersion)
- Thread captures refinement history naturally

See `WIDGETS_UX_FLOW.md` for detailed versioning discussion.

## 7. Recipes

These illustrate the end-to-end vision; MVP1 supports a subset.

### Writer
| Task | Command | Output |
| --- | --- | --- |
| Name a character | `/generate name japanese female` | Suggests names inline |
| Expand backstory | `/expand` | Longer text inline |
| Create manga from chapter | `/create manga` | Manga page artifact |
| Generate audiobook | `/create audiobook` | Audio artifact |
| Visualize relationships | `/show graph` | Graph view |

### Product/Engineering
| Task | Command | Output |
| --- | --- | --- |
| Document a feature | `/generate spec` | Spec document from notes |
| Create architecture diagram | `/create diagram` | Mermaid/image artifact |
| Summarize sprint | `/summarize sprint` | Summary inline |
| Generate release notes | `/create release-notes` | Markdown artifact |
| Track decision | `/log decision` | Decision record entity |

### Communication
| Task | Command | Output |
| --- | --- | --- |
| Draft newsletter | `/create newsletter` | Newsletter artifact |
| Generate social posts | `/generate posts` | Multiple post variants |
| Create presentation | `/create deck` | Slide artifact |
| Summarize campaign | `/summarize campaign` | Report inline |
| Schedule send | `/schedule 2pm` | Queues via Convex |

## 8. MVP Ladder

| Phase | Focus | Capabilities |
| --- | --- | --- |
| MVP1 | Understand + Create | Basic lookup, inline + modal output, minimal manifest, confirm modal |
| MVP1.5 | First refinement | Artifact viewer, refine loop, simple regenerate |
| Pro | Deep work | Workspace panel, batch queues, cost estimates |
| Team | Collaboration | ROB cadences, team libraries, policy packs v1 |
| Enterprise | Governance | Approval chains, audit trails, SSO, marketplace controls |

## 9. Non-Goals

- Automation (/watch, /agent, scheduling).
- Workspace panel and batch UI.
- Policy packs and approval chains.
- Marketplace and public widget publishing.
- Multimodal output (image/audio).
- Cross-project learning.
- Per-execution model selection.
- Grid-based dashboard layout.
- Inline widget keyboard shortcuts.

## 10. Future

This section preserves aspirational and deep design notes. Nothing here is required for MVP1 unless called out.

### The `create_artifact` Pattern

One universal tool handles all artifact creation:

| Field | Purpose |
|-------|---------|
| `type` | manga, presentation, audiobook, spec, etc. |
| `schema` | AI-generated structure |
| `content` | Filled content |
| `source` | Links back to origin entity/doc |
| `inputs` | References to selections, doc IDs, entity IDs |
| `citations` | Machine-readable (chunk IDs, line ranges, memory tags) |
| `policy` | Which rules applied (style, brand, compliance) |
| `operations` | What mutations/suggestions it proposes |
| `costEstimate` | Pre-run estimate (tokens/time/cost) |
| `costActual` | Recorded usage |
| `version` | Artifact version |
| `status` | draft -> ready -> published -> deprecated |

AI decides the structure. Keep the schema renderer-agnostic; render via composable UI primitives.

---

### Understanding Layer

Like Claude Code "understands the codebase", our system understands the user's project before acting. This is a key differentiator.

#### What the System Knows (via Qdrant + Project Graph)

| Layer | Source | Example |
|-------|--------|---------|
| **Project Graph** | Entities, relationships, documents | "Elena is protagonist, relates to Kai" |
| **Semantic Memory** | Qdrant vectors of all content | "Find scenes with magic" |
| **Style Memory** | User preferences, corrections | "User prefers 4-panel manga pages" |
| **Precedents** | Previous artifacts, what worked | "Ch.1 manga accepted, Ch.2 needed refinement" |
| **Decisions** | Logged choices and rationale | "We decided Elena's magic is blue" |

#### Pre-Execution Understanding

Before any widget runs, system gathers context:

1. **Entity Resolution** - extract mentioned entities, load properties (character appearances, traits)
2. **Style Memory** - project preferences, user corrections, explicit rules
3. **Precedent Learning** - similar past work, what was refined
4. **Policy Check** - applicable rules (brand, compliance)

Then proposes approach: *"Based on chapter 3 and your previous mangas, I suggest 5 pages. Elena's magic activation should be the climax. Proceed?"*

#### Agent Understanding Tools

| Tool | Purpose |
|------|---------|
| `understand_project()` | Project state summary |
| `understand_entity(id)` | Deep context on specific entity |
| `understand_user()` | Preferences, patterns, history |
| `find_relevant(query)` | Semantic search via Qdrant |
| `find_precedents(type, context)` | Similar past artifacts |

---

### Generative UI

Rendering options:
- **Build our own** - composable primitives (`Grid`, `Panel`, `Image`, `Text`, `Audio`)
- **Tambo** - [github.com/tambo-ai/tambo](https://github.com/tambo-ai/tambo)
- **Google AI SDK** - generative UI patterns
- **Vercel AI SDK** - RSC streaming components

Decision: TBD. Start with primitives, evaluate libraries.

---

### Artifact Operations (CRUD)

Full lifecycle operations for users and agents:

| Operation | What It Does |
|-----------|--------------|
| `create_artifact` | New artifact with manifest, links to sources, status: DRAFT |
| `get_artifact` / `list_artifacts` | Read artifacts, filter by type/status/project |
| `update_artifact(id, changes, reason)` | New version, preserves history, updates manifest |
| `refine_artifact(id, instruction)` | AI-assisted iteration, records as learning signal |
| `publish_artifact(id)` | READY -> PUBLISHED (runs approval chain if required) |
| `delete_artifact(id, reason)` | Soft delete (archive), warns if dependents exist |
| `deprecate_artifact(id, replacement?)` | Mark deprecated, point to replacement |
| `mark_stale(artifactId, reason)` | Flag when source entities/docs change |
| `regenerate_artifact(id)` | Re-run with current context, show diff from previous |

---

### User Examples

#### Writer

| Task | Command | Output |
|------|---------|--------|
| Name a character | `/generate name japanese female` | Suggests 5 names inline |
| Expand backstory | `/expand` on backstory section | Longer text inline |
| Add character voice | `/add-voice calm mature` | Voice profile on entity |
| Create manga from chapter | `/create manga` | New manga page artifact |
| Generate audiobook | `/create audiobook` | Audio file with character voices |
| Visualize relationships | `/show graph` | Graph tab opens |

#### Product Engineer

| Task | Command | Output |
|------|---------|--------|
| Document a feature | `/generate spec` | Spec document from notes |
| Create architecture diagram | `/create diagram` | Mermaid/image artifact |
| Summarize sprint | `/summarize sprint` | Summary inline |
| Generate release notes | `/create release-notes` | Markdown artifact |
| Find related docs | `/find related` | Links via Qdrant |
| Track decision | `/log decision` | Decision record entity |

#### Communication Manager

| Task | Command | Output |
|------|---------|--------|
| Draft newsletter | `/create newsletter` | Newsletter artifact |
| Generate social posts | `/generate posts` | Multiple post variants |
| Create presentation | `/create deck` | Slide artifact |
| Summarize campaign | `/summarize campaign` | Report inline |
| Schedule send | `/schedule 2pm` | Queues via Convex |
| Notify stakeholders | `/notify team` | Sends notifications |

---

### Async & Scheduling (Convex)

Widgets can trigger scheduled actions:

| Pattern | Use Case |
|---------|----------|
| `schedule(time, action)` | Send newsletter at 2pm |
| `cron(pattern, action)` | Weekly report generation |
| `notify(users, message)` | Alert on artifact completion |
| `queue(action)` | Background audiobook rendering |

This enables CRM-like automation - scheduled follow-ups, reminders, recurring reports.

---

### Advanced Commands

#### Autonomous & Reactive

| Command | What it does | Example |
|---------|--------------|---------|
| `/agent` | Spawn background agent | "Research competitors daily" |
| `/watch` | Trigger on change | "When Elena mentioned, update timeline" |
| `/if` | Conditional automation | "If deadline passed, notify team" |

#### Learning & Memory

| Command | What it does | Example |
|---------|--------------|---------|
| `/teach` | Train AI on pattern | "This is how I name characters" |
| `/remember` | Save rule/preference | "Always use Oxford comma" |
| `/style` | Learn from example | "Write like this sample" |

#### Versioning & Exploration

| Command | What it does | Example |
|---------|--------------|---------|
| `/branch` | Create alternate version | "What if Elena dies here?" |
| `/compare` | Diff two versions | Side-by-side review |
| `/merge` | Combine branches | Bring ideas together |

#### External & Integration

| Command | What it does | Example |
|---------|--------------|---------|
| `/fetch` | Pull external data | Import from URL, API |
| `/sync` | Two-way sync | Connect Notion, GitHub |
| `/webhook` | Trigger external | Post to Slack, Zapier |

---

### Marketplace & Sharing

#### Public Marketplace

| Command | What it does |
|---------|--------------|
| `/browse` | Discover community widgets |
| `/install` | Add widget to project |
| `/publish` | Share your widget publicly |
| `/rate` | Review a widget |

#### Team/Enterprise Libraries (Figma-style)

Like Figma's shared component libraries - teams can publish and consume internal widgets.

| Scope | Description |
|-------|-------------|
| **Personal** | Your widgets, your projects |
| **Team** | Shared within team, version controlled |
| **Org** | Company-wide standards, approved widgets |
| **Public** | Marketplace, community contributions |

**Team library features:**
- Publish widget to team -> team members see it in `/browse team`
- Version control - update widget, team gets latest
- Permissions - who can publish, who can use
- Analytics - which widgets used most
- Forking - copy and customize for your project

**Enterprise governance:**
- Approved widgets list
- Audit log of widget usage
- SSO-gated marketplace access
- Custom widget review workflow

---

### Artifact Lineage

Artifacts form a DAG (directed acyclic graph):

- Artifact A derived from doc X + decision M + entity Y
- Artifact B derived from Artifact A + new notes
- If entity Y changes -> downstream artifacts marked "stale" -> regeneration proposed

This is where World Graph + Memories become more than search context.

---

### Policy Packs

Teams install policies that affect generation:

| Policy Type | Example |
|-------------|---------|
| Brand voice | Tone, terminology, style rules |
| Compliance | Regulatory disclaimers, PII redaction |
| Citations | "No hallucinated citations" - must cite source or say "Unknown" |
| Approval gates | Some policies force Knowledge PR approval |

Policies stored in registry, applied at generation time, recorded in manifest.

---

### Flagship Widgets (Differentiation)

These exploit World Graph + Linter + Coach + Governance - not just content generation:

| Widget | Output | Special Sauce |
|--------|--------|---------------|
| `/log decision` | Decision artifact + affected entities | Opens approval request, pins to Decision Ledger |
| `/generate spec` | PRD/spec with structured fields | Runs spec linter (consistency, missing criteria) |
| `/create release-notes` | Release notes with provenance | Cites PR IDs, decision IDs, changelog |
| `/show graph` | Living model visualization | Explains why links exist from relationship notes |
| `/create postmortem` | Incident postmortem | Links to timeline, decisions, action items |
| `/create campaign` | Assets pack (newsletter + social + landing) | Brand policy applied, scheduled sends |

---

### What Makes This Unique

| Capability | Description |
|------------|-------------|
| **Governed autonomy** | Approval policies, safe-by-default agents |
| **Artifacts with receipts** | Manifest with sources, citations, approval trail |
| **Artifact lineage** | DAG of dependencies, staleness detection |
| **Living model integration** | World Graph + Decision Ledger + Memories |
| **Policy packs** | Team-grade brand/compliance/citation rules |
| **Multi-modal output** | Text, image, audio, structured - one pattern |
| **Reactive automation** | `/watch` triggers on change, not just schedule |
| **AI learns you** | `/teach` and `/style` personalize behavior |
| **Figma-style sharing** | Team libraries with version control |
| **Marketplace ecosystem** | Community widgets, network effects |

---

### Database Schema (Convex)

#### Core Tables

| Table | Purpose |
|-------|---------|
| `widgets` | Widget definitions (prompt, inputs, output, modality) |
| `widgetVersions` | Version history, enables rollback |
| `widgetInstalls` | Which widgets installed in which projects |
| `widgetLibraries` | Team/org library containers |
| `widgetLibraryMembers` | Access control per library |

#### Marketplace Tables

| Table | Purpose |
|-------|---------|
| `widgetPublications` | Public marketplace listings |
| `widgetRatings` | Reviews and stars |
| `widgetAnalytics` | Install counts, usage stats |

#### ROB Tables

| Table | Purpose |
|-------|---------|
| `cadenceTemplates` | ROB definitions (schedule, inputs, outputs, participants) |
| `cadenceRuns` | Instance per period (weekly run, quarterly run) |
| `cadenceWatchers` | Entity/doc triggers for this cadence |
| `cadenceMemory` | What happened last run, commitments, follow-ups |

#### Key Fields

**widgets**: id, name, icon, type, prompt, inputs, output, applicableTo, modality, ownerId, libraryId, visibility (private/team/org/public), status (draft/published/deprecated)

**widgetLibraries**: id, name, scope (personal/team/org), teamId, orgId, publishPermissions, installPermissions

---

### Rhythm of Business (ROB)

ROB is a product pillar: it turns widgets into an execution OS by automating the cadence without ceremony. ROB = the operating cadence of a team. Recurring reviews, updates, decisions. Widgets + scheduling turn this into an automated system.

**Principle:** Automate the cadence, don't add ceremony. Async first. Artifacts are truth, not meetings.

#### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         ROB CYCLE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BEFORE (auto)          DURING (user)         AFTER (auto)     │
│  ─────────────          ────────────          ──────────────   │
│  Pull metrics           Review pre-read       Capture decisions│
│  Scan changes           Make decisions        Create actions   │
│  Detect drift           Log with /commands    Update model     │
│  Generate pre-read      Assign owners         Schedule next    │
│                                                                 │
│         ↓                     ↓                     ↓          │
│    [Pre-Read]           [Decisions]           [Commitments]    │
│     artifact             artifact               artifact       │
│         │                     │                     │          │
│         └─────────────────────┴─────────────────────┘          │
│                               ↓                                 │
│                      LIVING MODEL UPDATED                       │
│              (entities, decisions, lineage, state)              │
└─────────────────────────────────────────────────────────────────┘
```

#### Cadence Templates

| Command | Cadence | What it produces |
|---------|---------|------------------|
| `/rob standup` | Daily | Digest, blockers, today's priorities |
| `/rob wxr` | Weekly | Metrics, wins/risks/asks, decisions, commitments |
| `/rob sprint-plan` | Bi-weekly | PRD delta, scope proposal, risk flags |
| `/rob sprint-review` | Bi-weekly | Release notes, decisions, follow-ups |
| `/rob growth-review` | Monthly | Channel performance, experiments, briefs |
| `/rob qbr` | Quarterly | What changed, OKRs, strategy, roadmap branches |

#### Zero-Ceremony Setup

When user runs `/rob setup`:

1. **Assistant guides** - asks what cadence, who participates, what inputs matter
2. **Schema adapts** - Living Model adds entities/properties needed for this ROB
3. **Watchers created** - auto-detect changes relevant to this cadence
4. **First run scheduled** - Convex async job queued

No manual config. The system learns what you need.

#### Watchers + Async (Convex Infrastructure)

| Trigger | Action | Notification |
|---------|--------|--------------|
| Schedule (cron) | Generate pre-read | "WXR ready for Monday" |
| Entity changed | Mark artifacts stale | "Roadmap changed -> deck outdated" |
| Decision logged | Update affected docs | "Decision D applied to 3 artifacts" |
| Deadline passed | Escalate blocker | "Commitment X overdue" |

All powered by Convex scheduler + background jobs. Notifications via Pulse or external (Slack, email).

#### Enterprise Governance

| Need | How ROB handles it |
|------|-------------------|
| Standardization | Same templates across 50 teams |
| Cross-team consistency | Linter catches contradictions across org |
| Audit trail | Every artifact has manifest (who, what, when, why) |
| Policy enforcement | Legal approval required before publish |
| Compliance | Decisions citable, changes reversible |

#### How the System Understands

Each ROB run captures and connects:

| Layer | What it knows |
|-------|---------------|
| Cadence memory | What happened last run, what was committed |
| Entity changes | What changed since last run |
| Decision state | What was decided, what's pending |
| Artifact lineage | What derives from what, what's stale |
| Watcher triggers | What needs attention |

Next run is smarter because it knows the history.

---

### Widget Pipelines (`/flow`)

Chain widgets together. Invoke via `/flow [name]` or build interactively.

#### Invocation Options

| Method | Example |
|--------|---------|
| Named flow | `/flow sales-call-followup` |
| Inline chain | `/flow [summarize -> extract -> notify]` |
| Interactive | `/flow` (system guides step by step) |
| Agent-built | Agent constructs flow based on goal |

#### Example: Sales Call Follow-up

| Step | Widget | Output -> Input |
|------|--------|----------------|
| 1 | `/summarize call` | Call Summary artifact |
| 2 | `/extract objections` | Updates Sales Objections entity |
| 3 | `/create followups` | Creates tasks linked to owners |
| 4 | `/send recap` | Email draft (approval gated) |

#### Flow Features

| Feature | Description |
|---------|-------------|
| **Gates** | Pause for approval at specific steps |
| **Conditions** | `if objection.type == "price"` -> different branch |
| **Loops** | `for each chapter` -> run widget |
| **Error handling** | On fail -> retry / skip / alert |

Pipelines can be:
- **Manual** - user triggers each step
- **Auto** - runs to completion, pauses at approval gates
- **Scheduled** - ROB triggers the pipeline

Flows are saved, versioned, and shareable like widgets (personal -> team -> org -> public).

Failed step -> pause -> notify -> user retries or skips.

---

### Cost Transparency

Before running expensive widgets, show estimate:

| Info | Example |
|------|---------|
| Tokens | ~2,500 input / ~1,000 output |
| Time | ~30 seconds |
| Cost | ~$0.05 |
| Tier | Requires Pro |

User confirms or cancels. Actual cost recorded in manifest.

---

### Discovery + Shortcuts

**Current surfaces:**
- Inline AI (in editor)
- `/ai` and `/widget` commands
- Command palette (Cmd+K)
- Side panel AI (floating + full screen)

**Discovery improvements needed:**

| Feature | Description |
|---------|-------------|
| Smart `/` menu | Contextual suggestions based on entity type, recent use |
| Favorites | Pin frequent widgets to top |
| Recent | Show last 5 widgets used |
| Search | Fuzzy search across all widgets |
| Categories | Filter by type (generator, analyzer, creator) |
| Recommendations | "Users like you also use..." |

**Keyboard shortcuts:**

| Shortcut | Action |
|----------|--------|
| `/` | Open widget menu |
| `Cmd+K` | Command palette with widget search |
| `Cmd+Shift+W` | Open widget panel |
| `↑↓` | Navigate suggestions |
| `Enter` | Run selected widget |
| `Tab` | Fill suggested parameters |

**ROB discovery:**

`/rob` shows available cadences with:
- Setup wizard for new cadences
- Status of active cadences (next run, last run)
- Quick actions (run now, pause, edit)

---

### Dashboard Evolution

Dashboards are composed artifacts made of widget blocks. Each block is a saved widget run (inputs + sources + output).

#### Levels
1) Pinned dashboard (MVP1)
   - Manual refresh only, per block or refresh all
   - Shows lastRunAt and sources

2) On-open refresh (MVP1.5)
   - Optional refresh when the dashboard is opened
   - User-controlled to avoid surprise costs

3) Scheduled and on-change (Pro)
   - Per-block refresh modes: manual, on-open, scheduled, on-change
   - Convex async notifications when blocks complete

---

### Execution Modes

Widgets alone are insufficient. Three distinct execution modes serve different needs:

| Mode | Surface | Duration | Use Case |
|------|---------|----------|----------|
| **Widget** | Inline/modal | Seconds | Quick, one-shot actions |
| **Workspace** | Side panel | Minutes-hours | Iterative refinement, deep work |
| **Automation** | Background | Scheduled | Batch, recurring, reactive |

#### When Each Mode Applies

| Signal | Mode |
|--------|------|
| Single item, simple output | Widget |
| Needs refinement loop | Workspace |
| Multiple items (batch) | Workspace or Automation |
| Scheduled/recurring | Automation |
| Reactive to changes | Automation |
| User wants to "set and forget" | Automation |

#### Execution Router

System decides mode based on:
- Widget definition (supports batch? needs refinement?)
- User intent (scope selection, explicit mode request)
- Context (selection size, complexity)

User can override: "Run in background" or "Open in workspace"

---

### Workspace Panel Architecture

**Adaptive primitives, not generative UI.**

The Workspace Panel assembles from composable primitives based on widget config - predictable, testable, fast.

#### Layout Patterns

| Layout | Use Case | Structure |
|--------|----------|-----------|
| **Split** | Visual output (manga, diagrams) | Preview + Context side-by-side |
| **Stack** | Text output (spec, report) | Streaming preview, collapsible context |
| **Queue** | Batch operations | Queue list + active item preview |
| **Canvas** | Freeform (graph, whiteboard) | Zoomable canvas + tools |

#### Widget Workspace Config

Each widget defines its workspace behavior:

| Field | Purpose |
|-------|---------|
| `layout` | split, stack, queue, canvas |
| `panels` | Which panels to show (scope, preview, context, refine) |
| `previewType` | paginated, streaming, diff, canvas |
| `contextSources` | entities, memories, precedents, policies |
| `refinementMode` | inline, chat, form |
| `batchSupport` | Whether batch mode available |
| `batchMode` | sequential, parallel, staged |

#### State Machine: Artifact Lifecycle

```
QUEUED -> PREPARING -> GENERATING -> READY -> REFINING -> FINAL
   │         │            │          │         │        │
skeleton  loading     streaming   preview  iteration  published
+ queue   + context   + progress  + accept + version  + locked
  pos     gathering   + stage     + refine + compare
```

- User can CANCEL at any point before FINAL
- User can FORK at READY or REFINING to create branch
- STALE flag if source entities change after FINAL

---

### Context Pipeline

How the system "understands" and adapts to user's project:

| Stage | What Happens |
|-------|--------------|
| 1. Entity Resolution | Extract mentioned entities, load their properties (character appearances, traits) |
| 2. Style Memory | Project-level preferences, user corrections, explicit rules |
| 3. Precedent Learning | Previous artifacts of same type, what worked, what was refined |
| 4. Policy Application | Content rating, brand guidelines, compliance rules |

This pipeline runs before generation. Context is captured in artifact manifest for reproducibility.

#### Precedent Learning (Key Differentiator)

For iterative creative work (manga, audiobooks, visual content):
- System learns from previously created artifacts
- Extracts "what worked" (accepted without refinement)
- Extracts "what was refined" (user corrections = training signal)
- Applies learned style to new generations
- Shows user what precedents influenced this output

---

### Batch Execution

| Mode | When | Behavior |
|------|------|----------|
| **Sequential** | Order matters (manga chapters, narrative) | Each learns from previous, ensures consistency |
| **Parallel** | Independent items (translations, summaries) | Fast, no cross-learning |
| **Staged** | Dependency graph | Stage 1 parallel -> Stage 2 sequential -> etc. |
| **Incremental** | Delta processing | Only regenerate what changed since last run |

#### Batch UX

- Scope selector: This item / Selected / All
- Queue visualization with progress per item
- "Run in background" option for long batches
- Pause/resume/cancel individual items or whole batch
- Notification when batch complete

#### Batch & Automation Use Cases

**Image Generation (Creative)**
- All chapters -> manga (sequential, style-consistent, cross-learning)
- Character sheets (parallel per character)
- Scene illustrations for key moments

**Market Research (Business)**
- Daily: `/watch` competitor URLs -> `/diff` -> `/update entity` -> if significant: `/alert`
- Weekly: industry news synthesis
- On-demand: deep dive on new competitor

**Internal Communications (Operations)**
- ROB cadences: cron -> pull changes -> pull decisions -> generate -> approval gate -> distribute
- Daily standup digest, weekly exec summary, sprint review

**Content Localization (Scale)**
- Translate to N languages (parallel per language)
- Native reviewer per language (staged gates)
- Incremental: only translate changed sections

---

### User Journey Discovery

Framework for understanding each persona's needs:

| Question | Purpose |
|----------|---------|
| **Triggers** | "When do you think 'I need help with this'?" |
| **Current workarounds** | "How do you solve this today?" |
| **Understanding needs** | "What context would the system need?" |
| **Output expectations** | "What does 'done' look like?" |
| **Iteration patterns** | "How many rounds of revision?" |
| **Scale** | "One-off or recurring? How many per week?" |

#### Writer Journeys

| Journey | Understanding Needed | Mode |
|---------|---------------------|------|
| Visualize chapter as manga | Characters, appearances, key scenes, previous art style | Workspace |
| Keep world consistent | Established facts, timeline, descriptions | Widget (`/lint`) |
| Explore what-if | Current state, implications of change | Widget + Workspace |
| All chapters as manga | Visual continuity, character aging | Batch sequential |

#### Marketing Journeys

| Journey | Understanding Needed | Mode |
|---------|---------------------|------|
| Monitor competitors | Who matters, what sources, what signals | Automation (`/watch`) |
| Create campaign assets | Brand voice, audience, channels | Flow |
| Internal comms cadence | What changed, decisions, metrics | ROB |
| Research new market | Existing knowledge, gaps, sources | Flow |

#### Product/Engineering Journeys

| Journey | Understanding Needed | Mode |
|---------|---------------------|------|
| Document feature | Architecture, dependencies, past decisions | Widget + linter |
| Track decisions | Options, tradeoffs, affected components | Widget (`/log decision`) |
| Generate release notes | PRs, changes, breaking changes | Flow |
| Onboard to area | Architecture, entities, ownership | Widget (`/explain`) |

---

### Output Routing

| Output Type | Where It Goes | Example |
|-------------|---------------|---------|
| Inline | Streams into editor at cursor | /expand, /improve |
| Block Update | Updates specific content block with diff | /translate block |
| Entity Mutation | Updates entity properties (may trigger Knowledge PR) | /add-voice |
| New Artifact | Creates linked document/media | /create manga |
| Batch Artifacts | Multiple outputs, queued | /create manga (all chapters) |
| Suggestion | Proposes options, user picks | /suggest names |
| Navigation | Opens view/panel | /show graph |

---

### Pricing Model

**Principle: Users pay for outcomes, not tokens.**

#### Tier Structure

| Tier | Widgets | Workspace | Batch | Automation | Artifacts |
|------|---------|-----------|-------|------------|-----------|
| Free | Basic only | No | No | No | 5 stored |
| Pro | All | Single item | No | Simple schedules | 50 stored |
| Team | All | Full | Up to 20 items | ROB cadences | 100/user |
| Enterprise | Custom | Full | Unlimited | Full | Unlimited |

#### Execution Limits

| Tier | Monthly Executions | Heavy Operations |
|------|-------------------|------------------|
| Free | 50 | Not available |
| Pro | 500 | Count as 5x |
| Team | Soft limit (throttle, don't block) | Included |
| Enterprise | Unlimited | Included |

#### Heavy Operations

Manga, audiobook, large batch = high token cost. Handled as:
- Free/Pro: "This counts as 5 generations"
- Team/Enterprise: Included in unlimited, no friction

#### Usage Policy

- **Soft limits**: Throttle at limit, don't hard block
- **Grace period**: Allow overage, nudge to upgrade
- **Rate limiting**: X per minute to prevent abuse
- **Concurrent limits**: Max simultaneous jobs

#### Enterprise Cost Visibility

Not for billing - for awareness and planning:
- Dashboard: usage by team
- Optional soft budgets per team with alerts
- "Marketing used 45% of org capacity this month"

---

### Roadmap Phases

| Phase | Focus | Deliverables | Dependencies |
|-------|-------|--------------|--------------|
| **0. Widget Foundation** | Core pattern | Widget registry extending Capabilities, execution router, basic input modal | Capabilities package |
| **1. Artifact Core** | Output | Artifact schema, manifest structure, basic artifact viewer, storage | Convex schema |
| **2. Workspace Panel** | Deep work | Adaptive layout renderer, primitives (preview, context, refine), state machine | Artifact Core |
| **3. Batch & Queue** | Scale | Queue UI, batch execution modes, progress tracking, background jobs | Workspace Panel |
| **4. Context Pipeline** | Intelligence | Entity resolution, style memory, precedent learning | Project Graph, Memories |
| **5. Governance** | Trust | Approval chains, audit log, Knowledge PR integration | MLP1 infrastructure |
| **6. ROB Engine** | Cadence | Cadence templates, `/rob` commands, async runs, notifications | Automation, Governance |
| **7. Team Libraries** | Collaboration | Widget versioning, team/org scopes, permissions | Governance |
| **8. Policy Packs** | Enterprise | Brand voice, compliance, citation rules | Team Libraries |
| **9. Marketplace** | Ecosystem | Public widgets, ratings, discovery | Policy Packs |

#### Phase 0-2 Details (Near-term)

**Phase 0: Widget Foundation**
- Extend `@mythos/capabilities` -> widget definitions
- Add workspace config fields to widget schema
- Build execution router (widget vs workspace vs automation)
- Create reusable input modal component
- Wire up first widget: `/generate summary` as proof

**Phase 1: Artifact Core**
- Define artifact Convex schema (type, content, manifest, lineage)
- Implement manifest structure (sources, citations, policies, reproducibility)
- Build basic artifact viewer (content + manifest sidebar)
- Storage and retrieval

**Phase 2: Workspace Panel**
- Layout renderer (split, stack, queue, canvas)
- Primitives: ScopeSelector, PreviewPanel, ContextPanel, RefinementInput
- State machine implementation (queued -> generating -> ready -> refining -> final)
- First workspace widget: `/create manga` (single chapter)

---

### Open Questions: UX/UI Refinement

#### Understanding Layer

| Question | Options | Considerations |
|----------|---------|----------------|
| How deep should pre-execution understanding go? | Minimal (fast), moderate, comprehensive | Speed vs accuracy tradeoff |
| Show understanding to user before generation? | Always, on request, never | Transparency vs friction |
| How to correct misunderstanding? | "Not that Elena", explicit correction UI | User effort vs accuracy |
| Cross-project learning? | Never, opt-in, team-level | Privacy vs improvement |

#### Flow / Pipelines

| Question | Options | Considerations |
|----------|---------|----------------|
| Visual builder or text syntax? | Visual only, text only, both | Different user preferences |
| Can flows call other flows? | Yes (composition), no (flat) | Power vs complexity |
| How to debug failed flows? | Step-by-step replay, logs, visual trace | Troubleshooting UX |
| Flow versioning? | Git-like, simple history, none | Team collaboration |

#### Agent Integration

| Question | Options | Considerations |
|----------|---------|----------------|
| When does agent act vs ask? | Conservative (always ask), moderate, aggressive | Autonomy vs control |
| How does agent explain its understanding? | Before action, in manifest, on request | Trust building |
| Can user correct agent's knowledge? | Explicit teach, implicit from corrections | Learning loop |
| Agent access to artifact CRUD? | Full, read-only, limited | Safety vs capability |

#### Invocation & Discovery

| Question | Options | Considerations |
|----------|---------|----------------|
| How to discover widgets? | Cmd+K categories, contextual `/` menu, widget browser panel | Power users want speed, newcomers need discovery |
| Context-aware suggestions? | Show relevant widgets based on current entity type, selection | May feel intrusive if wrong |
| Keyboard-first or click-first? | Slash commands vs button bars vs both | Different user preferences |
| Where does Workspace Panel open? | Replace main content, side panel, floating window | Screen real estate, focus |

#### Workspace Behavior

| Question | Options | Considerations |
|----------|---------|----------------|
| Persist workspace across sessions? | Auto-save draft, explicit save, discard on close | User expectation, data loss risk |
| Multiple workspaces? | Tabs, one at a time, background | Complexity vs flexibility |
| Workspace for inline widgets? | Never, optional "expand to workspace" | Keep simple widgets simple |
| Refinement: chat or form? | Chat-style iteration, structured form, hybrid | Different mental models |

#### Batch & Automation

| Question | Options | Considerations |
|----------|---------|----------------|
| Default batch mode? | Ask user, infer from content, widget default | Consistency vs optimization |
| Background job notifications? | Pulse (in-app), email, Slack, all | Notification fatigue |
| What if batch item fails? | Skip and continue, pause batch, retry N times | User control vs automation |
| Review before batch execute? | Preview all items, trust config, optional | Speed vs safety |

#### Context & Learning

| Question | Options | Considerations |
|----------|---------|----------------|
| Show context sources before generation? | Always, on request, never | Transparency vs friction |
| Explain why AI made choice? | Inline citations, manifest only, ask AI | Trust building vs clutter |
| How to correct learning? | Explicit "don't do this", implicit from refinements | User effort vs accuracy |
| Cross-project learning? | Never, opt-in, team-level | Privacy vs improvement |

#### Pricing & Limits

| Question | Options | Considerations |
|----------|---------|----------------|
| Show cost before execute? | Always, only expensive, never | Transparency vs friction |
| Hard limit behavior? | Block, throttle, allow with warning | User experience vs cost control |
| Team budget allocation? | Equal per seat, pool, admin-assigned | Fairness vs flexibility |
| Carry over unused? | Yes, no, partial | Revenue predictability |

#### Enterprise

| Question | Options | Considerations |
|----------|---------|----------------|
| Approval chain flexibility? | Fixed roles, configurable, per-widget | Complexity vs control |
| Cross-team consistency? | Linter warnings, hard blocks, suggestions | Autonomy vs consistency |
| Custom widget creation? | No-code builder, code upload, request from vendor | Capability vs support burden |
| SSO integration scope? | Auth only, permissions, attribute mapping | IT requirements vary |

---

### Open Questions: Technical Design

#### Architecture

| Question | Options | Considerations |
|----------|---------|----------------|
| Where does widget logic live? | Convex actions, edge functions, client | Latency, cost, complexity |
| Streaming artifacts? | Full generation then display, stream chunks | UX vs implementation |
| Artifact storage? | Convex files, external blob store, hybrid | Cost, performance, limits |
| Workspace state? | Client only, Convex sync, hybrid | Offline, multi-device |

#### Data Model

| Question | Options | Considerations |
|----------|---------|----------------|
| Artifact versioning? | Full copies, diffs, hybrid | Storage cost vs simplicity |
| Lineage tracking? | Explicit foreign keys, graph edges, both | Query patterns |
| Style memory structure? | Key-value, embeddings, structured rules | Flexibility vs queryability |
| Precedent matching? | Semantic search, type + recency, hybrid | Accuracy vs speed |

#### Integration

| Question | Options | Considerations |
|----------|---------|----------------|
| External triggers? | Webhooks, Zapier, native integrations | Build vs buy |
| Export formats? | PDF, Markdown, native, all | User needs vary |
| Version control? | Git-like branching, simple history, none | Complexity vs power |
| API access? | Full REST/GraphQL, limited, none | Developer needs |

---

### Enterprise Use Cases (Gaps to Address)

| Capability | Current State | Needed |
|------------|---------------|--------|
| Approval chains | Not implemented | Multi-step, role-based approval workflow |
| Template libraries | Not implemented | Org-standard templates with locked fields |
| Cost centers | Not implemented | Usage tracking by team/project for visibility |
| Compliance audit | Partial (provenance) | Full audit log with export |
| Cross-team consistency | Not implemented | Linter for contradictions across org |
| Localization pipeline | Not implemented | Multi-language batch with review workflow |
| Asset deduplication | Not implemented | Similar content detection, reuse suggestions |
| Scheduled freshness | Not implemented | Auto-refresh data sources, staleness alerts |
| External integrations | Planned | Slack, Notion, GitHub, custom webhooks |
| Custom widgets | Not implemented | No-code builder or template system |

---

### Design Principles (Summary)

| Principle | Meaning |
|-----------|---------|
| **Understand first** | Know the project deeply before acting (like Claude Code knows codebase) |
| **Elastic execution** | Same widget works inline, in workspace, or automated |
| **Adaptive, not generative UI** | Composable primitives configured by widget, not AI-generated layouts |
| **Outcomes over tokens** | Subscription tiers, not pay-per-token anxiety |
| **Progressive complexity** | Simple for beginners, powerful for experts |
| **Receipts built-in** | Every output has manifest explaining why |
| **Learn from use** | Precedents and refinements improve future outputs |
| **Soft limits** | Throttle don't block, nudge don't punish |

### Integration with Living Memory OS

Widgets are the user-facing action layer on top of the Living Memory OS (MLP1) and Proactivity Engine (MLP2).

#### Output Routing

| Widget output | System integration |
|---------------|-------------------|
| Inline (low risk) | Direct update, auto-approved |
| High-risk change | Knowledge PR draft -> review required |
| New artifact | Document/media creation -> links to source entity |
| Background work | Proactivity job -> Pulse signal when done |
| Memory/rule | Pinned to Decision Ledger |

#### Command Mapping

| Command | Living Memory OS component |
|---------|---------------------------|
| `/generate`, `/expand` | Knowledge PR if entity change |
| `/teach`, `/remember` | Decision Ledger (pinned memory) |
| `/agent` | Proactivity job (background worker) |
| `/watch` | Proactive signal trigger |
| `/create artifact` | Document + Project Graph link |
| `/branch` | Version in revision history |

#### Risk-Based Approval

Uses `projectTypeRegistry` risk levels:
- **Low risk**: Auto-execute (inline text, suggestions)
- **High risk**: Knowledge PR required (entity changes, relationship changes)
- **Core**: Always requires explicit approval

#### Provenance

All widget actions tracked with:
- Actor (user or agent)
- Tool + toolCallId
- Model + thread identifiers
- Target (entity/document/artifact)

Enables audit, rollback, and "why did this happen?" answers.

### Related

- `UNIVERSAL_ENTITY_PROFILE.md` - where widgets appear
- `MLP1_LIVING_MEMORY_OS.md` - Knowledge PRs, Decision Ledger
- `MLP2_PROACTIVITY_ENGINE.md` - Pulse, background jobs, Impact PRs
- `projectTypeRegistry` - widget definitions, risk levels
- `MLP1_ROADMAP.md` - implementation status
