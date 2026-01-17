# Embedding Outbox + Canon Claims Notes

## Canon claims
- Added a lightweight `canonClaims` table in Convex for canonical statements.
- Minimal API in `muse/convex/canonClaims.ts` supports list/create/archive.
- Backfill helper: `muse/convex/migrations/backfillCanonClaimsFromMemories.ts` can seed
  canon claims from pinned memories (per project).

## Unified embedding outbox
- Embedding work now runs through `analysisJobs` using kind `embedding_generation`.
- A new handler (`muse/convex/ai/analysis/handlers/embeddingGenerationJob.ts`) processes
  document, entity, and memory embeddings plus memory vector deletes.
- The legacy `embeddingJobs` table remains but is no longer used by new code paths.
