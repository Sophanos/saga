# Widgets UX Flow

> Quick reference for the widget user experience. See WIDGETS.md for full spec.

## Current Infrastructure

### What Exists

| Component | Location | Status |
|-----------|----------|--------|
| Command Palette UI | `apps/web/src/components/command-palette/` | ✅ Uses `cmdk`, filters, recents |
| Slash Command Menu | `packages/editor-webview/src/components/SlashCommandMenu.tsx` | ✅ TipTap extension, grouped |
| Capabilities Registry | `packages/capabilities/src/registry.ts` | ✅ Central registry, surfaces |
| Command Registry | `apps/web/src/commands/` | ✅ Generates from capabilities |
| State Store | `stores/commandPalette.ts` | ✅ isOpen, query, filter, recentIds |

### Capability Kinds (existing)

```typescript
type CapabilityKind = "tool" | "chat_prompt" | "ui";
type CapabilitySurface = "quick_actions" | "command_palette" | "chat";
type CapabilityCategory = "analysis" | "generation" | "knowledge" | "navigation";
```

### What Widgets Add

```typescript
// New capability kind
type CapabilityKind = "tool" | "chat_prompt" | "ui" | "widget";

// New surface for slash menu in editor
type CapabilitySurface = "quick_actions" | "command_palette" | "chat" | "slash_menu";

// Widget-specific fields
interface WidgetCapability extends CapabilityBase {
  kind: "widget";
  widgetType: "inline" | "artifact";
  prompt: StructuredPrompt;
  defaultModel: string;
  costWeight: number;
  clarifyOnAmbiguity: boolean;
  outputSchema?: ZodSchema;
}
```

---

## Entry Points

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SLASH COMMAND (/) — Editor focused                          │
│     ├─ Existing: SlashCommandMenu.tsx                           │
│     ├─ Add: Widget commands with "widget" kind                  │
│     └─ Surfaces: ["slash_menu"]                                 │
│                                                                  │
│  2. COMMAND PALETTE (Cmd+K) — Global                            │
│     ├─ Existing: CommandPalette.tsx with cmdk                   │
│     ├─ Add: Widget commands + parameter hints                   │
│     └─ Surfaces: ["command_palette"]                            │
│                                                                  │
│  3. AI PANEL — No selection fallback                            │
│     ├─ Existing: Console tabs (chat, linter, etc.)              │
│     └─ "Ask AI" routes here when no text selected               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 1: Slash Command Menu (/)

**Existing component:** `SlashCommandMenu.tsx`

```
User types "/" in editor
         │
         ▼
┌─────────────────────────────────────┐
│ Recent                              │  ← Add recent widgets (per-project)
│ ├─ /summarize                       │
│ └─ /expand                          │
├─────────────────────────────────────┤
│ Widgets                             │  ← New category
│ ├─ /summarize                       │
│ ├─ /expand                          │
│ ├─ /rewrite                         │
│ ├─ /outline                         │
│ └─ /generate name                   │
├─────────────────────────────────────┤
│ Create                              │  ← Artifact widgets
│ ├─ /create spec                     │
│ ├─ /create summary                  │
│ ├─ /create brief                    │
│ └─ /create notes                    │
├─────────────────────────────────────┤
│ Format                              │  ← Existing TipTap commands
│ ├─ Heading 1                        │
│ ├─ Bullet List                      │
│ └─ ...                              │
├─────────────────────────────────────┤
│ Ask AI: "{query}"                   │  ← Fallback (fuzzy no-match)
└─────────────────────────────────────┘

Interactions (already implemented):
- ↑↓ navigate, Enter select, Esc close
- Typing filters list
- Click selects
```

**Changes needed:**
1. Add "Recent" section with per-project widget history
2. Add "Widgets" and "Create" categories
3. Add "Ask AI" fallback when no matches
4. Wire widget execution to new preview modal flow

---

## Flow 2: Command Palette (Cmd+K)

**Existing component:** `CommandPalette.tsx`

```
User presses Cmd+K
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ 🔍 Search commands...                            ×  │
├─────────────────────────────────────────────────────┤
│ [All] [Entity] [AI] [Widget] [Nav] [General]       │  ← Add Widget filter
├─────────────────────────────────────────────────────┤
│ Recent                                              │
│ ├─ /create spec                              ⌘⇧S   │
│ └─ /summarize                                      │
├─────────────────────────────────────────────────────┤
│ Widgets                                             │
│ ├─ Summarize         Condense selected text        │  ← Description on focus
│ ├─ Expand            Expand selected text          │
│ ├─ Rewrite           Change tone/style             │
│ │   └─ [formal] [casual] [concise] [custom]        │  ← Parameter hints
│ ├─ Outline           Create markdown outline       │
│ └─ Generate Names    Suggest names                 │
├─────────────────────────────────────────────────────┤
│ Create Artifact                                     │
│ ├─ Create Spec       Generate specification        │
│ ├─ Create Summary    Generate summary doc          │
│ └─ Create Brief      Generate brief doc            │
├─────────────────────────────────────────────────────┤
│ AI Analysis          (existing)                    │
│ ├─ Check Consistency                         ⌘⇧L   │
│ ├─ Clarity Check                                   │
│ └─ ...                                             │
└─────────────────────────────────────────────────────┘

Tab cycles through filters (existing)
```

