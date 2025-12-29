# Mythos IDE Monorepo Analysis

> Comprehensive analysis of `/Users/mibook/saga/muse` covering consistency, architecture, code patterns, performance, and scalability metrics.
>
> Generated: 2025-12-29

---

## Executive Summary

| Metric | Value | Health |
|--------|-------|--------|
| **Total LOC** | ~84,000 | - |
| **Total Files** | ~450 | - |
| **Consistency Issues** | 17 identified | Needs attention |
| **Duplicate Code** | ~1,150 LOC saveable | Refactor opportunity |
| **Performance Issues** | 12 identified | Medium priority |
| **Architecture** | Well-structured | 1 dependency violation |

### Top 5 Priorities

1. **HIGH** - Fix `EntityType`/`RelationType` duplication across 3 packages
2. **HIGH** - Add retry logic to base API client
3. **HIGH** - Fix N+1 query in `updateDocumentOrder`
4. **HIGH** - Split `agent-protocol` single-file package (1,276 LOC)
5. **MEDIUM** - Extract RAG retrieval from edge functions

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [LOC Metrics & Efficiency](#2-loc-metrics--efficiency)
3. [Consistency Analysis](#3-consistency-analysis)
4. [Code Duplication](#4-code-duplication)
5. [Performance & Robustness](#5-performance--robustness)
6. [Recommendations](#6-recommendations)

---

## 1. Architecture Overview

### Package Dependency Graph

```
                            ┌─────────────────────────────────────────────────────────────┐
                            │                       APPLICATIONS                          │
                            │  apps/web (React)  ·  apps/mobile (Expo)  ·  apps/website   │
                            └─────────────────────────────────────────────────────────────┘
                                                        │
                                                        ▼
                            ┌─────────────────────────────────────────────────────────────┐
                            │                    SHARED PACKAGES                          │
                            │   @mythos/state  ·  @mythos/sync  ·  @mythos/ai            │
                            │   @mythos/db     ·  @mythos/api-client                     │
                            └─────────────────────────────────────────────────────────────┘
                                                        │
                                                        ▼
                            ┌─────────────────────────────────────────────────────────────┐
                            │                   FOUNDATION LAYER                          │
                            │   @mythos/core  ·  @mythos/agent-protocol  ·  @mythos/storage│
                            │   @mythos/prompts  ·  @mythos/theme  ·  @mythos/ui          │
                            └─────────────────────────────────────────────────────────────┘
                                                        │
                                                        ▼
                            ┌─────────────────────────────────────────────────────────────┐
                            │                  SUPABASE EDGE FUNCTIONS                    │
                            │   ai-chat  ·  ai-saga  ·  ai-agent  ·  ai-embed  ·  etc.   │
                            │           ↓ uses ↓                                          │
                            │   _shared/ (billing, qdrant, deepinfra, prompts)           │
                            └─────────────────────────────────────────────────────────────┘
```

### Dependency Issue Found

```
@mythos/db → @mythos/state (INVERTED DEPENDENCY)
```

**Location:** `packages/db/src/mappers/activity.ts` imports types from `@mythos/state`

**Impact:** Lower-level package depends on higher-level package, making testing difficult.

**Fix:** Move `ActivityLogEntry` and `ActivityType` to `@mythos/core`.

---

## 2. LOC Metrics & Efficiency

### By Package

| Package | LOC | Files | Avg LOC/File |
|---------|-----|-------|--------------|
| packages/core | 5,721 | 31 | 185 |
| packages/db | 5,556 | 25 | 222 |
| packages/state | 2,697 | 8 | 337 |
| packages/sync | 2,667 | 6 | 445 |
| packages/ai | 1,471 | 17 | 87 |
| packages/agent-protocol | 1,276 | 1 | **1,276** |
| packages/api-client | 404 | 3 | 135 |
| *Other packages* | ~3,500 | ~40 | ~88 |
| **Total Packages** | **~23,100** | **~130** | **178** |

### By App

| App | LOC | Files | % of Total |
|-----|-----|-------|------------|
| apps/web | 43,575 | 216 | **52%** |
| apps/mobile | 4,906 | 24 | 6% |
| apps/website | 952 | 4 | 1% |
| **Total Apps** | **49,433** | **244** | **59%** |

### Supabase Functions

| Area | LOC | Files |
|------|-----|-------|
| AI Functions | ~5,500 | 15 |
| _shared/ utilities | ~4,000 | 30 |
| Other functions | ~2,300 | 17 |
| **Total** | **11,784** | **62** |

### File Distribution

```
TypeScript (.ts)     ████████████████████████████████  66%  (~55,000 LOC)
TypeScript JSX       ████████████████  30%  (~25,000 LOC)
SQL Migrations       █  2%  (~2,000 LOC)
Config/Styles        █  2%  (~2,000 LOC)
```

### Largest Files (Refactoring Candidates)

| File | LOC | Priority |
|------|-----|----------|
| `packages/core/src/templates/builtin.ts` | 2,107 | HIGH - extract to JSON |
| `packages/agent-protocol/src/index.ts` | 1,276 | HIGH - split package |
| `packages/db/src/types/database.ts` | 610 | Low - generated |
| `packages/sync/src/syncEngine.ts` | 543 | Medium |
| `supabase/functions/ai-saga/index.ts` | 454 | Medium |

---

## 3. Consistency Analysis

### Type Definition Issues

| Issue | Severity | Files | Fix |
|-------|----------|-------|-----|
| `EntityType` defined 3x | HIGH | core, agent-protocol, _shared | Single source in @mythos/core |
| `RelationType` defined 3x | HIGH | core, agent-protocol, _shared | Single source in @mythos/core |
| `EntityOccurrence` mismatch | MEDIUM | core vs agent-protocol | Align optional/required fields |
| Local types in ai-detect | MEDIUM | supabase/functions/ai-detect | Import from _shared/types |

### Error Handling Inconsistency

| Pattern | Location | Issue |
|---------|----------|-------|
| `GenesisApiError extends Error` | `services/ai/genesisClient.ts:20` | Should extend `ApiError` |
| DB throws generic `Error` | `packages/db/src/queries/*.ts` | Should use typed errors |

### Config Inconsistency

| Package | tsconfig extends |
|---------|-----------------|
| core, ai, db | `@mythos/typescript-config/base` |
| sync, state, storage | `../../tooling/typescript/tsconfig.base.json` (relative!) |

**Fix:** Standardize all to `@mythos/typescript-config/base`

### Cross-Platform Hook Mismatch

**useOnlineStatus:**
- Web: `checkOnlineStatus()` method
- Mobile: `refreshStatus()` method + `connectionType` field

**Fix:** Create shared interface in `@mythos/state`

---

## 4. Code Duplication

### Estimated Savings: ~1,150 LOC

#### Database Query Boilerplate (~300 LOC)

**Pattern repeated 153 times:**
```typescript
const supabase = getSupabaseClient();
const { data, error } = await supabase.from("TABLE")...
if (error) throw new Error(`Failed to X: ${error.message}`);
return data;
```

**Fix:** Create `executeQuery<T>()` helper in `packages/db/src/queryHelper.ts`

#### RAG Retrieval in Edge Functions (~150 LOC)

**Duplicated in:** `ai-chat`, `ai-saga`, `ai-agent`

**Note:** There's also a bug - `project_id` vs `projectId` key inconsistency!

**Fix:** Extract to `_shared/rag.ts`

#### SSE Streaming Pattern (~100 LOC)

**Duplicated in:** `ai-chat`, `ai-saga`, `ai-agent`

**Fix:** Extract to `_shared/streaming.ts`

#### Chat Agent Hooks (~200 LOC)

**Similar hooks:** `useChatAgent.ts` (282 LOC) vs `useSagaAgent.ts` (346 LOC)

**Shared patterns:**
- `generateMessageId()`
- `getErrorMessage()`
- `stopStreaming()`
- `clearChat()`
- AbortController handling

**Fix:** Create `createAgentHook()` factory

#### Platform Hooks (~250 LOC)

| Hook | Web | Mobile | Overlap |
|------|-----|--------|---------|
| useOnlineStatus | 149 | 257 | ~100 LOC |
| useSupabaseAuthSync | 349 | 174 | ~75 LOC |
| ProgressiveNudge | 281 | 443 | ~75 LOC |

---

## 5. Performance & Robustness

### Critical Issues

| Issue | Location | Impact |
|-------|----------|--------|
| N+1 query in document ordering | `packages/db/src/queries/documents.ts:159-174` | HIGH - sequential DB calls |
| Missing retry logic | `apps/web/src/services/api-client.ts` | HIGH - transient failures crash |
| No pagination for entities/docs | `packages/db/src/queries/*.ts` | HIGH - large project slowdown |

### Medium Issues

| Issue | Location | Impact |
|-------|----------|--------|
| Fire-and-forget without tracking | `useWritingAnalysis.ts:146-156` | Data loss possible |
| Inconsistent timeouts | Various API clients | User confusion |
| Missing memoization parent | `useWorldGraph.ts:42-89` | Unnecessary re-renders |
| SQL aggregation in JS | `analysis.ts:195-251` | Memory overhead |
| No rate limit backoff | `api-client.ts:47-52` | API hammering |

### Good Patterns Found

- Excellent cleanup patterns in hooks (AbortController, event listener removal)
- Consistent debouncing to prevent excessive API calls
- `isMountedRef` pattern prevents state updates after unmount
- `sagaClient.ts` has proper retry logic and timeouts
- `usePersistence` factory for DRY CRUD operations

---

## 6. Recommendations

### Immediate Actions (This Sprint)

| # | Action | Files | Est. Effort |
|---|--------|-------|-------------|
| 1 | Fix `EntityType` duplication | 3 files | 2 hours |
| 2 | Fix `GenesisApiError` inheritance | 1 file | 15 min |
| 3 | Add retry wrapper to `callEdgeFunction` | 1 file | 1 hour |
| 4 | Fix RAG `project_id` vs `projectId` bug | 3 files | 30 min |

### Short-Term (Next 2 Weeks)

| # | Action | Est. LOC Saved | Est. Effort |
|---|--------|----------------|-------------|
| 1 | Extract RAG to `_shared/rag.ts` | 150 | 3 hours |
| 2 | Create DB query helper | 300 | 4 hours |
| 3 | Split `agent-protocol` package | 0 (maintainability) | 4 hours |
| 4 | Add pagination to entity/doc queries | 0 (performance) | 3 hours |
| 5 | Standardize tsconfig extends | 0 (consistency) | 1 hour |

### Medium-Term (Next Month)

| # | Action | Benefit |
|---|--------|---------|
| 1 | Create `createAgentHook()` factory | 200 LOC saved, maintainability |
| 2 | Extract SSE streaming helper | 100 LOC saved |
| 3 | Move `builtin.ts` templates to JSON | 2,000+ LOC reduction |
| 4 | Add SQL aggregation for metrics | Performance |
| 5 | Centralize timeout configuration | Consistency |

### Tech Debt Backlog

- Add test coverage (currently 0 test files detected)
- Document package APIs with JSDoc
- Consider splitting apps/web (52% of codebase)
- Align cross-platform hook interfaces

---

## Architecture Strengths

| Strength | Evidence |
|----------|----------|
| Clean package boundaries | Well-defined exports, minimal coupling |
| Consistent naming | kebab-case files, camelCase code |
| Good shared utilities | `_shared/` in edge functions |
| Factory patterns | `usePersistence`, auth store factory |
| Prompt consolidation | `@mythos/prompts` as source of truth |
| Error response standardization | `_shared/errors.ts` with error codes |

---

## Appendix: File Counts

| Category | Files |
|----------|-------|
| TypeScript (.ts) | ~320 |
| TypeScript React (.tsx) | ~100 |
| JSON (config, package) | ~50 |
| SQL (migrations) | ~15 |
| CSS | ~5 |
| **Total** | **~490** |

---

*Report generated by parallel sub-agent analysis covering 5 dimensions: consistency, duplication, architecture, performance, and metrics.*
