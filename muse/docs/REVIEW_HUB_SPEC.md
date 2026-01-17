# Inbox Spec (Pulse + Changes + Activity + Artifacts)

> Goal: one calm, centralized surface for everything that needs attention.
> Positioning: Agents execute. Rhei remembers.
> Pattern: Cursor-style unified panel with section headers.

## What Inbox Is (and Isn't)

**Inbox = "What needs attention now"**
- Single overlay panel, not a full page
- Mixed items in one scrollable view (All) or filtered by tab
- Pull-based: user opens it when ready, no popups

**Inbox ≠ History**
- History lives elsewhere:
  - Knowledge PRs (past approvals, rollbacks) — backend term
  - Activity Log (event trail)
  - Artifact versions
- Could add "History" filter later, but keep Inbox focused on current attention

## Naming

| Concept | UI Label | Backend Term |
|---------|----------|--------------|
| The panel | **Inbox** | — |
| Ambient signals | **Pulse** | `pulseSignals` |
| Governed mutations | **Changes** | `knowledgeSuggestions` (Knowledge PRs) |
| Async job results | **Activity** | `widgetExecutions`, `activityLog` |
| Living outputs | **Artifacts** | `artifacts`, `artifactVersions` |

## Core Rules

- **No popups** during Flow Mode.
- **One entry point**: bell icon opens Inbox.
- **Default tab = Activity** (matches bell mental model: "what just happened?").
- **All view = primary**: shows all sections, Pulse first.
- **Tabs filter**, they don't navigate to separate views.
- **Everything is actionable**: signal → action → trail.

## Tab Structure

| Tab | Shows | Badge |
|-----|-------|-------|
| **All** | All sections grouped | Total unread count |
| **Pulse** | Ambient signals only | Pulse count |
| **Changes** | Knowledge PRs only | Pending PR count |
| **Activity** | Async job results only | Recent completions |
| **Artifacts** | Stale/updated artifacts | Stale count |

## Entry Points

| Trigger | Opens | Default Tab |
|---------|-------|-------------|
| **Bell icon** (primary) | Inbox | Activity |
| **Pulse badge** (if shown) | Inbox | Pulse |
| **Cmd+K → "Open Inbox"** | Inbox | Last active or All |

## Layout (Overlay Panel)

```
┌─────────────────────────────────────┐
│ 🔔 Inbox                    [Close] │
├─────────────────────────────────────┤
│ All │ Pulse 3 │ Changes 2 │ Activity │ Artifacts │
├─────────────────────────────────────┤
│                                     │
│ Pulse                               │  ← section header (collapsible)
│ ┌─────────────────────────────────┐ │
│ │ ● "Marcus" entity detected      │ │
│ │   Chapter 3         [Review →]  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ● Voice drift: 15% off          │ │
│ │   Scene 4           [Review →]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Changes                    [2 PRs]  │  ← section header
│ ┌─────────────────────────────────┐ │
│ │ ○ Update: Marcus age 32→35      │ │
│ │   Entity change     [Approve]   │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ○ New relationship: Marcus→Aria │ │
│ │   Edge addition     [Approve]   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Activity                            │  ← section header
│ ┌─────────────────────────────────┐ │
│ │ ✓ Timeline generated · 2m ago   │ │
│ │   Widget            [Open →]    │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ⏳ Research task running...     │ │
│ │   Sub-agent         [View]      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Artifacts                  [1 stale]│  ← section header
│ ┌─────────────────────────────────┐ │
│ │ ⚠ Character list outdated       │ │
│ │   Last sync: 3d     [Refresh]   │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

## Section Behavior

- **Sections collapse** when empty (no empty state noise)
- **Section headers** show count and optional bulk action
- **Items** have: icon, title, context line, inline action
- **Status indicators**: ● new, ○ pending, ✓ done, ⏳ running, ⚠ stale

## Item Actions by Type

| Type | Primary Action | Secondary |
|------|----------------|-----------|
| **Pulse signal** | Review → | Dismiss |
| **Change (PR)** | Approve | Reject, View diff |
| **Activity (done)** | Open result → | Dismiss |
| **Activity (running)** | View progress | Cancel |
| **Artifact (stale)** | Refresh | Open, Ignore |

## State Rules

- **Pulse**: signals are read-only until acted on. Dismiss allowed.
- **Changes**: all mutations require explicit approval. Never auto-apply.
- **Activity**: shows execution lifecycle (queued → running → done/failed).
- **Artifacts**: shows staleness and source lineage. No auto-refresh.

## Flow

1. User works in Flow Mode (undisturbed).
2. Background: Muse generates signals, PRs, job results.
3. Bell icon shows badge count.
4. User clicks bell → Inbox opens (default: Activity tab).
5. User reviews, approves/dismisses, opens results.
6. Every action leaves a trail (receipts + rollback).

## Interaction: Expand to Detail

For complex items (diffs, version history), clicking "View diff" or "Open" can:
- Expand inline (accordion style), OR
- Open a detail modal/sheet

Keep the Inbox as the hub; details are one click away, not a separate route.

## Data Sources (Backend)

| Section | Table | Query |
|---------|-------|-------|
| Pulse | `pulseSignals` | `convex/pulse.ts:listByProject` |
| Changes | `knowledgeSuggestions` | `convex/knowledgeSuggestions.ts` |
| Activity | `widgetExecutions` | `convex/inbox.ts:getInboxData` |
| Artifacts | `artifacts` | `convex/inbox.ts:getInboxData` |
| **Unified** | all | `convex/inbox.ts:getInboxData`, `getInboxCounts` |

## File Map

| Area | Files |
|------|-------|
| **State** | |
| Inbox store | `packages/state/src/inbox.ts` |
| History store | `packages/state/src/history.ts` |
| Exports | `packages/state/src/index.ts` |
| **Convex** | |
| Schema (pulseSignals) | `convex/schema.ts` |
| Pulse API | `convex/pulse.ts` |
| Unified inbox query | `convex/inbox.ts` |
| **Web UI** | |
| Main panel | `apps/web/src/components/inbox/Inbox.tsx` |
| Bell trigger | `apps/web/src/components/inbox/InboxBell.tsx` |
| Tabs | `apps/web/src/components/inbox/InboxTabs.tsx` |
| Sections | `apps/web/src/components/inbox/InboxSection.tsx` |
| Item rows | `apps/web/src/components/inbox/InboxItem.tsx` |
| Empty states | `apps/web/src/components/inbox/InboxEmptyState.tsx` |
| History panel | `apps/web/src/components/inbox/history/HistoryPanel.tsx` |
| Data hook | `apps/web/src/components/inbox/useInboxData.ts` |
| **Expo UI** | |
| All components | `apps/expo/src/components/inbox/` (mirrors web) |
| **Consumers** | |
| Web header | `apps/web/src/components/Header.tsx` → `InboxBell` |
| Expo shell | `apps/expo/src/components/layout/AppShell.tsx` → `InboxBell` |

## Migration Notes

- ~~ActivityBell.tsx~~ → `InboxBell` from `@/components/inbox`
- Deprecation aliases in `apps/expo/src/components/widgets/index.ts`
- Old `ActivityBell`/`ActivityInbox` exports still work (deprecated)
