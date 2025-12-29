# Comprehensive Embedding Strategy for Mythos IDE

> **Note:** The implementation details have been consolidated into [SEMANTIC_SEARCH.md](./SEMANTIC_SEARCH.md).
> This document remains as a vision/roadmap reference for future features.

> All embedding use cases across Command Palette, Writing Coach, Consistency Linter, Entity System, World-Building, Plot Analysis, RAG Chat, Export, and Mobile

---

## Executive Summary

Embeddings transform Mythos IDE from a writing tool into a **semantic intelligence layer** that understands narrative meaning, not just text. This document maps **40+ embedding use cases** across 8 major areas.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EMBEDDING-POWERED MYTHOS IDE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Cmd+K      │  │  Writing    │  │ Consistency │  │    RAG      │         │
│  │  Palette    │  │  Coach      │  │   Linter    │  │    Chat     │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                │                 │
│         └────────────────┴────────────────┴────────────────┘                 │
│                                   │                                          │
│                    ┌──────────────┴──────────────┐                           │
│                    │     SEMANTIC LAYER          │                           │
│                    │  ┌────────────────────────┐ │                           │
│                    │  │  DeepInfra             │ │                           │
│                    │  │  • Qwen3-Embedding-8B  │ │                           │
│                    │  │  • Qwen3-Reranker-4B   │ │                           │
│                    │  └────────────────────────┘ │                           │
│                    │  ┌────────────────────────┐ │                           │
│                    │  │  Qdrant (Hetzner)      │ │                           │
│                    │  │  • saga_vectors        │ │                           │
│                    │  │  • HNSW index          │ │                           │
│                    │  └────────────────────────┘ │                           │
│                    └─────────────────────────────┘                           │
│                                   │                                          │
│         ┌─────────────────────────┼─────────────────────────┐                │
│         │                         │                         │                │
│  ┌──────┴──────┐  ┌───────────────┴───────────────┐  ┌──────┴──────┐        │
│  │   Entity    │  │      Document Chunks          │  │  Knowledge  │        │
│  │  Embeddings │  │  (Paragraphs, Scenes, Chapters)│  │   Graphs   │        │
│  └─────────────┘  └───────────────────────────────┘  └─────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Command Palette (Cmd+K)

### Vision: Grok/ChatGPT-Style Search with Sources

```
┌─────────────────────────────────────────────────────────────────┐
│  Search: "What does Kael know about the prophecy?"              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AI ANSWER (streaming)                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Based on the manuscript, Kael learned about the prophecy   │ │
│  │ in Chapter 3 when the Elder revealed... [Source: Ch.3]     │ │
│  │ His knowledge includes the three signs... [Source: Kael]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  SOURCES (3)                                         Relevance  │
│  ├── 📄 Chapter 3: The Revelation                        92%   │
│  ├── 👤 Kael (Character)                                 88%   │
│  └── 📜 The Ancient Prophecy (Magic System)              85%   │
│                                                                  │
│  QUICK ACTIONS                                                   │
│  ├── ➕ Create Entity                                            │
│  ├── ✨ Ask AI to Elaborate                                      │
│  └── 📍 Jump to Chapter 3                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Features

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Semantic Search** | Find documents/entities by meaning | Embed query → Qdrant search → Rerank |
| **AI Answers** | Generate answer with citations | RAG: retrieve context → LLM stream |
| **Source Display** | Show matching sources with scores | Display reranked results |
| **Quick Actions** | Context-aware actions | Based on result type |
| **Preview Pane** | Entity/document details | Fetch full data on selection |

### Search Flow

```
User Query
    │
    ▼
┌─────────────────┐     ┌─────────────────┐
│ Detect Mode     │     │ Modes:          │
│ (question?)     │────▶│ • search        │
└────────┬────────┘     │ • question (AI) │
         │              │ • command       │
         ▼              └─────────────────┘
┌─────────────────┐
│ Embed Query     │  DeepInfra Qwen3-Embedding-8B
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────────┐
│Qdrant │ │ If question│
│Search │ │ Stream AI  │
│Top 30 │ │ Answer     │
└───┬───┘ └─────┬─────┘
    │           │
    ▼           │
┌───────────┐   │
│ Rerank    │   │
│ Top 10    │   │
└─────┬─────┘   │
      │         │
      └────┬────┘
           ▼
    ┌─────────────┐
    │ Display:    │
    │ • Answer    │
    │ • Sources   │
    │ • Actions   │
    └─────────────┘
