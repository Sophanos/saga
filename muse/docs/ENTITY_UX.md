# Entity UX

> Creation, viewing, editing - full lifecycle

## Design Principles

1. **Low friction** - Creation as fast as naming a file
2. **Context-preserving** - Never navigate away from current work
3. **AI-proactive** - System detects and suggests; user approves
4. **Single surface** - All entity interaction in Artifact Panel
5. **Registry-driven** - Entity types defined per project template, not hardcoded

## Entity Types

Types come from **Project Type Registry** (`convex/lib/typeRegistry.ts`). Each project template defines its own types. The UI dynamically renders type options from the resolved registry.

---

## 1. Layout Structure

### Main Layout

```
LEFT SIDEBAR          MAIN CANVAS                   RIGHT PANELS
───────────────────────────────────────────────────────────────────
Project/Workspace     Editor canvas (default)       Artifact Panel
                      OR                            - Graph view
Entities section      Graph view                    - Tables/Diagrams
  - User created      [toggle editor/graph]         - Timelines
  - AI detected                                     - Iteration chat
    (pending)         BubbleMenu on select:
                      - formatting                  OR
+ Add entity          - add as entity
  (inline input)      - add to existing entity      AI Side Panel

Documents section     Inline Floating Cards:        + Floating AI icon
  - Chapters          - Entity preview/edit           (bottom right)
  - Scenes            - Expandable in-place
```

### Main Canvas Modes

| Mode | Purpose |
|------|---------|
| Editor | TipTap editing, inline floating cards for entities |
| Graph | Project Graph (React Flow), floating cards on node click |

### Right Panel States

| State | Content |
|-------|---------|
| Artifact Panel | Entity graph view, tables, diagrams, iteration chat |
| AI Side Panel | Chat interface, context-aware |
| Collapsed | Floating AI icon only |

### Entity Interaction Model

**Decision: Inline Floating Cards**

| Action | Result |
|--------|--------|
| Click entity mention | Floating card appears anchored to text |
| Click [Expand] | Card grows inline with full details + tabs |
| Click [Graph] | Entity-centric graph opens in Artifact Panel |
| Click [Edit] | Iteration chat in floating card |
| Click node in Graph view | Floating card appears at node |

### Entity Creation Sources

| Location | Trigger | Flow |
|----------|---------|------|
| Left sidebar | Click + | Inline input, type picker from registry |
| Left sidebar | AI detected | Pending items with subtle highlight, accept/decline |
| Main canvas (editor) | Select text | BubbleMenu: add as entity or to existing |

### AI Detection Visual

