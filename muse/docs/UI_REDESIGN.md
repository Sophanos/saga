# Mythos IDE - UI Redesign Document

## Design Direction: Cleaner than Notion, Deeper than Cursor

**Philosophy:** Every pixel earns its place. If it doesn't help the writer, it doesn't exist.

**Core Principles:**
1. **Canvas is sacred** - 90% of screen is content
2. **Progressive disclosure** - complexity appears only when needed
3. **Keyboard-first** - mouse is optional
4. **AI is ambient** - assists without interrupting
5. **Cross-platform native** - feels native on macOS, iOS, web

---

## Tech Stack: Expo Router + @expo/ui (SwiftUI)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      EXPO ROUTER                            │
│              File-based routing for all platforms           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │     WEB     │  │     iOS     │  │    macOS    │         │
│  │   (React)   │  │  (SwiftUI)  │  │  (SwiftUI)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         └────────────────┴────────────────┘                 │
│                          │                                  │
│                   @expo/ui/swift-ui                         │
│              Native components via Host                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                       CONVEX                                │
│            Real-time data + AI tool state                   │
└─────────────────────────────────────────────────────────────┘
```

### @expo/ui SwiftUI Components Available

```tsx
// Import from @expo/ui/swift-ui
import {
  // Layout
  Host,           // Container for SwiftUI (required wrapper)
  Form,           // Native iOS form container
  Section,        // Grouped content sections
  List,           // Native list with edit/delete/reorder
  HStack,         // Horizontal stack
  VStack,         // Vertical stack
  Spacer,         // Flexible space

  // Controls
  Button,         // Native button (variants: default, bordered, borderedProminent)
  TextField,      // Native text input
  Switch,         // Toggle switch
  Picker,         // Selection (variants: menu, segmented, wheel)

  // Display
  Text,           // Native text
  Image,          // SF Symbols + images
  Label,          // Icon + text combo

  // Navigation
  NavigationLink, // Push navigation
  ContextMenu,    // Long-press menu

} from '@expo/ui/swift-ui';

// Modifiers for styling
import {
  frame,
  background,
  clipShape,
  foregroundStyle
} from '@expo/ui/swift-ui/modifiers';
```

### File Structure (Expo Router)

```
app/
├── _layout.tsx              # Root layout (Stack or Drawer)
├── (tabs)/                  # Tab group
│   ├── _layout.tsx          # Tab navigator config
│   ├── index.tsx            # Home / Editor
│   ├── world.tsx            # Project graph
│   └── settings.tsx         # Settings
├── (sheets)/                # Modal sheets group
│   ├── _layout.tsx          # Sheet presentation config
│   ├── entity/[id].tsx      # Entity detail sheet
│   ├── search.tsx           # Search sheet
│   └── ai.tsx               # AI chat sheet
├── (modals)/                # Full modals
│   ├── _layout.tsx
│   ├── export.tsx
│   └── import.tsx
└── +not-found.tsx
```

### Navigation Patterns

**Drawer (Sidebar) + Stack:**
```tsx
// app/_layout.tsx
import { Drawer } from 'expo-router/drawer';

export default function RootLayout() {
  return (
    <Drawer screenOptions={{ drawerType: 'permanent' }}>
      <Drawer.Screen name="(tabs)" options={{ drawerLabel: 'Home' }} />
    </Drawer>
  );
}
```

**Native Tabs:**
```tsx
// app/(tabs)/_layout.tsx
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf="doc.text" />
        <Label>Editor</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="world">
        <Icon sf="globe" />
        <Label>World</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

**Modal Sheets:**
```tsx
// app/(sheets)/_layout.tsx
import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'index' };

export default function SheetLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="entity/[id]"
        options={{
          presentation: 'modal',
          sheetAllowedDetents: [0.5, 0.75, 1], // Snap points
        }}
      />
      <Stack.Screen
        name="ai"
        options={{
          presentation: 'modal',
          sheetAllowedDetents: [0.4, 1],
        }}
      />
    </Stack>
  );
}
```

### Platform-Specific Rendering

```tsx
// components/Sidebar.tsx
import { Platform } from 'react-native';
import { Host, List, Section, Button, Text } from '@expo/ui/swift-ui';

export function Sidebar() {
  if (Platform.OS === 'web') {
    // Web: Custom React component
    return <WebSidebar />;
  }

  // iOS/macOS: Native SwiftUI
  return (
    <Host style={{ flex: 1 }}>
      <List listStyle="sidebar">
        <Section title="Documents">
          {chapters.map(chapter => (
            <Button key={chapter.id} onPress={() => navigate(chapter.id)}>
              <Text>{chapter.title}</Text>
            </Button>
          ))}
        </Section>
        <Section title="World">
          <Button systemImage="person.2">
            <Text>Characters ({entities.characters.length})</Text>
          </Button>
          <Button systemImage="map">
            <Text>Locations ({entities.locations.length})</Text>
          </Button>
        </Section>
      </List>
    </Host>
  );
}
```

---

## Backend: Convex Integration

### Why Convex over Supabase
- Real-time by default (no polling)
- TypeScript end-to-end
- Simpler mental model (functions, not SQL)
- Better for collaborative features

### Migration Strategy
```
Current: Supabase (postgres + edge functions)
Target:  Convex (documents + functions) + Supabase Auth
```

Keep Supabase for:
- Authentication (already works)
- File storage (images, exports)

Move to Convex:
- Documents, entities, relationships
- Real-time sync
- AI tool state

---

## Current Feature Inventory

### ✅ Core Features (Must Preserve)

| Feature | Current Location | Priority |
|---------|-----------------|----------|
| Rich text editor (Tiptap) | Canvas | P0 |
| Chapter/Scene hierarchy | Sidebar | P0 |
| Entity system (7 types) | Sidebar + Modals | P0 |
| Entity HUD on hover | Floating | P0 |
| Project Graph visualization | Canvas view | P1 |
| AI Chat with RAG | Console tab | P0 |
| Writing Coach (tension/pacing) | Console tab | P1 |
| Consistency Linter | Console tab | P1 |
| Semantic Search | Console tab | P0 |
| Dynamics extraction | Console tab | P2 |
| Import/Export | Modals | P1 |
| Command Palette | Modal | P0 |
| Settings | Modal | P1 |
| Writer/DM mode toggle | Header | P1 |

### 🔧 Features Needing Redesign

| Feature | Issue | Redesign Approach |
|---------|-------|------------------|
| Console tabs | Too rigid, takes space | Floating panels/sheets |
| Three-panel layout | Feels cramped | Adaptive single canvas with overlays |
| Entity forms | Modal-heavy | Inline editing + side sheets |
| Project sidebar | Always visible | Collapsible + spotlight search |
| Project Graph | Separate view | Picture-in-picture or overlay |

---

## New UI Architecture

### 1. Layout Philosophy

**From:** `Sidebar | Canvas | Console` (rigid three-panel)
**To:** `Canvas-first with contextual overlays`