```

---

## 2. Writing Coach Enhancements

### 2.1 Style Matching (Find Similar Passages)

```typescript
// Find passages in project with similar writing style
async function findSimilarPassages(
  currentParagraph: string,
  projectId: string
): Promise<StyleMatch[]> {
  const embedding = await embedText(currentParagraph);
  const matches = await searchParagraphs(projectId, embedding, { 
    threshold: 0.8,
    excludeSelf: true 
  });
  return matches;
}
```

**Use Cases:**
- "You've written something similar in Chapter 3"
- Find stylistic patterns across manuscript
- Identify repetitive descriptions

### 2.2 Tonal Consistency Detection

```typescript
interface TonalAnalysis {
  chapterMood: string;           // e.g., "tense"
  paragraphMood: string;         // e.g., "comedic"
  consistency: number;           // 0-1
  deviation: 'low' | 'medium' | 'high' | 'extreme';
}
```

**Detection Method:**
- Embed chapter context (preceding ~2000 words)
- Embed current paragraph
- Compare embeddings for mood alignment
- Flag extreme deviations

### 2.3 Character Voice Consistency

```typescript
interface VoiceProfile {
  characterId: string;
  embedding: number[];           // Aggregated from voiceNotes + dialogue
  sampleCount: number;
}

// Check if dialogue matches character's voice
async function checkVoiceConsistency(
  dialogue: string,
  characterId: string
): Promise<{ match: number; isConsistent: boolean }> {
  const voiceProfile = await getVoiceProfile(characterId);
  const dialogueEmbedding = await embedText(dialogue);
  const match = cosineSimilarity(dialogueEmbedding, voiceProfile.embedding);
  return { match, isConsistent: match >= 0.75 };
}
```

### 2.4 Show-Don't-Tell Classification

**Hybrid Approach:**
1. **Embedding Filter:** Compare to "showing" vs "telling" exemplars
2. **LLM Confirmation:** Only call LLM on suspicious sentences

```typescript
// Pre-computed exemplar embeddings
const SHOWING_EXEMPLARS = [
  "Her fists clenched, knuckles white",
  "His shoulders slumped as he turned away",
];
const TELLING_EXEMPLARS = [
  "She was angry",
  "He felt sad",
];

// Fast classification
function classifyShowDontTell(sentence: string): 'showing' | 'telling' | 'mixed' {
  const embedding = await embedText(sentence);
  const showingScore = maxSimilarity(embedding, SHOWING_EMBEDDINGS);
  const tellingScore = maxSimilarity(embedding, TELLING_EMBEDDINGS);
  // ...
}
```

### 2.5 Pacing Analysis via Benchmarks

```typescript
interface PacingBenchmark {
  genre: string;
  sceneType: 'action' | 'dialogue' | 'introspection';
  embedding: number[];           // Average of exemplar scenes
  tensionProfile: number[];
}

// Compare scene pacing to genre benchmarks
async function analyzePacing(scene: string, genre: string): Promise<{
  currentPacing: 'too_slow' | 'appropriate' | 'too_fast';
  benchmarkMatch: number;
}>;
```

### 2.6 Genre Compliance

```typescript
// Pre-seeded genre exemplars
const GENRE_EXEMPLARS = {
  thriller: ['action_sequence', 'tension_buildup', 'cliffhanger_ending'],
  romance: ['romantic_tension', 'emotional_interiority', 'vulnerability'],
  fantasy: ['world_building', 'magic_description', 'epic_scope'],
  horror: ['dread_buildup', 'sensory_unease', 'isolation'],
};

// Check if prose matches genre conventions
async function analyzeGenreCompliance(scene: string, genre: string): Promise<{
  alignment: number;
  matchedConventions: string[];
  missingConventions: string[];
}>;
```

---

## 3. Consistency Linter Enhancements

### 3.1 Cross-Document Contradiction Detection

**Goal:** Find semantically conflicting statements across the manuscript.

```typescript
interface ContradictionPair {
  statement1: { text: string; document: string; line: number };
  statement2: { text: string; document: string; line: number };
  similarity: number;        // High = same topic
  isContradiction: boolean;  // LLM verified
  explanation: string;
}

// Pipeline:
// 1. Extract factual statements (LLM)
// 2. Embed all statements
// 3. Find high-similarity pairs across documents
// 4. LLM verification of contradictions
```

**Example Contradictions:**

| Document 1 | Document 2 | Type |
|------------|------------|------|
| "Kael's eyes were deep blue" | "his brown eyes" | character/visual |
| "Journey takes three days" | "arrived that evening" | world/timeline |
| "Magic requires incantations" | "cast with a gesture" | world/rules |

### 3.2 Character Knowledge Tracking

**Goal:** Prevent characters from knowing things they shouldn't.

```typescript
interface KnowledgeFact {
  characterId: string;
  fact: string;
  embedding: number[];
  acquiredAt: { document: string; position: number };
  source: 'witnessed' | 'told' | 'deduced' | 'revealed';
}

