# Mythos IDE Monorepo Analysis

> Status: **All refactoring complete** | Updated: 2025-12-29

## Metrics

| Metric | Value |
|--------|-------|
| Total LOC | ~84,000 |
| Packages | 19 (all passing typecheck) |
| Apps | 3 (web, mobile, website) |
| Edge Functions | 15 |

## Architecture

```
apps/           → web (React), mobile (Expo), website
packages/       → core, db, state, sync, ai, agent-protocol, ui, theme, etc.
supabase/       → Edge functions + _shared/ utilities
```

## Completed Refactoring

| Category | Changes |
|----------|---------|
| **Architecture** | Split agent-protocol (1,276→5 files), fix db→state dependency |
| **Performance** | N+1 query → batch upsert, SQL aggregation for metrics |
| **Robustness** | Retry logic + exponential backoff, typed DB errors |
| **Consistency** | Shared RAG (`_shared/rag.ts`), SSE streaming (`_shared/streaming.ts`) |
| **DX** | `executeQuery<T>()` helper, pagination, `createAgentHook()` factory |

## Key Patterns

- **DB Queries**: Use `executeQuery<T>()` from `packages/db/src/queryHelper.ts`
- **API Calls**: Use `callEdgeFunction()` with built-in retry from `services/api-client.ts`
- **Timeouts**: Centralized in `services/config.ts` (`API_TIMEOUTS`, `RETRY_CONFIG`)
- **Errors**: Typed `DBError` hierarchy in `packages/db/src/errors.ts`
- **Edge Functions**: Import from `_shared/rag.ts` and `_shared/streaming.ts`

## Remaining Tech Debt

- [ ] Add test coverage
- [ ] Complete DB query helper migration (5/16 files done)
- [ ] Align cross-platform hook interfaces
