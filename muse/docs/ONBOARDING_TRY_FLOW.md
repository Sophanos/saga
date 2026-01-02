# Mythos Onboarding (Landing Chat Bar → /try Trial)

This document defines a Notion+Cursor‑style onboarding flow that starts from the landing page “ChatGPT‑like” input, funnels into `/try` (anonymous trial, 5 AI calls), and prepares the product vision: **story as code → world bible → visual/manga generation → episodic/series outputs**.

Core promise for /try:
- User imports a chapter/file.
- We import it into docs.
- We auto‑build the graph and outline characters/world.
- We show Notion‑style sidebars immediately: database UI on the left, analysis/linters on the right.
- We open the floating AI bar so users can prompt against the Qdrant‑backed world context.

## User Reality (from interviews)

**What they trust and use today**
- Proofreading/grammar without meaning drift (ChatGPT/Quillbot/etc.).
- “Sorting machine”: dump text/notes → split/organize.
- Logic checks when stuck (math, biology, rule consistency).
- Name lists, occasional descriptions.

**What they avoid**
- Plot generation / letting AI “decide” story direction.
- Tools that “evaluate” or judge ideas.

**What they want**
- A “master document / artbook” per book: organized characters, locations, magic rules, timeline, etc.
- Consistency detection (eye color, timeline, lore contradictions) with explicit citations.

## Product Positioning (what onboarding must prove fast)

Mythos is **not a text generator**. It’s a **story database that organizes itself**, with optional AI assistance:
- Organize and structure drafts into chapters/scenes.
- Extract and track narrative entities (characters, places, items, factions, rules).
- Check consistency and explicit logic rules.
- Later: visual memory + entity portraits → manga/storyboard → multi-format exports.

## Current Implementation (as-is)

**Landing entry**
- File: `muse/apps/website/src/pages/LandingPage.tsx`
- Component: `FloatingChatBar()`
- Behavior: stores `sessionStorage["mythos_trial_draft"] = <text>` and redirects to `/try`.

**Trial boot**
- Route: `/try` handled in `muse/apps/web/src/App.tsx` via `AnonymousTryApp`.
- Bootstrapping: `muse/apps/web/src/hooks/useAnonymousProjectLoader.ts`
  - Creates/refreshes server anon session: `muse/apps/web/src/services/anonymousSession.ts` → edge function `muse/supabase/functions/anon-session/index.ts`
  - Sets server trial status into store: `muse/apps/web/src/stores/anonymous.ts`
  - Creates a project, and a “Getting Started” doc when no draft exists.
  - **Gap:** when `mythos_trial_draft` exists, it’s used only to name the project, then cleared; the pasted text is not imported into a document.

**5-call limit UX**
- Chat trial variant: `muse/apps/web/src/components/chat/ChatPanel.tsx`
- Limit enforcement: `muse/apps/web/src/stores/anonymous.ts` (`MAX_CHAT_MESSAGES = 5`) + server quota (anon trial migrations + billing checks).
- Prompt to save/convert: `muse/apps/web/src/components/auth/SaveWorkPrompt.tsx`

## Decision (Jan 2, 2026) — No Wizard, Inline Start

For authenticated users with **no projects**, we will **skip the full-screen project selector empty state** and show the real app shell immediately:
- **Layout stays visible** (header + manifest + canvas + console).
- **Canvas** shows an inline “Start your project” flow (Start blank / Browse templates / Create with AI).
- **Manifest** shows a Notion-style quick action list (Page / AI Notes / Database / Templates) that jumps into the inline flow.
- **Template picker modal** remains for users with existing projects (triggered from header → New Project).
- **/try** remains unchanged: anonymous entry, no wizard, quick value first.

## Proposed Onboarding (Notion+Cursor style)

### Stage A — Landing “Chat Bar” (0–20s, no AI cost)

Goal: capture intent without friction and carry it into `/try` reliably.

**A1. Keep the ChatGPT-like bar. Add “Goal chips” (optional, single-select)**
- Import & organize (default)
- Proofread (no rewrite)
- Sort notes into world bible
- Consistency check
- Name generator
- Visualize characters (beta)

**A2. Auto-suggest a default goal (heuristics only, no AI calls)**
- Long prose → Import & organize
- Bullets/short fragments → Sort notes
- “grammar/spelling” terms → Proofread
- “name list” terms → Name generator

**A3. Store a single payload (instead of only a raw draft)**
- New key: `sessionStorage["mythos_trial_payload"]`
- Example:
```json
{
  "v": 1,
  "source": "paste",
  "goal": "import_organize",
  "tone": "safe",
  "text": "…"
}
```

**Why this matters**
- Avoids burning the 5-call budget on intent detection.
- Preserves trust (“you choose what AI does”).
- Prevents abuse (landing page doesn’t become a free AI endpoint).

### Stage B — /try First Minute (20–90s, show value fast)

Goal: the user sees their content in the editor and understands “story as code” immediately.

**B1. Always create 2 docs**
- “Welcome / Quick Start” (Notion checklist style)
- “Imported Draft” (from pasted text or file import)

