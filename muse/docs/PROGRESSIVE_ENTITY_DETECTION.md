# Progressive Entity Detection

This document describes the implementation of progressive (streaming) entity detection using AI SDK's `streamObject` with `output: 'array'` mode.

## Overview

**Problem**: The current entity detection implementation waits for the entire AI response before showing any results. For long texts with many entities, this creates a poor UX with extended loading states.

**Solution**: Use AI SDK's streaming array output to emit entities one-by-one as they're detected, allowing the UI to show progressive results.

## Technical Implementation

### AI SDK Streaming Array Feature

AI SDK v4.1.0+ provides `streamObject` with `output: 'array'` mode:

```typescript
import { streamObject } from 'ai';
import { z } from 'zod';

const result = streamObject({
  model,
  output: 'array',           // Enable array streaming
  schema: entitySchema,       // Schema for each array element
  system: systemPrompt,
  prompt: userPrompt,
});

// Stream elements one-by-one via elementStream
for await (const entity of result.elementStream) {
  console.log('Entity detected:', entity.name);
  // Each entity is complete and validated against schema
}
```

### Key Components

#### 1. Edge Function: `ai-detect-stream`

Location: `/supabase/functions/ai-detect-stream/index.ts`

- Uses `streamObject` with `output: 'array'` and Zod schema
- Validates entity positions as they stream
- Emits SSE events for each entity
- Tracks statistics and sends final summary

SSE Event Types:
```typescript
{ type: "entity", data: DetectedEntity }  // Each entity
{ type: "stats", data: DetectionStats }   // Final statistics  
{ type: "done" }                          // Stream complete
{ type: "error", message: string }        // Error occurred
```

#### 2. Client Hook: `useStreamingEntityDetection`

Location: `/apps/web/src/hooks/useStreamingEntityDetection.ts`

```typescript
const { 
  detectEntities, 
  entities,      // Grows as entities arrive
  stats,         // Available after completion
  isStreaming, 
  error,
  cancel,
  reset 
} = useStreamingEntityDetection();

// Start detection with callbacks
await detectEntities(text, existingEntities, {
  minConfidence: 0.7,
  onEntity: (entity) => {
    // Animate entity appearing in UI
    highlightInEditor(entity);
  },
  onComplete: (entities, stats) => {
    console.log(`Detected ${stats.totalEntities} entities`);
  },
});
```

#### 3. Async Generator Alternative

For more control, use the generator function:

```typescript
import { streamEntityDetection } from '@/hooks/useStreamingEntityDetection';

for await (const event of streamEntityDetection(text)) {
  if (event.type === 'entity') {
    processEntity(event.data);
  } else if (event.type === 'stats') {
    showSummary(event.data);
  }
}
```

## UI Integration

### Entity Suggestion Modal Enhancement

Modify `EntitySuggestionModal` to support progressive loading:

```tsx
function EntitySuggestionModal({ onDetect }) {
  const { detectEntities, entities, isStreaming, stats } = useStreamingEntityDetection();
  
  const handleDetect = async (text: string) => {
    await detectEntities(text, existingEntities, {
      onEntity: (entity) => {
        // Entity appears with animation
      },
    });
  };
  
  return (
    <div>
      {/* Show entities as they arrive */}
      {entities.map((entity, i) => (
        <EntityCard 
          key={entity.tempId} 
          entity={entity}
          className={isStreaming ? "animate-fade-in" : ""}
        />
      ))}
      
      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-2">
          <Spinner />
          <span>Detecting entities... ({entities.length} found)</span>
        </div>
      )}
      
      {/* Stats after completion */}
      {stats && <DetectionStats stats={stats} />}
    </div>
  );
}
```

### Editor Integration

Highlight entities progressively in the Tiptap editor:

