# Widgets MVP1 Implementation Plan (Execution-Ready)

> Last updated: 2026-01-11  
> Source of truth: `muse/docs/WIDGETS.md`, `muse/docs/WIDGETS_UX_FLOW.md`

This document turns the Widgets MVP1 spec into an execution-ready engineering plan across Convex + Web + Expo, with explicit file paths, data shapes, and integration points. It also includes a **MVP1.5** step for **durable async workflows + cross-platform notifications** using Convex components.

---

## 0) MVP1 Contract (Non-Negotiables)

**Entry points**
- `/` in editor (TipTap slash menu) and `Cmd+K` (global command palette) share the same widget set + recents.
- Unknown command fallback: **Ask AI: "{query}"**.

**Execution pipeline**
`invoke → gather → stream progress → preview (governance) → confirm → apply (inline) OR create artifact`

**Governance + receipts**
- The **preview modal is the approval boundary**; nothing writes before confirm.
- Every artifact ships with a minimal **manifest receipts block** (collapsed by default).
- MVP1 widgets **do not mutate entities**.

**MVP1 scope constraints**
- Text-only artifacts.
- No refinement loop.
- No automation (/watch) in MVP1.

---

## 0.5) Implementation Update (2026-01-11)

Implemented now (scaffold + working wedge):
- Capability system: `widget` kind + `slash_menu` surface + MVP1 widget registry entries in `muse/packages/capabilities/src/types.ts` and `muse/packages/capabilities/src/registry.ts`.
- Shared contract: widget execution types in `muse/packages/agent-protocol/src/widgets.ts`.
- Convex schema: `widgetExecutions`, `artifacts`, and `artifactVersions` added in `muse/convex/schema.ts`.
- Server registry + execution: `muse/convex/ai/widgets/registry.ts` + `muse/convex/ai/widgets/runWidgetToStream.ts` (server-authoritative prompts + streamed output).
- HTTP streaming: `/ai/widgets` SSE route in `muse/convex/http.ts`.
- Web UI wedge:
  - Cmd+K widget filter + per-project recents + Ask AI fallback (`muse/apps/web/src/stores/commandPalette.ts`, `muse/apps/web/src/components/command-palette/CommandPalette.tsx`).
  - Widget commands derived from capabilities (`muse/apps/web/src/commands/widget-commands.ts`).
  - Widget execution store + SSE client (`muse/apps/web/src/stores/widgetExecution.ts`, `muse/apps/web/src/services/ai/widgetClient.ts`).
  - Progress tile + preview modal + receipts block (`muse/apps/web/src/components/widgets/*`).
  - Slash menu wiring for widgets + Ask AI fallback (`muse/apps/web/src/components/canvas/Canvas.tsx` + `muse/packages/editor/src/extensions/slash-command.ts`).
  - Inline apply markers + applied highlight + apply helper (`muse/packages/editor/src/extensions/execution-marker.ts`, `muse/packages/editor/src/extensions/applied-highlight.ts`, `muse/apps/web/src/lib/widgets/applyInlineWidget.ts`).
  - Receipts source picker + manual add/remove wiring (`muse/apps/web/src/components/widgets/SourcePickerModal.tsx`, `muse/apps/web/src/components/widgets/ReceiptsBlock.tsx`).
  - Artifacts list/detail view (web) with staleness badges (`muse/apps/web/src/components/artifacts/ArtifactsView.tsx`, `muse/apps/web/src/components/canvas/Canvas.tsx`, `muse/apps/web/src/commands/navigation-commands.ts`).

Still pending (planned):
- Inline revert UI (markers exist; add hover + revert action).
- Regenerate same inputs + diff preview (Convex + UI).
- Staleness badges on list rows + regenerate flow UI.
- Expo artifact widget flow (view/list/receipts).
- MVP1.5 notifications + durable async jobs.

---

## 1) Architecture Decisions (Socratic, then locked-in)

1) **Where is the source of truth for widget prompts/models?**  
**Server.** Client sends `widgetId + inputs`; server resolves prompt/model/version from an allowlist registry.

2) **Where is the approval boundary?**  
**Client preview modal.** Backend produces preview output; client confirms writes (inline insert or artifact create).