```
┌─────────────────────────────────────────────────────────────┐
│ ● ● ●  [breadcrumb] Project / Chapter / Scene    ⌘K  🌙 👤 │ <- Minimal header
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                     CANVAS (EDITOR)                         │
│                                                             │
│              Full focus writing experience                  │
│                                                             │
│                                                             │
│                                               ┌───────────┐ │
│                                               │ AI Assist │ │ <- Floating panel
│                                               │           │ │
│                                               └───────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 📁 Outline  |  🎭 Characters  |  🗺 World  |  💬 Chat      │ <- Bottom dock
└─────────────────────────────────────────────────────────────┘
```

### 2. Component Hierarchy

```
App
├── CommandPalette (Spotlight-style, ⌘K)
├── Header (minimal)
│   ├── TrafficLights (macOS-style)
│   ├── Breadcrumb (Project > Chapter > Scene)
│   ├── SearchTrigger
│   └── UserMenu
├── Canvas (main content area)
│   ├── Editor (Tiptap)
│   │   ├── EditorToolbar (floating, appears on selection)
│   │   └── EntityMentionPopover
│   ├── ProjectGraphOverlay (toggle)
│   └── EntityHUD (floating near cursor)
├── BottomDock (macOS Dock-style)
│   ├── OutlinePanel (slide up)
│   ├── EntitiesPanel (slide up)
│   ├── WorldPanel (slide up)
│   └── ChatPanel (slide up)
├── SideSheet (contextual, slides from right)
│   ├── EntityDetail
│   ├── SearchResults
│   ├── CoachAnalysis
│   └── LinterIssues
└── Modals (rare, only for blocking actions)
    ├── ExportModal
    ├── ImportModal
    └── SettingsModal
```

---

## Component Specifications

### 3.1 Command Palette (Spotlight)

**Trigger:** `⌘K` or click search
**Style:** Centered overlay with blur backdrop, rounded corners

```
┌─────────────────────────────────────────┐
│ 🔍 Type a command or search...          │
├─────────────────────────────────────────┤
│ RECENT                                  │
│   📄 Chapter 3: The Betrayal           │
│   🎭 Marcus Aurelius                    │
├─────────────────────────────────────────┤
│ ACTIONS                                 │
│   ➕ Create Character         ⇧⌘C      │
│   ➕ Create Location          ⇧⌘L      │
│   🤖 Run Linter               ⇧⌘L      │
│   📊 Writing Analysis         ⇧⌘A      │
├─────────────────────────────────────────┤
│ NAVIGATION                              │
│   📁 Go to Document...                  │
│   🗺 Open Project Graph          ⌘G      │
└─────────────────────────────────────────┘
```

**Features:**
- Fuzzy search across commands, documents, entities
- Recent items section
- Keyboard navigation (↑↓ to select, ↵ to execute)
- Action hints with keyboard shortcuts
- Nested navigation (e.g., "Create >" shows entity types)

### 3.2 Header Bar

**Style:** Slim (40px), semi-transparent with blur

```tsx
<Header className="h-10 backdrop-blur-xl bg-mythos-bg-primary/80 border-b border-white/5">
  <TrafficLights />
  <Breadcrumb items={[project, chapter, scene]} />
  <Spacer />
  <ModeToggle /> {/* Writer / DM */}
  <SearchButton />
  <UserAvatar />
</Header>
```

**Breadcrumb behavior:**
- Click any segment to navigate
- Dropdown on hover shows siblings
- Editable titles inline

### 3.3 Canvas (Editor Area)

**Style:** Full bleed, maximum content focus

**Features:**
- No visible chrome when typing
- Floating toolbar on text selection (Notion-style)
- Entity mentions with inline chips
- Soft fade at edges when scrolling
- Word count in subtle footer

```tsx
<Canvas>
  <Editor>
    <FloatingToolbar
      visible={hasSelection}
      tools={['bold', 'italic', 'link', 'mention', 'comment']}
    />
    <Content />
  </Editor>
  <CanvasFooter>
    <WordCount />
    <AutosaveIndicator />
  </CanvasFooter>
</Canvas>
```

### 3.4 Bottom Dock

**Style:** macOS Dock aesthetic, glassmorphic

```
┌───────────────────────────────────────────────────────────┐
│  📑 Outline  │  🎭 Entities  │  🌐 World  │  💬 AI   │
└───────────────────────────────────────────────────────────┘
```

**Behavior:**
- Icons with labels, hover to preview
- Click to expand panel upward (sheet)
- Active panel indicator (glow/underline)
- Drag to reorder
- Right-click for quick actions

**Panel Expansion:**
```
┌─────────────────────────────────────────────────────────┐
│                     Canvas (Editor)                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                   EXPANDED PANEL (40vh)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Chapter 1│ │ Chapter 2│ │ Chapter 3│ │ + New    │   │
│  │  Scene 1 │ │  Scene 1 │ │          │ │          │   │
│  │  Scene 2 │ │  Scene 2 │ │          │ │          │   │
│  │  Scene 3 │ │          │ │          │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│  📑 Outline  │  🎭 Entities  │  🌐 World  │  💬 AI   │
└─────────────────────────────────────────────────────────┘
```

### 3.5 Outline Panel (Document Structure)

**View:** Horizontal kanban-style or tree view toggle

**Kanban Mode:**
```
┌──────────────────────────────────────────────────────────┐
│ 📑 Outline                              [🌳 Tree] [▦ Board] │
├──────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│ │ CHAPTER 1   │ │ CHAPTER 2   │ │ CHAPTER 3   │  [+ Chapter] │
│ │─────────────│ │─────────────│ │─────────────│          │
│ │ ○ Scene 1   │ │ ○ Scene 1   │ │ (empty)     │          │
│ │ ○ Scene 2   │ │ ○ Scene 2   │ │             │          │
│ │ ○ Scene 3   │ │             │ │             │          │
│ │ [+ Scene]   │ │ [+ Scene]   │ │ [+ Scene]   │          │
│ └─────────────┘ └─────────────┘ └─────────────┘          │
└──────────────────────────────────────────────────────────┘
```

**Tree Mode:** Classic indented list (current style, refined)

### 3.6 Entities Panel

**Style:** Grid of cards with type filters

```
┌──────────────────────────────────────────────────────────┐
│ 🎭 Entities                    [All ▾] [+ Create ▾]     │
├──────────────────────────────────────────────────────────┤
│ 🎭 Characters  🗺 Locations  ⚔️ Items  👥 Factions       │
├──────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│ │ 🎭 Marcus   │ │ 🎭 Elena    │ │ 🎭 The Sage │          │
│ │ Protagonist │ │ Ally        │ │ Mentor      │          │
│ │ 3 scenes    │ │ 2 scenes    │ │ 1 scene     │          │
│ └─────────────┘ └─────────────┘ └─────────────┘          │
└──────────────────────────────────────────────────────────┘
```

**Card interaction:**
- Click to open EntitySheet (side panel)
- Drag to editor to insert mention
- Hover for quick preview (HUD)

### 3.7 AI Panel (Chat + Tools)

**Style:** Conversational with inline tool results

