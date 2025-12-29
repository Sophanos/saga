# Notion-like Features Implementation Plan

> Adding Command Palette, World Graph Visualization, and AI Sidebar to Mythos IDE

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Command Palette](#phase-1-command-palette-cmdk)
3. [Phase 2: World Graph Visualization](#phase-2-world-graph-visualization)
4. [Phase 3: AI Sidebar/Agent](#phase-3-ai-sidebaragen)
5. [Design System Integration](#design-system-integration)
6. [Architecture Patterns](#architecture-patterns)

---

## Overview

### Goals

Transform Mythos IDE into a power-user-friendly creative writing environment with:

| Feature | Inspiration | Purpose |
|---------|-------------|---------|
| Command Palette | Notion, VS Code, Linear | Quick access to any action via keyboard |
| World Graph | Obsidian, Roam | Visual exploration of entity relationships |
| AI Sidebar | Notion AI, Cursor | Context-aware AI assistant for world building |

### Current State

- **Editor**: Tiptap-based with entity mentions and linter decorations
- **Entities**: Character, Location, Item, MagicSystem, Faction support
- **World Graph**: In-memory graph class exists (no visualization)
- **Console Panel** (6 tabs, all implemented):
  | Tab | Feature | Status |
  |-----|---------|--------|
  | Chat | RAG chat with streaming (`useChatAgent`) | Done |
  | Search | Semantic search (DeepInfra + Qdrant) | Done |
  | Linter | Consistency checking with auto-fix | Done |
  | Dynamics | Entity interaction extraction | Done |
  | Coach | Writing feedback (show-don't-tell, pacing, sensory) | Done |
  | History | Analysis dashboard | Done |
- **Search**: See [SEMANTIC_SEARCH.md](../../../docs/SEMANTIC_SEARCH.md)
- **Keyboard shortcuts**: Mod-[ / Mod-] (style nav), Mod-J (console toggle)

### Implementation Status

| Feature | Status |
|---------|--------|
| Semantic Search (Qdrant) | **Done** |
| RAG Chat (streaming) | **Done** |
| Auto-embedding (docs/entities) | **Done** |
| Command Palette | Planned |
| World Graph Visualization | Planned |
| AI Tool Calling | Planned |

---

## Phase 1: Command Palette (Cmd+K)

### Design

**Progressive Disclosure (Raycast/Linear style)**

The palette starts compact and expands progressively:
- Default: ~6 most relevant items (recent + quick actions)
- Typing: Shows all matching results across categories
- "Show All": Expands individual sections
- Tab: Cycles through section filters

**Compact state (default, no query):**
```
┌────────────────────────────────────────────────────┐
│  Search commands and content...              ⌘K   │
├────────────────────────────────────────────────────┤
│                                                    │
│ Recent                                             │
│ ┌────────────────────────────────────────────────┐ │
│ │ 📄  Chapter 7 — The Awakening            Dec 28│ │
│ └────────────────────────────────────────────────┘ │
│    👤  Elena (Character)                   Dec 27 │
│                                                    │
│ Quick Actions                                      │
│    💬  Ask AI                               ⌘/    │
│    👤  Create Character                     ⌘⇧C   │
│    ⚠️   Run Linter                          ⌘⇧L   │
│                                                    │
│ More...                                   Show All │
│                                                    │
├────────────────────────────────────────────────────┤
│  ↑↓ navigate   Tab sections   ↵ select   esc     │
└────────────────────────────────────────────────────┘
```

**Expanded state (after clicking "Show All" or Tab):**
```
┌────────────────────────────────────────────────────┐
│  Search commands and content...              ⌘K   │
├────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌────┐ ┌─────┐ ┌───────┐       │
│ │ All  │ │Entity│ │ AI │ │ Nav │ │General│       │  ← Tab filters
│ └──────┘ └──────┘ └────┘ └─────┘ └───────┘       │
│                                                    │
│ Entities                                           │
│    👤  Create Character                     ⌘⇧C   │
│    📍  Create Location                      ⌘⇧O   │
│    ⚔️   Create Item                         ⌘⇧I   │
│    ✨  Create Magic System                        │
│    🏛️   Create Faction                            │
│    🔍  Search Entities                      ⌘E    │
│                                                    │
│ AI Actions                                         │
│    💬  Ask AI About Story                   ⌘/    │
│    ✨  Detect Entities in Selection               │
│    ⚠️   Check Story Consistency             ⌘⇧L   │
│                                                    │
│ Navigation                                         │
│    📄  Go to Document                       ⌘P    │
│    🔍  Search Everything                    ⌘⇧F   │
│    🕐  Recent Files                               │
│                                                    │
│ General                                            │
│    🎲  Toggle Writer/DM Mode                ⌘M    │
│    📥  Export Story                         ⌘⇧E   │
│    📤  Import Story                               │
│    ⚙️   Settings                            ⌘,    │
│                                                    │
├────────────────────────────────────────────────────┤
│  ↑↓ navigate   Tab sections   ↵ select   esc     │
└────────────────────────────────────────────────────┘
```

**Search results state:**
```
┌────────────────────────────────────────────────────┐
│  elena                                       ⌘K   │
├────────────────────────────────────────────────────┤
│                                                    │
│ Entities                                           │
│ ┌────────────────────────────────────────────────┐ │
│ │ 👤  Elena                                      │ │
│ │     Character · Mentioned in 12 docs           │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ Documents                                          │
│    Chapter 7 — The Awakening               Dec 28 │
│    "Elena stood at the edge of the cliff..."      │
│                                                    │
│    Character Notes: Elena                  Dec 27 │
│    "Backstory and motivations..."                 │
│                                                    │
├────────────────────────────────────────────────────┤
│  ↑↓ navigate   ↵ select   esc close              │
└────────────────────────────────────────────────────┘
```

**Empty state (no results):**
```
┌────────────────────────────────────────────────────┐
│  xyzabc                                      ⌘K   │
├────────────────────────────────────────────────────┤
│                                                    │
│                                                    │
│              No results found.                     │
│                                                    │
│         Press ↵ to search story content:          │
│                   "xyzabc"                         │
│                                                    │
│         Or create new entity:                      │
│         👤 Character  📍 Location  ⚔️ Item        │
│                                                    │
│                                                    │
├────────────────────────────────────────────────────┤
│  ↑↓ navigate   ↵ search   esc close              │
└────────────────────────────────────────────────────┘
```

### Interaction Behavior

| Action | Result |
|--------|--------|
| `Cmd+K` | Open compact palette (~6 items) |
| Type query | Filter all commands + semantic search |
| `Tab` | Cycle section filters (All → Entity → AI → Nav → General) |
| `Shift+Tab` | Cycle backwards |
| Click "Show All" / "More..." | Expand to full list |
| `↑` `↓` | Navigate items |
| `Enter` | Execute selected command |
| `Esc` | Close palette (or clear query first) |
| `Cmd+Enter` | Execute + keep palette open |

### Progressive Disclosure Logic

```typescript
// Compact mode shows:
const compactItems = [
  ...recentItems.slice(0, 2),        // Last 2 recent docs/entities
  ...frequentActions.slice(0, 3),    // Top 3 most-used actions
  { type: "show-all", label: "More..." }
];

// Expanded mode shows all categories
// Search mode shows all matching results ranked by relevance
```

### Design Principles (Raycast/Grok inspired)

- **Progressive disclosure**: Start minimal, expand on demand
- **Clean typography**: Flat lists with subtle indentation
- **Date metadata**: Right-aligned, relative dates ("Dec 28", "Today")
- **Tab filters**: Quick category switching without typing
- **Selection highlight**: Subtle background, not heavy borders
- **Preview text**: Content snippets under document results
- **Empty state**: Fallback to semantic search + entity creation
- **Keyboard-first**: All actions accessible via keyboard

### Technology

- **Library**: `cmdk` (same as Notion, Linear, Vercel)
- **Size**: ~3KB gzipped
- **Features**: Fuzzy search, keyboard nav, accessibility (ARIA)
- **Content Search**: Reuse `searchViaEdge()` for semantic search across documents/entities
- **See**: [SEMANTIC_SEARCH.md](../../../docs/SEMANTIC_SEARCH.md) for vector search details

### File Structure

```
apps/web/src/
├── components/
│   └── command-palette/
│       ├── CommandPalette.tsx      # Main modal wrapper
│       ├── CommandItem.tsx         # Single command row
│       └── index.ts
├── commands/
│   ├── registry.ts                 # Command registry singleton
│   ├── entity-commands.ts          # Entity CRUD commands
│   ├── ai-commands.ts              # AI action commands
│   ├── navigation-commands.ts      # Navigation commands
│   ├── general-commands.ts         # Utility commands
│   └── index.ts
├── hooks/
│   └── useGlobalShortcuts.ts       # Global keyboard handler
└── stores/
    └── commandPalette.ts           # Palette state
```

### Command Interface

```typescript
interface Command {
  id: string;                    // Unique identifier
  label: string;                 // Display text
  description?: string;          // Secondary text
  icon?: LucideIcon;             // Icon component
  category: CommandCategory;     // Grouping
  keywords: string[];            // Search terms
  shortcut?: string;             // Keyboard shortcut display
  execute: (ctx: CommandContext) => void | Promise<void>;
  when?: (ctx: CommandContext) => boolean;  // Visibility
}

type CommandCategory = "entity" | "ai" | "navigation" | "general" | "recent";

interface CommandContext {
  store: MythosStore;
  currentProject: Project | null;
  currentDocument: Document | null;
  selectedText: string | null;
  editorInstance: Editor | null;
  openModal: (modal: string, props?: unknown) => void;
  showNotification: (msg: string, type: string) => void;
}
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `Cmd+Shift+C` | Create character |
| `Cmd+Shift+O` | Create location |
| `Cmd+Shift+L` | Run linter |
| `Cmd+E` | Search entities |
| `Cmd+P` | Go to document |
| `Cmd+Shift+F` | Search everything (semantic) |
| `Cmd+/` | Ask AI (focus chat) |
| `Cmd+M` | Toggle Writer/DM mode |
| `Cmd+Shift+E` | Export story |
| `Cmd+,` | Settings |
| `Cmd+B` | Toggle sidebar |
| `Cmd+J` | Toggle console |

---

## Phase 2: World Graph Visualization

### Design

```
┌─────────────────────────────────────────────────────────────┐
│ Graph  │ 👤 Characters  📍 Locations  ⚔️ Items  [⟳ Layout] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         ┌────────┐                                          │
│         │ Elena  │◄──────knows──────┐                       │
│         │  👤    │                   │                       │
│         └───┬────┘                   │                       │
│             │                    ┌───┴────┐                  │
│          loves                   │ Marcus │                  │
│             │                    │   👤   │                  │
│             ▼                    └───┬────┘                  │
│         ┌────────┐                   │                       │
│         │Valdris │◄────guards────────┘                       │
│         │  📍    │                                           │
│         └───┬────┘                                           │
│             │                                                │
│          contains                                            │
│             │                                                │
│             ▼                                                │
│     ┌──────────────┐                                         │
│     │Crystal Palace│                                         │
│     │     📍       │                                         │
│     └──────────────┘                                         │
│                                                             │
│                                        [─] [□] [+]  🗺️      │
└─────────────────────────────────────────────────────────────┘
```

### Technology

- **Library**: `@xyflow/react` (React Flow v12)
- **Layout**: `elkjs` (Eclipse Layout Kernel)
- **Features**: Pan, zoom, drag, selection, custom nodes/edges

### File Structure

```
apps/web/src/
├── components/
│   └── world-graph/
│       ├── WorldGraphView.tsx       # Tab container
│       ├── WorldGraphCanvas.tsx     # React Flow wrapper
│       ├── WorldGraphControls.tsx   # Filter toolbar
│       ├── nodes/
│       │   └── EntityNode.tsx       # Custom node component
│       └── edges/
│           └── RelationshipEdge.tsx # Custom edge with label
└── hooks/
    ├── useWorldGraph.ts             # Store → React Flow transform
    └── useGraphLayout.ts            # ELK layout integration
```

### Node Styling by Type

| Entity Type | Color | Icon |
|-------------|-------|------|
| Character | Cyan (`#22d3ee`) | 👤 User |
| Location | Green (`#22c55e`) | 📍 MapPin |
| Item | Gold (`#f59e0b`) | ⚔️ Sword |
| Faction | Purple (`#a855f7`) | 🏛️ Building |
| Magic System | Violet (`#8b5cf6`) | ✨ Wand |

### Edge Colors by Category

| Relationship Category | Types | Color |
|----------------------|-------|-------|
| Familial | parent_of, child_of, sibling_of, married_to | Blue |
| Romantic | loves | Pink |
| Conflict | hates, enemy_of, killed | Red |
| Social | knows, allied_with | Gray |
| Ownership | owns, guards, created | Gold |
| Hierarchical | member_of, rules, serves | Purple |

### Interactions

| Action | Behavior |
|--------|----------|
| Click node | Select entity, sync with HUD |
| Double-click node | Open EntityFormModal |
| Drag node | Reposition (manual override) |
| Hover node | Highlight connected nodes/edges |
| Click edge | Show relationship tooltip |
| Scroll | Zoom in/out |
| Drag canvas | Pan view |
| Filter toggles | Show/hide entity types |
| Layout button | Re-run force-directed layout |

---

## Phase 3: AI Sidebar/Agent

> **Note**: Basic RAG Chat is already implemented in Console Chat tab.
> This phase focuses on enhancements: tool calling, quick actions, context display.

### Current Implementation (Done)

- `ai-chat` edge function with RAG retrieval (DeepInfra + Qdrant)
- `chatClient.ts` with SSE streaming support
- `useChatAgent` hook with abort/streaming
- `ChatPanel` in Console with message bubbles
- Chat store slice (messages, isStreaming, error, context)

### Enhanced Design

```
┌─────────────────────────────────────────────────┐
│ AI Assistant                              [···] │
├─────────────────────────────────────────────────┤
│ 📄 Chapter 7 — The Awakening                    │
│ 📝 "Elena stood at the edge..."  (selected)    │
├─────────────────────────────────────────────────┤
│ Quick actions                                   │
│ ┌─────────────┐ ┌─────────────┐                │
│ │ ✨ Describe │ │ 👤 Create   │                │
│ │  selection  │ │  character  │                │
│ └─────────────┘ └─────────────┘                │
│ ┌─────────────┐ ┌─────────────┐                │
│ │ 🔗 Suggest  │ │ ⚠️ Check    │                │
│ │relationships│ │consistency  │                │
│ └─────────────┘ └─────────────┘                │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🧑 You                                          │
│ Help me create a backstory for Elena            │
│                                                 │
│ 🤖 Mythos AI                                    │
│ Based on the current scene, here's a backstory  │
│ for **Elena**:                                  │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔧 Create Entity: Elena                     │ │
│ │ Type: Character                             │ │
│ │ Backstory: Elena was born in the mountain   │ │
│ │ village of...                               │ │
│ │                        [Cancel] [Create]    │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
├─────────────────────────────────────────────────┤
│ 💬 Ask about your story...            [@] [↑]  │
└─────────────────────────────────────────────────┘
```

### Technology

- **AI**: Vercel AI SDK with tool calling (OpenRouter provider)
- **Embeddings**: DeepInfra Qwen3-Embedding-8B (4096 dims)
- **Vector Search**: Qdrant on Hetzner
- **Streaming**: Server-Sent Events (SSE) - already implemented
- **Context**: RAG retrieval + future: document, selection, nearby entities
- **See**: [SEMANTIC_SEARCH.md](../../../docs/SEMANTIC_SEARCH.md) for full architecture

### File Structure

```
apps/web/src/
├── components/
│   └── console/
│       └── AISidebar/
│           ├── AISidebar.tsx         # Main container
│           ├── ContextBar.tsx        # Doc/selection display
│           ├── QuickActions.tsx      # Notion-style buttons
│           ├── ChatMessages.tsx      # Message list
│           ├── ChatInput.tsx         # Input with @mentions
│           ├── ToolResultCard.tsx    # Tool execution UI
│           └── index.ts
├── hooks/
│   ├── useAIChat.ts                  # Chat logic
│   └── useChatContext.ts             # Context builder
└── stores/
    └── ai-sidebar.ts                 # Messages, tools state

packages/ai/src/
└── tools/
    ├── entity-tools.ts               # create_entity, update_entity
    ├── relationship-tools.ts         # create_relationship
    └── content-tools.ts              # generate_content

supabase/functions/
└── ai-agent/
    └── index.ts                      # Edge function with tools
```

### Quick Actions

| Action | Prompt | Requirements |
|--------|--------|--------------|
| Describe selection | "Describe what's happening in the selected text" | Selection |
| Create character | "Help me create a new character based on the current context" | - |
| Suggest relationships | "Analyze entities and suggest relationships" | - |
| Check consistency | "Check this content for consistency issues" | - |
| Generate backstory | "Generate a backstory for the main character" | - |
| Brainstorm next steps | "Suggest what could happen next" | - |

### Tool Definitions

```typescript
// Entity Tools
create_entity({
  type: "character" | "location" | "item" | "faction" | "magic_system",
  name: string,
  aliases?: string[],
  notes?: string,
  // Type-specific fields...
})

update_entity({
  entityId: string,
  updates: Partial<Entity>
})

// Relationship Tools
create_relationship({
  sourceEntityName: string,
  targetEntityName: string,
  type: RelationType,
  bidirectional?: boolean,
  notes?: string
})

// Content Tools
generate_content({
  contentType: "description" | "backstory" | "dialogue" | "scene",
  context: string,
  tone?: string,
  length?: "short" | "medium" | "long"
})

analyze_consistency({
  scope: "selection" | "document" | "mentioned_entities"
})
```

### Context Building

```typescript
interface ChatContext {
  document: {
    id: string;
    title: string;
    excerpt: string;  // Relevant portion
  } | null;

  selection: {
    text: string;
    surroundingContext: string;
  } | null;

  entities: {
    mentioned: Entity[];   // In current document
    nearby: Entity[];      // Related via graph
  };

  relationships: Relationship[];  // Between mentioned entities

  project: {
    name: string;
    genre?: string;
  };
}
```

---

## Design System Integration

### Color Palette

Use existing `@mythos/theme` tokens:

```typescript
// Entity colors
const entityColors = {
  character: "#22d3ee",   // Cyan
  location: "#22c55e",    // Green
  item: "#f59e0b",        // Gold
  faction: "#a855f7",     // Purple
  magic_system: "#8b5cf6", // Violet
  concept: "#64748b",     // Gray
};

// UI colors
const uiColors = {
  bg: {
    primary: "#07070a",
    secondary: "#0f0f14",
    tertiary: "#1a1a24",
  },
  text: {
    primary: "#f8fafc",
    secondary: "#94a3b8",
    muted: "#64748b",
  },
  border: "rgba(255, 255, 255, 0.08)",
  accent: "#22d3ee",
};
```

### Component Styling

All components follow the existing modal pattern:

```tsx
// Overlay container
<div className="fixed inset-0 z-50">
  {/* Backdrop */}
  <div
    className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
    onClick={onClose}
  />

  {/* Content */}
  <div className="relative z-10 ...">
    {/* ... */}
  </div>
</div>
```

### Typography

- **Headings**: Inter, font-medium
- **Body**: Inter, font-normal
- **Mono**: JetBrains Mono (code, shortcuts)
- **Sizes**: text-xs (10px), text-sm (14px), text-base (16px)

---

## Architecture Patterns

### Store Pattern (Zustand + Immer)

```typescript
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface CommandPaletteState {
  isOpen: boolean;
  searchQuery: string;
  recentCommands: string[];
}

interface CommandPaletteActions {
  openPalette: () => void;
  closePalette: () => void;
  setSearchQuery: (query: string) => void;
  addRecentCommand: (id: string) => void;
}

export const useCommandPaletteStore = create<
  CommandPaletteState & CommandPaletteActions
>()(
  immer((set) => ({
    isOpen: false,
    searchQuery: "",
    recentCommands: [],

    openPalette: () => set({ isOpen: true }),
    closePalette: () => set({ isOpen: false, searchQuery: "" }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    addRecentCommand: (id) => set((state) => {
      const recent = [id, ...state.recentCommands.filter(r => r !== id)];
      state.recentCommands = recent.slice(0, 5);
    }),
  }))
);
```

### Hook Pattern

```typescript
export function useGlobalShortcuts() {
  const openPalette = useCommandPaletteStore((s) => s.openPalette);
  const closePalette = useCommandPaletteStore((s) => s.closePalette);
  const isOpen = useCommandPaletteStore((s) => s.isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes("Mac");
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key === "k") {
        e.preventDefault();
        isOpen ? closePalette() : openPalette();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openPalette, closePalette]);
}
```

### Component Pattern

```typescript
interface CommandItemProps {
  command: Command;
  onSelect: () => void;
}

export function CommandItem({ command, onSelect }: CommandItemProps) {
  const Icon = command.icon;

  return (
    <Command.Item
      value={`${command.label} ${command.keywords.join(" ")}`}
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
        "text-mythos-text-secondary",
        "data-[selected=true]:bg-mythos-bg-tertiary",
        "data-[selected=true]:text-mythos-text-primary",
      )}
    >
      {Icon && <Icon className="w-4 h-4 text-mythos-text-muted" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{command.label}</div>
        {command.description && (
          <div className="text-xs text-mythos-text-muted truncate">
            {command.description}
          </div>
        )}
      </div>
      {command.shortcut && (
        <kbd className="px-2 py-1 text-[10px] font-mono bg-mythos-bg-primary/50 rounded">
          {command.shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}
```

---

## Implementation Phases

| Phase | Feature | Deliverables |
|-------|---------|--------------|
| 1 | Command Palette | Cmd+K with all commands, semantic search integration |
| 2 | World Graph | Graph tab with entity visualization, ELK layout |
| 3 | Console Enhancements | Context bar, quick actions, tool calling |

> Note: Console Chat, Search, Coach, Linter, Dynamics tabs are already complete.

---

## Dependencies to Add

```bash
# Phase 1
bun add cmdk

# Phase 2
bun add @xyflow/react elkjs

# Phase 3 (uses existing ai package)
# No new dependencies
```

---

## Success Criteria

### Command Palette (Planned)
- [ ] Opens with Cmd+K from anywhere
- [ ] Fuzzy search across all commands
- [ ] Semantic search integration via `searchViaEdge()`
- [ ] All shortcuts work and match displayed keys
- [ ] Recent commands tracked
- [ ] Commands execute correct actions

### World Graph (Planned)
- [ ] All entities displayed as nodes
- [ ] All relationships displayed as labeled edges
- [ ] Click selects and shows in HUD
- [ ] Filters work by entity type
- [ ] Layout algorithm produces readable graphs
- [ ] Pan/zoom smooth on 100+ entities

### Console / AI Features (Done + Enhancements)
- [x] RAG chat with streaming responses
- [x] Semantic search panel
- [x] Writing coach (show-don't-tell, pacing, sensory)
- [x] Consistency linter with auto-fix
- [x] Entity dynamics extraction
- [ ] Context bar shows current doc/selection
- [ ] Quick actions (preset prompts)
- [ ] Tool calls with entity creation confirmation
- [ ] @mentions for entities in chat