AI-detected text shown with subtle highlight animation (pinkish/accent color, gentle pulse). User can:
- Click to accept (creates entity)
- Dismiss (won't detect again)
- Ignore (stays pending)

---

## 2. Interaction Flow

Principle: **User never leaves flow state.** All interactions happen in-place without navigation or modal interruption.

### Graph to Artifact

User clicks node in Graph view:
1. Artifact Panel slides open (if closed)
2. EntityCard loads for that entity
3. Graph remains visible, selected node highlighted
4. User edits in Artifact Panel, changes reflect in Graph

No page navigation. No modal. Context preserved.

### AI to Sidebar

AI detects entity while user writes:
1. Pending item appears in sidebar (dimmed)
2. User continues writing uninterrupted
3. When ready, user glances at sidebar, clicks accept/decline
4. Accepted entity appears in list and Graph

No popup. No toast. No interruption.

### Editor to Artifact

User selects text, clicks "add as entity":
1. Entity created
2. Artifact Panel opens with EntityCard
3. Editor visible alongside, selection becomes link
4. User adds details in Artifact Panel iteration chat

Split view. Both contexts visible.

### Artifact Iteration

User refines entity via iteration chat:
1. Type natural language: "add fear of betrayal"
2. EntityCard updates inline
3. Changes saved automatically
4. Graph relationships update if affected

No save button workflow. Continuous refinement.

### AI Proactivity Balance

| Trigger | AI Action | User Impact |
|---------|-----------|-------------|
| Auto-save | Detect entities, queue in sidebar | Zero interruption |
| /check command | Scan and show all suggestions | User-initiated |
| Explicit ask | Generate content, open in Artifact | User-initiated |

AI works in background. User chooses when to engage.

---

## 3. Creation Details

### Sidebar: Inline Quick-Add

Discord "Add Channel" pattern. No modal.

1. Click + next to Entities section
2. Inline input appears in-place
3. Type selector shows types from registry
4. Type name, select type
5. Enter creates, Esc cancels

AI suggestions appear as dimmed pending items with accept/decline.

### Editor: Selection-Based

Extend BubbleMenu (already has Ask AI).

1. Select text
2. Click Entity button in BubbleMenu
3. Options: create new entity OR add to existing entity
4. Type picker shows registry types (for new)
5. Select type - entity created, text becomes link (if mentions enabled)

### AI Detection

AI analyzes content and suggests entities based on context. Types are inferred from registry definitions.

Triggers:
- Auto-save (Qdrant embeddings already running)
- Explicit `/check` command (document or project-wide)

States: pending, accepted, rejected. Rejected suggestions don't reappear for same text.

---

## 3. Viewing and Editing

### EntityCard Layout

Header: Icon, name, type, key fields as pills, actions

Tabs:
- Overview: Fields + TipTap editor + assets
- Graph: Relationships centered on this entity
- Mentions: Qdrant semantic search
- History: Change log

Iteration chat for natural language refinement.

Actions: Insert (into editor), Copy, Save

---

## 4. Widgets

Inline `/commands` with entity context:

| Command | Action |
|---------|--------|
| `/generate name` | Name generator (fictional types only) |
| `/expand backstory` | Expands content based on existing notes |
| `/suggest-connections` | Proposes relationships to other entities |
| `/add-voice` | Assigns voice profile (for audiobooks) |
| `/analyze image` | Extracts visual details into entity notes |

Widgets can produce:
- Inline output - updates the entity directly
- New artifact - creates derived content (manga page, audiobook, presentation)

---

## 5. Multi-Modal Properties

Entities can hold any modality:

| Modality | Examples |
|----------|----------|
| Text | Name, backstory, notes |
| Image | Portrait, concept art, reference images |
| Audio | Voice profile, theme music |
| Reference | Links to artifacts, documents |

Images stored as `projectAssets`, referenced by `assetId`/`storageId`.
Widgets declare their modality. Agents route to the right service.

---

## 6. Identity Sensitivity

Registry defines `fictional: true/false` per type.

| Entity Type | Name Changes | Content Generation |
|-------------|--------------|-------------------|
| Fictional | Allowed | Allowed |
| Real (contact, company) | Blocked or approval required | Allowed for notes |

---

## 7. Commands

| Command | Scope | Action |
|---------|-------|--------|
| `/check` | Current document | Scan for entities, show suggestions |
| `/check all` | All documents | Project-wide scan |
| `/entity <name>` | Manual | Create entity from chat |

---

## 8. Data Model

### Entity Suggestions

```typescript
// convex/schema.ts
entitySuggestions: defineTable({
  projectId: v.id("projects"),
  documentId: v.optional(v.id("documents")),
  surfaceText: v.string(),
  suggestedType: v.string(),
  status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
  createdEntityId: v.optional(v.id("entities")),
  source: v.union(v.literal("ai"), v.literal("user")),
  confidence: v.optional(v.number()),
  createdAt: v.number(),
  resolvedAt: v.optional(v.number()),
})
```

---

## 9. Implementation Priority

P0 - Core:
- Sidebar inline quick-add
- Entity opens in Artifact Panel (EntityCard)
- Wire graph node click to Artifact Panel

P1 - Editor:
- BubbleMenu entity type picker
- Add to existing entity option
- Link creation for selected text

P2 - AI Detection:
- entitySuggestions table
- /check command
- Sidebar pending items display

P3 - Widgets:
- /generate name
- /expand backstory
- /suggest-connections
- /add-voice
- /analyze image

---

## 10. Implemented Components

### Editor Extensions (`packages/editor/src/extensions/`)

| Extension | Purpose |
|-----------|---------|
| `entity-mark.ts` | Mark text as entity (colored underline) |
| `entity-card-node.ts` | Inline block node for entity cards |

### Editor WebView (`packages/editor-webview/src/components/`)

| Component | Purpose |
|-----------|---------|
| `BubbleMenu.tsx` | Entity type picker in selection menu |
| `Editor.tsx` | Entity click handler, extensions |
| `EntityCardNodeView.tsx` | Inline card with tabs (Overview/Graph/Mentions) |
| `EntityFloatingCard.tsx` | Floating preview card (compact) |

### Web Components (`apps/web/src/components/entity/`)

| Component | Purpose |
|-----------|---------|
| `EntityFloatingCard.tsx` | Floating card for web app |
| `EntityExpandedCard.tsx` | Full card with iteration chat |
| `EntityProfilePage.tsx` | Full page entity view |

### Entity Colors (`packages/theme/src/colors.ts`)

- character: `#22d3ee` (cyan)
- location: `#22c55e` (green)
- item: `#f59e0b` (amber)
- magic_system: `#a855f7` (purple)

### CSS Classes

**Entity marks** (Editor.tsx, globals.css):
- `.entity-character` - Cyan underline
- `.entity-location` - Green underline
- `.entity-item` - Amber underline
- `.entity-magic_system` - Purple underline

**AI provenance** (uses `data-ai-status` attribute from AIGeneratedMark):
- `.ai-generated[data-ai-status="pending"]` - Pink (unreviewed)
- `.ai-generated[data-ai-status="accepted"]` - Blue (accepted)
- `.ai-generated[data-ai-status="rejected"]` - Gray, faded

**AI detection** (P2: entitySuggestions):
- `[data-ai-entity-detected]` - Purple pulse animation

### Usage Flow

1. Select text → BubbleMenu → Click **Entity** → Choose type
2. Text gets EntityMark (colored underline)
3. Click marked text → EntityCardNode inserts inline
4. Card adapts to editor width (container queries)

---

## Open Questions

1. **Mention syntax**: @name vs [[name]] vs auto-link?
2. **Detection trigger**: Every save or explicit /check command only?
3. **Confidence threshold**: Show all AI suggestions or filter by confidence?
4. **Graph creation**: Add entities via sidebar only, or also allow creation directly in graph view?
5. **Artifact Panel vs Modal**: EntityCard always in Artifact Panel, or option to open as modal?

---

## Related

- `convex/lib/typeRegistry.ts` - Registry resolution
- `convex/entities.ts` - Entity CRUD
- `packages/editor/src/extensions/` - TipTap extensions
- `packages/editor-webview/src/components/` - Editor UI
- `packages/theme/src/colors.ts` - Entity colors
- `apps/web/src/components/entity/` - Web entity components

*Last updated: January 2026*