```
┌──────────────────────────────────────────────────────────┐
│ 💬 AI Assistant                           [New Chat ▾]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  🤖 How can I help with your story?                     │
│                                                          │
│  👤 Check if there are any inconsistencies in chapter 3 │
│                                                          │
│  🤖 Running consistency check...                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔧 check_consistency                    [Running]  │  │
│  │ Analyzing chapter 3 for inconsistencies...         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  🤖 Found 2 issues:                                      │
│  • ⚠️ Marcus's eye color changed (blue → green)         │
│  • ⚠️ Timeline conflict: Event happens before birth     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ 💬 Message... @mention for context           [Send ➤]   │
└──────────────────────────────────────────────────────────┘
```

**Quick Actions Row:**
```
┌──────────────────────────────────────────────────────────┐
│ 🎯 Run Linter  │  📊 Analyze  │  🌍 Build World  │  ✨ Generate │
└──────────────────────────────────────────────────────────┘
```

### 3.8 Side Sheet (Entity Detail, Search Results, etc.)

**Style:** Slides from right, 400px width, backdrop blur

```
                                              ┌────────────────┐
                                              │ ✕ 🎭 Marcus    │
                                              │                │
                                              │ [Edit] [Delete]│
                                              ├────────────────┤
                                              │ ALIASES        │
                                              │ Marc, The Hero │
                                              ├────────────────┤
                                              │ ARCHETYPE      │
                                              │ 🦸 Hero        │
                                              ├────────────────┤
                                              │ TRAITS         │
                                              │ ✓ Brave        │
                                              │ ✗ Impulsive    │
                                              ├────────────────┤
                                              │ RELATIONSHIPS  │
                                              │ → Elena (ally) │
                                              │ → Castle (home)│
                                              ├────────────────┤
                                              │ APPEARS IN     │
                                              │ Ch1: Scene 1,2 │
                                              │ Ch2: Scene 1   │
                                              └────────────────┘
```

### 3.9 Entity HUD (Floating Preview)

**Style:** Small card near cursor, appears on entity hover in editor

```
      ┌─────────────────────────┐
      │ 🎭 Marcus              │
      │ Hero • Brave, Impulsive │
      │ Currently: Castle       │
      │ [Click to open]         │
      └─────────────────────────┘
                ▼
```

### 3.10 Project Graph Overlay

**Style:** Full-screen overlay with controls, glassmorphic background

```
┌─────────────────────────────────────────────────────────────┐
│ ✕ Project Graph                    [Filter ▾] [Reset Layout] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         [Marcus] ─────ally───── [Elena]                     │
│            │                       │                        │
│          home                    home                       │
│            │                       │                        │
│         [Castle] ═══path═══ [Forest] ─── [Dark Cave]       │
│                                                             │
│                    [The Sage]                               │
│                        │                                    │
│                     mentor                                  │
│                        │                                    │
│                    [Marcus]                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Interaction Patterns

### 4.1 Keyboard Shortcuts (Cursor-inspired)

| Action | Shortcut | Context |
|--------|----------|---------|
| Command Palette | `⌘K` | Global |
| Quick Search | `⌘P` | Global |
| New Chapter | `⌘N` | Global |
| New Entity | `⌘⇧E` | Global |
| Toggle AI Panel | `⌘J` | Global |
| Toggle Outline | `⌘B` | Global |
| Toggle Project Graph | `⌘G` | Global |
| Run Linter | `⌘⇧L` | Global |
| Run Analysis | `⌘⇧A` | Global |
| Focus Editor | `Esc` | Global |
| Bold | `⌘B` | Editor |
| Italic | `⌘I` | Editor |
| Insert Mention | `@` | Editor |
| Insert Scene Break | `---` | Editor |

### 4.2 Animations

**Panel Transitions:**
```css
/* Bottom dock panel expand */
.panel-expand {
  animation: slideUp 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

/* Side sheet */
.side-sheet-enter {
  animation: slideInRight 250ms cubic-bezier(0.32, 0.72, 0, 1);
}

/* Command palette */
.spotlight-enter {
  animation: fadeInScale 150ms ease-out;
}
```

**Micro-interactions:**
- Button press: scale(0.98) with spring
- Card hover: translateY(-2px) + shadow
- Focus rings: animated border
- Loading: skeleton shimmer

### 4.3 Contextual Menus

Right-click context menus for:
- Documents (rename, delete, move, export)
- Entities (edit, delete, find mentions, view relationships)
- Editor text (format, create entity from selection)
- Project Graph nodes (edit, delete, expand connections)

---

## Color System

### 5.1 Dark Theme (Primary)

```css
:root {
  /* Backgrounds */
  --bg-primary: hsl(220, 15%, 8%);      /* Main canvas */
  --bg-secondary: hsl(220, 15%, 11%);   /* Panels */
  --bg-tertiary: hsl(220, 15%, 14%);    /* Cards */
  --bg-elevated: hsl(220, 15%, 16%);    /* Hover states */

  /* Glass effects */
  --glass-bg: hsla(220, 15%, 12%, 0.8);
  --glass-border: hsla(0, 0%, 100%, 0.06);

  /* Text */
  --text-primary: hsl(220, 10%, 95%);
  --text-secondary: hsl(220, 10%, 65%);
  --text-muted: hsl(220, 10%, 45%);

  /* Accent */
  --accent: hsl(210, 100%, 60%);        /* Blue */
  --accent-hover: hsl(210, 100%, 65%);

  /* Entity colors */
  --entity-character: hsl(280, 70%, 60%);  /* Purple */
  --entity-location: hsl(145, 60%, 50%);   /* Green */
  --entity-item: hsl(35, 90%, 55%);        /* Gold */
  --entity-faction: hsl(350, 70%, 55%);    /* Red */
  --entity-magic: hsl(195, 80%, 55%);      /* Cyan */
  --entity-event: hsl(25, 85%, 55%);       /* Orange */
  --entity-concept: hsl(220, 60%, 60%);    /* Blue */

  /* Status */
  --success: hsl(145, 60%, 50%);
  --warning: hsl(35, 90%, 55%);
  --error: hsl(350, 70%, 55%);
  --info: hsl(195, 80%, 55%);
}
```

### 5.2 Light Theme (Secondary)

```css
:root.light {
  --bg-primary: hsl(0, 0%, 100%);
  --bg-secondary: hsl(220, 15%, 96%);
  --bg-tertiary: hsl(220, 15%, 92%);
  --text-primary: hsl(220, 15%, 15%);
  /* ... */
}
```

---

## Implementation Roadmap

---

# PHASE 1: FOUNDATION

> Goal: Core shell that feels cleaner than Notion, native on iOS/macOS

## Step 1.0: Project Setup

```bash
# Create new Expo project with Router
npx create-expo-app@latest mythos-app --template tabs

# Install dependencies
cd mythos-app
npx expo install @expo/ui expo-router convex

# Install for native development
npx expo install expo-dev-client
```

**Project Structure:**
```
mythos-app/
├── app/                      # Expo Router pages
│   ├── _layout.tsx           # Root layout
│   ├── (main)/               # Main app group
│   │   ├── _layout.tsx       # Sidebar + content layout
│   │   ├── index.tsx         # Editor (home)
│   │   ├── world.tsx         # Project graph
│   │   └── settings.tsx      # Settings
│   └── (sheets)/             # Modal sheets
│       ├── entity/[id].tsx
│       ├── search.tsx
│       └── ai.tsx
├── components/
│   ├── native/               # SwiftUI wrappers
│   │   ├── Sidebar.tsx
│   │   ├── EntitySheet.tsx
│   │   └── AISheet.tsx
│   ├── shared/               # Cross-platform
│   │   ├── Editor.tsx
│   │   └── ProjectGraph.tsx
│   └── web/                  # Web-specific
│       └── WebSidebar.tsx
├── convex/                   # Convex backend
│   ├── schema.ts
│   ├── documents.ts
│   ├── entities.ts
│   └── ai/
├── hooks/
├── stores/
└── constants/
    └── tokens.ts             # Design tokens
```

## Step 1.1: Design Tokens

Create `constants/tokens.ts`:

```typescript
// constants/tokens.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const colors = {
  // Backgrounds (Dark theme)
  bgApp: '#0f0f0f',
  bgSurface: '#161616',
  bgElevated: '#1c1c1c',
  bgHover: '#242424',
  bgActive: '#2a2a2a',

  // Borders
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderDefault: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(255, 255, 255, 0.15)',

  // Text
  textPrimary: 'rgba(255, 255, 255, 0.95)',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textMuted: 'rgba(255, 255, 255, 0.4)',

  // Accent
  accent: '#3b82f6',
  accentHover: '#60a5fa',

  // Entity colors (for badges, icons)
  entity: {
    character: '#a78bfa',
    location: '#34d399',
    item: '#fbbf24',
    faction: '#f87171',
    magic: '#22d3ee',
    event: '#fb923c',
    concept: '#60a5fa',
  },

  // Status
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#22d3ee',
} as const;