3) **How do we avoid divergent implementations across / and Cmd+K?**  
Single client execution controller (`widgetExecution` store) used by both surfaces.

4) **How do we stream progress consistently with existing AI streaming?**  
Reuse `generationStreams` + `convex/ai/streams.ts` chunk persistence (`context`/`delta`/`error`/`done`).

5) **How do we future-proof for async + notifications?**  
Design widget runs as a durable job (Workpool/Workflow) that can later complete out-of-band and notify.

---

## 2) Shared Types & Contracts (Packages)

### 2.1 Capability system: add `widget` kind + `slash_menu` surface

Files:
- `muse/packages/capabilities/src/types.ts`
- `muse/packages/capabilities/src/registry.ts`
- `muse/packages/capabilities/src/index.ts`

Changes:
- Extend `CapabilitySurface`:
  ```ts
  export type CapabilitySurface = "quick_actions" | "command_palette" | "chat" | "slash_menu";
  ```
- Extend `CapabilityKind`:
  ```ts
  export type CapabilityKind = "tool" | "chat_prompt" | "ui" | "widget";
  ```
- Add serializable widget types (UI-friendly; server remains authoritative):
  ```ts
  export type WidgetType = "inline" | "artifact";

  export type PromptVariableType = "string" | "entity" | "selection" | "document";
  export interface PromptVariable {
    name: string;
    type: PromptVariableType;
    required: boolean;
    description?: string;
  }

  export interface StructuredPrompt {
    system: string;
    user: string;
    variables: PromptVariable[];
  }

  export type WidgetParam =
    | { name: string; type: "enum"; options: string[]; default?: string }
    | { name: string; type: "string"; default?: string };

  export interface WidgetCapability extends CapabilityBase {
    kind: "widget";
    widgetType: WidgetType;
    prompt: StructuredPrompt;
    defaultModel: string;
    contextBudget: "adaptive" | number;
    clarifyOnAmbiguity: boolean;
    costWeight: number;
    parameters?: WidgetParam[];
    outputSchemaId?: string;
  }
  ```
- Add `isWidgetCapability()` guard.
- Add MVP1 widget capability entries to `muse/packages/capabilities/src/registry.ts` (IDs like `widget.summarize`, `widget.create-spec`) with `surfaces: ["slash_menu","command_palette"]`.

### 2.2 Widget execution contract (client ↔ Convex)

File:
- `muse/packages/agent-protocol/src/widgets.ts` (new)
- `muse/packages/agent-protocol/src/index.ts` (export)

Contract types (minimal, serializable):
```ts
export type WidgetExecutionStatus =
  | "idle"
  | "gathering"
  | "clarifying"
  | "generating"
  | "formatting"
  | "preview"
  | "applying"
  | "done"
  | "error";

export interface WidgetInvokeRequest {
  widgetId: string;
  projectId: string;
  documentId?: string;
  selectionText?: string;
  selectionRange?: { from: number; to: number };
  parameters?: Record<string, unknown>;
}

export type ArtifactSourceType = "document" | "entity" | "memory";

export interface ArtifactSourceRef {
  type: ArtifactSourceType;
  id: string;
  title?: string;
  manual: boolean;
  addedAt: number;
  sourceUpdatedAt?: number;
}

export interface ArtifactManifestDraft {
  type: string; // "spec" | "brief" | ...
  status: "draft" | "manually_modified";
  sources: ArtifactSourceRef[];
  createdBy: string;
  createdAt: number;
  executionContext: {
    widgetId: string;
    widgetVersion: string;
    model: string;
    inputs: Record<string, unknown>;
    startedAt: number;
    completedAt?: number;
  };
}

export interface WidgetExecutionResult {
  executionId: string;
  widgetId: string;
  widgetType: "inline" | "artifact";
  model: string;
  output: string;
  titleSuggestion?: string;
  manifestDraft?: ArtifactManifestDraft;
}
```

---

## 3) Backend (Convex): Schema + Execution + Artifacts + Receipts

### 3.1 Schema additions

File:
- `muse/convex/schema.ts`

Add tables (MVP1 minimum):
- `widgetExecutions` (audit trail + recents + regeneration inputs)
- `artifacts` (stored output + receipts)
- `artifactVersions` (version history for regeneration + diff preview)