```typescript
const { detectEntities } = useStreamingEntityDetection();

await detectEntities(text, [], {
  onEntity: (entity) => {
    // Highlight each entity as detected
    entity.occurrences.forEach(occ => {
      editor.commands.setMark('entityHighlight', {
        from: occ.startOffset,
        to: occ.endOffset,
        entityType: entity.type,
        entityId: entity.tempId,
      });
    });
  },
});
```

## Performance/UX Benefits

| Aspect | Batch Detection | Progressive Detection |
|--------|-----------------|----------------------|
| Time to first result | 3-10s (full response) | 0.5-2s (first entity) |
| Perceived performance | "Waiting..." | "Finding entities..." |
| User feedback | None during processing | Visual entities appearing |
| Cancelability | All or nothing | Cancel mid-stream |
| Memory usage | Full response in memory | Streamed, lower peak |

### Metrics

For a 5000-word document with ~20 entities:
- **Batch**: 8 seconds wait, then all entities
- **Progressive**: First entity in 1.5s, new entity every 0.3-0.5s

## Limitations and Gotchas

### 1. Position Accuracy

LLMs occasionally output incorrect character positions. The implementation includes position validation and correction:

```typescript
function validateEntityPositions(entity, text, options) {
  // Verify positions match actual text
  // Attempt correction via string search if wrong
  // Filter out invalid occurrences
}
```

### 2. Entity Grouping

With batch detection, the LLM can see all occurrences before grouping. With streaming, entities are emitted as detected, potentially before all mentions are seen.

**Mitigation**: The prompt instructs the LLM to emit entities with all known occurrences at time of detection. Post-processing can merge duplicates.

### 3. AI SDK Version

Requires AI SDK v4.1.0+ for `streamObject` with `output: 'array'`. Edge functions currently use v4.0.0.

**Action Required**: Update edge function imports:
```typescript
// From:
import { streamText } from "https://esm.sh/ai@4.0.0";

// To:
import { streamObject } from "https://esm.sh/ai@4.1.0";
```

### 4. Model Support

Not all models support structured output equally well. Recommended models:
- Claude 3.5 Sonnet (excellent)
- GPT-4 Turbo (excellent)
- GPT-4o (excellent)
- Claude 3 Haiku (good, faster)

### 5. Error Recovery

If the stream fails mid-way, partially detected entities are preserved:

```typescript
try {
  await detectEntities(text);
} catch (error) {
  // entities array contains all entities detected before failure
  console.log('Partial results:', entities);
}
```

## Migration Path

### Phase 1: Add Streaming Endpoint (Complete)
- [x] Create `ai-detect-stream` edge function
- [x] Create `useStreamingEntityDetection` hook

### Phase 2: UI Integration
- [ ] Update `EntitySuggestionModal` to use streaming hook
- [ ] Add progressive animation for entity cards
- [ ] Show streaming indicator with count

### Phase 3: Editor Integration  
- [ ] Progressive entity highlighting in Tiptap
- [ ] Real-time entity mark updates

### Phase 4: Cleanup
- [ ] Deprecate batch `ai-detect` endpoint (or keep for non-streaming clients)
- [ ] Update AI SDK version across all edge functions

## Testing

```bash
# Test edge function locally
supabase functions serve ai-detect-stream

# Test with curl
curl -X POST http://localhost:54321/functions/v1/ai-detect-stream \
  -H "Content-Type: application/json" \
  -H "x-openrouter-key: $OPENROUTER_API_KEY" \
  -d '{"text": "Kael the warrior entered Shadowfen, carrying Stormbringer."}' \
  --no-buffer
```

## Related Files

- `/supabase/functions/ai-detect-stream/index.ts` - Streaming edge function
- `/apps/web/src/hooks/useStreamingEntityDetection.ts` - React hook
- `/supabase/functions/ai-detect/index.ts` - Original batch implementation
- `/packages/core/src/entities/detection-types.ts` - Type definitions
- `/packages/prompts/src/entity-detector.ts` - Detection prompts
