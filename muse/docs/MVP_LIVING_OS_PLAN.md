# Rhei Living OS: Cohesive MVP Plan (Concise)

> **Status**: Active
> **Scope**: MLP1 foundation -> MLP1.5 ambient -> MLP2 engine -> MLP3 outputs
> **Depends on**: MLP1_ROADMAP.md, ARTIFACTS_SPEC.md, MLP2_PROACTIVITY_ENGINE.md, COHERENCE_SPEC.md

## Executive Summary

Agents become interchangeable orchestration layers (OpenAI, Anthropic, Microsoft, Google will all offer it). The defensibility moves to:
- your personal/project schema (typed registry)
- your memory graph
- your decision log / canon
- your artifact history
- your tasteful UI

Rhei is a living canvas that turns flow into structure with trails (receipts).
- "Create first. We'll handle the structure."
- "Agents do work. Rhei is where work becomes meaning."
- "Agents execute. Rhei remembers."

## Product Contract (Non-negotiable)

- **Dead Zone (Flow)**: no AI interruptions, no inline nudges.
- **Living Zone (Ambient)**: background analysis only; surfaces appear when the user looks.
- **Build Zone (Output)**: widgets + artifacts + exports; everything reviewable and reversible.

## Platform Bets (Keep consistent with ARTIFACTS_SPEC)

- **Multimodal**: text + image + audio converges.
- **Unified retrieval**: cross-modal memory (Qdrant + CLIP + text embeddings).
- **Trust UX**: trails (receipts), diffs, rollback, citations.
- **Premium**: calm UX + trust + export pipelines.
- **Integrations**: MCP first; do not build 50 bespoke connectors.
- **Proactivity**: ambient pulse only; no spam, no popups.

## Roadmap Focus (MLP1 -> MLP3)

**MLP1 (Foundation, no new ambition)**
- Widget execution pipeline (P0)
- Notification inbox (async completion + trail links)
- Billing end-to-end on devices

**MLP1.5 (One ambient proof)**
- Pulse Card per session/per day
- Shows: what emerged, what changed, what is unresolved, what is ready
- Actions: create Knowledge PR, create artifact, ignore, pin to canon

**MLP2 (Ambient engine, calm only)**
- Coherence checks as signals (no alerts)
- Voice/style centroid across templates
- Relationship inference as suggestions, never auto-mutations
- Unified analysis outbox (embeddings + detection + coherence) — see `muse/docs/MLP2_PROACTIVITY_ENGINE.md`

**MLP3 (Build Zone outputs)**
- Export pipelines as paid tier
- Multi-format synthesis (not writer-only):
  - document -> audio narration
  - product narrative -> pitch video script
  - course notes -> lessons + quizzes
  - world bible -> game JSON / dialogue trees

## Trail UX (Core Story)

Everyone will have agents. Almost nobody will have trustful execution.
- Knowledge PRs
- diff/rollback
- trails in canvas (receipt blocks)
- trace/citations surfaces

"Every change leaves a trail."

## High-Value Packs (Same UI, different registry + widgets)

| Pack | Input | Reflect | Ship widgets (2-3)
| --- | --- | --- | --- |
| Product | PRDs, notes, interviews | features, risks, decisions, dependencies, contradictions | roadmap timeline, ticket batch, stakeholder deck |
| Engineering | ADRs, arch notes, incident notes | systems, APIs, dependencies, decisions, drift | ADR generator + decision log, living diagram, runbook exporter |
| Research | papers, excerpts, hypotheses, notes | claims/evidence tables, contradictions, citations | literature matrix, paper outline, figure/table generator |
| Marketing/Comms | brand docs, drafts, campaign ideas | voice consistency, message map, audience fit | campaign kit exporter, content repurposer, brand voice lint |
| Creator/Studio | scripts, outlines, assets | structure, beats, hooks, reuse | shot list/storyboard, publishing calendar, audio pipeline (later) |
| Personal | journaling, planning, learning | themes, values, commitments, people | weekly review, goal map + decision log, life timeline |

Delivered through the project type picker plus AI Template Builder.
Key: keep the same core UI; change the registry + default artifact tabs + widget menu.

## Market Research Plan (De-risk the wedge)

1) **One-sentence core loop per pack**
   - "I dump messy stuff into the canvas -> Rhei gives me structure -> I ship output X."
   - If it cannot fit, the pack is not ready.

2) **12 structured interviews**
   - 3 personas x 4 interviews: Product, Research, Engineering.
   - Ask: current stack, what breaks at scale, weekly repeats, where AI helps vs annoys, what they would pay for.

3) **Wizard-of-Oz test**
   - Simulate the widget pipeline manually.
   - Show artifact panel + receipts.
   - Measure trust and reduction of real work.

4) **North-star metric**
   - Structured outputs shipped per week.
   - Examples: approved Knowledge PRs, artifacts created + reused, exports generated.

## Implementation Map (File Paths Overview)

+-----------------------------------------------+---------------------------------------+
| Area                                          | Files                                 |
+-----------------------------------------------+---------------------------------------+
| Widgets execution + trails (receipts)         | muse/convex/ai/widgets/runWidgetToStream.ts |
|                                               | muse/convex/widgetExecutions.ts       |
|                                               | muse/apps/*/src/components/widgets/   |
| Artifacts system + iteration                  | muse/docs/ARTIFACTS_SPEC.md           |
|                                               | muse/convex/artifacts.ts              |
|                                               | muse/packages/core/src/artifacts/engine.ts |
| Knowledge PRs + approvals + rollback          | muse/convex/knowledgeSuggestions.ts   |
|                                               | muse/apps/*/src/components/knowledge/ |
| Activity/Inbox surface                         | muse/apps/*/src/components/widgets/ActivityBell.tsx |
| Flow Mode + Dead Zone                          | muse/apps/expo/src/components/flow/   |
| Memory + Qdrant + embeddings                  | muse/convex/ai/embeddings.ts          |
|                                               | muse/convex/ai/search/*.ts            |
| MCP + citations                               | muse/packages/mcp-server/src/         |
| AI template builder                           | muse/apps/expo/src/components/projects/AITemplateBuilder/ |
|                                               | muse/apps/web/src/components/modals/TemplatePickerModal/AITemplateBuilder/ |
+-----------------------------------------------+---------------------------------------+

## Related Docs

- MLP1 Roadmap: `muse/docs/MLP1_ROADMAP.md`
- Artifacts Spec: `muse/docs/ARTIFACTS_SPEC.md`
- Proactivity Engine: `muse/docs/MLP2_PROACTIVITY_ENGINE.md`
- Coherence Spec: `muse/docs/COHERENCE_SPEC.md`
- Widgets UX Flow: `muse/docs/WIDGETS_UX_FLOW.md`
- Review Hub Spec: `muse/docs/REVIEW_HUB_SPEC.md`
- MLP1 Launch Packs: `muse/docs/MLP1_LAUNCH_PACKS.md`