**B2. Import pasted text or files using existing import pipeline**
- Use `muse/apps/web/src/services/import/` (plaintext/docx/epub/md/pdf → IR → TipTap).
- If headings are detected, split into chapters/scenes (already supported in `importStory()`).

**B3. Auto‑run analysis on import (explicitly allowed)**
- On first import, automatically run:
  - Entity extraction → populate Characters/Locations/Items.
  - Outline generation (chapter/scene summary).
  - Consistency scan (lightweight).
- These actions consume trial quota; show a small “Trial usage” toast.

**B4. Open the AI floating bar (Notion‑style)**
- Show the floating AI panel on first load, with a short greeting:
  - “I can answer based on your imported chapter + world database.”
- Prefill a contextual prompt, but do not auto‑send (user controls trial usage).

**B5. Prefill (but do not auto-send) the first chat prompt**
- Where: `muse/apps/web/src/components/chat/ChatPanel.tsx` (trial variant)
- Behavior: show a suggested prompt + “Send” button. User chooses to spend more of the 5 calls.

Prompt templates (trust-first):
- Proofread: “Fix spelling/grammar without changing meaning. Output suggestions, not a rewrite.”
- Organize: “Split into chapters/scenes and propose an outline. Don’t invent plot.”
- World bible: “Extract entities and propose a world bible structure. No judgement.”
- Consistency: “Flag contradictions with quoted evidence only.”

**B6. Make the Welcome doc the “activation checklist”**
Example tasks (each maps to existing UI):
1) “Your text is in the editor”
2) “Entities detected + World Graph updated”
3) “Outline generated from your chapter”
4) “Consistency scan completed”
5) “(Optional) Generate 20 names / portrait”

### Stage C — Post-signup onboarding (optional, 3–5 min, deeper personalization)

Goal: set durable preferences and align with the long-term vision (world → visuals → series).

**C1. Project type**
- Novel / Series / Screenplay / Game / World bible / Manga pipeline

**C2. What to track (multi-select)**
- Characters, Locations, Items, Factions, Magic system, Timeline, Relationships

**C3. Guardrails (trust settings)**
- Plot generation: Off / Suggestions only / On
- Edits: Proofread only / Line edits / Rewrite
- Consistency strictness: Low / Medium / High
- “Idea inbox”: No‑judgement mode on/off

**C4. Output ambitions (optional)**
- Just writing
- Visual bible / manga reference
- Episodic / series adaptation

## Key Tradeoffs (options + pros/cons)

**Goal chips vs AI intent detect**
- Chips: predictable, trust-preserving, no trial cost; slightly more UI.
- AI detect: “magic” but consumes trial budget and can misclassify → trust loss.

**Auto-run entity detection**
- Auto (selected): immediate wow, but uses trial quota.
- Mitigation: show a tiny “Trial usage” chip + allow re-run manually.

**Wizard overlay vs Welcome document**
- Overlay: guaranteed completion; higher friction.
- Welcome doc (recommended): Notion-like, persistent “master document” framing.

## Implementation Touchpoints (files to change)

Landing / payload:
- `muse/apps/website/src/pages/LandingPage.tsx` (store `mythos_trial_payload`, add goal chips + heuristics)

Trial boot + doc creation:
- `muse/apps/web/src/hooks/useAnonymousProjectLoader.ts` (read payload; create “Imported Draft” document using import utilities)
- `muse/apps/web/src/stores/anonymous.ts` (persist onboarding selections + “seenWelcome” flags if needed)

Chat prefill + floating panel:
- `muse/apps/web/src/components/chat/ChatPanel.tsx` (show suggested prompt based on payload/goal)
- `muse/apps/web/src/components/Layout.tsx` (ensure floating chat is visible on first load)

Import pipeline (reuse, don’t reinvent):
- `muse/apps/web/src/services/import/index.ts`
- `muse/apps/web/src/services/import/parsers/plaintext.ts`

Trial quota + session:
- `muse/apps/web/src/services/anonymousSession.ts` (anon token, session init)
- `muse/supabase/functions/anon-session/index.ts` (server session/quota)

Auto‑analysis + graph/outline hooks (to add if missing):
- `muse/apps/web/src/hooks/useAnonymousProjectLoader.ts` (trigger analysis after import)
- `muse/apps/web/src/hooks/useStreamingEntityDetection.ts` or AI executors
- Linter/Coach/Meters views already live in:
  - `muse/apps/web/src/components/console/LinterView.tsx`
  - `muse/apps/web/src/components/console/CoachView.tsx`
  - `muse/apps/web/src/components/console/AnalysisDashboard.tsx`
  - `muse/apps/web/src/components/manifest/Manifest.tsx`

## Success Metrics (for go-to-market)

Activation (first session):
- User sees their pasted text in the editor within 10 seconds.
- User completes 2 checklist items (create an entity, run a safe check).

Conversion:
- Trial exhaustion screen → signup click-through.
- % of users who migrate anonymous data on signup.

Trust:
- Low complaint rate about “AI changed my meaning.”
- High engagement with “consistency/logic” actions vs plot generation.