// Check: Does character know this at this point in story?
async function checkKnowledgeViolation(
  characterId: string,
  statement: string,
  documentId: string,
  position: number
): Promise<KnowledgeViolation | null>;
```

**Integration with Dynamics Extractor:**
- `DISCOVERS` → Character learns fact
- `REVEALS` → Fact becomes known
- `OBSERVES` → Character witnesses event

### 3.3 Timeline Consistency

```typescript
interface TimelineEvent {
  description: string;
  embedding: number[];
  absoluteTime?: string;        // "Year 3042"
  relativeTime?: {
    reference: string;
    relation: 'before' | 'after' | 'during';
  };
  documentOrder: number;
}

// Detect: Event A happens after B in narrative, but before B in timeline
async function detectTimelineViolations(
  events: TimelineEvent[]
): Promise<TimelineViolation[]>;
```

### 3.4 Location Consistency

```typescript
// Track character locations through story
interface CharacterPresence {
  characterId: string;
  locationId: string;
  documentId: string;
  position: number;
}

// Detect: Character can't be in two places at once
// Detect: Impossible travel times
async function detectLocationViolations(
  presences: CharacterPresence[]
): Promise<LocationViolation[]>;
```

### 3.5 Relationship Evolution Tracking

```typescript
interface RelationshipState {
  source: string;
  target: string;
  description: string;
  embedding: number[];
  sentiment: number;           // -1 (hate) to 1 (love)
  position: number;            // Story position
}

// Detect: Sudden reversals without cause
// Detect: Unearned relationship changes
async function detectRelationshipViolations(
  states: RelationshipState[]
): Promise<RelationshipViolation[]>;
```

### 3.6 Foreshadowing/Payoff Matching

```typescript
interface Foreshadowing {
  setupText: string;
  setupEmbedding: number[];
  setupPosition: number;
  type: 'object' | 'dialogue' | 'prophecy';
  importance: 'major' | 'minor';
  payoff?: {
    text: string;
    position: number;
    matchScore: number;
  };
  status: 'planted' | 'reinforced' | 'paid_off' | 'unfired';
}

// Find unfired Chekhov's guns
async function findUnfiredSetups(
  projectId: string,
  storyProgress: number        // 0-1
): Promise<{ setup: Foreshadowing; urgency: 'critical' | 'soon' }[]>;
```

---

## 4. Entity System Enhancements

### 4.1 Find Similar Characters (Archetypes)

```typescript
// "Find characters like Gandalf" → returns mentor figures
async function findSimilarCharacters(
  characterId: string,
  projectId: string
): Promise<{ character: Entity; similarity: number }[]>;
```

### 4.2 Suggest Relationships

```typescript
// Auto-suggest relationships based on trait similarity
async function suggestRelationships(
  characterId: string
): Promise<{ target: Entity; suggestedType: RelationType; reason: string }[]>;
```

### 4.3 Auto-Link Entities

```typescript
// When new entity detected, find potential matches
async function findEntityMatches(
  detectedEntity: DetectedEntity,
  projectId: string
): Promise<{ existing: Entity; similarity: number }[]>;
```

---

## 5. World-Building Enhancements

### 5.1 Location Atmosphere Matching

```typescript
// Find locations with similar mood
async function findSimilarLocations(
  atmosphere: string,
  projectId: string
): Promise<Location[]>;
```

### 5.2 Magic System Rule Consistency

```typescript
// Alert when magic use violates system rules
async function checkMagicConsistency(
  spellDescription: string,
  magicSystemId: string
): Promise<{ isValid: boolean; violations: string[] }>;
```

### 5.3 Faction Ideology Clustering

```typescript
// Group factions by similar goals/values
async function clusterFactions(
  projectId: string
): Promise<Map<string, Entity[]>>;  // cluster name → factions
```

---

## 6. RAG Chat System

### 6.1 Context Retrieval Flow

```
User: "What happened to Kael in the prophecy?"
         │
         ▼
┌─────────────────┐
│ Embed Query     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Search Qdrant   │
│ • Documents     │
│ • Entities      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Rerank Top-K    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Context   │
│ for LLM         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stream Answer   │
│ with Citations  │
└─────────────────┘
```

### 6.2 @Mentions for Explicit Context

```typescript
// Parse @mentions from chat input
function parseMentions(input: string): {
  query: string;
  entityMentions: string[];     // @Kael, @Lyra
  documentMentions: string[];   // @Chapter 5
} {
  // Extract mentions, retrieve their embeddings
  // Inject into context window
}
```

### 6.3 Conversation Memory

```typescript
// Remember past conversations for context
interface ChatMemory {
  turns: { role: 'user' | 'assistant'; content: string; embedding: number[] }[];
}

