# MLP1 E2E Context Builder Prompt Set

Use these prompts with `context_builder` to review logical flow, robustness, and performance per journey. Each prompt aligns with the MLP1 roadmap and the E2E-01…08 plan in `muse/docs/MLP1_E2E_SCRIPT.md`.

## Prompt 1: E2E-01 Infrastructure + E2E-02 Auth
Recommended `response_type`: `question`

Analyze the E2E infrastructure and auth journey (E2E-01 + E2E-02) against the MLP1 roadmap. Find Playwright config, global setup, auth fixtures, and the Expo/Tauri/Web auth UI. Review logical flow, selector stability, environment gating, and performance risks (startup readiness, flakiness). Call out missing test IDs, brittle selectors, or gaps between infra and auth flows.

## Prompt 2: E2E-03 Projects + Documents + Editor Persistence
Recommended `response_type`: `question`

Analyze the E2E-03 journey (create project, create document, open editor, persistence after reload). Align with MLP1 editor stability and autosave behavior. Identify logical gaps, data setup issues, brittle UI dependencies, and performance hazards. Suggest missing assertions and test IDs needed for robust editor persistence.

## Prompt 3: E2E-04 Entity Detection + World Graph
Recommended `response_type`: `question`

Analyze the E2E-04 journey for entity detection and world graph ("Sortiermaschine" in MLP1). Locate deterministic fixtures, detection actions, world-graph UI, and test selectors. Identify robustness risks, missing coverage, and performance bottlenecks (detection latency, graph render, query timing).

## Prompt 4: E2E-05 AI Agent Chat + Streaming
Recommended `response_type`: `question`

Analyze the E2E-05 AI chat + streaming journey. Align with MLP1 AI co-author principles (approval-based tools, AI silent unless invoked, streaming UX). Review saga scripts, agent runtime hooks, test assertions, and UI selectors. Identify logical gaps, flaky stream timing, or missing approvals coverage.

## Prompt 5: E2E-06 RAG Pipeline
Recommended `response_type`: `question`

Analyze the E2E-06 RAG pipeline journey (embeddings -> Qdrant -> retrieval). Align with MLP1 RAG architecture. Inspect deterministic embedding mode, Convex actions, Qdrant usage, and test expectations. Identify reliability risks, data isolation gaps, and performance costs.

## Prompt 6: E2E-07 Real-Time Collaboration
Recommended `response_type`: `question`

Analyze the E2E-07 collaboration journey. Align with MLP1 collaboration track and performance stabilization (cursor throttling, presence gating). Review multi-user context setup, presence sync, editor integration, and cursor rendering selectors. Identify robustness issues or missing assertions for real-time sync.

## Prompt 7: E2E-08 Billing + Tier Limits
Recommended `response_type`: `question`

Analyze the E2E-08 billing + tier limits journey. Align with MLP1 tier config and entitlements. Inspect mocked billing response, subscription upsert helpers, and UI usage counters. Identify gaps in entitlements coverage, selector stability, or performance risks.
