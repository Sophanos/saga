# MYTHOS IDE - Project Analysis

> Last updated: December 2024

## What Is This?

**Mythos IDE** is an AI-powered creative writing environment that treats **"story as code"** - tracking entities (characters, locations, items) like variables, maintaining a World Graph of relationships, and using AI agents to detect inconsistencies and provide real-time writing feedback.

---

## What Can Users Do Today?

### Core Writing Experience

| Feature | Status | Description |
|---------|--------|-------------|
| Rich Text Editor | Complete | Tiptap-based with serif typography, dark theme |
| Document Management | Complete | Chapters, scenes, notes, outlines, worldbuilding |
| Auto-Save | Complete | 2-second debounce, dirty state tracking, visibility-aware |
| Word Count | Complete | Real-time tracking per document |
| Export | Complete | PDF, EPUB, DOCX, Markdown with glossary |

### Entity System (The "WOW" Feature)

| Feature | Status | Description |
|---------|--------|-------------|
| 7 Entity Types | Complete | Character, Location, Item, Magic System, Faction, Event, Concept |
| Auto-Detection | Complete | AI extracts entities from pasted text with confidence scores |
| @-Mentions | Complete | Type `@` to autocomplete entity references |
| Entity Marks | Complete | Clickable highlighted text linked to entities |
| HUD Overlay | Complete | Click entity → floating panel with stats/details |
| DM/Writer Modes | Complete | Toggle between mechanical stats vs narrative view |

### AI Analysis Suite

| Agent | Status | What It Does |
|-------|--------|--------------|
| Writing Coach | Complete | Tension graph, sensory heatmap, show-don't-tell grades, pacing |
| Consistency Linter | Complete | Detects character/world/timeline contradictions with auto-fix |
| Entity Detector | Complete | Extracts entities with precise character positions |
| Dynamics Extractor | Complete | Tracks character interactions (hostile, hidden, passive) |
| Genesis Wizard | Complete | Scaffolds new projects from descriptions |

### Quality Tools

- **Style Issue Detection**: Telling, passive voice, adverbs, repetition
- **One-Click Fixes**: Preview diff → apply single or batch
- **Keyboard Navigation**: `Cmd+[/]` to jump between issues
- **Undo/Redo**: Full history for linter fixes

---

## USP (Unique Selling Proposition)

### Primary USP: "Story as Code" Intelligence

Unlike Scrivener, Notion, or Google Docs:
- **Entities are first-class citizens** - not just text, but tracked objects with types, aliases, properties
- **World Graph** - relationships between entities with conflict detection
- **AI understands narrative** - not just grammar, but character consistency, timeline logic, plot threads

### Secondary USPs

| USP | Description |
|-----|-------------|
| **Real-Time Narrative Metrics** | Tension curves, sensory balance, show-don't-tell scoring - like a fitness tracker for prose |
| **Consistency Linting** | "TypeScript for fiction" - catches contradictions before readers do |
| **Genre-Aware Coaching** | AI adapts advice to fantasy vs thriller vs romance conventions |
| **DM Mode** | Built for worldbuilders/GMs - tracks stats, hidden info, power levels |
| **Entity Auto-Detection** | Paste 10,000 words → entities extracted in seconds with precise positions |

### Competitive Positioning

```
Scrivener    = Organization
Notion       = Flexibility  
Cursor.ai    = Code AI
Mythos       = Organization + AI + Narrative Understanding
```

---

## MLP (Minimum Lovable Product) Readiness

### Ready (Web App Core)

- Full writing experience with rich editor
- Complete entity CRUD system
- All 5 AI agents functional
- Export to 4 formats
- Project management
- Persistence layer (Supabase)

### Partially Ready

| Area | Status | Gap |
|------|--------|-----|
| Templates | 14 built-in | Need UI to select during project creation |
| Relationships | Schema ready | UI for relationship creation/visualization missing |
| Scene Blocks | Extension exists | Not exposed in UI yet |
| Analysis History | Dashboard exists | Limited historical data displayed |

### Not Ready

| Area | Blocker |
|------|---------|
| Mobile App | Mock data only, missing fonts, no editor screen |
| Authentication | No login/signup flow |
| Collaboration | Single-user only |
| Offline Mode | Requires internet for AI + DB |

### MLP Verdict: **Web App is 85% MLP-ready for solo writers**

Missing for launch:
1. Authentication flow (critical)
2. Template selection in project creation (important)
3. Better onboarding/tutorial (important)

---

## Opportunities

### 1. World-Building Expansion

| Feature | Effort | Impact | Description |
|---------|--------|--------|-------------|
| **Visual World Graph** | Medium | High | Force-directed graph visualization of entity relationships |
| **Timeline View** | Medium | High | Chronological event visualization |
| **Map Integration** | High | High | Upload map images, link locations to regions |
| **Lineage Trees** | Low | Medium | Auto-generate family trees from `parent_of`/`child_of` |
| **Faction Politics** | Medium | Medium | Alliance/rivalry webs, power dynamics |
| **Magic System Designer** | Medium | High | Visual rules/limitations/costs editor |

### 2. Character Profiles

| Feature | Effort | Impact | Description |
|---------|--------|--------|-------------|
| **Character Sheets** | Low | High | Full-page profile view (already have data) |
| **Arc Tracking** | Medium | High | Track character transformation across scenes |
| **Voice Samples** | Low | Medium | Store dialogue snippets per character |
| **Relationship Map** | Medium | High | Visual web of character connections |
| **Archetype Analysis** | Low | Medium | AI-powered archetype recommendations |