**Changes needed:**
1. Add "Widget" filter category
2. Add parameter hints for widgets like /rewrite
3. Wire widget execution to preview modal flow
4. Show "Requires selection" badge when applicable

---

## Flow 3: Widget Execution

```
User selects command (either entry point)
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  NEEDS CLARIFICATION?                               │
│  (threshold-based disambiguation)                   │
├─────────────────────────────────────────────────────┤
│  High confidence → Proceed automatically            │
│  Close match → Inline picker in progress tile       │
│  Complex → Agent ask modal                          │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  PROGRESS TILE                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ ● Gathering context                           │  │
│  │   ▼ Show details                              │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Position:                                          │
│  - Short runs: anchored near selection              │
│  - Long runs: fixed bottom bar                      │
│                                                     │
│  Stages: Gathering → Generating → Formatting        │
│  Expandable: tool calls, entity reads               │
│  Cancel: graceful with warning                      │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  PREVIEW MODAL                                      │
│  (new component, not existing)                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ Insert Summary                              × │  │
│  ├───────────────────────────────────────────────┤  │
│  │ [Title field for artifacts]                   │  │
│  ├───────────────────────────────────────────────┤  │
│  │ Preview content...                            │  │
│  │ [Show full preview] if truncated              │  │
│  │                                               │  │
│  │ ▶ Receipts (collapsed)                        │  │
│  ├───────────────────────────────────────────────┤  │
│  │              [Cancel]  [Insert/Create]        │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │
         ├─── Inline widget ───→ Insert at selection
         │                       Show "Applied" highlight
         │
         └─── Artifact widget ──→ Save to project
                                  Navigate to artifact
```

---

## Component Map

### New Components Needed

| Component | Purpose | Location |
|-----------|---------|----------|
| `WidgetPreviewModal` | Preview + confirm flow | `apps/web/src/components/widgets/` |
| `WidgetProgressTile` | Execution progress UI | `apps/web/src/components/widgets/` |
| `InlineApplyHighlight` | Applied text indicator | `packages/editor-webview/` |
| `ReceiptsBlock` | Manifest display | `apps/web/src/components/widgets/` |
| `SourcePicker` | Add sources modal | `apps/web/src/components/widgets/` |

### Modified Components

| Component | Changes |
|-----------|---------|
| `SlashCommandMenu.tsx` | Add Recent, Widgets, Create categories; Ask AI fallback |
| `CommandPalette.tsx` | Add Widget filter; parameter hints; wire to preview modal |
| `capabilities/registry.ts` | Add widget capabilities with new kind |
| `commandPalette.ts` store | Add widget-specific state (preview, execution) |

---

## State Flow

```
┌─────────────────────────────────────────────────────┐
│  commandPalette store (existing)                    │
├─────────────────────────────────────────────────────┤
│  isOpen: boolean                                    │
│  query: string                                      │
│  filter: 'all' | 'entity' | 'ai' | 'widget' | ...  │  ← Add 'widget'
│  recentCommandIds: string[]                         │
│  expanded: boolean                                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  widgetExecution store (new)                        │
├─────────────────────────────────────────────────────┤
│  status: 'idle' | 'gathering' | 'generating' |      │
│          'preview' | 'applying' | 'error'           │
│  currentWidget: WidgetCapability | null             │
│  inputs: Record<string, unknown>                    │
│  partialOutput: string | null      ← resume cache   │
│  previewContent: string | null                      │
│  executionLog: ExecutionStep[]                      │
│  error: WidgetError | null                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  artifact store (existing, extend)                  │
├─────────────────────────────────────────────────────┤
│  artifacts: Artifact[]                              │
│  + createArtifact(content, manifest)                │
│  + updateArtifactSources(id, sources[])             │
│  + checkStaleness(id): 'fresh' | 'stale' | 'missing'│
└─────────────────────────────────────────────────────┘
```

---

## Capability Registry Updates