export const typography = {
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    title: 42,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const layout = {
  sidebarWidth: 260,
  sidebarCollapsed: 48,
  headerHeight: 44,
  sheetWidth: 380,
} as const;

// SF Symbols for entity types (iOS/macOS native)
export const entityIcons = {
  character: 'person.fill',
  location: 'map.fill',
  item: 'shippingbox.fill',
  faction: 'person.3.fill',
  magic: 'sparkles',
  event: 'calendar',
  concept: 'lightbulb.fill',
} as const;
```

## Step 1.2: Root Layout

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useFonts } from 'expo-font';
import { useColorScheme } from 'react-native';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ConvexProvider client={convex}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? '#0f0f0f' : '#ffffff',
          },
        }}
      >
        <Stack.Screen name="(main)" />
        <Stack.Screen
          name="(sheets)/entity/[id]"
          options={{
            presentation: 'modal',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="(sheets)/ai"
          options={{
            presentation: 'modal',
            sheetAllowedDetents: [0.4, 0.8, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="(sheets)/search"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        />
      </Stack>
    </ConvexProvider>
  );
}
```

## Step 1.3: Sidebar (Native SwiftUI)

```tsx
// components/native/Sidebar.tsx
import { Platform } from 'react-native';
import { Link, usePathname } from 'expo-router';
import {
  Host, List, Section, Button, Text, Image, HStack, Spacer
} from '@expo/ui/swift-ui';
import { frame, background, clipShape, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { colors, entityIcons } from '@/constants/tokens';

export function Sidebar() {
  const pathname = usePathname();
  const documents = useQuery(api.documents.list);
  const entityCounts = useQuery(api.entities.counts);

  // Web fallback
  if (Platform.OS === 'web') {
    return <WebSidebar />;
  }

  return (
    <Host style={{ flex: 1, backgroundColor: colors.bgSurface }}>
      <List listStyle="sidebar">
        {/* Search */}
        <Section>
          <Link href="/(sheets)/search" asChild>
            <Button variant="bordered">
              <HStack spacing={8}>
                <Image systemName="magnifyingglass" size={14} color="secondary" />
                <Text color="secondary">Search</Text>
                <Spacer />
                <Text color="tertiary" fontSize={12}>⌘K</Text>
              </HStack>
            </Button>
          </Link>
        </Section>

        {/* Documents */}
        <Section title="Documents">
          {documents?.map((doc) => (
            <Link key={doc._id} href={`/(main)?doc=${doc._id}`} asChild>
              <Button>
                <HStack spacing={8}>
                  <Image
                    systemName={doc.type === 'chapter' ? 'doc.text' : 'doc'}
                    size={14}
                    color={pathname.includes(doc._id) ? 'accent' : 'secondary'}
                  />
                  <Text
                    color={pathname.includes(doc._id) ? 'primary' : 'secondary'}
                    fontWeight={pathname.includes(doc._id) ? 'semibold' : 'regular'}
                  >
                    {doc.title}
                  </Text>
                </HStack>
              </Button>
            </Link>
          ))}
        </Section>

        {/* World */}
        <Section title="World">
          {Object.entries(entityCounts ?? {}).map(([type, count]) => (
            <Link key={type} href={`/(main)/world?type=${type}`} asChild>
              <Button>
                <HStack spacing={8}>
                  <Image
                    systemName={entityIcons[type as keyof typeof entityIcons]}
                    size={14}
                    color={colors.entity[type as keyof typeof colors.entity]}
                    modifiers={[
                      frame({ width: 24, height: 24 }),
                      background(colors.entity[type as keyof typeof colors.entity] + '20'),
                      clipShape('roundedRectangle'),
                    ]}
                  />
                  <Text color="secondary" style={{ textTransform: 'capitalize' }}>
                    {type}s
                  </Text>
                  <Spacer />
                  <Text color="tertiary" fontSize={12}>{count}</Text>
                </HStack>
              </Button>
            </Link>
          ))}
        </Section>

        {/* Bottom actions */}
        <Spacer />
        <Section>
          <Button variant="bordered" systemImage="plus">
            <Text>New Page</Text>
          </Button>
          <Link href="/(main)/settings" asChild>
            <Button variant="bordered" systemImage="gear">
              <Text>Settings</Text>
            </Button>
          </Link>
        </Section>
      </List>
    </Host>
  );
}
```

## Step 1.4: Main Layout with Drawer

```tsx
// app/(main)/_layout.tsx
import { Drawer } from 'expo-router/drawer';
import { Platform, useWindowDimensions } from 'react-native';
import { Sidebar } from '@/components/native/Sidebar';
import { layout, colors } from '@/constants/tokens';

export default function MainLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  return (
    <Drawer
      drawerContent={() => <Sidebar />}
      screenOptions={{
        drawerType: isLargeScreen ? 'permanent' : 'slide',
        drawerStyle: {
          width: layout.sidebarWidth,
          backgroundColor: colors.bgSurface,
          borderRightWidth: 0,
        },
        headerShown: false,
        sceneContainerStyle: {
          backgroundColor: colors.bgApp,
        },
      }}
    >
      <Drawer.Screen name="index" />
      <Drawer.Screen name="world" />
      <Drawer.Screen name="settings" />
    </Drawer>
  );
}
```

## Step 1.5: Editor Screen

```tsx
// app/(main)/index.tsx
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Editor } from '@/components/shared/Editor';
import { Header } from '@/components/native/Header';
import { colors } from '@/constants/tokens';

export default function EditorScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const document = useQuery(api.documents.get, doc ? { id: doc } : 'skip');
  const updateDocument = useMutation(api.documents.update);

  return (
    <View style={styles.container}>
      <Header
        title={document?.title ?? 'Untitled'}
        subtitle={document?.type === 'scene' ? 'Scene' : 'Chapter'}
      />
      <Editor
        content={document?.content}
        onChange={(content) => {
          if (doc) {
            updateDocument({ id: doc, content });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgApp,
  },
});
```

## Step 1.6: Command Palette (Search Sheet)

```tsx
// app/(sheets)/search.tsx
import { View, StyleSheet, TextInput, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Host, List, Section, Button, Text, Image, HStack } from '@expo/ui/swift-ui';
import { colors, entityIcons } from '@/constants/tokens';

export default function SearchSheet() {
  const [query, setQuery] = useState('');
  const results = useQuery(api.search.global, query ? { query } : 'skip');
  const recent = useQuery(api.history.recent);

  // Keyboard shortcut to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Pressable style={styles.backdrop} onPress={() => router.back()}>
      <View style={styles.modal}>
        <Host matchContents style={{ width: '100%' }}>
          {/* Search input */}
          <HStack spacing={12} style={styles.inputRow}>
            <Image systemName="magnifyingglass" size={16} color="secondary" />
            <TextInput
              style={styles.input}
              placeholder="Search or type a command..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <Text color="tertiary" fontSize={12}>esc</Text>
          </HStack>

          {/* Results */}
          <List>
            {!query && recent && (
              <Section title="Recent">
                {recent.map((item) => (
                  <Button
                    key={item._id}
                    onPress={() => {
                      router.back();
                      router.push(item.type === 'document'
                        ? `/(main)?doc=${item._id}`
                        : `/(sheets)/entity/${item._id}`
                      );
                    }}
                  >
                    <HStack spacing={8}>
                      <Image
                        systemName={item.type === 'document' ? 'doc.text' : entityIcons[item.entityType]}
                        size={14}
                        color="secondary"
                      />
                      <Text>{item.title}</Text>
                    </HStack>
                  </Button>
                ))}
              </Section>
            )}

            {query && results && (
              <>
                {results.documents?.length > 0 && (
                  <Section title="Documents">
                    {results.documents.map((doc) => (
                      <Button
                        key={doc._id}
                        onPress={() => {
                          router.back();
                          router.push(`/(main)?doc=${doc._id}`);
                        }}
                      >
                        <Text>{doc.title}</Text>
                      </Button>
                    ))}
                  </Section>
                )}

                {results.entities?.length > 0 && (
                  <Section title="Entities">
                    {results.entities.map((entity) => (
                      <Button
                        key={entity._id}
                        onPress={() => {
                          router.back();
                          router.push(`/(sheets)/entity/${entity._id}`);
                        }}
                      >
                        <HStack spacing={8}>
                          <Image
                            systemName={entityIcons[entity.type]}
                            size={14}
                            color={colors.entity[entity.type]}
                          />
                          <Text>{entity.name}</Text>
                        </HStack>
                      </Button>
                    ))}
                  </Section>
                )}
              </>
            )}

            {/* Quick actions when no query */}
            {!query && (
              <Section title="Quick Actions">
                <Button systemImage="plus" onPress={() => { /* create doc */ }}>
                  <Text>New Page</Text>
                </Button>
                <Button systemImage="person.badge.plus" onPress={() => { /* create char */ }}>
                  <Text>New Character</Text>
                </Button>
                <Button systemImage="bubble.left" onPress={() => router.push('/(sheets)/ai')}>
                  <Text>Ask AI</Text>
                </Button>
              </Section>
            )}
          </List>
        </Host>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  modal: {
    width: '90%',
    maxWidth: 560,
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
```

---

# PHASE 2: SIDE PANELS (Native Sheets)

> Goal: Contextual information via native iOS/macOS sheet presentations

Expo Router's modal sheets use native iOS presentation APIs, giving us:
- Native drag-to-dismiss gestures
- Snap points (detents) at 40%, 60%, 100% height
- Native grabber handle
- Hardware-accelerated animations

## Step 2.1: Entity Sheet

```tsx
// app/(sheets)/entity/[id].tsx
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  Host, Form, Section, TextField, Button, Text, Image,
  HStack, VStack, Spacer, Switch, Picker, ContextMenu
} from '@expo/ui/swift-ui';
import { frame, background, clipShape } from '@expo/ui/swift-ui/modifiers';
import { colors, entityIcons } from '@/constants/tokens';

export default function EntitySheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entity = useQuery(api.entities.get, { id });
  const updateEntity = useMutation(api.entities.update);
  const relationships = useQuery(api.relationships.byEntity, { entityId: id });

  if (!entity) return null;

  return (
    <Host style={{ flex: 1 }}>
      <Form>
        {/* Header with icon and name */}
        <Section>
          <VStack spacing={8} alignment="center">
            <Image
              systemName={entityIcons[entity.type]}
              size={48}
              color={colors.entity[entity.type]}
              modifiers={[
                frame({ width: 72, height: 72 }),
                background(colors.entity[entity.type] + '20'),
                clipShape('circle'),
              ]}
            />
            <TextField
              defaultValue={entity.name}
              onChangeText={(name) => updateEntity({ id, name })}
              style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}
            />
            <Text color="secondary">
              {entity.type} · {entity.data?.archetype ?? 'No archetype'}
            </Text>
          </VStack>
        </Section>

        {/* Aliases */}
        <Section title="Aliases">
          <HStack spacing={8} wrap>
            {entity.aliases?.map((alias, i) => (
              <Button
                key={i}
                variant="bordered"
                onPress={() => {/* remove alias */}}
              >
                <Text>{alias}</Text>
              </Button>
            ))}
            <Button variant="bordered" systemImage="plus">
              <Text>Add</Text>
            </Button>
          </HStack>
        </Section>

        {/* Character-specific: Traits */}
        {entity.type === 'character' && (
          <Section title="Traits">
            {entity.data?.traits?.map((trait, i) => (
              <HStack key={i} spacing={8}>
                <Image
                  systemName={trait.type === 'strength' ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
                  color={trait.type === 'strength' ? colors.success : colors.error}
                  size={16}
                />
                <Text>{trait.name}</Text>
              </HStack>
            ))}
            <Button variant="bordered" systemImage="plus">
              <Text>Add trait</Text>
            </Button>
          </Section>
        )}

        {/* Character-specific: Status */}
        {entity.type === 'character' && entity.data?.status && (
          <Section title="Status">
            <HStack spacing={8}>
              <Text color="secondary">Health</Text>
              <Spacer />
              <Text>{entity.data.status.health ?? 100}%</Text>
            </HStack>
            <HStack spacing={8}>
              <Text color="secondary">Mood</Text>
              <Spacer />
              <Text>{entity.data.status.mood ?? 'Neutral'}</Text>
            </HStack>
            <HStack spacing={8}>
              <Text color="secondary">Location</Text>
              <Spacer />
              <Text>{entity.data.status.location ?? 'Unknown'}</Text>
            </HStack>
          </Section>
        )}

        {/* Relationships */}
        <Section title="Relationships">
          {relationships?.map((rel) => (
            <Button
              key={rel._id}
              onPress={() => router.push(`/(sheets)/entity/${rel.targetId}`)}
            >
              <HStack spacing={8}>
                <Image systemName="arrow.right" size={12} color="secondary" />
                <Text>{rel.targetName}</Text>
                <Text color="secondary">({rel.type})</Text>
              </HStack>
            </Button>
          ))}
          <Button variant="bordered" systemImage="plus">
            <Text>Add relationship</Text>
          </Button>
        </Section>

        {/* Actions */}
        <Section>
          <Button
            variant="borderedProminent"
            onPress={() => {/* find in documents */}}
          >
            <Text>Find in Documents</Text>
          </Button>
          <ContextMenu>
            <ContextMenu.Trigger>
              <Button variant="bordered" systemImage="ellipsis">
                <Text>More</Text>
              </Button>
            </ContextMenu.Trigger>
            <ContextMenu.Items>
              <Button systemImage="trash" onPress={() => {/* delete */}}>
                <Text color="error">Delete Entity</Text>
              </Button>
            </ContextMenu.Items>
          </ContextMenu>
        </Section>
      </Form>
    </Host>
  );
}
```

## Step 2.2: AI Sheet (Chat + Tools)

```tsx
// app/(sheets)/ai.tsx
import { View, ScrollView, TextInput, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  Host, Form, Section, Button, Text, Image, HStack, VStack, Spacer
} from '@expo/ui/swift-ui';
import { colors } from '@/constants/tokens';
import { ToolCard } from '@/components/ai/ToolCard';

export default function AISheet() {
  const [input, setInput] = useState('');
  const [sessionId] = useState(() => crypto.randomUUID());

  const messages = useQuery(api.chat.messages, { sessionId });
  const sendMessage = useAction(api.chat.send);
  const activeTools = useQuery(api.toolRuns.active, { sessionId });

  const handleSend = async () => {
    if (!input.trim()) return;
    const message = input;
    setInput('');
    await sendMessage({ sessionId, message });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Host style={{ flex: 1 }}>
        <VStack style={{ flex: 1 }}>
          {/* Header */}
          <HStack spacing={12} style={styles.header}>
            <Image systemName="bubble.left.and.bubble.right" size={20} />
            <Text fontSize={17} fontWeight="semibold">AI Assistant</Text>
            <Spacer />
            <Button variant="bordered" systemImage="plus" onPress={() => {/* new chat */}}>
              <Text>New</Text>
            </Button>
          </HStack>

          {/* Messages */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.messages}>
            {messages?.map((msg) => (
              <View
                key={msg._id}
                style={[
                  styles.message,
                  msg.role === 'user' ? styles.userMessage : styles.assistantMessage
                ]}
              >
                <HStack spacing={8} alignment="top">
                  <Image
                    systemName={msg.role === 'user' ? 'person.circle' : 'sparkles'}
                    size={16}
                    color={msg.role === 'user' ? 'accent' : 'purple'}
                  />
                  <Text style={{ flex: 1 }}>{msg.content}</Text>
                </HStack>

                {/* Tool calls inline */}
                {msg.toolCalls?.map((tool) => (
                  <ToolCard key={tool.id} toolCall={tool} />
                ))}
              </View>
            ))}

            {/* Active tool runs */}
            {activeTools?.map((run) => (
              <ToolCard key={run._id} run={run} />
            ))}
          </ScrollView>

          {/* Quick Tools */}
          <Section title="Quick Tools">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <HStack spacing={8}>
                <QuickToolButton
                  icon="checkmark.shield"
                  label="Lint"
                  onPress={() => sendMessage({ sessionId, message: '/lint' })}
                />
                <QuickToolButton
                  icon="chart.bar"
                  label="Analyze"
                  onPress={() => sendMessage({ sessionId, message: '/analyze' })}
                />
                <QuickToolButton
                  icon="globe"
                  label="World"
                  onPress={() => sendMessage({ sessionId, message: '/world' })}
                />
                <QuickToolButton
                  icon="person.badge.plus"
                  label="Character"
                  onPress={() => sendMessage({ sessionId, message: '/character' })}
                />
              </HStack>
            </ScrollView>
          </Section>

          {/* Input */}
          <HStack spacing={12} style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask about your story..."
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              multiline
            />
            <Button
              variant="borderedProminent"
              systemImage="arrow.up.circle.fill"
              onPress={handleSend}
              disabled={!input.trim()}
            />
          </HStack>
        </VStack>
      </Host>
    </KeyboardAvoidingView>
  );
}

function QuickToolButton({ icon, label, onPress }) {
  return (
    <Button variant="bordered" onPress={onPress}>
      <VStack spacing={4} alignment="center">
        <Image systemName={icon} size={20} />
        <Text fontSize={11}>{label}</Text>
      </VStack>
    </Button>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  messages: {
    padding: 16,
    gap: 16,
  },
  message: {
    padding: 12,
    borderRadius: 12,
  },
  userMessage: {
    backgroundColor: colors.bgElevated,
    marginLeft: 40,
  },
  assistantMessage: {
    backgroundColor: 'transparent',
  },
  inputRow: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
  },
});

## Step 2.3: Tool Cards (Lint, World, Character)

```tsx
// components/ai/ToolCard.tsx
import { View, StyleSheet } from 'react-native';
import {
  Host, VStack, HStack, Text, Image, Button, Spacer
} from '@expo/ui/swift-ui';
import { frame, background, clipShape } from '@expo/ui/swift-ui/modifiers';
import { colors } from '@/constants/tokens';

interface ToolRun {
  _id: string;
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  output?: any;
  error?: string;
}

const TOOL_CONFIG = {
  lint: {
    icon: 'checkmark.shield',
    label: 'Consistency Check',
    color: colors.warning,
  },
  analyze: {
    icon: 'chart.bar',
    label: 'Writing Analysis',
    color: colors.info,
  },
  world: {
    icon: 'globe',
    label: 'World Builder',
    color: colors.entity.location,
  },
  character: {
    icon: 'person.badge.plus',
    label: 'Character Builder',
    color: colors.entity.character,
  },
  detect: {
    icon: 'eye',
    label: 'Entity Detection',
    color: colors.accent,
  },
};

export function ToolCard({ run }: { run: ToolRun }) {
  const config = TOOL_CONFIG[run.tool] ?? {
    icon: 'gearshape',
    label: run.tool,
    color: colors.textMuted,
  };

  return (
    <Host matchContents>
      <VStack
        spacing={12}
        style={[styles.card, { borderLeftColor: config.color }]}
      >
        {/* Header */}
        <HStack spacing={8}>
          <Image
            systemName={config.icon}
            size={16}
            color={config.color}
            modifiers={[
              frame({ width: 28, height: 28 }),
              background(config.color + '20'),
              clipShape('roundedRectangle'),
            ]}
          />
          <Text fontWeight="medium">{config.label}</Text>
          <Spacer />
          <StatusBadge status={run.status} />
        </HStack>

        {/* Progress bar when running */}
        {run.status === 'running' && (
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${run.progress ?? 0}%`,
                  backgroundColor: config.color,
                },
              ]}
            />
          </View>
        )}

        {/* Results based on tool type */}
        {run.status === 'completed' && (
          <ToolResult tool={run.tool} output={run.output} />
        )}

        {/* Error state */}
        {run.status === 'failed' && (
          <HStack spacing={8}>
            <Image systemName="exclamationmark.triangle" size={14} color="error" />
            <Text color="error">{run.error}</Text>
          </HStack>
        )}
      </VStack>
    </Host>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { icon: 'clock', color: colors.textMuted, label: 'Pending' },
    running: { icon: 'arrow.triangle.2.circlepath', color: colors.info, label: 'Running' },
    completed: { icon: 'checkmark.circle', color: colors.success, label: 'Done' },
    failed: { icon: 'xmark.circle', color: colors.error, label: 'Failed' },
  };
  const config = statusConfig[status];

  return (
    <HStack spacing={4}>
      <Image systemName={config.icon} size={12} color={config.color} />
      <Text fontSize={12} color="secondary">{config.label}</Text>
    </HStack>
  );
}

function ToolResult({ tool, output }: { tool: string; output: any }) {
  switch (tool) {
    case 'lint':
      return <LintResult issues={output.issues} />;
    case 'analyze':
      return <AnalyzeResult metrics={output} />;
    case 'character':
      return <CharacterResult character={output} />;
    case 'world':
      return <WorldResult entities={output.entities} />;
    default:
      return <Text color="secondary">Completed</Text>;
  }
}

// Lint result: List of issues
function LintResult({ issues }: { issues: any[] }) {
  if (!issues?.length) {
    return (
      <HStack spacing={8}>
        <Image systemName="checkmark.circle.fill" size={16} color="success" />
        <Text color="success">No issues found!</Text>
      </HStack>
    );
  }

  return (
    <VStack spacing={8}>
      <Text fontSize={13} color="secondary">{issues.length} issues found</Text>
      {issues.slice(0, 3).map((issue, i) => (
        <HStack key={i} spacing={8} style={styles.issueRow}>
          <Image
            systemName={issue.severity === 'error' ? 'xmark.circle' : 'exclamationmark.triangle'}
            size={14}
            color={issue.severity === 'error' ? 'error' : 'warning'}
          />
          <VStack spacing={2} style={{ flex: 1 }}>
            <Text fontSize={13}>{issue.message}</Text>
            <Text fontSize={11} color="secondary">{issue.location}</Text>
          </VStack>
          <Button variant="bordered" onPress={() => {/* jump to */}}>
            <Text fontSize={11}>Jump</Text>
          </Button>
        </HStack>
      ))}
      {issues.length > 3 && (
        <Button variant="bordered">
          <Text fontSize={12}>View all {issues.length} issues</Text>
        </Button>
      )}
    </VStack>
  );
}

// Analyze result: Writing metrics
function AnalyzeResult({ metrics }: { metrics: any }) {
  return (
    <VStack spacing={8}>
      <HStack spacing={16}>
        <MetricPill label="Pacing" value={metrics.pacing} />
        <MetricPill label="Tension" value={`${metrics.tension}%`} />
        <MetricPill label="Mood" value={metrics.mood} />
      </HStack>
      <Text fontSize={12} color="secondary">
        Readability: Grade {metrics.readability?.grade}
      </Text>
    </VStack>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <VStack spacing={2} alignment="center">
      <Text fontSize={11} color="secondary">{label}</Text>
      <Text fontSize={13} fontWeight="medium">{value}</Text>
    </VStack>
  );
}

// Character result: Generated character preview
function CharacterResult({ character }: { character: any }) {
  return (
    <VStack spacing={8}>
      <HStack spacing={12}>
        <Image
          systemName="person.fill"
          size={24}
          color={colors.entity.character}
          modifiers={[
            frame({ width: 44, height: 44 }),
            background(colors.entity.character + '20'),
            clipShape('circle'),
          ]}
        />
        <VStack spacing={2}>
          <Text fontWeight="semibold">{character.name}</Text>
          <Text fontSize={12} color="secondary">{character.archetype}</Text>
        </VStack>
      </HStack>
      <Text fontSize={13} numberOfLines={2}>{character.description}</Text>
      <Button variant="borderedProminent">
        <Text>Add to World</Text>
      </Button>
    </VStack>
  );
}

// World result: Generated entities preview
function WorldResult({ entities }: { entities: any[] }) {
  return (
    <VStack spacing={8}>
      <Text fontSize={13} color="secondary">
        Generated {entities?.length} entities
      </Text>
      <HStack spacing={8} wrap>
        {entities?.slice(0, 6).map((e, i) => (
          <HStack key={i} spacing={4} style={styles.entityChip}>
            <Image
              systemName={TOOL_CONFIG[e.type]?.icon ?? 'circle'}
              size={12}
              color={colors.entity[e.type]}
            />
            <Text fontSize={12}>{e.name}</Text>
          </HStack>
        ))}
      </HStack>
      <Button variant="borderedProminent">
        <Text>Import All</Text>
      </Button>
    </VStack>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 12,
    marginVertical: 4,
  },
  progressContainer: {
    height: 4,
    backgroundColor: colors.bgHover,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  issueRow: {
    backgroundColor: colors.bgHover,
    borderRadius: 8,
    padding: 8,
  },
  entityChip: {
    backgroundColor: colors.bgHover,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
```

---

# PHASE 3: AI + CONVEX INTEGRATION

> Goal: Real-time AI tools with live state sync

## Step 3.1: Convex Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Documents (chapters, scenes)
  documents: defineTable({
    projectId: v.id("projects"),
    parentId: v.optional(v.id("documents")),
    type: v.union(v.literal("chapter"), v.literal("scene")),
    title: v.string(),
    content: v.optional(v.string()), // Tiptap JSON
    plainText: v.optional(v.string()),
    wordCount: v.number(),
    order: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_parent", ["parentId"]),

  // Entities (characters, locations, etc.)
  entities: defineTable({
    projectId: v.id("projects"),
    type: v.string(), // character, location, item, etc.
    name: v.string(),
    aliases: v.array(v.string()),
    data: v.any(), // type-specific fields
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_project", ["projectId"])
    .index("by_type", ["projectId", "type"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["projectId"],
    }),

  // Relationships between entities
  relationships: defineTable({
    projectId: v.id("projects"),
    sourceId: v.id("entities"),
    targetId: v.id("entities"),
    type: v.string(), // ally, enemy, located_at, owns, etc.
    description: v.optional(v.string()),
  })
    .index("by_source", ["sourceId"])
    .index("by_target", ["targetId"]),

  // AI Tool Executions (for tracking state)
  toolRuns: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    tool: v.string(), // lint, analyze, detect, generate
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    input: v.any(),
    output: v.optional(v.any()),
    progress: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"]),

  // Chat messages
  chatMessages: defineTable({
    projectId: v.id("projects"),
    sessionId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.any())),
  })
    .index("by_session", ["sessionId"]),
});
```

## Step 3.2: Tool Cards Architecture

```tsx
// components/ai/ToolCard.tsx
interface ToolCardProps {
  run: ToolRun; // from Convex
}

export function ToolCard({ run }: ToolCardProps) {
  const toolConfig = TOOL_REGISTRY[run.tool];

  return (
    <Card className="border border-border-subtle">
      <div className="flex items-center gap-2 p-3">
        <toolConfig.icon className="w-4 h-4" />
        <span className="font-medium">{toolConfig.label}</span>
        <StatusBadge status={run.status} />
      </div>

      {run.status === 'running' && (
        <ProgressBar value={run.progress} />
      )}

      {run.status === 'completed' && (
        <ToolResult tool={run.tool} data={run.output} />
      )}

      {run.status === 'failed' && (
        <ErrorDisplay error={run.error} />
      )}
    </Card>
  );
}
```

## Step 3.3: Tool Registry

```tsx
// tools/registry.ts
export const TOOL_REGISTRY = {
  lint: {
    label: 'Consistency Check',
    icon: AlertTriangle,
    description: 'Find inconsistencies in your world',
    resultComponent: LintResultCard,
    quickAction: true,
  },
  analyze: {
    label: 'Writing Analysis',
    icon: BarChart,
    description: 'Analyze pacing, tension, and style',
    resultComponent: AnalysisResultCard,
    quickAction: true,
  },
  detect: {
    label: 'Entity Detection',
    icon: Scan,
    description: 'Find characters and places in text',
    resultComponent: DetectResultCard,
    quickAction: false,
  },
  generate: {
    label: 'Generate Content',
    icon: Sparkles,
    description: 'AI-powered content generation',
    resultComponent: GenerateResultCard,
    quickAction: false,
  },
  world: {
    label: 'World Builder',
    icon: Globe,
    description: 'Generate world from description',
    resultComponent: WorldResultCard,
    quickAction: true,
  },
  character: {
    label: 'Character Builder',
    icon: User,
    description: 'Create detailed character',
    resultComponent: CharacterResultCard,
    quickAction: true,
  },
};
```

## Step 3.4: Convex Functions for AI

```typescript
// convex/ai/lint.ts
import { action } from "../_generated/server";
import { v } from "convex/values";

export const runLint = action({
  args: {
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    // 1. Create tool run record
    const runId = await ctx.runMutation(internal.toolRuns.create, {
      projectId: args.projectId,
      tool: "lint",
      status: "running",
    });

    // 2. Fetch entities and documents
    const entities = await ctx.runQuery(api.entities.list, {
      projectId: args.projectId,
    });

    // 3. Update progress
    await ctx.runMutation(internal.toolRuns.updateProgress, {
      runId,
      progress: 30,
    });

    // 4. Call AI for analysis
    const issues = await analyzeConsistency(entities);

    // 5. Complete
    await ctx.runMutation(internal.toolRuns.complete, {
      runId,
      output: { issues },
    });

    return { runId, issues };
  },
});
```

## Step 3.5: Real-time Tool State Hook

```tsx
// hooks/useToolRun.ts
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function useToolRun(runId: Id<"toolRuns"> | null) {
  // Real-time subscription to tool state
  const run = useQuery(
    api.toolRuns.get,
    runId ? { runId } : "skip"
  );

  return {
    run,
    isRunning: run?.status === "running",
    isComplete: run?.status === "completed",
    progress: run?.progress ?? 0,
    result: run?.output,
    error: run?.error,
  };
}

export function useRunTool() {
  const runLint = useMutation(api.ai.lint.runLint);
  const runAnalyze = useMutation(api.ai.analyze.runAnalyze);
  // ... etc

  return {
    lint: runLint,
    analyze: runAnalyze,
  };
}
```

---

# PHASE 4: POLISH

- [ ] Animations (Framer Motion)
- [ ] Keyboard shortcuts map
- [ ] Accessibility (focus management, ARIA)
- [ ] Light theme
- [ ] Mobile responsive
- [ ] Onboarding flow

---

## File Structure

```
apps/web/src/
├── components/
│   ├── ui/                    # Base design system
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Sheet.tsx          # Side sheet
│   │   ├── Dock.tsx           # Bottom dock
│   │   └── ...
│   ├── layout/
│   │   ├── AppShell.tsx       # Main layout
│   │   ├── Header.tsx
│   │   ├── Canvas.tsx
│   │   └── BottomDock.tsx
│   ├── command-palette/
│   │   ├── CommandPalette.tsx
│   │   ├── CommandItem.tsx
│   │   └── useCommandRegistry.ts
│   ├── panels/
│   │   ├── OutlinePanel.tsx
│   │   ├── EntitiesPanel.tsx
│   │   ├── WorldPanel.tsx
│   │   └── AIPanel.tsx
│   ├── sheets/
│   │   ├── EntitySheet.tsx
│   │   ├── SearchSheet.tsx
│   │   ├── CoachSheet.tsx
│   │   └── LinterSheet.tsx
│   ├── editor/
│   │   ├── Editor.tsx
│   │   ├── FloatingToolbar.tsx
│   │   ├── EntityMention.tsx
│   │   └── EntityHUD.tsx
│   └── project-graph/
│       ├── ProjectGraphOverlay.tsx
│       └── ...
├── hooks/
│   ├── usePanel.ts            # Panel open/close state
│   ├── useSheet.ts            # Sheet open/close state
│   └── useKeyboardShortcuts.ts
├── stores/
│   └── ui.ts                  # UI state (panels, sheets, etc.)
└── styles/
    ├── tokens.css             # Design tokens
    ├── animations.css         # Keyframes
    └── global.css
```

---

## Migration Strategy

1. **Parallel Development**: Build new UI in `/components-v2/` without breaking current
2. **Feature Flag**: `USE_NEW_UI` env var to toggle
3. **Incremental Migration**: Replace one panel/component at a time
4. **State Preservation**: Keep existing stores, only update UI layer

---

## Open Questions

1. **Mobile/Tablet**: Do we need responsive breakpoints or is this desktop-only?
2. **Real-time Collaboration**: Will this affect layout decisions?
3. **Offline Mode**: How should we indicate sync state?
4. **Theming**: Just dark/light or full custom themes?
5. **Onboarding**: Need first-time user experience?

---

## References

- [Notion](https://notion.so) - Clean editor, slash commands, databases
- [Cursor](https://cursor.sh) - AI integration, dark aesthetic, keyboard-first
- [Linear](https://linear.app) - Animation quality, keyboard shortcuts
- [Obsidian](https://obsidian.md) - Graph view, plugin architecture
- [Arc Browser](https://arc.net) - Sidebar organization, spaces

---

*Document created: 2025-01-07*