// Retrieve relevant past conversation turns
async function retrieveRelevantHistory(
  currentQuery: string,
  memory: ChatMemory
): Promise<string[]>;
```

---

## 7. Export & Publishing

### 7.1 Auto-Generate Blurbs

```typescript
// Find most important passages for book blurb
async function generateBlurb(projectId: string): Promise<{
  hookSentence: string;
  keyPassages: string[];
  themes: string[];
}>;
```

### 7.2 Theme Extraction

```typescript
// Auto-detect themes from manuscript
async function extractThemes(projectId: string): Promise<{
  primaryThemes: string[];
  secondaryThemes: string[];
  themeLocations: Map<string, string[]>;  // theme → document IDs
}>;
```

### 7.3 Comp Title Suggestions

```typescript
// "Books similar to your story"
async function suggestCompTitles(
  manuscriptSummary: string
): Promise<{ title: string; author: string; similarity: number }[]>;
```

---

## 8. Mobile App Integration

### 8.1 Offline Embeddings

```typescript
// Store pre-computed embeddings locally
interface OfflineEmbeddingCache {
  entities: Map<string, number[]>;
  documentChunks: Map<string, number[]>;
  lastSynced: Date;
}

// Sync strategy
async function syncEmbeddings(projectId: string): Promise<void> {
  // Only sync changed entities/documents
  // Delta updates to minimize bandwidth
}
```

### 8.2 On-Device Search

```typescript
// Fast local semantic search
function localSemanticSearch(
  query: string,
  cache: OfflineEmbeddingCache
): SearchResult[] {
  // Use pre-computed query embeddings
  // Or small on-device model (ONNX)
}
```

---

## 9. Database Schema Extensions

```sql
-- Paragraph embeddings for fine-grained analysis
CREATE TABLE paragraph_embeddings (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  paragraph_index INTEGER,
  text_hash TEXT,
  content_preview TEXT,
  embedding VECTOR(1536),
  metadata JSONB,  -- tension, mood, has_dialogue, speaker_id
  created_at TIMESTAMPTZ
);

-- Character knowledge tracking
CREATE TABLE character_knowledge (
  id UUID PRIMARY KEY,
  character_id UUID REFERENCES entities(id),
  fact_content TEXT,
  fact_embedding VECTOR(1536),
  fact_type TEXT,  -- secret, public, discovered
  acquired_document_id UUID,
  acquired_position INTEGER,
  source TEXT,     -- witnessed, told, deduced
  created_at TIMESTAMPTZ
);

-- Timeline events
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY,
  project_id UUID,
  description TEXT,
  embedding VECTOR(1536),
  absolute_time TEXT,
  document_id UUID,
  position INTEGER,
  character_ids UUID[],
  caused_by UUID[],
  causes UUID[],
  created_at TIMESTAMPTZ
);

-- Foreshadowing tracking
CREATE TABLE foreshadowing (
  id UUID PRIMARY KEY,
  project_id UUID,
  setup_text TEXT,
  setup_embedding VECTOR(1536),
  setup_document_id UUID,
  setup_position INTEGER,
  type TEXT,       -- object, dialogue, prophecy
  importance TEXT, -- major, minor
  payoff_text TEXT,
  payoff_embedding VECTOR(1536),
  status TEXT DEFAULT 'planted',
  created_at TIMESTAMPTZ
);

-- Voice profiles
CREATE TABLE voice_profiles (
  id UUID PRIMARY KEY,
  entity_id UUID REFERENCES entities(id),
  embedding VECTOR(1536),
  sample_count INTEGER,
  source_type TEXT,  -- voice_notes, dialogue_aggregate
  updated_at TIMESTAMPTZ
);