```typescript
// packages/capabilities/src/registry.ts

// Add widget capabilities
const WIDGET_CAPABILITIES: WidgetCapability[] = [
  {
    id: "widget.summarize",
    kind: "widget",
    label: "Summarize",
    description: "Condense selected text",
    icon: "FileText",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresSelection: true,
    requiresProject: true,
    widgetType: "inline",
    costWeight: 1,
    clarifyOnAmbiguity: false,
    prompt: {
      system: "You are a concise summarizer.",
      user: "Summarize the following text:\n\n${selection}",
      variables: [{ name: "selection", type: "selection", required: true }],
    },
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    order: 10,
  },
  {
    id: "widget.expand",
    kind: "widget",
    label: "Expand",
    description: "Expand selected text with more detail",
    icon: "Maximize2",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresSelection: true,
    requiresProject: true,
    widgetType: "inline",
    costWeight: 2,
    clarifyOnAmbiguity: false,
    prompt: { /* ... */ },
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    order: 20,
  },
  {
    id: "widget.rewrite",
    kind: "widget",
    label: "Rewrite",
    description: "Change tone or style",
    icon: "RefreshCw",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresSelection: true,
    requiresProject: true,
    widgetType: "inline",
    costWeight: 2,
    clarifyOnAmbiguity: false,
    parameters: [
      { name: "tone", type: "enum", options: ["formal", "casual", "concise", "expanded"], default: "formal" },
    ],
    prompt: { /* ... */ },
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    order: 30,
  },
  // ... more inline widgets

  // Artifact widgets
  {
    id: "widget.create-spec",
    kind: "widget",
    label: "Create Spec",
    description: "Generate specification document",
    icon: "FileCode",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresProject: true,
    widgetType: "artifact",
    costWeight: 5,
    clarifyOnAmbiguity: true,  // High-impact, pause for entity ambiguity
    prompt: { /* ... */ },
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    order: 100,
  },
  // ... more artifact widgets
];

export const CAPABILITIES: Capability[] = [
  ...CAPABILITIES_BASE,
  ...WIDGET_CAPABILITIES,  // Add widgets
];
```

---

## Integration Points

### 1. SlashCommandMenu → Widget Execution

```typescript
// packages/editor-webview/src/components/SlashCommandMenu.tsx

// Current: command(item) calls TipTap command
// New: if item.kind === "widget", dispatch to widget execution

const handleSelect = (item: SlashCommandItem) => {
  if (item.kind === "widget") {
    // Post message to parent (web app)
    window.parent.postMessage({
      type: "WIDGET_INVOKE",
      widgetId: item.id,
      selection: editor.state.selection,
    }, "*");
  } else {
    command(item);  // Existing TipTap command
  }
};
```

### 2. CommandPalette → Widget Execution

```typescript
// apps/web/src/commands/ai-commands.ts

// Current: capabilityToCommand converts to navigation-only commands
// New: widget capabilities execute via widgetExecution store

function capabilityToCommand(capability: Capability): Command {
  if (capability.kind === "widget") {
    return {
      id: capability.id,
      label: capability.label,
      // ...
      execute: async (ctx) => {
        const { startWidgetExecution } = useWidgetExecutionStore.getState();
        startWidgetExecution(capability, {
          selection: ctx.selectedText,
          documentId: ctx.state.document.currentDocument?.id,
        });
      },
    };
  }
  // ... existing logic
}
```

### 3. Write Path (Inline Apply)

```typescript
// Existing: write_content operation in agent tools
// Reuse for widget inline apply

const applyInlineWidget = async (content: string, selection: Selection) => {
  // Use existing editor command
  editor.chain()
    .focus()
    .setTextSelection(selection)
    .insertContent(content)
    .run();

  // Add execution marker (new)
  addExecutionMarker(selection.from, selection.to + content.length, executionId);

  // Show highlight (new)
  showAppliedHighlight(selection.from, content.length);
};
```

---

## User Journey Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     WIDGET USER JOURNEY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INVOKE                                                       │
│     "/" in editor  OR  Cmd+K globally                           │
│     ↓                                                           │
│  2. SELECT                                                       │
│     Browse/search → pick widget → (optional params)             │
│     ↓                                                           │
│  3. EXECUTE                                                      │
│     Progress tile shows stages                                  │
│     ↓                                                           │
│  4. PREVIEW                                                      │
│     Modal with content, title (artifact), receipts              │
│     ↓                                                           │
│  5. CONFIRM                                                      │
│     [Insert] for inline  OR  [Create] for artifact              │
│     ↓                                                           │
│  6. RESULT                                                       │
│     Inline: highlight fades, marker persists                    │
│     Artifact: saved to project, receipts attached               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## MVP1 Implementation Order

1. **Phase 0: Widget Foundation**
   - Add `widget` kind to capabilities
   - Add `slash_menu` surface
   - Register MVP1 widgets in registry
   - Wire SlashCommandMenu to new execution flow

2. **Phase 1: Execution UI**
   - `WidgetProgressTile` component
   - `WidgetPreviewModal` component
   - `widgetExecution` store

3. **Phase 2: Inline Apply**
   - Execution marker in editor
   - Applied highlight with fade
   - Revert action

4. **Phase 3: Artifacts**
   - Artifact schema in Convex
   - Manifest structure
   - `ReceiptsBlock` component
   - Staleness detection

5. **Phase 4: Polish**
   - Recent widgets (per-project)
   - "Ask AI" fallback
   - Cmd+K parameter hints
   - Error states
