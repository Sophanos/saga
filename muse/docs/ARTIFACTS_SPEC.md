# Artifacts System Specification

> AI-generated content blocks with iteration, deep linking, and editor integration

---

## Overview

Artifacts are AI-generated content blocks that can appear:
1. **Inline** in chat messages (small, quick suggestions)
2. **Side Panel** next to the editor (substantial content with iteration)
3. **Embedded** in documents (inserted content)

The key innovation: **Artifacts have their own mini-chat for iteration**.

---

## Key Design Decisions (January 2026)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Storage** | Full Convex sync | Real-time, persistent, shareable. No local-only. |
| **Mixed content** | Yes, sections | One artifact = canvas with prose + diagram + table + code |
| **Tabs** | Branches, not pins | User creates tabs to explore directions. Can merge tabs. |
| **Agent context** | Full awareness | Agent sees complete artifact content to understand "update the diagram" |
| **Scoping** | Project-scoped | Artifacts persist across doc switches, clear on project switch |
| **TOC** | Reusable component | Notion-style dots for section navigation, used everywhere |
| **Default behavior** | Add section to current | Agent adds content to existing artifact, not always new tab |
| **Deep links** | Artifact + section level | `/artifact/{id}#section-{sectionId}` |

---

## Visual Layout

### Editor + Artifact Panel

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Sidebar]  │                    EDITOR                    │    ARTIFACT      │
│            │                                               │                  │
│ 📁 Project │  # Chapter 3: The Betrayal                   │ 📊 Relationships │
│            │                                               │ ───────────────  │
│ 📄 Ch 1    │  Elena stood at the window, watching the     │                  │
│ 📄 Ch 2    │  courtyard below. The morning light cast     │  ┌──────────┐   │
│ 📄 Ch 3 ←  │  long shadows across the stone...            │  │  Elena   │   │
│ 📄 Ch 4    │                                               │  └────┬─────┘   │
│            │  She had trusted Marcus. That was her        │       │         │
│ 👤 Elena   │  first mistake.                              │  ┌────▼─────┐   │
│ 👤 Marcus  │                                               │  │  Marcus  │   │
│ 👤 Varen   │  > Press '/' for commands...                 │  └──────────┘   │
│            │                                               │                  │
│            │                                               │ ─────────────── │
│            │                                               │ 💬 Iterate:     │
│            │                                               │ ┌─────────────┐ │
│            │                                               │ │ Add Varen   │ │
│            │                                               │ │ to this...  │ │
│            │                                               │ └─────────────┘ │
│            │                                               │        [Send]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Chat + Artifact Panel

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       CHAT                        │       ARTIFACT           │
│                                                   │                          │
│ User: Create a timeline of the war               │ 📅 War of Shadows        │
│                                                   │ ─────────────────────    │
│ Saga: I've created a timeline in the artifact    │                          │
│ panel. Key events:                               │ Year 1 ─── Sundering     │
│                                                   │           begins         │
│ • Year 1: The Sundering begins                   │      │                   │
│ • Year 3: Fall of the Eastern Kingdom            │ Year 3 ─── Eastern       │
│ • Year 7: Elena born                             │           Kingdom falls   │
│                                                   │      │                   │
│ Want me to add more detail to any event?         │ Year 7 ─── Elena born    │
│                                                   │      │                   │
│ ┌───────────────────────────────────────────┐   │ Year 24 ── Present day   │
│ │ Ask about your story...                   │   │                          │
│ └───────────────────────────────────────────┘   │ ─────────────────────    │
│                                                   │ 💬 "Add the Treaty of   │
│                                                   │     Thornfield in Y12"  │
│                                                   │              [Send]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Artifact Types

### Implemented (RAS-based renderers)

| Type | Renderer | Interactive Ops | Status |
|------|----------|-----------------|--------|
| `prose` | ArtifactProse | `prose.block.replace` | Done |
| `table` | ArtifactTable | row reorder, cell edit, rows remove | Done |
| `diagram` | ArtifactDiagram | node move/upsert, edge add/update | Done |
| `timeline` | ArtifactTimeline | item upsert/update | Done |
| `chart` | ArtifactChart | read-only (ECharts) | Done |
| `outline` | ArtifactOutline | item move | Done |
| `entityCard` | ArtifactEntityCard | read-only | Done |

### Prose variants (rendered via ArtifactProse)

| Type | Use Case | Renderer | Status |
|------|----------|----------|--------|
| `dialogue` | Character speech | ArtifactProse (variant) | Done |
| `lore` | World rules, canon | ArtifactProse (variant) | Done |
| `code` | Technical content | ArtifactProse (variant) | Done |
| `map` | Locations, geography | ArtifactProse (variant) | Done |

### Source Types (NOT renderers)