-- Genre exemplars (pre-seeded)
CREATE TABLE genre_exemplars (
  id UUID PRIMARY KEY,
  genre TEXT,
  category TEXT,   -- action_sequence, romantic_tension
  description TEXT,
  embedding VECTOR(1536)
);
```

---

## 10. Implementation Priority

### Phase 1: Core Infrastructure (Week 1-2)
| Item | Priority | Effort |
|------|----------|--------|
| DeepInfra embedding service | P0 | 1 day |
| Qdrant vector operations | P0 | 1 day |
| Document chunk embedding on save | P0 | 2 days |
| Entity embedding on save | P0 | 1 day |
| Basic semantic search hook | P0 | 2 days |

### Phase 2: Command Palette (Week 3)
| Item | Priority | Effort |
|------|----------|--------|
| Install cmdk, create palette | P0 | 2 days |
| Semantic search integration | P0 | 1 day |
| AI answer generation (RAG) | P0 | 2 days |
| Source display with scores | P1 | 1 day |

### Phase 3: Writing Coach (Week 4-5)
| Item | Priority | Effort |
|------|----------|--------|
| Similar passage finder | P1 | 2 days |
| Tonal consistency detection | P1 | 2 days |
| Voice profile system | P1 | 3 days |
| Genre compliance checker | P2 | 2 days |

### Phase 4: Consistency Linter (Week 6-7)
| Item | Priority | Effort |
|------|----------|--------|
| Cross-document contradictions | P1 | 3 days |
| Knowledge tracking | P1 | 3 days |
| Timeline validation | P2 | 2 days |
| Foreshadowing matcher | P2 | 2 days |

### Phase 5: Entity & World (Week 8)
| Item | Priority | Effort |
|------|----------|--------|
| Similar character finder | P2 | 1 day |
| Relationship suggestions | P2 | 2 days |
| Location atmosphere matching | P2 | 1 day |

### Phase 6: Mobile & Export (Week 9-10)
| Item | Priority | Effort |
|------|----------|--------|
| Offline embedding sync | P2 | 3 days |
| Blurb generation | P3 | 1 day |
| Theme extraction | P3 | 1 day |

---

## 11. Cost Estimates

### Per Operation

| Operation | Tokens | Price | Cost |
|-----------|--------|-------|------|
| Embed query | 100 | $0.01/M | $0.000001 |
| Embed paragraph | 200 | $0.01/M | $0.000002 |
| Rerank 30 docs | 6000 | $0.025/M | $0.00015 |
| Search + Rerank | 6100 | - | $0.00016 |

### Per Project Setup

| Item | Count | Cost |
|------|-------|------|
| Embed 1000 documents | 500K tokens | $0.005 |
| Embed 500 entities | 50K tokens | $0.0005 |
| Embed paragraphs | 2M tokens | $0.02 |
| **Total initial** | | **~$0.03** |

### Monthly Usage (Heavy User)

| Activity | Count | Cost |
|----------|-------|------|
| Searches | 1000 | $0.16 |
| Coach analysis | 500 | $0.05 |
| Linter runs | 200 | $0.03 |
| **Total monthly** | | **~$0.25** |

---

## 12. Key Files to Create

```
packages/ai/src/
├── providers/
│   └── deepinfra.ts              # DeepInfra client
├── services/
│   ├── embeddings.ts             # Embed text
│   └── reranker.ts               # Rerank results
└── agents/
    ├── answer-agent.ts           # RAG answers
    └── semantic-coach.ts         # Embedding-enhanced coach

packages/db/src/
├── clients/
│   └── qdrant.ts                 # Qdrant client
└── queries/
    ├── vectors.ts                # Vector CRUD
    ├── knowledge.ts              # Knowledge graph
    └── timeline.ts               # Timeline events

apps/web/src/
├── components/
│   └── command/
│       ├── CommandPalette.tsx    # Main Cmd+K UI
│       ├── AIAnswerPane.tsx      # Streaming answer
│       └── SourcesList.tsx       # Sources with scores
├── hooks/
│   ├── useSemanticSearch.ts      # Search + rerank
│   ├── useAIAnswer.ts            # RAG streaming
│   ├── useVoiceConsistency.ts    # Voice checking
│   └── useKnowledgeGraph.ts      # Knowledge tracking
└── stores/
    └── command.ts                # Command palette state
```

---

## Summary

| Area | Use Cases | Key Benefit |
|------|-----------|-------------|
| **Cmd+K Palette** | AI answers + sources | "Ask your story anything" |
| **Writing Coach** | Style, tone, voice, genre | Comparative analysis |
| **Consistency Linter** | Contradictions, knowledge, timeline | Cross-document intelligence |
| **Entity System** | Similar characters, relationships | Semantic discovery |
| **World-Building** | Atmosphere, rules, factions | Consistency at scale |
| **RAG Chat** | Context retrieval, @mentions | Story-aware AI |
| **Export** | Blurbs, themes, comp titles | Publishing automation |
| **Mobile** | Offline search, sync | Anywhere access |

**Bottom Line:** Embeddings transform every feature from text-matching to meaning-understanding, enabling Mythos IDE to truly "understand" the story.
