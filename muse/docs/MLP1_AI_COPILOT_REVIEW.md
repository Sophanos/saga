# MLP1 AI Copilot Review (Saga)

## Goals
- Make the AI feel like a co-author for world-building, not a Q&A bot.
- Use embeddings (text + image) to ground responses without asking for Chapter 1.
- Enable discovery via @mentions and auto-search so the AI can self-serve context.
- Provide a clear tool/approval flow that keeps users in control of world changes.

## Current Behavior (Observed)
- "Build World" quick action is a chat prompt, not a tool call.
- Blank projects have no embedded documents, so RAG returns nothing.
- AI falls back to generic questions instead of creating structure.
- Editor context is limited to title + selection; no full document excerpt.

## What We Already Have (Key Capabilities)

### Text Embeddings (Qdrant)
- Documents: embedded on autosave with `type=document` payloads.
- Entities: embedded on create/update with `type=entity` payloads.
- RAG used by both `ai-chat` and `ai-saga` when configured.

### Image Embeddings (CLIP + Qdrant)
- `search_images`: text -> image search via CLIP.
- `find_similar_images`: image -> image similarity.
- `ai-image` and `ai-image-analyze` also sync to `saga_images`.

### Agent Tooling (Saga)
- `genesis_world`, `detect_entities`, `generate_template`, `check_consistency`.
- Core CRUD tools: create/update/delete entity/relationship.
- Tool approvals are supported (AI SDK 6).

## Gaps vs "Copilot" Experience

### 1) Missing Seed Context on Blank Projects
- Template description is not stored as a document or entity.
- RAG has nothing to pull, so AI asks for Chapter 1.

### 2) Limited Editor Awareness
- AI does not see the current doc text (only selection or title).
- No "current canvas excerpt" in prompt.

### 3) Quick Action: Build World is just chat
- The action does not call `genesis_world` directly.
- AI is not prompted to propose scaffold creation.

### 4) Auto-Discovery is not used
- The AI is not allowed to auto-invoke `ai-search` for context.
- No "search for relevant docs/entities" tool is available to the agent.

### 5) Embeddings Not Leveraged for Image Context
- Image search tools exist, but the agent does not decide when to use them.
- No guidance in prompt to query images for visual consistency.

## Target Behavior (MLP1)

### A) Seed the World on Project Creation
- Save template description as a worldbuilding doc.
- Embed it immediately so RAG can retrieve it.
- Use this as the first context block for world-building prompts.

### B) Inject Current Canvas Context
- Add a clipped excerpt of the current document text (or selection).
- If document is empty, skip and fall back to seed context.

### C) World-Building Quick Action -> Tool Proposal
- Change "Build World" quick action to `genesis_world` proposal.
- Include genre, detailLevel, and includeOutline defaults.

### D) Auto-Discovery on User Request
- When user asks for "world structure" or "expand the world":
  - If RAG has low/no results, the AI should propose `genesis_world`.
  - If text exists, propose `detect_entities`.
  - If images exist and user asks for visuals, propose `search_images`.

### E) Make @Mentions First-Class
- @mention should include document or entity content in prompt.
- AI should ask: "Which chapters/scenes should I reference?" only if
  no selection and no recent doc context exists.

## Design Options

### Context Injection Strategy
- Option 1: Full current doc (capped at N chars).
- Option 2: Selection + window around cursor (N before/after).
- Option 3: Summary cache per doc (AI-generated, updated on save).

### "Copilot Mode" Rules
- Always propose a tool for world-building on blank projects.
- If the user requests structure, default to `genesis_world`.
- If the user references existing text, default to `detect_entities`.
- Use `commit_decision` when user confirms a canon rule.

### Image Context Rules
- If user asks for visual style, use `search_images` before `generate_image`.
- If user references an existing portrait, use `find_similar_images`.

## Concrete User Example

**Input**: "Blank project. Slavic LOTR / Witcher symbolism."

**Desired behavior**:
- AI proposes `genesis_world` with:
  - `genre: "high_fantasy"`
  - `detailLevel: "detailed"`
  - `includeOutline: true`
  - `entityCount: 20`
