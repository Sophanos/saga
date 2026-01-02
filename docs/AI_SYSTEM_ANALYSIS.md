# Mythos IDE - AI System Analysis

> Comprehensive analysis of the AI coaching, linting, and intelligence systems

---

## Executive Summary

Mythos IDE implements a sophisticated AI-powered writing assistance system with **5 specialized agents**, **vector embeddings infrastructure**, **real-time analysis**, and **IDE-like fix capabilities**. The system treats "story as code" with narrative-aware linting similar to TypeScript's type checking.

---

## Table of Contents

1. [AI Agent Architecture](#1-ai-agent-architecture)
2. [Writing Coach Capabilities](#2-writing-coach-capabilities)
3. [Consistency Linter ("TypeScript for Fiction")](#3-consistency-linter-typescript-for-fiction)
4. [Vector Embeddings & Semantic Search](#4-vector-embeddings--semantic-search)
5. [Editor Integration](#5-editor-integration)
6. [Real-time vs Batch Analysis](#6-real-time-vs-batch-analysis)
7. [Cross-Document Intelligence](#7-cross-document-intelligence)
8. [Gap Analysis vs Cursor.ai](#8-gap-analysis-vs-cursorai)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. AI Agent Architecture

### Agent Overview

| Agent | Model | Purpose | Speed |
|-------|-------|---------|-------|
| **WritingCoach** | Gemini Flash | Real-time prose analysis | Fast |
| **ConsistencyLinter** | Gemini Pro | Narrative contradiction detection | Thorough |
| **EntityDetector** | Gemini Pro | Extract entities with positions | Accurate |
| **DynamicsExtractor** | Gemini Flash | Character interaction tracking | Fast |
| **GenesisWizard** | Gemini Pro | Project scaffolding | Creative |

### Base Agent Class

All agents extend `NarrativeAgent` (`packages/ai/src/agents/base.ts`):

```typescript
export abstract class NarrativeAgent {
  protected config: AgentConfig;
  
  protected async analyze(context: AnalysisContext): Promise<unknown> {
    const messages = this.buildMessages(context);
    const response = await generateObject({
      model: this.getModel(),
      schema: this.getSchema(),
      messages,
      temperature: this.config.temperature,
    });
    return response.object;
  }
}

interface AnalysisContext {
  documentContent: string;
  entities?: Entity[];           // Known entities for context
  relationships?: Relationship[]; // Entity relationships
  projectConfig?: ProjectConfig;  // Genre, style mode, etc.
  previousMessages?: CoreMessage[];
}
```

### Model Configuration

```typescript
// OpenRouter Models (Primary)
{
  analysis: "google/gemini-3-pro-preview",
  fast: "google/gemini-3-flash-preview",
  thinking: "moonshotai/kimi-k2-thinking",
  creative: "moonshotai/kimi-k2-thinking",
}

// Gemini Models (Fallback)
{
  analysis: "gemini-3-pro-preview",
  fast: "gemini-3-flash-preview",
}
```

---

## 2. Writing Coach Capabilities

### Analysis Dimensions

| Dimension | Output | Description |
|-----------|--------|-------------|
| **Tension Analysis** | `number[]` (0-100) | Per-paragraph tension scoring |
| **Sensory Details** | `{ sight, sound, touch, smell, taste }` | Count per sense |
| **Show-Don't-Tell** | Score (0-100) + Grade (A-F) | Showing vs telling ratio |
| **Pacing** | `accelerating \| steady \| decelerating` | Scene rhythm |
| **Mood** | `string` | Dominant emotional atmosphere |
| **Style Issues** | `StyleIssue[]` | With auto-fix suggestions |

### Style Issue Types

| Type | Problem | Auto-Fix Example |
|------|---------|------------------|
| `telling` | Direct emotional statements | "She was angry" → "Her fists clenched" |
| `passive` | Passive voice | "was seen" → "saw" |
| `adverb` | Weak verb + adverb | "ran quickly" → "sprinted" |
| `repetition` | Repeated words | Suggests synonyms |

### Genre-Aware Coaching

```typescript
// packages/prompts/src/coach.ts
GENRE_COACH_CONTEXTS = {
  fantasy: "Poetic language and world-building are valued...",
  thriller: "Pace is paramount. Short, punchy sentences...",
  romance: "Emotional interiority is expected...",
  literary: "Prose style is paramount. Some 'telling' can be intentional...",
  horror: "Atmosphere through sensory detail. Dread builds through what's NOT shown...",
  scifi: "Technical accuracy matters. Balance exposition with action...",
  mystery: "Plant clues fairly. Red herrings should be subtle...",
  historical: "Period-appropriate language without being archaic...",
}
```

### Output Schema

```typescript
interface WritingAnalysis {
  metrics: {
    tension: number[];
    sensory: { sight: number; sound: number; touch: number; smell: number; taste: number };
    pacing: "accelerating" | "steady" | "decelerating";
    mood: string;
    showDontTellScore: number;
    showDontTellGrade: "A" | "B" | "C" | "D" | "F";
  };
  issues: StyleIssue[];
  insights: string[];  // AI-generated writing tips
}
```

---

## 3. Consistency Linter ("TypeScript for Fiction")

### Rule Categories

| Category | Icon | Checks |
|----------|------|--------|
| `character` | User | Name spelling, physical descriptions, personality, voice patterns, knowledge/skills |
| `world` | Globe | Location descriptions, magic systems, technology levels, distance/travel times |
| `plot` | GitBranch | Cause-effect chains, character motivations, foreshadowing payoffs |
| `timeline` | Clock | Chronological consistency, event ordering |

### Severity Levels

```typescript
// packages/core/src/analysis/severity-config.ts
SEVERITY_CONFIG = {
  error: { order: 0, bgClass: "bg-mythos-accent-red/10" },
  warning: { order: 1, bgClass: "bg-mythos-accent-amber/10" },
  info: { order: 2, bgClass: "bg-mythos-accent-cyan/10" },
}
```

### Issue Structure

```typescript
interface ConsistencyIssue {
  id: string;
  type: "character" | "world" | "plot" | "timeline";
  severity: "info" | "warning" | "error";
  location: { line: number; text: string };
  message: string;
  suggestion: string;  // EXACT replacement text
  relatedLocations?: { line: number; text: string }[];
}
```

### Auto-Fix System

```typescript
// packages/editor/src/fixes/
replaceText(editor, from, to, text)  // Replace text range
insertText(editor, position, text)    // Insert at position
removeText(editor, from, to)          // Delete range
jumpToPosition(editor, position)      // Navigate to location
```

### Undo/Redo Stack

```typescript
// apps/web/src/stores/undo.ts
interface UndoEntry {
  type: "fix";
  issueId: string;
  before: string;
  after: string;
  position: { from: number; to: number };
  timestamp: number;
}

// Zustand store with max 50 entries
useUndoStore = {
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  pushUndo(entry): void;
  undo(): UndoEntry | undefined;
  redo(): UndoEntry | undefined;
}
```

---

## 4. Vector Embeddings & Semantic Search

### Database Schema (pgvector)

```sql
-- packages/db/src/migrations/003_pgvector.sql

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns
ALTER TABLE documents ADD COLUMN embedding VECTOR(1536);
ALTER TABLE documents ADD COLUMN content_text TEXT;
ALTER TABLE entities ADD COLUMN embedding VECTOR(1536);

-- IVFFlat index for cosine similarity
CREATE INDEX idx_documents_embedding ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Search Functions

```typescript
// packages/db/src/queries/embeddings.ts

// Pure semantic search
searchEntitiesByEmbedding(projectId, embedding, limit, threshold)
searchDocumentsByEmbedding(projectId, embedding, limit, threshold)

// Full-text search
fulltextSearchDocuments(projectId, query, limit)

// Hybrid search (semantic + full-text weighted)
hybridSearchDocuments(projectId, embedding, searchQuery, {
  limit: 10,
  semanticWeight: 0.7,  // 70% semantic, 30% full-text
  matchThreshold: 0.5,
})
```

### Batch Operations

```typescript
batchUpdateEntityEmbeddings(updates: { id, embedding }[])
batchUpdateDocumentEmbeddings(updates: { id, embedding, contentText }[])
getEntitiesWithoutEmbeddings(projectId, limit)
getDocumentsWithoutEmbeddings(projectId, limit)
```

### Story Bible & Memory Controls

The memory layer backs the Story Bible UI and canon system. Memories are stored as RAG-style records and injected into prompts with provenance tags.

Key behaviors:
- Canon decisions are project-scoped `decision` memories and can be pinned for priority.
- Memory metadata tracks `pinned`/`redacted` state; redaction overwrites content + embeddings.
- Read options support `includeExpired`, `includeRedacted`, `pinnedOnly`, and `maxAgeDays` for UI toggles.
- Prompt injection uses `[M:<id>]` tags so linter/chat can cite canon facts.

Example read request:

```json
{
  "projectId": "proj_123",
  "categories": ["decision", "style"],
  "maxAgeDays": 30,
  "includeExpired": false,
  "includeRedacted": false
}
```

### Current Status

| Component | Status |
|-----------|--------|
| Database schema | ✅ Complete |
| Query functions | ✅ Complete |
| Index optimization | ✅ Complete |
| Embedding generation | ❌ Not implemented |
| Search UI | ❌ Not implemented |

---

## 5. Editor Integration

### Decoration Extensions

**StyleDecoration** (`packages/editor/src/extensions/style-decoration.ts`):
- Squiggly underlines for style issues
- CSS classes: `.style-telling`, `.style-passive`, `.style-adverb`, `.style-repetition`
- Click handling for issue selection
- Keyboard navigation: `Cmd+]` (next), `Cmd+[` (previous)

**LinterDecoration** (`packages/editor/src/extensions/linter-decoration.ts`):
- Severity-based underlining
- CSS classes: `.linter-error`, `.linter-warning`, `.linter-info`
- Data attributes for issue metadata

### Position Finding Algorithm

```typescript
function findTextPositions(doc: ProseMirrorNode, searchText: string) {
  // Build map of text offsets to ProseMirror positions
  const textNodes: Array<{ text: string; pmPos: number; textOffset: number }> = [];
  
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      textNodes.push({ text: node.text, pmPos: pos, textOffset: cumulativeOffset });
      cumulativeOffset += node.text.length;
    }
  });
  
  // Search concatenated text and convert offsets back to PM positions
  const fullText = textNodes.map(n => n.text).join("");
  // ... find matches and convert to { from, to } positions
}
```

### Editor Commands

```typescript
// Style issues
setStyleIssues(issues: StyleIssue[])
setSelectedStyleIssue(issueId: string)
jumpToStyleIssue(issueId: string)
selectNextStyleIssue()
selectPreviousStyleIssue()

// Linter issues
setLinterIssues(issues: ConsistencyIssue[])
```

---

## 6. Real-time vs Batch Analysis

### Debouncing Strategy

| Hook | Debounce | Min Content |
|------|----------|-------------|
| `useWritingAnalysis` | 1000ms | 50 chars |
| `useLinterFixes` | 1000ms | 50 chars |
| `useDynamicsExtraction` | 2000ms | 100 chars |

### Content Hash Deduplication

```typescript
// Avoid redundant analysis
const contentHash = simpleHash(content);
if (contentHash === lastAnalyzedHash) {
  return; // Skip - content unchanged
}
```

### Abort Controller Pattern

```typescript
// Cancel pending analysis on new request
if (abortControllerRef.current) {
  abortControllerRef.current.abort();
}
abortControllerRef.current = new AbortController();
```

### Analysis Persistence

```sql
-- packages/db/src/migrations/004_analysis.sql
CREATE TABLE scene_analysis (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  document_id UUID,
  scene_id TEXT,
  
  -- Metrics
  tension_data JSONB,
  sensory_data JSONB,
  pacing FLOAT,
  mood TEXT,
  show_dont_tell_score FLOAT,
  
  -- Additional
  word_count INTEGER,
  dialogue_ratio FLOAT,
  character_presence JSONB,
  
  analyzed_at TIMESTAMPTZ
);
```

---

## 7. Cross-Document Intelligence

### World Graph

```typescript
// packages/core/src/world-graph/index.ts
class WorldGraph {
  private nodes: Map<string, Entity>;
  private edges: Map<string, Relationship>;
  private adjacency: Map<string, Set<string>>;
  
  // Queries
  getRelated(entityId: string, depth: number = 1): Entity[];
  findByName(name: string): Entity[];
  getEntitiesByType(type: EntityType): Entity[];
  
  // Conflict Detection
  detectConflicts(): Conflict[];
}
```

### Conflict Types

| Type | Detection |
|------|-----------|
| `genealogy` | Married relatives warning |
| `relationship` | Contradictory feelings (loves & hates) |
| `timeline` | Chronological impossibilities |
| `location` | Impossible travel times |

### Entity Matching

```typescript
// EntityDetector can match new entities to existing
interface DetectedEntity {
  matchedExistingId?: string;  // Links to known entity
  suggestedAliases?: string[]; // Detected aliases
  confidence: number;          // 0.0-1.0
}
```

---

## 8. Gap Analysis vs Cursor.ai

### Feature Comparison

| Feature | Cursor.ai | Mythos IDE | Gap |
|---------|-----------|------------|-----|
| **Inline Completions** | Tab to accept ghost text | ❌ None | Critical |
| **Command Palette** | Cmd+K inline prompt | ❌ None | Critical |
| **Chat with RAG** | @file, @codebase | ❌ Stub only | High |
| **Semantic Search** | Full codebase | ⚠️ Infrastructure only | Medium |
| **Quick Fixes** | Lightbulb + hover | ⚠️ List only | Medium |
| **Multi-file Context** | Full project | ⚠️ Single document | Medium |
| **Project Refactoring** | Rename symbol | ❌ None | Medium |
| **Agent Capabilities** | Autonomous multi-step | ❌ Single-task | Low |

### What Mythos Has That Cursor Doesn't

| Unique Feature | Description |
|----------------|-------------|
| **Tension Curves** | Paragraph-by-paragraph tension analysis |
| **Sensory Balance** | 5-sense detail tracking |
| **Genre Coaching** | Different rules per genre |
| **Dynamics Extraction** | Who-does-what-to-whom |
| **Consistency Linting** | Character/world/plot/timeline |
| **Archetype Analysis** | Jungian archetype behavior |
| **Entity World Graph** | Relationship tracking with conflicts |

---

## 9. Implementation Roadmap

### P0 - Critical (Cursor Parity)

#### Inline AI Completions
```
Files to create:
- packages/editor/src/extensions/ai-completion.ts
- packages/ai/src/agents/prose-completer.ts

Features:
- Ghost text rendering via Tiptap decorations
- Context: surrounding text + entity mentions + genre
- Tab to accept, Escape to dismiss
- Debounced trigger on typing pause (500ms)
```

#### Command Palette (Cmd+K)
```
Files to create:
- apps/web/src/components/CommandPalette.tsx
- packages/ai/src/agents/command-agent.ts

Features:
- cmdk integration (already in dependencies)
- Selection-aware prompting
- Quick actions: rewrite, expand, condense, change tone
- Command history
```

### P1 - High Priority

#### Chat with RAG
```
Files to modify:
- apps/web/src/components/console/Console.tsx (ChatPanel)
- packages/ai/src/agents/chat-agent.ts (new)

Features:
- Conversation state management
- Context retrieval from embeddings
- @entity, @chapter mentions
- Message history persistence
```

#### Semantic Search UI
```
Files to create:
- apps/web/src/components/SearchPanel.tsx
- apps/web/src/hooks/useSemanticSearch.ts

Features:
- Search input with mode toggle (semantic/hybrid)
- Results with context snippets
- Click to navigate to location
- "Find similar passages" for entities
```

### P2 - Medium Priority

#### Project-Wide Refactoring
```
Files to create:
- apps/web/src/components/modals/RefactorModal.tsx
- packages/db/src/queries/refactoring.ts

Features:
- Rename entity across all documents
- Preview all changes before applying
- Batch update with undo support
- Update aliases and mentions
```

#### Multi-File AI Context
```
Files to modify:
- packages/ai/src/agents/base.ts (enhance context)
- packages/ai/src/agents/project-analyzer.ts (new)

Features:
- Include related documents in context
- Character arc analysis across chapters
- "What does X know at this point?"
```

### P3 - Future

#### Agent Capabilities
```
Features:
- Plan → Execute → Verify loop
- Multi-document editing transactions
- "Apply fix to all similar" automation
- Autonomous worldbuilding suggestions
```

---

## Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │           AI Agent Layer                │
                    │  ┌─────────────┬─────────────┬────────┐ │
                    │  │WritingCoach │ConsistLinter│EntityDet│ │
                    │  │(Gemini Fast)│(Gemini Pro) │(Gemini) │ │
                    │  └─────────────┴─────────────┴────────┘ │
                    └────────────────┬────────────────────────┘
                                     │
                    ┌────────────────┴────────────────────────┐
                    │           Hooks Layer                    │
                    │  useWritingAnalysis  useLinterFixes     │
                    │  useDynamicsExtraction  useEditorNav    │
                    └────────────────┬────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────┐
        │                            │                         │
┌───────┴───────┐          ┌─────────┴─────────┐     ┌────────┴────────┐
│  Zustand      │          │  Editor           │     │   Database      │
│  Stores       │          │  (Tiptap)         │     │   (Supabase)    │
├───────────────┤          ├───────────────────┤     ├─────────────────┤
│ analysisStore │◄────────►│ StyleDecoration   │     │ scene_analysis  │
│ dynamicsStore │          │ LinterDecoration  │     │ embeddings      │
│ historyStore  │          │ EntityMark        │     │ entities        │
│ undoStore     │          │ Fix utilities     │     │ documents       │
└───────────────┘          └───────────────────┘     └─────────────────┘
```

---

## Key File Locations

| Component | Path |
|-----------|------|
| **Agents** | |
| Writing Coach | `packages/ai/src/agents/writing-coach.ts` |
| Consistency Linter | `packages/ai/src/agents/consistency-linter.ts` |
| Entity Detector | `packages/ai/src/agents/entity-detector.ts` |
| Dynamics Extractor | `packages/ai/src/agents/dynamics-extractor.ts` |
| **Prompts** | |
| Coach Prompts | `packages/prompts/src/coach.ts` |
| Linter Prompts | `packages/prompts/src/linter.ts` |
| **Editor** | |
| Style Decoration | `packages/editor/src/extensions/style-decoration.ts` |
| Linter Decoration | `packages/editor/src/extensions/linter-decoration.ts` |
| Fix Utilities | `packages/editor/src/fixes/` |
| **Database** | |
| Embeddings Queries | `packages/db/src/queries/embeddings.ts` |
| Analysis Queries | `packages/db/src/queries/analysis.ts` |
| pgvector Migration | `packages/db/src/migrations/003_pgvector.sql` |
| **Hooks** | |
| Writing Analysis | `apps/web/src/hooks/useWritingAnalysis.ts` |
| Linter Fixes | `apps/web/src/hooks/useLinterFixes.ts` |
| Editor Navigation | `apps/web/src/hooks/useEditorNavigation.ts` |
| **Stores** | |
| Analysis Store | `apps/web/src/stores/analysis.ts` |
| Undo Store | `apps/web/src/stores/undo.ts` |
| History Store | `apps/web/src/stores/history.ts` |