| Source | Description | Staleness |
|--------|-------------|-----------|
| `document` | Project document | Tracked via `updatedAt` |
| `entity` | Project entity | Tracked via `updatedAt` |
| `memory` | AI memory | Tracked via `updatedAt` |
| `web` | Fetched web content | External (can't track) |
| `github` | Fetched from GitHub | External (can't track) |

---

## Artifact Receipt Node (Editor)

The editor supports an inline, block-level **receipt node** so artifacts can be embedded with provenance and navigation.

- Node: `artifactReceipt` (TipTap node extension in `packages/editor/src/extensions/artifact-receipt.ts`)
- Purpose: show artifact title/type, source summary + staleness badge, and provide jump-to-artifact
- Default insertion: web Canvas inserts `artifactReceipt` immediately after inserted artifact content
- NodeView events:
  - `artifact:open` `{ artifactKey }` → open Artifact Panel and focus that artifact
  - `artifact:receipt:refresh` `{ artifactKey, artifactId? }` → refresh staleness and update receipt attrs in-place

### ArtifactReceiptExtension Features

The `ArtifactReceiptExtension` is a TipTap node extension with:

- **Attributes**: `artifactKey`, `artifactId`, `title`, `artifactType`, `sources` (array), `staleness`, `createdAt`, `updatedAt`, `createdBy`
- **Commands**: `insertArtifactReceipt`, `updateArtifactReceipt`, `removeArtifactReceipt`
- **Staleness badges**: `fresh`, `stale`, `external`, `unknown` with visual indicators
- **Source types**: `document`, `entity`, `memory`, `web`, `github`
- **Interactions**: Click to open artifact, keyboard navigation, refresh button
- **Type icons**: Type-specific icons (memo, speech balloon, scroll, laptop, map, etc.)

### Usage

```typescript
// Insert a receipt
editor.commands.insertArtifactReceipt({
  artifactKey: "prose-123",
  title: "Chapter 3 Draft",
  artifactType: "prose",
  staleness: "fresh",
  sources: [{ type: "document", id: "doc-456", title: "Chapter 2" }],
});

// Update staleness
editor.commands.updateArtifactReceipt("prose-123", { staleness: "stale" });

// Remove receipt
editor.commands.removeArtifactReceipt("prose-123");
```

---

## Function-Style Syntax

AI generates artifacts using clean function calls:

### Tables
```python
table("Political Hierarchy", [
  ["Rank", "Title", "Authority"],
  [1, "Emperor", "Absolute"],
  [2, "High Lord", "Regional"],
  [3, "Baron", "Local"]
])
```

### Diagrams
```python
diagram("Character Relationships", """
  Elena -->|trusts| Marcus
  Marcus -->|betrays| Elena
  Elena -->|seeks help| Varen
  Varen -.->|mentors| Elena
""")
```

### Timelines
```python
timeline("War of Shadows", [
  (1, "The Sundering begins"),
  (3, "Fall of the Eastern Kingdom"),
  (7, "Elena born in refugee camp"),
  (12, "Treaty of Thornfield"),
  (24, "Present day")
])
```

### Entity Cards
```python
entity("character", "Lord Varen", {
  "age": 67,
  "role": "Mentor",
  "description": "Silver-haired nobleman, one blind eye",
  "goals": ["Protect Elena", "Restore the old ways"],
  "fears": ["Dying before redemption"]
})
```

### Prose
```python
prose("""
The dragon's scales shimmered like molten copper in the dying light.
Elena's breath caught—years of training, yet nothing prepared her
for the sheer presence of the creature before her.
""")
```

### Outlines
```python
outline("Act 2: The Descent", [
  ("Chapter 7", "Elena discovers the betrayal"),
  ("Chapter 8", "Flight from the capital"),
  ("Chapter 9", "The mountain refuge"),
  ("Chapter 10", "Varen's proposition")
])
```

### Lore/Canon
```python
lore("The Three Laws of Binding", """
1. Blood freely given strengthens the bond
2. Names spoken thrice cannot be unspoken
3. No binding survives the death of both parties

**Exceptions**: Royal bloodlines are immune to the Third Law.
""")
```

### Deep Links
```python
link("entity", "elena-123", "Elena")
link("document", "ch3-456", "Chapter 3")
link("block", "ch3-456#p12", "the confrontation scene")
link("artifact", "timeline-789", "war timeline")
```

---

## Stage Tool

The AI controls the artifact panel with the `stage()` tool:

### Open Content
```python
# Open a document for reference
stage("open", { type: "document", id: "ch3-456" })

# Open with highlight
stage("open", {
  type: "document",
  id: "ch3-456",
  highlight: "block-789"
})

# Open entity card
stage("open", { type: "entity", id: "elena-123" })
```

### Show Generated Artifact
```python
# Show a diagram
stage("show", {
  type: "diagram",
  title: "Character Relationships",
  content: "Elena --> Marcus --> Varen"
})

# Show a table
stage("show", {
  type: "table",
  title: "Noble Houses",
  data: [["House", "Motto"], ["Varen", "Truth Endures"]]
})

# Show fetched web content
stage("show", {
  type: "web",
  url: "https://en.wikipedia.org/wiki/Feudalism",
  title: "Feudal System Research",
  content: "# Feudalism\n\nThe feudal system..."
})
```

### Split View
```python
# Compare two documents
stage("split", [
  { type: "document", id: "ch1", highlight: "opening" },
  { type: "document", id: "ch3", highlight: "opening" }
])
```

### Close
```python
stage("close")
```

---

## Iteration Chat

Every artifact has a mini-chat for refinement:

```
┌─────────────────────────────────────────────┐
│ 📊 Character Relationships                  │
│ ───────────────────────────────────────     │
│                                             │
│      ┌────────┐                            │
│      │ Elena  │                            │
│      └───┬────┘                            │
│          │ trusts                          │
│      ┌───▼────┐                            │
│      │ Marcus │                            │
│      └────────┘                            │
│                                             │
│ ─────────────────────────────────────────  │
│ 💬 Iteration History:                       │
│                                             │
│ You: Add Varen to the diagram              │
│ AI: Added Varen with mentor relationship   │
│                                             │
│ You: Show the betrayal more clearly        │
│ AI: Changed arrow style for betrayal       │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Make Marcus and Varen enemies...        │ │
│ └─────────────────────────────────────────┘ │
│                                    [Send]   │
│                                             │
│ [Copy] [Insert] [Save] [Versions ▼]        │
└─────────────────────────────────────────────┘
```

### Iteration Context

The iteration chat has full context:
- The artifact content
- The conversation that created it
- The current document (if in editor)
- Related entities and documents

### Iteration Commands

Quick commands in the iteration input:

| Command | Action |
|---------|--------|
| `+character` | Add a character to diagram |
| `+event` | Add event to timeline |
| `+row` | Add row to table |
| `/simplify` | Simplify the artifact |
| `/expand` | Add more detail |
| `/style dark` | Change visual style |

---

## Widgets (Reusable Patterns)

Widgets are pre-built artifact generators:

### `/fetch` - External Content
```
/fetch github:anthropics/claude-code/README.md
/fetch url:https://example.com/article
/fetch arxiv:2301.00001
```

### `/diagram` - Quick Diagrams
```
/diagram relationships     → Character relationship map
/diagram timeline          → Story timeline
/diagram hierarchy         → Power structure
/diagram flowchart         → Plot flowchart
```

### `/analyze` - Analysis Artifacts
```
/analyze pacing           → Pacing analysis chart
/analyze characters       → Character arc visualization
/analyze structure        → Three-act structure breakdown
```

### `/generate` - Content Generation
```
/generate outline         → Story outline
/generate character       → Character card
/generate worldbuilding   → World bible entry
```

### `/compare` - Split View
```
/compare ch1 ch3          → Side-by-side chapters
/compare draft final      → Version comparison
```

---

## Artifact Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. CREATED          2. ITERATED         3. APPLIED            │
│  ─────────           ──────────          ─────────             │
│                                                                 │
│  AI generates    →   User refines    →   Insert/Save           │
│  artifact            via mini-chat       to document           │
│                                                                 │
│  stage("show",       "Add more          [Insert at cursor]     │
│    {...})            detail..."         [Save to entity]       │
│                                          [Pin to canon]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### States

| State | Description | Storage |
|-------|-------------|---------|
| `draft` | Just created, not yet applied | Stored |
| `manually_modified` | User edited content directly | Stored |
| `applied` | Inserted into document | Stored |
| `saved` | Saved to entity/canon | Stored |
| `stale` | Source content changed | Computed via `checkStaleness` |
| `external` | Web/GitHub source (can't track) | Computed via `checkStaleness` |

---

## Deep Linking

### URL Scheme
```
rhei://project/{projectId}/document/{docId}
rhei://project/{projectId}/document/{docId}#block-{blockId}
rhei://project/{projectId}/entity/{entityId}
rhei://project/{projectId}/artifact/{artifactKey}
rhei://project/{projectId}/artifact/{artifactKey}#section-{sectionId}
rhei://help/{topic}
```

### Missing: Link + AI Integration

| Feature | Location | Status |
|---------|----------|--------|
| Copy Link (section) | Section menu (⋮) → "Copy link" | ❌ Missing |
| AI link resolver | Agent tool to fetch artifact by `rhei://` URL | ❌ Missing |
| @ mention autocomplete | Type `@` in AI input → artifact picker | ❌ Missing |
| CMD+K artifact picker | Global shortcut → search artifacts/docs/entities | ❌ Missing |

**Copy** (header) = snapshot content of active tab. **Copy Link** (section menu) = deep link URL.

### Access Control (P0)

Deep links are **membership-gated** for P0 (no public share tokens yet). Before navigating, clients call:

- `deepLinks.checkAccess({ projectId, targetType, targetId, requireRole })`
  - `requireRole: "member"` for read-only targets
  - `requireRole: "editor"` for mutating targets

### In-Content Links
```markdown
See [Elena](/entity/elena-123) in [Chapter 3](/doc/ch3#block-45).
Compare with the [relationship diagram](/artifact/rel-001).
Learn more in [Entity Tracking Guide](/help/entities).
```

### AI-Generated Links
```python
# AI can create links in responses
prose("""
[Elena](/entity/elena-123) turned to face
[Marcus](/entity/marcus-456). The weight of his
betrayal—detailed in [the council scene](/doc/ch3#block-78)—
hung between them.
""")
```

---

## Actions by Artifact Type

| Artifact | Primary Action | Secondary Actions |
|----------|----------------|-------------------|
| `prose` | Insert at cursor | Copy, Replace selection |
| `dialogue` | Insert | Copy, Add to voice samples |
| `entity` | Save to Entity | Copy, Insert description |
| `diagram` | Add to Graph | Copy image, Insert as image |
| `timeline` | Create events | Copy, Insert as list |
| `table` | Insert as table | Copy, Export CSV |
| `outline` | Create chapters | Copy, Insert as headings |
| `lore` | Pin to Canon | Copy, Add to world bible |
| `web` | Extract to doc | Copy, Save reference |
| `code` | Insert | Copy, Create entity from schema |

---

## Technical Implementation

### Artifact Schema

```typescript
// Artifacts support MIXED CONTENT via sections
// Each artifact is a mini-canvas with multiple content types

interface Artifact {
  id: string;
  artifactKey: string;
  title: string;
  sections: ArtifactSection[];  // Mixed content - prose, diagram, table, etc.
  status: "draft" | "manually_modified" | "applied" | "saved";
  statusChangedAt?: number;
  statusBy?: string;
  statusContext?: {
    appliedToDocumentId?: string;
    savedToEntityId?: string;
  };
  sources: ArtifactSource[];
  executionContext: {
    widgetId: string;
    widgetVersion: string;
    model: string;
    inputs: Record<string, unknown>;
    startedAt: number;
    completedAt: number;
  };
  projectId: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// Section within an artifact (supports mixed content)
interface ArtifactSection {
  id: string;
  type: ArtifactSectionType;
  title?: string;
  content: string;
  format: "markdown" | "mermaid" | "json" | "plain";
  collapsed: boolean;
  order: number;
}

type ArtifactSectionType =
  | "prose" | "dialogue" | "code" | "lore"
  | "diagram" | "timeline" | "table" | "chart"
  | "entityCard" | "outline" | "map";

interface ArtifactSource {
  type: "document" | "entity" | "memory" | "web" | "github";
  id: string;
  title?: string;
  manual: boolean;
  addedAt: number;
  sourceUpdatedAt?: number;
}

// Legacy: single-type artifacts (deprecated in favor of sections)
// Kept for backward compatibility with existing artifacts
type ArtifactType =
  | "prose" | "dialogue" | "entity" | "outline" | "lore"
  | "diagram" | "timeline" | "table" | "map"
  | "document" | "web" | "code" | "github";

interface IterationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  artifactVersion?: string;
}

interface ArtifactVersion {
  id: string;
  content: string;
  timestamp: number;
  trigger: "creation" | "iteration" | "manual";
}
```

### Stage Store

```typescript
// packages/state/src/stage.ts
// Full Convex sync - all artifacts persisted and real-time

interface StageState {
  isOpen: boolean;
  tabs: ArtifactTab[];           // Tabs = branches, not pins
  activeTabId: string | null;

  // Tab operations (branch, merge, not pin)
  createTab: (artifact?: Partial<Artifact>) => string;
  focusTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  mergeTabs: (sourceTabId: string, targetTabId: string) => void;
  reorderTabs: (tabIds: string[]) => void;
  branchFromSection: (artifactId: string, sectionId: string) => string;

  // Artifact actions
  updateArtifact: (artifactId: string, updates: Partial<Artifact>) => void;
  addSection: (artifactId: string, section: Omit<ArtifactSection, "id" | "order">) => string;
  updateSection: (artifactId: string, sectionId: string, updates: Partial<ArtifactSection>) => void;
  removeSection: (artifactId: string, sectionId: string) => void;
  reorderSections: (artifactId: string, sectionIds: string[]) => void;

  // Iteration
  sendIteration: (artifactKey: string, message: string) => Promise<void>;

  // Apply
  insertAtCursor: (artifactKey: string, sectionId?: string) => void;
  insertSectionAtCursor: (artifactId: string, sectionId: string) => void;
  saveToEntity: (artifactKey: string, entityId: string) => void;
}

interface ArtifactTab {
  id: string;
  artifactId: string;
  title: string;
  order: number;
}
```

### Agent Context

```typescript
// Agent receives FULL artifact panel state in context
// Agent needs complete awareness to understand "update the diagram"

interface AgentArtifactContext {
  panelOpen: boolean;
  activeTab: {
    id: string;
    title: string;
  } | null;
  activeArtifact: {
    id: string;
    title: string;
    sections: {
      id: string;
      type: ArtifactSectionType;
      title?: string;
      content: string;  // Full content, not truncated
    }[];
  } | null;
  otherTabs: { id: string; title: string }[];  // For reference
  currentDocumentId: string | null;            // What user is editing
}
```

### TOC Component

```typescript
// Reusable Table of Contents component
// Used in: documents, artifacts, any scrollable content with sections
// Like Notion's outline with hover dots

interface TOCProps {
  sections: { id: string; title: string; level?: number }[];
  activeSection?: string;
  onSectionClick: (sectionId: string) => void;
  position: "left" | "right";  // Dots on left or right
}

// Features:
// - Dots/lines indicating sections
// - Hover dot → show section title tooltip
// - Click dot → scroll to section
// - Active section highlighted
// - Collapsed sections shown differently
```

### Tool Definitions

```typescript
// convex/ai/tools/artifactTools.ts
// Agent has FULL control over artifact panel

const artifactTools = {
  // Main artifact tool - create, update, add sections
  artifact: {
    description: "Create or update artifact with sections (mixed content canvas)",
    parameters: z.object({
      action: z.enum(["create", "update", "addSection", "updateSection", "removeSection"]),
      artifactId: z.string().optional(),      // Required for update operations
      title: z.string().optional(),           // For create/update artifact
      sections: z.array(z.object({
        type: z.enum(["prose", "diagram", "table", "timeline", "code", "entityCard", "outline"]),
        title: z.string().optional(),
        content: z.string(),
      })).optional(),                          // For create
      sectionId: z.string().optional(),       // For section operations
      sectionContent: z.string().optional(),  // For updateSection
      sectionType: z.string().optional(),     // For addSection
    }),
    autoExecute: true,
  },

  // Tab/stage control
  stage: {
    description: "Control artifact panel tabs and navigation",
    parameters: z.discriminatedUnion("action", [
      z.object({ action: z.literal("newTab"), title: z.string().optional() }),
      z.object({ action: z.literal("focusTab"), tabId: z.string() }),
      z.object({ action: z.literal("closeTab"), tabId: z.string() }),
      z.object({ action: z.literal("mergeTabs"), sourceTabId: z.string(), targetTabId: z.string() }),
      z.object({ action: z.literal("branchSection"), artifactId: z.string(), sectionId: z.string() }),
      z.object({ action: z.literal("close") }),
    ]),
    autoExecute: true,
  },

  // Deep linking
  link: {
    description: "Create a deep link to content",
    parameters: z.object({
      type: z.enum(["entity", "document", "block", "artifact", "section", "help"]),
      id: z.string(),
      sectionId: z.string().optional(),  // For artifact section links
      label: z.string(),
    }),
    autoExecute: true,
  },
};

// Convenience tools that wrap artifact tool
const contentTools = {
  diagram: {
    description: "Add mermaid diagram section to current artifact",
    parameters: z.object({ title: z.string().optional(), content: z.string() }),
    // Internally calls: artifact({ action: "addSection", sectionType: "diagram", ... })
  },
  table: {
    description: "Add table section to current artifact",
    parameters: z.object({ title: z.string().optional(), rows: z.array(z.array(z.unknown())) }),
  },
  timeline: {
    description: "Add timeline section to current artifact",
    parameters: z.object({ title: z.string().optional(), events: z.array(z.tuple([z.number(), z.string()])) }),
  },
  prose: {
    description: "Add prose section to current artifact",
    parameters: z.object({ title: z.string().optional(), content: z.string() }),
  },
};
```

---

## UI Components

### ArtifactPanel
```
┌─────────────────────────────────────────────┐
│ [Icon] Title                    [Actions ▼] │
│ ─────────────────────────────────────────── │
│                                             │
│            ARTIFACT CONTENT                 │
│            (rendered by type)               │
│                                             │
│ ─────────────────────────────────────────── │
│ 💬 Iteration                                │
│ ┌─────────────────────────────────────────┐ │
│ │ Refine this artifact...                 │ │
│ └─────────────────────────────────────────┘ │
│                                    [Send]   │
│                                             │
│ [Insert] [Copy] [Save ▼] [Versions: v3 ▼]  │
└─────────────────────────────────────────────┘
```

### InlineArtifact (in chat)
```
┌─────────────────────────────────────────────┐
│ 📊 Character Relationships    [Expand →]    │
│ ─────────────────────────────────────────── │
│ Elena → Marcus → Varen (3 nodes)            │
│                                [Copy] [Use] │
└─────────────────────────────────────────────┘
```

### ArtifactActions Menu
```
┌─────────────────────────┐
│ Insert at cursor        │
│ Insert as new block     │
│ ─────────────────────── │
│ Copy to clipboard       │
│ Copy as markdown        │
│ Copy as image           │
│ ─────────────────────── │
│ Save to entity...       │
│ Pin to canon            │
│ Export...               │
│ ─────────────────────── │
│ Open in full screen     │
│ View versions           │
└─────────────────────────┘
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+A` | Toggle artifact panel |
| `Cmd+Enter` | Insert artifact at cursor |
| `Cmd+C` | Copy artifact |
| `Cmd+S` | Save artifact |
| `Escape` | Close artifact panel |
| `Tab` | Focus iteration input |
| `Cmd+[` / `Cmd+]` | Previous/next version |

---

## Examples

### Example 1: Building a World Map

```
User: Help me visualize the geography of my world

AI: I'll create a map diagram showing the major regions:

diagram("World of Aetheris", """
  subgraph North["Northern Wastes"]
    Frost[Frost Peaks]
    Varen[Varen's Domain]
  end

  subgraph Central["Central Kingdoms"]
    Capital[The Capital]
    Thornfield[Thornfield]
  end

  subgraph South["Southern Reaches"]
    Desert[Scorched Lands]
    Port[Free Ports]
  end

  North ---|Mountain Pass| Central
  Central ---|Trade Routes| South
""")

This shows the three major regions. Use the iteration chat
to add specific locations or adjust relationships.
```

### Example 2: Character Development

```
User: Create a character card for the antagonist

AI: Here's Marcus's character card:

entity("character", "Marcus Thorne", {
  "age": 28,
  "role": "Antagonist (former ally)",
  "house": "House Thorne",
  "description": "Dark hair, calculating eyes, carries his father's blade",
  "motivation": "Believes Elena's family caused his father's death",
  "arc": "From trusted friend to bitter enemy",
  "relationships": [
    { "target": "Elena", "type": "betrays", "reason": "Family vendetta" },
    { "target": "Varen", "type": "fears", "reason": "Knows too much" }
  ]
})

Iterate on this card to add backstory, refine motivations,
or connect to other characters.
```

### Example 3: Research Integration

```
User: /fetch github:worldbuilding/magic-systems/README.md

AI: I've fetched the magic systems reference:

stage("show", {
  type: "github",
  url: "github:worldbuilding/magic-systems/README.md",
  title: "Magic Systems Reference",
  content: "# Magic System Design\n\n## Hard vs Soft Magic..."
})

Key patterns I found that might work for your story:
- Sanderson's Laws for hard magic
- Cost/benefit structure
- Limitation-based drama

Want me to adapt any of these for your Three Laws of Binding?
```

---

## Tool Gap Analysis (vs Notion/Craft)

### Current Rhei Tools

| Category | Tool | Status |
|----------|------|--------|
| **Search** | `searchContextTool` | Done |
| **Search** | `webSearchTool` | Done |
| **Search** | `webExtractTool` | Done |
| **Read** | `readDocumentTool` | Done |
| **Read** | `getEntityTool` | Done |
| **Write** | `writeContentTool` | Done |
| **Graph** | `createEntityTool` | Done |
| **Graph** | `updateEntityTool` | Done |
| **Graph** | `graphMutationTool` | Done |
| **Analysis** | `analyzeContentTool` | Done |
| **Image** | `generateImageTool` | Done |
| **Image** | `illustrateSceneTool` | Done |
| **Image** | `analyzeImageTool` | Done |
| **World** | `genesisWorldTool` | Done |
| **Questions** | `askQuestionTool` | Done |

### Recently Implemented Tools

| Priority | Tool | What It Does | Status |
|----------|------|--------------|--------|
| **P1** | `viewVersionHistoryTool` | View document versions, compare snapshots | ✅ Done |
| **P1** | `deleteDocumentTool` | Delete documents | ✅ Done |
| **P2** | `searchUsersTool` | Find users by name/email | ✅ Done |
| **P2** | `viewCommentsTool` | See editorial feedback on documents | ✅ Done |
| **P2** | `addCommentTool` | AI participates in discussions | ✅ Done |

### Still Missing Tools

| Priority | Tool | What It Does | Why Needed |
|----------|------|--------------|------------|
| **P3** | `sendNotificationTool` | Notify collaborators | Team workflows |
| **P3** | `batchCreateTool` | Create multiple docs/entities at once | Efficiency |
| **P3** | `structuredQueryTool` | SQL-like queries on entities | Power users |

### Artifact-Specific Tools (IMPLEMENTED)

These tools are wired into `agentRuntime.ts` and auto-execute. Server-executed model: agent calls → runtime executes → streams result to client → client handler applies UI effects.

**Design (January 2026):**
- Artifacts support **mixed content** via sections (prose + diagram + table in one artifact)
- **Tabs = branches**, not pins (branch, merge, rename, reorder)
- Agent has **full context** of artifact panel (not minimal)
- **Full Convex sync** for all artifacts
- **TOC component** for section navigation (reusable across app)

| Tool | Description | Auto-execute | Status |
|------|-------------|--------------|--------|
| `artifact_tool` | Create/update/apply_op/remove artifacts | Yes | ✅ Done |
| `artifact_stage` | Control panel: open/close, set_active, focus, compare, exit_compare | Yes | ✅ Done |
| `artifact_link` | Generate deep links to projects/documents/entities/artifacts | Yes | ✅ Done |
| `artifact_diagram` | Convenience: create diagrams, upsert/move nodes, add/update edges | Yes | ✅ Done |
| `artifact_table` | Convenience: create tables, add/update/remove/reorder rows | Yes | ✅ Done |
| `artifact_timeline` | Convenience: create timelines, upsert/update items | Yes | ✅ Done |
| `artifact_prose` | Convenience: create prose/dialogue/lore/code, replace blocks | Yes | ✅ Done |

**Implementation paths**:
- Tool definitions: `convex/ai/tools/artifactTools.ts`
- Runtime wiring: `convex/ai/agentRuntime.ts` (TOOL_POLICY + executeArtifactTool)
- Client handler: `apps/expo/src/hooks/useArtifactToolHandler.ts`
- TOC component: `packages/ui/src/components/toc.tsx`

---

## Competitive Advantages vs Notion/Craft

### vs Notion AI

| Feature | Notion | Rhei | Winner |
|---------|--------|------|--------|
| **Artifact Panel** | None (inline only) | Side panel with iteration | Rhei |
| **Block-level links** | Page only | `#block-{id}` | Rhei |
| **Iteration chat** | None | Per-artifact mini-chat | Rhei |
| **Version history** | Via separate tool | Integrated in artifact | Rhei |
| **Mermaid diagrams** | None | Native rendering | Rhei |
| **Entity cards** | Generic page | Typed schema | Rhei |
| **Image generation** | None | `generateImageTool` | Rhei |
| **Page truncation** | 26k tokens | Smart chunking | Rhei |
| **Persistent memory** | None | Cross-session | Rhei |

### vs Craft AI

| Feature | Craft | Rhei | Winner |
|---------|-------|------|--------|
| **Artifact Panel** | None | Side panel | Rhei |
| **Edit documents** | Read-only | Full CRUD | Rhei |
| **Iteration** | New chat only | In-artifact refinement | Rhei |
| **Deep linking** | Block-level | Block-level | Tie |
| **Entity tracking** | None | Auto-detection + graph | Rhei |
| **Coherence checking** | None | Built-in | Rhei |
| **Image generation** | None | Multiple tools | Rhei |

### Key Differentiators

1. **Artifact Iteration Chat** - Neither Notion nor Craft has this
2. **Mermaid Diagrams** - Native diagram rendering
3. **Entity Cards** - Typed entity visualization
4. **Block-Level Deep Links** - Cite specific paragraphs
5. **Image Generation** - Create character portraits, scene illustrations
6. **Version Scrubbing** - Navigate artifact history inline

---

## UX Patterns to Steal

### From Notion

1. **Table row handles** - Drag to reorder, checkbox on left
2. **Block hover menu** - Actions appear on hover (6-dot grip)
3. **Synced blocks** - Content stays in sync across pages
4. **Database views** - Table, board, calendar, timeline
5. **Cell coloring** - Fine-grained table styling

### From Craft

1. **`<Content>` tags** - Clear copyable content distinction
2. **Model selector** - Switch between quality tiers
3. **Deep links** - `craft://doc/{blockId}` scheme

### Unique to Rhei

1. **Iteration mini-chat** - Refine artifacts without leaving context
2. **Entity auto-detection** - Characters highlighted automatically
3. **Coherence signals** - Pulse warnings for inconsistencies
4. **Project Graph integration** - Artifacts can create graph nodes
5. **Genesis world tool** - Generate complete story worlds

---

## Table UX Enhancement

Based on Notion's table pattern with row handles:

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Character Stats                              [Actions ▼] │
├─────────────────────────────────────────────────────────────┤
│ ⋮⋮ │ ☐ │ Name      │ Age │ Role        │ Status    │       │
├────┼───┼───────────┼─────┼─────────────┼───────────┤       │
│ ⋮⋮ │ ☐ │ Elena     │ 24  │ Protagonist │ Active    │       │
│ ⋮⋮ │ ☐ │ Marcus    │ 28  │ Antagonist  │ Active    │       │
│ ⋮⋮ │ ☑ │ Varen     │ 67  │ Mentor      │ Deceased  │       │
├────┴───┴───────────┴─────┴─────────────┴───────────┘       │
│ + Add row                                                   │
├─────────────────────────────────────────────────────────────┤
│ 💬 "Remove the deceased characters"                  [Send] │
├─────────────────────────────────────────────────────────────┤
│ [Copy] [Insert] [Export CSV] [Versions: v2 ▼]              │
└─────────────────────────────────────────────────────────────┘

Legend:
⋮⋮ = Drag handle (6-dot grip)
☐ = Checkbox (unchecked)
☑ = Checkbox (checked)
```

### Table Features

| Feature | Description |
|---------|-------------|
| **Row handles** | 6-dot grip for drag-to-reorder |
| **Row checkboxes** | Select rows for bulk actions |
| **Inline editing** | Click cell to edit |
| **Column resize** | Drag column borders |
| **Column sort** | Click header to sort |
| **Row coloring** | Conditional formatting |
| **Add row** | Quick add at bottom |
| **Iteration** | Natural language to modify table |

Status (implementation):
- Row handles + row selection checkboxes are rendered in ArtifactPanel tables (web + Expo).
- Web runtime Table v1 supports drag reorder, inline cell edits, and row removal (RAS).
- Expo native table renderer (`ArtifactTableNative.tsx`) supports gesture-based drag-to-reorder with reanimated.
- Mermaid rendering is enabled in web and Expo (Expo uses WebView preview).
- Artifact insert action is wired for web editor insertion; Expo still logs for now.
- RAS runtime renders table/diagram/timeline/chart/prose/outline/entity card on web; Expo uses WebView runtime for diagrams/timelines/charts.

---

## Migration Path

### Phase 1: Basic Artifacts (status)

| Item | Status | Notes |
|------|--------|-------|
| `prose`, `dialogue`, `table` artifacts | Done (baseline) | Types and renderers exist; dialogue falls back to prose renderer. |
| Basic stage panel (open/close) | Done (panel modes) | Panel toggle + open/close via store actions. |
| Copy and insert actions | Partial | Copy is implemented; insert is wired for web editor only. |
| Table with row handles and checkboxes | Done | Web + Expo render handles and selection. |

### Phase 2: Rich Artifacts (status)

| Item | Status | Notes |
|------|--------|-------|
| `diagram`, `timeline`, `entity` artifacts | Done (baseline) | Renderers exist; timeline/entity are JSON/text-based. |
| Mermaid rendering | Done | Web + Expo render Mermaid (Expo via WebView). |
| Iteration chat (basic) | Done | Mini-chat + history in panel. |
| Row drag-to-reorder | Done | Web + Expo support drag-to-reorder (Expo uses native gesture handler). |

### Phase 3: Full Iteration (status)

| Item | Status | Notes |
|------|--------|-------|
| Version history with scrubbing | Done | Scrub UI + keyboard shortcuts on web; Expo has scrubbing buttons. |
| Full iteration context | Partial | Iteration messages store artifact + document context on web; tool wiring pending. |
| Artifact persistence | Done | Merge-safe sync with dirty tracking and write-through hook. |
| Bulk row operations | Partial | Web RAS table supports remove-selected; more ops pending. |

### Phase 4: Widgets & Deep Links (status)

| Item | Status | Notes |
|------|--------|-------|
| `/fetch` widget | Done | Widget registered (server + client); fetch uses web_extract. |
| `/diagram` widget | Done | Widget registered (server + client) with mermaid prompt. |
| Deep linking scheme (`rhei://...#block-{id}`) | Done | `rhei://` URL scheme with focusId support on Expo + Tauri. |
| Cross-artifact references | Done (web) / Partial (Expo) | Web Artifact Panel shows outgoing refs + backlinks and a graph view; element-level copy links in renderers still pending. |

### Phase 5: Collaboration Tools (status)

| Item | Status | Notes |
|------|--------|-------|
| `view_version_history` | Done | Backend: `convex/revisions.viewVersionHistory`, Agent: `convex/ai/tools/collaborationTools.ts`, Runtime: `convex/ai/agentRuntime.ts` (RAG category, auto-execute) |
| `delete_document` | Done | Backend: `convex/documents.deleteDocument` (soft-delete), Agent: tool + HITL approval (destructive danger level) |
| `search_users` | Done | Backend: `convex/users.searchProjectUsers`, Agent: RAG category, auto-execute |
| `view_comments` | Done | Backend: `convex/comments.listByDocument`, Agent: RAG category, auto-execute |
| `add_comment` | Done | Backend: `convex/comments.add`, Agent: HITL category, requires user approval |

### Phase 5: Missing UI for Collaboration Tools

| Component | Priority | Notes |
|-----------|----------|-------|
| `AddCommentApprovalCard` | P1 | HITL approval card in AI chat - show comment content, target document |
| `DeleteDocumentApprovalCard` | P1 | HITL approval card with destructive warning - show document title, confirm action |
| `VersionHistoryResultCard` | P2 | Display version list in chat - timestamp, author, diff preview |
| `CommentsResultCard` | P2 | Display comments in chat - author avatar, timestamp, selection context |
| `UserSearchResultCard` | P2 | Display user search results - name, email, avatar for @mention selection |

### Phase 6: Batch Export + Context Management (status)

| Item | Status | Notes |
|------|--------|-------|
| Batch PDF with offscreen rendering | Done | `batchRenderArtifacts()` utility in `services/export/artifacts/batchRender.tsx` |
| Format picker (PNG/SVG/PDF/JSON/Batch) | Done | Dropdown in ArtifactPanel header |
| Thread summarization action | Done | `convex/ai/summarizeThread.ts` with token estimation + warning levels |
| ChatUsageIndicator with summarize | Done | "Summarize" button at >6k tokens; calls summarization action |
| ArtifactReceiptExtension commands | Done | `updateArtifactReceipt()`, `removeArtifactReceipt()` commands |

---

## Open Questions (Post-UI)

### Context Sharing: AI Panel ↔ Artifact Panel

**Current:** AI has document context via `readDocumentTool`

**Question:** How should artifact context flow to AI?

Decision: Tool-based by default (`readArtifactTool`), with optional `@artifact` mention for explicit injection. Auto-inject is avoided to keep prompts lean.

### Session Scope

Decision: Document-scoped artifacts with thread history retained for iteration provenance.

### Component Reuse (decision)

- Keep artifact mini-chat as the default interaction surface.
- Reuse `AIPanelInput` when it can preserve the artifact pill UX without regressing animation/latency.
- Specialized renderers stay modular; no sub-agent layer required yet.

---

## Implementation Plan (RAS-first)

1. Commit to hybrid strategy (Mermaid baseline + flagship interactive artifacts).
2. Formalize data vs view vs renderer contract with stable IDs for all elements.
3. Choose web-first renderer stack and define adapter interface.
4. Build Artifact Runtime v1 on RAS v0.1 from day one (Markdown, Mermaid, Table v1, ECharts v1, Timeline v1).
5. Ship RN WebView runtime + message bridge for focus/selection/export/navigation.
6. Harden RAS v0.1 (schema validation, ID rules, `{byId, order}` invariants).
7. Artifact Engine v1 (domain ops -> JSON Patch, rev checks, optimistic concurrency).
8. Flagship diagrams with React Flow (custom nodes/edges + editing).
9. Uniform deep linking across all artifacts (`.../artifact/{artifactKey}#{elementId}`).
10. First-class export per renderer with deterministic layouts.
11. Scale and specialize only when usage demands it.
12. Refinements: conflict strategy, entity card schema, story-time, templates, cross-links, staleness, iteration history, CSP notes.

## Implementation Tickets (Draft)

## Ticket: Hybrid Artifact Strategy + Stack Baseline
**Phase:** 1
**Dependencies:** None
**Owner:** Codex
**Acceptance Criteria:**
- Mermaid baseline + flagship goal captured in spec. (Done)
- Web-first stack recorded (Tables, Diagrams, Charts, Timelines). (Done)

## Ticket: Artifact Model Separation + ID Conventions
**Phase:** 2
**Dependencies:** Hybrid Artifact Strategy + Stack Baseline
**Owner:** Codex
**Acceptance Criteria:**
- Data vs view vs renderer contract documented. (Done in spec)
- ID grammar defined (JSON Pointer-safe). (Done in spec)

## Ticket: Renderer Adapter Contract (Web)
**Phase:** 3
**Dependencies:** Artifact Model Separation + ID Conventions
**Owner:** Codex
**Acceptance Criteria:**
- `render(spec)`, `export(spec, opts)`, `emitInteractions(events)` defined. (Defined in spec)
- Adapter contract used by runtime entry point. (Done)

## Ticket: RAS v0.1 Core Schema + Validation
**Phase:** 6
**Dependencies:** Artifact Model Separation + ID Conventions
**Owner:** Codex
**Acceptance Criteria:**
- `ArtifactEnvelope` with `rev`, `data`, `view`, `viewByUser`, `index`, `provenance`. (Defined in spec)
- Collections use `{byId, order}` across artifact types. (Defined in spec)
- Schema validation wired into creation/update paths. (Done in state store)

## Ticket: Artifact Runtime v1 (RAS-first)
**Phase:** 4
**Dependencies:** Renderer Adapter Contract (Web), RAS v0.1 Core Schema + Validation
**Owner:** Codex
**Acceptance Criteria:**
- Markdown renderer with design-system typography. (Done in runtime)
- Mermaid renderer (safe config, themed). (Done in panels + Expo WebView)
- Table v1 with stable row IDs + reorder. (Done in web runtime)
- ECharts v1 with basic interactions. (Done in web runtime)
- Timeline v1 with editable items. (Done in web runtime)

## Ticket: React Native WebView Artifact Runtime
**Phase:** 5
**Dependencies:** Artifact Runtime v1 (RAS-first)
**Owner:** Codex
**Acceptance Criteria:**
- WebView runtime added for RAS diagram/timeline/chart. (Done: embedded renderer)
- Native table renderer (`ArtifactTableNative.tsx`) with gesture-based drag-to-reorder. (Done)
- Message bridge supports focus/selection/export hooks. (Done: focus + selection + JSON export)

## Ticket: Artifact Engine v1 (Domain Ops -> JSON Patch)
**Phase:** 7
**Dependencies:** RAS v0.1 Core Schema + Validation
**Owner:** Codex
**Acceptance Criteria:**
- Domain ops compile to JSON Patch with `/rev` test. (Done)
- Patch application bumps `rev` deterministically. (Done)
- Op log recorded for undo/redo. (Done)

## Ticket: React Flow Flagship Diagrams
**Phase:** 8
**Dependencies:** Artifact Runtime v1 (RAS-first), Artifact Engine v1 (Domain Ops -> JSON Patch)
**Owner:** Codex
**Acceptance Criteria:**
- Custom entity nodes render with name + status. (Done in artifact runtime)
- Relationship edges support labels. (Done in artifact runtime)
- Click node opens entity card. (Done in artifact runtime)
- Drag-to-connect creates a relationship op. (Done in artifact runtime)

## Ticket: Deep Linking Across Artifacts
**Phase:** 9
**Dependencies:** Artifact Engine v1 (Domain Ops -> JSON Patch), React Flow Flagship Diagrams
**Owner:** Codex
**Acceptance Criteria:**
- `rhei://project/{projectId}/artifact/{artifactKey}#{elementId}` supported. (Done: Expo + Tauri handlers)
- Diagram, table, timeline, and chart focus handlers implemented. (Done in runtime)
- Expo deep link listener (`useRheiDeepLinkListener.ts`) with focusId support. (Done)
- Tauri deep link handler (`useDeepLinks.ts`) with `@tauri-apps/plugin-deep-link`. (Done)

## Ticket: Export as First-Class Renderer Mode
**Phase:** 10
**Dependencies:** Artifact Runtime v1 (RAS-first)
**Owner:** Codex
**Acceptance Criteria:**
- Export hooks per renderer (PNG/SVG/JSON; SVG falls back to PNG when needed; PDF assembly on web). (Done in web runtime + panel)
- Layout determinism stored in `data` (not runtime-only). (Partial: RAS data stores positions/order)
- Batch PDF export with offscreen rendering: `batchRenderArtifacts()` utility renders each artifact to PNG/SVG before pdfmake assembly. (Done)
- Format picker in ArtifactPanel: PNG, SVG, PDF, JSON, Batch PDF, Batch JSON. (Done)

## Ticket: Refinements + Conflict Strategy
**Phase:** 12
**Dependencies:** Artifact Engine v1 (Domain Ops -> JSON Patch)
**Owner:** Codex
**Acceptance Criteria:**
- Conflict strategy defined (auto-rebase vs prompt). (Planned)
- Entity card schema added. (Done)
- Story-time format formalized. (Done in schema)
- Templates + cross-artifact links + staleness checks defined. (Partial: schema + staleness query)
- Iteration history storage added. (Done in schema + state)

*Last updated: January 15, 2026 (revised: artifact tools implemented - artifact_tool, artifact_stage, artifact_link, artifact_diagram, artifact_table, artifact_timeline, artifact_prose)*