- AI then proposes `generate_template` if user wants custom entity kinds
  (e.g., "spirits", "ancestors", "rituals").
- AI creates 1–3 example entities (proposed) and asks to approve.

## MLP1 Release Checklist

### Must-Haves
- Seed context from template description.
- RAG works on empty project.
- Quick action -> tool proposal (genesis_world).
- Editor context injection (doc excerpt).

### Nice-to-Haves
- Auto-summary cache per doc.
- Tool suggestion explanation UI.
- Image search suggestions.

## Open Questions

1) How much doc text should be injected by default (tokens)?
2) Should `genesis_world` be auto-triggered on first world-building request?
3) Do we allow the AI to auto-propose changes without explicit prompts?
4) Should template description be visible as a worldbuilding doc?
5) Do we want "copilot mode" to always propose a tool before writing prose?

## Recommendation for MLP1
- Seed a worldbuilding doc + embed on project creation.
- Inject current doc excerpt (last 1-2k chars or selection).
- Make "Build World" quick action trigger `genesis_world` proposal.
- Keep strict approval for all world changes.

## Status Update (Implemented)
- Editor context now supports selection context and document excerpt (web + edge):
  - `muse/apps/web/src/hooks/useSagaAgent.ts`
  - `muse/packages/agent-protocol/src/types.ts`
  - `muse/packages/ai/src/agents/saga.ts`
  - `muse/supabase/functions/_shared/tools/types.ts`
  - `muse/supabase/functions/_shared/prompts/saga.ts`
- "Build World" quick action now maps to the `genesis_world` tool with defaults:
  - `muse/packages/capabilities/src/registry.ts`
- Seed worldbuilding doc created and embedded on project creation (blank + template flows):
  - `muse/apps/web/src/components/modals/ProjectCreateModal.tsx`
  - `muse/apps/web/src/components/modals/TemplatePickerModal/CreateProjectForm.tsx`
  - `muse/apps/web/src/services/projects/seedWorldbuilding.ts`
- @mentions resolve to actual document/entity content for Saga prompt injection:
  - `muse/supabase/functions/_shared/mentions.ts`
  - `muse/supabase/functions/ai-saga/index.ts`
  - `muse/supabase/functions/_shared/prompts/saga.ts`
- Saga prompt rules now prefer tool proposals on empty context and image search before generation (edge + package):
  - `muse/supabase/functions/_shared/prompts/saga.ts`
  - `muse/packages/ai/src/agents/saga.ts`

## Implementation Plan (Next Steps)

### 1) Seed Context on Project Creation (Blank + Template)
- Create a worldbuilding doc that stores the template description so RAG has a seed.
  - `muse/apps/web/src/components/modals/ProjectCreateModal.tsx`
  - `muse/apps/web/src/components/modals/TemplatePickerModal/CreateProjectForm.tsx`
- Persist `content_text` and run immediate embed + Qdrant upsert for the seed doc.
  - `muse/apps/web/src/services/ai/embeddingClient.ts` (use `embedTextViaEdge`)

### 2) @Mention Content Injection for Saga
- Resolve mentions to actual document/entity content for prompt injection.
  - `muse/supabase/functions/ai-saga/index.ts`
  - `muse/supabase/functions/_shared/rag.ts` (or add a new mention resolver helper)
  - `muse/supabase/functions/_shared/prompts/saga.ts`

### 3) Auto-Discovery and Tool Suggestions
- If RAG is empty and user asks for world structure, guide to `genesis_world`.
- If story text exists, guide to `detect_entities`.
- If visuals are requested, guide to `search_images`.
  - `muse/packages/ai/src/agents/saga.ts`
  - `muse/supabase/functions/_shared/prompts/saga.ts`
  - `muse/supabase/functions/ai-saga/index.ts` (wire any extra tool context needed)

### 4) Image Context Guidance
- Add explicit prompt rules to consult image search tools before generating.
  - `muse/packages/ai/src/agents/saga.ts`
  - `muse/supabase/functions/_shared/prompts/saga.ts`