Proposed schema shapes (validators abbreviated for readability; implement with `v.*`):

**`widgetExecutions`**
```ts
widgetExecutions: defineTable({
  projectId: v.id("projects"),
  userId: v.string(),
  widgetId: v.string(),
  widgetVersion: v.string(),
  widgetType: v.union(v.literal("inline"), v.literal("artifact")),
  documentId: v.optional(v.id("documents")),
  selectionText: v.optional(v.string()),
  selectionRange: v.optional(v.object({ from: v.number(), to: v.number() })),
  parameters: v.optional(v.any()),
  status: v.string(),
  model: v.optional(v.string()),
  output: v.optional(v.string()),
  sources: v.array(v.object({
    type: v.union(v.literal("document"), v.literal("entity"), v.literal("memory")),
    id: v.string(),
    title: v.optional(v.string()),
    manual: v.boolean(),
    addedAt: v.number(),
    sourceUpdatedAt: v.optional(v.number()),
  })),
  error: v.optional(v.string()),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_project_startedAt", ["projectId", "startedAt"])
  .index("by_project_widget", ["projectId", "widgetId"])
  .index("by_project_user", ["projectId", "userId"]);
```

**`artifacts`**
```ts
artifacts: defineTable({
  projectId: v.id("projects"),
  createdBy: v.string(),
  type: v.string(),
  status: v.union(v.literal("draft"), v.literal("manually_modified")),
  title: v.string(),
  content: v.string(),
  sources: v.array(/* same shape as widgetExecutions.sources */),
  executionContext: v.object({
    widgetId: v.string(),
    widgetVersion: v.string(),
    model: v.string(),
    inputs: v.any(),
    startedAt: v.number(),
    completedAt: v.number(),
  }),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_project_updatedAt", ["projectId", "updatedAt"])
  .index("by_project_status", ["projectId", "status"])
  .index("by_project_type", ["projectId", "type"]);
```

**`artifactVersions`**
```ts
artifactVersions: defineTable({
  projectId: v.id("projects"),
  artifactId: v.id("artifacts"),
  version: v.number(),
  content: v.string(),
  sources: v.array(/* same shape */),
  executionContext: v.optional(v.any()),
  createdAt: v.number(),
})
  .index("by_artifact_version", ["artifactId", "version"])
  .index("by_project_createdAt", ["projectId", "createdAt"]);
```

### 3.2 Server-authoritative widget registry (allowlist)

New file:
- `muse/convex/ai/widgets/registry.ts`

```ts
export interface ServerWidgetDef {
  id: string;
  version: string;
  widgetType: "inline" | "artifact";
  artifactType?: string;
  defaultModel: string;
  costWeight: number;
  contextBudget: "adaptive" | number;
  clarifyOnAmbiguity: boolean;
  requiresSelection: boolean;
  prompt: { system: string; user: string };
  outputSchemaId?: string;
}

export function getServerWidgetDef(widgetId: string): ServerWidgetDef {
  // Map lookup + throw on unknown
}
```

Rule: **never accept prompt templates from client** (only `widgetId + inputs`).

### 3.3 Widget execution action (preview generation → stream)

New file:
- `muse/convex/ai/widgets/runWidgetToStream.ts`

Action signature (uses existing `generationStreams` infra):
```ts
export const runWidgetToStream = internalAction({
  args: {
    streamId: v.string(),
    projectId: v.id("projects"),
    userId: v.string(),
    widgetId: v.string(),
    documentId: v.optional(v.id("documents")),
    selectionText: v.optional(v.string()),
    selectionRange: v.optional(v.object({ from: v.number(), to: v.number() })),
    parameters: v.optional(v.any()),
  },
  handler: async (ctx, args) => { /* ... */ },
});
```

Implementation notes:
- Emit stage updates via `internal["ai/streams"].appendChunk` with `{ type: "context", data: { stage: "gathering" } }`.
- Generate output using the same model plumbing as `muse/convex/ai/agentRuntime.ts` (OpenRouter + streaming).
- Store final output on the `widgetExecutions` record, and call `internal["ai/streams"].complete` with `{ result: { executionId } }`.
- **Do not create artifacts here**; creation happens only on confirm mutation.

### 3.4 Clarify-on-ambiguity (resume)

