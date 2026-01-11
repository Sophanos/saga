# MLP 1: Living Memory OS

> **Last Updated:** 2026-01-10
>
> **Goal:** Turn “what the project knows” into a first-class, reviewable system: documents + project graph + pinned memories, with approval-based changes (“Knowledge PRs”) and clear provenance.

## What this is

MLP1 is building a **Living Memory OS** for a project:

- **Documents** are the narrative surface (what writers write).
- **Project Graph** (entities + relationships) is the structured surface (what the system can reason about).
- **Pinned memories** (decisions/policies) are the canonical surface (what must stay consistent).
- **Knowledge PRs** are the review surface (how changes become trusted).

This keeps the AI **silent unless invoked**, and keeps **high-impact changes reviewable**.

## Change capture → Knowledge PR (MLP1)

If a teammate says “Leader X changed”, that statement should not live only in chat. In MLP1 it must be **captured via an explicit mutation path**, for example:

- Update a node/edge in the Project Graph (entity/relationship change).
- Pin a canon memory / policy decision (Decision Ledger).
- Edit a document (writer change).

Once the change is **inside Muse**, the AI/runtime can propose follow‑up Knowledge PRs using the existing approval + `knowledgeSuggestions` flow.

### Change detection vs “change capture” (MLP1)

- MLP1 does **not** automatically notice external sources changing (Notion/Office/etc).
- A change must enter Muse (user edit, import/capture, tool call) before it can be modeled, linted, or turned into a Knowledge PR.
- Once a change is inside Muse, the system can safely propagate it through reviewable PRs (future: “Impact PRs” in MLP2).

## Review UX (“Changes to review”)

**Labeling**

- Use **“Changes to review”** for the panel header and Cmd+K command.
- Keep the editor menu item label **“Version history”** as the entry point (webview menu).

**Primary entry points (Expo Web)**

- Editor webview: More menu → **“Version history”** opens the “Changes to review” panel.
- Cmd+K: **“Changes to review”** command opens the same panel.

**What you can do**

- See a unified inbox of pending suggestions across `document` / `entity` / `relationship` / `memory`.
- Review preview/diff (where possible).
- Approve/reject single items or batch selections.
- Undo accepted graph/memory changes when rollback metadata is available.

**E2E selectors (stable hooks)**

- `knowledge-open` (editor menu item)
- `knowledge-pr-row` (list row)
- `knowledge-pr-details` (details panel)

## Provenance and audit

Every suggestion should be traceable:

- **Actor** (user vs agent)
- **Tool** + toolCallId
- **Model** + thread/stream identifiers (when available)
- **Target** (document/entity/relationship/memory identifiers)

This is required for:

- Trust (“why is the AI asking me this?”)
- Debugging (“where did this change come from?”)
- Rollback (“undo only what this approval applied”)

## Rollback / history (MLP1)

- **Graph + memory changes** can support rollback when applied via the approval runner, by storing rollback metadata alongside the suggestion result.
- **Document changes** remain editor-surface operations (apply/reject from the editor UI), so “undo” is not handled through the Knowledge PR runner in MLP1.