### 3. AI Enhancements

| Feature | Effort | Impact | Description |
|---------|--------|--------|-------------|
| **Dialogue Coach** | Medium | High | Character voice consistency checking |
| **Plot Hole Detector** | Medium | High | Cross-document contradiction scanning |
| **Foreshadowing Tracker** | Medium | Medium | Track setup → payoff pairs |
| **Pacing Optimizer** | Low | Medium | Suggest scene restructuring |
| **Research Assistant** | Medium | High | RAG over project for "remind me about X" |

### 4. Visual/Manga Direction

| Feature | Effort | Impact | Description |
|---------|--------|--------|-------------|
| **Storyboard View** | High | High | Panel layout planning for manga/comics |
| **Character Portraits** | Medium | High | AI image generation for entities |
| **Scene Illustrations** | High | High | Generate key scene artwork |
| **Panel-to-Prose** | Medium | Medium | Convert storyboard to prose |
| **Pose References** | Medium | Medium | AI-generated character poses |

### 5. Export/Publishing

| Feature | Effort | Impact | Description |
|---------|--------|--------|-------------|
| **Web Novel Format** | Low | Medium | RoyalRoad/Wattpad chapter formatting |
| **Print Layout** | Medium | High | Professional book interior |
| **Series Bible** | Low | High | Export complete world documentation |
| **Query Letter Generator** | Low | Medium | AI-drafted agent pitches |

---

## Recommendations

### Immediate (Before Launch)

1. **Add Authentication** - Email/OAuth via Supabase Auth
2. **Template Picker** - Show 14 templates in project creation modal
3. **Relationship UI** - Simple form to connect two entities
4. **Landing Page CTA** - Connect waitlist form to actual backend

### Short-Term (Post-Launch)

1. **Character Sheets** - Full-page entity views (low effort, high impact)
2. **Visual World Graph** - React Flow or D3 force graph
3. **Dialogue Voice Checker** - AI agent to flag out-of-character dialogue
4. **Mobile Font Fix** - Add actual font files (blocking!)

### Strategic (Long-Term Vision)

1. **Canvas Mode** - Whiteboard for storyboarding (like Figma)
2. **Image Generation Integration** - Flux/DALL-E for character portraits
3. **Collaboration** - Real-time multiplayer (Yjs/Liveblocks)
4. **Plugin System** - Let users extend with custom entity types/agents

---

## Design Observations

### Strengths

- Consistent dark theme with cyan/purple accents
- Professional typography (Instrument Serif for prose)
- ASCII-art HUD aesthetic is unique and memorable
- Panel-based layout familiar to IDE users

### Considerations

- UI is developer-dense - may intimidate non-technical writers
- Consider "Focus Mode" hiding all panels except editor
- Mobile app needs complete redesign for touch-first experience

---

## Architecture Overview

### Monorepo Structure

```
muse/
├── apps/
│   ├── web/          # Main React web app (Vite)
│   ├── mobile/       # Expo React Native app
│   └── website/      # Marketing landing page
├── packages/
│   ├── core/         # Entity types, schemas, world-graph
│   ├── db/           # Supabase queries, mappers
│   ├── editor/       # Tiptap extensions
│   ├── ai/           # AI agents (coach, linter, detector, etc.)
│   ├── prompts/      # Consolidated AI prompts
│   ├── theme/        # Design tokens
│   └── ui/           # Shared UI components
├── supabase/
│   └── functions/    # Edge functions for AI endpoints
└── tooling/          # ESLint, Tailwind, TypeScript configs
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + TypeScript |
| Editor | Tiptap (ProseMirror) |
| Styling | Tailwind CSS |
| State | Zustand |
| Database | Supabase (PostgreSQL + pgvector) |
| AI | Vercel AI SDK + OpenRouter/Gemini |
| Mobile | Expo + React Native |

### Entity Types

| Type | Description |
|------|-------------|
| `character` | People, beings, sentient creatures |
| `location` | Places in the story world |
| `item` | Objects of significance |
| `magic_system` | Systems of supernatural power |
| `faction` | Organizations, groups, political entities |
| `event` | Significant story events |
| `concept` | Abstract concepts, themes, motifs |

### AI Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| Writing Coach | Gemini Flash | Real-time prose analysis |
| Consistency Linter | Gemini Pro | Narrative contradiction detection |
| Entity Detector | Gemini Pro | Extract entities with positions |
| Dynamics Extractor | Gemini Flash | Character interaction tracking |
| Genesis Wizard | Gemini Pro | Project scaffolding |

---

## Summary

| Dimension | Assessment |
|-----------|------------|
| **Core Concept** | Excellent - "Story as Code" is genuinely novel |
| **Technical Foundation** | Strong - Clean monorepo, type-safe, well-architected |
| **AI Integration** | Excellent - 5 specialized agents, not just ChatGPT wrapper |
| **MLP Readiness** | 85% - Auth + templates needed for launch |
| **Differentiation** | High - No direct competitor combines these features |
| **Scalability Path** | Clear - World-building → Visual → Collaboration |

**Bottom Line**: Mythos IDE has a genuinely differentiated product. The "entity as first-class citizen" concept plus real-time narrative analysis is unique. The main gap is productizing (auth, onboarding) rather than core features. The path to "Notion+Cursor for writers" is clear and technically feasible.