New file:
- `muse/convex/ai/widgets/resumeWidgetToStream.ts`

```ts
export const resumeWidgetToStream = internalAction({
  args: {
    streamId: v.string(),
    executionId: v.id("widgetExecutions"),
    clarification: v.any(),
  },
  handler: async (ctx, args) => { /* resume from stored inputs */ },
});
```

### 3.5 Artifact create on confirm (writes receipts)

New file:
- `muse/convex/artifacts/createFromExecution.ts`

```ts
export const createFromExecution = mutation({
  args: {
    projectId: v.id("projects"),
    executionId: v.id("widgetExecutions"),
    title: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => { /* insert artifacts + artifactVersions v1 */ },
});
```

### 3.6 Manual source tagging (manifest-only; no entity mutation)

New file:
- `muse/convex/artifacts/updateSources.ts`

```ts
export const updateSources = mutation({
  args: {
    artifactId: v.id("artifacts"),
    add: v.optional(v.array(v.object({ type: v.string(), id: v.string() }))),
    remove: v.optional(v.array(v.object({ type: v.string(), id: v.string() }))),
  },
  handler: async (ctx, args) => { /* resolve title + snapshot updatedAt */ },
});
```

### 3.7 Staleness check

New file:
- `muse/convex/artifacts/checkStaleness.ts`

```ts
export type ArtifactStaleness = "fresh" | "stale" | "missing";

export const checkStaleness = query({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, args) => { /* compare sources[].sourceUpdatedAt */ },
});
```

### 3.8 Regeneration (same inputs) + diff preview (MVP1 “same-input regenerate” only)

New files:
- `muse/convex/artifacts/regenerateSameInputsToStream.ts` (action; generates preview)
- `muse/convex/artifacts/applyRegeneration.ts` (mutation; writes new artifactVersions + updates artifact content)

---

## 4) Web UI (apps/web): Commands + Execution Store + Modal UX

### 4.1 Command palette: add Widget filter + Ask AI fallback

Files:
- `muse/apps/web/src/stores/commandPalette.ts`
- `muse/apps/web/src/components/command-palette/CommandPalette.tsx`
- `muse/apps/web/src/commands/registry.ts`
- `muse/apps/web/src/commands/ai-commands.ts`

Changes:
- Extend categories/filters:
  - `CommandCategory`: add `"widget"`.
  - `CommandPaletteFilter`: add `"widget"`.
- Per-project recents:
  - Replace `recentCommandIds: string[]` with `recentByProjectId: Record<string, string[]>`.
  - Add `addRecentCommand(projectId: string, id: string)`.
  - Keep `persist(partialize)` storing only recents.
- “Ask AI: {query}” fallback item when no results:
  - If selection exists → invoke a widget-like one-shot inline run.
  - If no selection → open chat tab and prefill prompt.

### 4.2 Widget commands derived from capabilities (separate from AI commands)

New file:
- `muse/apps/web/src/commands/widget-commands.ts`

Responsibilities:
- `getCapabilitiesForSurface("command_palette")`
- filter `isWidgetCapability`
- map to `Command` with `category: "widget"`
- `execute` routes into `useWidgetExecutionStore.getState().start(req)`

Register alongside existing command sets in `muse/apps/web/src/commands/index.ts` (or wherever `commandRegistry.registerMany(...)` occurs).

### 4.3 Widget execution store (single controller for / + Cmd+K)

New file:
- `muse/apps/web/src/stores/widgetExecution.ts`

Core state:
```ts
interface WidgetExecutionState {
  status: WidgetExecutionStatus;
  streamId: string | null;
  executionId: string | null;
  currentWidgetId: string | null;
  widgetType: "inline" | "artifact" | null;
  inputs: Record<string, unknown>;
  selection: { from: number; to: number; text?: string } | null;
  previewContent: string | null;
  title: string;
  manifestDraft: ArtifactManifestDraft | null;
  error: { message: string; stage?: string } | null;
}
```

Core actions:
- `start(req: WidgetInvokeRequest): Promise<void>` (create stream, call Convex action, subscribe to `ai/streams.watch`)
- `onStreamChunk(chunk: StreamChunk): void` (update status/output/log)
- `confirmInlineApply(): Promise<void>` (insert + marker + highlight)
- `confirmCreateArtifact(): Promise<{ artifactId: string }>` (mutation createFromExecution)
- `cancel(): void` (stop watching stream; never writes)
- `discardOutput(): void` (Cmd+Esc / double-Esc)

### 4.4 Progress tile (stream-driven)

New file:
- `muse/apps/web/src/components/widgets/WidgetProgressTile.tsx`

Render stages: `Gathering → Generating → Formatting`, expandable details, Cancel.

### 4.5 Preview modal (governance boundary)

New file:
- `muse/apps/web/src/components/widgets/WidgetPreviewModal.tsx`

MVP1 behaviors:
- Truncate long content (2000+ words) with “Show full preview”.
- Inline widgets: CTA “Insert …”.
- Artifact widgets: editable title (max 100 chars), CTA “Create …”.
- Escape behavior: prompt discard if content exists; Cmd+Esc forces close.

### 4.6 Receipts UI + Source picker

New files:
- `muse/apps/web/src/components/widgets/ReceiptsBlock.tsx`
- `muse/apps/web/src/components/widgets/SourcePickerModal.tsx`

ReceiptsBlock:
- Show “No sources” if empty
- Group sources by type, show manual badges + timestamps
- Staleness badges: “May be stale” vs “Source missing”
- Actions: Add sources, Remove source, Re-run same inputs (MVP1)

---

## 5) Editor Integration (packages/editor + editor-webview)

### 5.1 Execution marker (durable, project-scoped)

New file:
- `muse/packages/editor/src/extensions/execution-marker.ts`

Mark attrs:
- `executionId: string`
- `widgetId: string`
- `projectId: string`

Rules:
- Preserve within-project copy/paste.
- Strip mark on cross-project paste (`transformPasted`).

### 5.2 Applied highlight (ephemeral)

New file:
- `muse/packages/editor/src/extensions/applied-highlight.ts`

Decorations that fade after 3–5 seconds.

### 5.3 Revert action (MVP1 pragmatic)

Approach:
- At confirm, store `{ originalText, appliedText }` on `widgetExecutions` (optional MVP1 field).
- Revert UI reads execution + replaces marked range with originalText.

Integration helper:
- `muse/apps/web/src/lib/widgets/applyInlineWidget.ts` (new)

---

## 6) Slash Menu Integration (/)

Files:
- `muse/packages/editor/src/extensions/slash-command.ts`
- `muse/packages/editor-webview/src/components/SlashCommandMenu.tsx`
- Web listener location: `muse/packages/editor-webview/src/components/EditorShell.tsx` (or wherever events are handled)

Changes:
- Inject widget items into the slash command item list (category “Widgets” + “Create” + “Recent”).
- Item action dispatches:
  - `editor:invoke-widget` with `{ widgetId, selectionText, selectionRange }`
  - `editor:ask-ai` fallback with `{ query, selectionText? }`
- Web app listens and calls `useWidgetExecutionStore.getState().start(...)`.

---

## 7) Expo (apps/expo): MVP1 artifact flow first

MVP1 Expo focus:
- Artifacts list + viewer + receipts + staleness
- “Create …” artifact widgets (spec/brief/notes/release-notes)

Files (example placements; adjust to existing nav):
- `muse/apps/expo/app/(tabs)/artifacts.tsx` (route)
- `muse/apps/expo/src/components/widgets/WidgetProgressScreen.tsx`
- `muse/apps/expo/src/components/widgets/WidgetPreviewScreen.tsx`
- `muse/apps/expo/src/components/widgets/ReceiptsBlock.tsx`

Inline selection widgets on mobile:
- Defer until editor selection replacement + marker support exists; keep `selectionRange?` optional in the shared contract.

---

## 8) MVP1.5: Durable Async + Cross-Platform Notifications (Convex Components)

Goal: make widget jobs safe to run in the background (slow models, long documents, scheduled runs), with consistent notifications on completion.

### 8.1 Data model (tokens + preferences + inbox)

File:
- `muse/convex/schema.ts`

Add:
- `notificationPreferences` (per user/project toggles)
- `deviceTokens` (mobile Expo push tokens; if you adopt the Expo component, it can own storage instead)
- `webPushSubscriptions` (browser push subscription JSON)
- `notificationInbox` (in-app notifications history)

### 8.2 Work execution: Workpool/Workflow wrapper

Files:
- `muse/convex/convex.config.ts` (add component registrations)
- `muse/convex/notifications/workpool.ts` (component wrapper)
- `muse/convex/ai/widgets/runWidgetJob.ts` (durable job entry)

Approach:
- Use **Workpool** for bounded parallelism + retries (idempotent steps only).
- Use **Workflow** when widget execution becomes multi-step (gather → generate → format → persist).

Concrete component wiring:
```ts
// muse/convex/convex.config.ts
import workpool from "@convex-dev/workpool/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import pushNotifications from "@convex-dev/expo-push-notifications/convex.config.js";

const app = defineApp();
// existing components...
app.use(pushNotifications);
app.use(workpool, { name: "widgetWorkpool" });
app.use(workflow, { name: "widgetWorkflow" });
export default app;
```

Contract:
- `enqueueWidgetRun(...)` schedules `internal.ai.widgets.runWidgetJob` and returns a `workId`.
- UI can read work status reactively (`pool.status(workId)`), and fall back to push notifications.

### 8.3 Notification senders (platform-specific)

**Mobile (Expo)**
- Use the official Convex component: `@convex-dev/expo-push-notifications`.
- Register token:
  ```ts
  // muse/convex/notifications/expoPush.ts
  import { PushNotifications } from "@convex-dev/expo-push-notifications";
  import { components } from "../_generated/api";

  const pushNotifications = new PushNotifications(components.pushNotifications);
  ```
  ```ts
  export const recordExpoPushToken = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
      const userId = /* get auth user id */;
      await pushNotifications.recordToken(ctx, { userId, pushToken: args.token });
    },
  });
  ```
- Send on artifact completion:
  ```ts
  await pushNotifications.sendPushNotification(ctx, {
    userId,
    notification: { title: "Artifact ready", body: artifact.title },
  });
  ```

**Web**
- Recommended MVP1.5 path: **browser-native Web Push (VAPID)** (no vendor lock-in).
  - Store `PushSubscriptionJSON` per user:
    - `registerWebPushSubscription(subscriptionJson)`
    - `unregisterWebPushSubscription(endpoint)`
  - Send from a Convex **action** (network call) with env vars:
    - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  - File: `muse/convex/notifications/webPush.ts`
- Alternative (if you want managed delivery + dashboard):
  - **OneSignal**: store `onesignalPlayerId`, send via REST (`ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`)
  - **FCM**: store `fcmToken`, send via HTTP v1 (service account)

**Tauri**
- Local notification shown by the desktop client.
- Backend triggers via:
  - realtime signal (Convex subscription to `notificationInbox.listUnread`) OR
  - polling `notificationInbox.listUnread` on an interval.

### 8.4 Wiring: “artifact created” → notification

Integration points:
- `muse/convex/artifacts/createFromExecution.ts` (after insert) enqueue `notifyArtifactCreated(...)`
- `muse/apps/web` and `muse/apps/expo` listen for inbox updates + show toast/badge

Suggested inbox event shape:
```ts
type NotificationKind = "artifact_created" | "artifact_stale" | "job_failed";
```

### 8.5 Rollout strategy (“slowly”)

1) In-app inbox only (no push), wired to artifact create + regenerate complete.
2) Expo push for mobile (most valuable).
3) Web push (native) OR FCM/OneSignal (pick one).
4) Tauri local notifications driven by inbox polling/subscription.

---

## 9) Testing & E2E Hooks

Docs of record:
- `muse/docs/E2E_TESTABILITY_CONTRACT.md`

Minimum:
- Add stable `data-testid` for:
  - command palette widget items
  - progress tile
  - preview modal (confirm/cancel/title)
  - receipts block (add/remove sources)

Server:
- Convex unit tests for:
  - schema invariants (versioning, sources snapshot)
  - staleness logic
  - regenerate same-inputs path

---

## 10) “Done” Criteria (MVP1)

- `/` and `Cmd+K` both list widgets, show recents, and share “Ask AI” fallback.
- Widget run streams progress → preview modal → confirm writes inline or creates artifact.
- Artifacts render receipts block with manual source tagging + staleness badge.
- No entity mutations occur from widget execution in MVP1.
