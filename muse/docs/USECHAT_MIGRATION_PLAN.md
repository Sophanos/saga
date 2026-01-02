# useChat Migration Plan: useSagaAgent to AI SDK 6

> **Goal**: Migrate from custom `useSagaAgent` hook (336 lines) and `sagaClient.ts` (528 lines) to AI SDK 6's native `useChat` hook, reducing maintenance burden while maintaining full feature parity.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [API Route Changes](#2-api-route-changes)
3. [Hook Migration Strategy](#3-hook-migration-strategy)
4. [Type Safety](#4-type-safety)
5. [Tool Approval Integration](#5-tool-approval-integration)
6. [State Management](#6-state-management)
7. [Risks and Mitigations](#7-risks-and-mitigations)
8. [Implementation Phases](#8-implementation-phases)

---

## 1. Current Architecture Analysis

### 1.1 Custom Implementation Overview

| File | Lines | Responsibility |
|------|-------|----------------|
| `hooks/useSagaAgent.ts` | 336 | Hook orchestration, editor context, modes |
| `hooks/createAgentHook.ts` | 456 | Factory pattern for agent hooks |
| `services/ai/sagaClient.ts` | 528 | SSE parsing, streaming, tool execution |
| `hooks/useToolRuntime.ts` | 420 | Tool lifecycle, accept/reject/cancel/retry |
| `stores/index.ts` (chat slice) | ~200 | Message state, tool invocations |

**Total custom code: ~1,940 lines**

### 1.2 Features useChat Provides Natively

| Feature | Current Implementation | useChat Native |
|---------|----------------------|----------------|
| SSE streaming | Manual `parseSSELine()` in sagaClient | Built-in |
| Message state | Zustand `chat.messages` slice | `messages` array |
| Streaming status | `isStreaming` in Zustand | `isLoading` / `status` |
| Abort/stop | Manual `AbortController` refs | `stop()` method |
| Error handling | Custom `SagaApiError` class | `error` property |
| Append to message | `appendToChatMessage()` action | Automatic |
| Message IDs | `generateMessageId()` utility | Automatic UUID |
| Tool calls | Custom `ChatToolInvocation` | `UIToolInvocation` |
| Tool approval | `useToolRuntime` hook | `addToolApprovalResponse()` |
| Reload/retry | Not implemented | `reload()` method |
| Message editing | Not implemented | `setMessages()` |

### 1.3 Custom Features NOT Provided by useChat

These must be preserved in a wrapper hook:

| Feature | Location | Migration Strategy |
|---------|----------|-------------------|
| **Editor context injection** | `useSagaAgent.buildEditorContext()` | Pass via `body` option |
| **Saga modes** | `modeRef.current` | Pass via `body.mode` |
| **Mentions system** | `ChatMention[]` in messages | Pass via `body.mentions` |
| **Conversation ID** | `conversationIdRef.current` | Pass via `body.conversationId` |
| **RAG context display** | `onContext` callback | Custom event parsing |
| **Tool progress updates** | `onProgress` callback | Custom event parsing |
| **Project context** | `currentProject?.id` | Pass via `body.projectId` |
| **BYOK API key** | `x-openrouter-key` header | `headers` option |

### 1.4 Current Event Types (SSE)

```typescript
// Current custom events (sagaClient.ts)
type SagaStreamEventType =
  | "context"  // RAG context metadata - NOT in useChat
  | "delta"    // Text chunk - useChat handles natively
  | "tool"     // Tool call proposal - useChat handles natively
  | "progress" // Tool progress update - NOT in useChat
  | "done"     // Stream complete - useChat handles natively
  | "error";   // Error occurred - useChat handles natively
```

**Key insight**: `context` and `progress` events are custom and require special handling.

---

## 2. API Route Changes

### 2.1 Current Backend Architecture

```
Frontend (useSagaAgent)
    |
    v
Supabase Edge Function: /functions/v1/ai-saga
    |
    +--> kind: "chat" -> Streaming SSE response
    +--> kind: "execute_tool" -> Non-streaming JSON
```

### 2.2 Option A: Keep Supabase Edge Functions (Recommended)

useChat supports custom endpoints via the `api` option. The edge function needs minimal changes:

```typescript
// useChat configuration
const chat = useChat({
  api: `${SUPABASE_URL}/functions/v1/ai-saga`,
  // ...
});
```

**Required backend changes**:

1. **Response format**: Must return AI SDK-compatible streaming format
2. **Tool calls**: Use `streamText` or `generateText` with `toolChoice`
3. **Custom events**: Embed in metadata or use data stream protocol

```typescript
// Backend: ai-saga/index.ts changes
import { streamText, tool } from 'ai';
import { createDataStreamResponse } from 'ai'; // For custom events

// Current format (custom SSE):
// data: {"type":"delta","content":"Hello"}
// data: {"type":"tool","toolCallId":"xyz",...}

// AI SDK format (data stream):
// 0:"Hello"  (text delta)
// 9:{"toolCallId":"xyz",...}  (tool call)
// 8:[...]  (tool result)
```

### 2.3 Option B: Add Next.js API Route (Alternative)

If more control is needed, add a Next.js route that proxies to Supabase:

```typescript
// apps/web/src/pages/api/chat/saga.ts (if using Next.js pages)
// or apps/web/src/app/api/chat/saga/route.ts (if using App Router)

import { streamText } from 'ai';
import { openrouter } from '@ai-sdk/openrouter';

export async function POST(req: Request) {
  const { messages, projectId, mentions, editorContext, mode } = await req.json();

  // Call Supabase for RAG context
  const context = await fetchRAGContext(projectId, messages);

  const result = streamText({
    model: openrouter('anthropic/claude-3.5-sonnet'),
    messages,
    tools: sagaTools,
    // ...
  });

  return result.toDataStreamResponse();
}
```

**Recommendation**: Start with Option A (edge function changes) for simpler migration.

### 2.4 Backend Response Format Changes

The edge function must switch from custom SSE to AI SDK data stream format:

```typescript
// Current (sagaClient.ts parses this):
function sendSSE(type: string, data: unknown) {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

// New (AI SDK format):
import { createDataStream } from 'ai';

const stream = createDataStream({
  execute: async (dataStream) => {
    // RAG context (custom annotation)
    dataStream.writeMessageAnnotation({
      type: 'context',
      documents: [...],
      entities: [...]
    });

    // Text streaming is automatic via result.mergeIntoDataStream()
    const result = streamText({ model, messages, tools });
    result.mergeIntoDataStream(dataStream);

    // Progress updates (custom annotation)
    dataStream.writeMessageAnnotation({
      type: 'progress',
      toolCallId: 'xyz',
      progress: { pct: 50, stage: 'Processing...' }
    });
  }
});
```

---

## 3. Hook Migration Strategy

### 3.1 Target Architecture

```
useSagaChat (new wrapper)
    |
    +--> useChat (AI SDK)
    |       |
    |       +--> messages, isLoading, error, stop, reload
    |       +--> append, setMessages
    |       +--> addToolResult (native)
    |
    +--> Custom logic (preserved)
            |
            +--> Editor context injection
            +--> Saga modes
            +--> Mentions
            +--> RAG context extraction
            +--> Progress updates
            +--> Zustand sync (optional)
```

### 3.2 New Hook: `useSagaChat`

```typescript
// hooks/useSagaChat.ts

import { useChat, type Message } from '@ai-sdk/react';
import { useCallback, useRef, useMemo } from 'react';
import { useMythosStore, type ChatMention, type ChatContext } from '../stores';
import { useEditorChatContext } from './useEditorChatContext';
import { useApiKey } from './useApiKey';
import type { SagaMode, EditorContext } from '@mythos/agent-protocol';

interface UseSagaChatOptions {
  enabled?: boolean;
  mode?: SagaMode;
}

interface UseSagaChatResult {
  // useChat native
  messages: Message[];
  isLoading: boolean;
  error: Error | undefined;
  stop: () => void;
  reload: () => Promise<string | null | undefined>;

  // Custom preserved
  sendMessage: (content: string, mentions?: ChatMention[]) => Promise<void>;
  clearChat: () => void;
  setMode: (mode: SagaMode) => void;
  mode: SagaMode;
  ragContext: ChatContext | null;

  // Tool approval (migrated from useToolRuntime)
  addToolApprovalResponse: typeof useChat['addToolApprovalResponse'];
}

export function useSagaChat(options?: UseSagaChatOptions): UseSagaChatResult {
  const { enabled = true, mode: initialMode = 'editing' } = options ?? {};

  const modeRef = useRef<SagaMode>(initialMode);
  const conversationIdRef = useRef<string | null>(null);
  const ragContextRef = useRef<ChatContext | null>(null);

  const currentProject = useMythosStore((s) => s.project.currentProject);
  const { key: apiKey } = useApiKey();
  const editorChatContext = useEditorChatContext();

  // Build editor context
  const buildEditorContext = useCallback((): EditorContext | undefined => {
    const ctx = editorChatContext;
    if (!ctx.document && !ctx.selection) return undefined;
    return {
      documentTitle: ctx.document?.title,
      selectionText: ctx.selection?.text,
    };
  }, [editorChatContext]);

  // Generate conversation ID if needed
  if (!conversationIdRef.current) {
    conversationIdRef.current = crypto.randomUUID();
  }

  const {
    messages,
    isLoading,
    error,
    stop,
    reload,
    append,
    setMessages,
    addToolResult,
  } = useChat({
    api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-saga`,
    id: conversationIdRef.current,

    // Headers for BYOK
    headers: useMemo(() => ({
      ...(apiKey ? { 'x-openrouter-key': apiKey } : {}),
    }), [apiKey]),

    // Body includes custom context
    body: {
      projectId: currentProject?.id,
      mode: modeRef.current,
      conversationId: conversationIdRef.current,
      // mentions added per-message in sendMessage
    },

    // Extract RAG context from annotations
    onFinish: (message) => {
      const contextAnnotation = message.annotations?.find(
        (a: unknown) => (a as { type?: string }).type === 'context'
      );
      if (contextAnnotation) {
        ragContextRef.current = contextAnnotation as unknown as ChatContext;
      }
    },

    // Handle errors
    onError: (error) => {
      console.error('[useSagaChat] Error:', error);
    },
  });

  // Wrapped sendMessage with mentions
  const sendMessage = useCallback(
    async (content: string, mentions?: ChatMention[]) => {
      if (!enabled || !currentProject?.id) return;
      if (!content.trim()) return;

      await append({
        role: 'user',
        content: content.trim(),
      }, {
        body: {
          projectId: currentProject.id,
          mentions,
          editorContext: buildEditorContext(),
          mode: modeRef.current,
          conversationId: conversationIdRef.current,
        },
      });
    },
    [enabled, currentProject?.id, append, buildEditorContext]
  );

  const clearChat = useCallback(() => {
    conversationIdRef.current = crypto.randomUUID();
    ragContextRef.current = null;
    setMessages([]);
  }, [setMessages]);

  const setMode = useCallback((newMode: SagaMode) => {
    modeRef.current = newMode;
  }, []);

  return {
    messages,
    isLoading,
    error,
    stop,
    reload,
    sendMessage,
    clearChat,
    setMode,
    mode: modeRef.current,
    ragContext: ragContextRef.current,
    addToolApprovalResponse: addToolResult,
  };
}
```

### 3.3 Migration Mapping

| useSagaAgent | useSagaChat (new) | Notes |
|--------------|-------------------|-------|
| `sendMessage(content, mentions)` | `sendMessage(content, mentions)` | Wrapper around `append()` |
| `stopStreaming()` | `stop()` | Native |
| `clearChat()` | `clearChat()` | Wrapper around `setMessages([])` |
| `isStreaming` | `isLoading` | Renamed |
| `error` | `error?.message` | Error is now Error object |
| `setMode(mode)` | `setMode(mode)` | Preserved |
| `mode` | `mode` | Preserved |
| N/A | `reload()` | New capability |
| N/A | `addToolApprovalResponse()` | Replaces useToolRuntime |

---

## 4. Type Safety

### 4.1 AI SDK Message Types

```typescript
import type { Message, UIToolInvocation } from '@ai-sdk/react';

// Message structure
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'data';
  content: string;
  createdAt?: Date;
  annotations?: unknown[];
  toolInvocations?: UIToolInvocation[];
}

// Tool invocation structure
interface UIToolInvocation {
  toolCallId: string;
  toolName: string;
  args: unknown;
  state: 'partial-call' | 'call' | 'result';
  result?: unknown;
}
```

### 4.2 Typed Tool Invocations

```typescript
// types/saga-tools.ts

import type { UIToolInvocation } from '@ai-sdk/react';
import type { ToolName, ToolArgsMap, ToolResultsMap } from '@mythos/agent-protocol';

/**
 * Type-safe tool invocation for Saga tools
 */
export type SagaToolInvocation<T extends ToolName = ToolName> =
  Omit<UIToolInvocation, 'toolName' | 'args' | 'result'> & {
    toolName: T;
    args: ToolArgsMap[T];
    result?: ToolResultsMap[T];
  };

/**
 * Helper to narrow UIToolInvocation to specific tool
 */
export function isSagaTool<T extends ToolName>(
  invocation: UIToolInvocation,
  toolName: T
): invocation is SagaToolInvocation<T> {
  return invocation.toolName === toolName;
}

/**
 * Infer message type from agent configuration
 * (AI SDK 6 pattern)
 */
// When we define the agent on the backend:
// export type SagaAgentMessage = InferAgentUIMessage<typeof sagaAgent>;
```

### 4.3 Mapping Current Types

```typescript
// Current ChatToolInvocation -> AI SDK UIToolInvocation

// Current (stores/index.ts):
interface ChatToolInvocation {
  toolCallId: string;
  toolName: ToolName;
  args: unknown;
  status: ToolInvocationStatus;  // 'proposed' | 'accepted' | 'executing' | 'executed' | 'rejected' | 'failed' | 'canceled'
  result?: unknown;
  artifacts?: ToolArtifact[];
  progress?: ToolProgress;
  error?: string;
  workflowId?: string;
}

// AI SDK UIToolInvocation:
interface UIToolInvocation {
  toolCallId: string;
  toolName: string;
  args: unknown;
  state: 'partial-call' | 'call' | 'result';  // Different states!
  result?: unknown;
}

// Migration: Create adapter type that extends UIToolInvocation
interface SagaUIToolInvocation extends UIToolInvocation {
  // Additional Saga-specific fields in annotations
  sagaState?: ToolInvocationStatus;  // Fine-grained status
  artifacts?: ToolArtifact[];
  progress?: ToolProgress;
  error?: string;
}
```

### 4.4 ToolResultCard Type Updates

```typescript
// components/console/AISidebar/ToolResultCard.tsx

import type { UIToolInvocation } from '@ai-sdk/react';
import type { ToolName } from '@mythos/agent-protocol';

interface ToolResultCardProps {
  toolInvocation: UIToolInvocation;
  onApprove: () => void;
  onReject: () => void;
  onRetry: () => void;
}

// Map AI SDK state to display
function getStatusFromState(state: UIToolInvocation['state']): string {
  switch (state) {
    case 'partial-call': return 'Preparing...';
    case 'call': return 'Proposed';  // Awaiting approval
    case 'result': return 'Completed';
  }
}
```

---

## 5. Tool Approval Integration

### 5.1 Current Flow (useToolRuntime)

```
1. LLM proposes tool -> onTool callback fires
2. Tool message added with status: 'proposed'
3. User clicks Accept -> acceptTool(messageId)
4. Status: proposed -> accepted -> executing -> executed/failed
5. User can Cancel during execution
6. User can Retry after failure
```

### 5.2 AI SDK addToolResult Flow

```typescript
// AI SDK approach
const { addToolResult, messages } = useChat({ ... });

// When user approves:
addToolResult({
  toolCallId: invocation.toolCallId,
  result: { approved: true },
});

// Backend receives this and executes the tool
// Result is streamed back and merged into the message
```

### 5.3 Gap Analysis

| Feature | Current | AI SDK | Gap |
|---------|---------|--------|-----|
| Accept | `acceptTool(id)` | `addToolResult({approved: true})` | Semantic mapping |
| Reject | `rejectTool(id)` | `addToolResult({approved: false})` | Semantic mapping |
| Cancel | `cancelTool(id)` during execution | Not directly supported | Custom implementation needed |
| Retry | `retryTool(id)` | Re-send message or custom | Custom implementation needed |
| Progress | `onProgress` callback | Message annotations | Backend changes |

### 5.4 Hybrid Approach: useToolApproval Hook

```typescript
// hooks/useToolApproval.ts

import { useCallback, useRef } from 'react';
import type { UIToolInvocation } from '@ai-sdk/react';

interface UseToolApprovalOptions {
  addToolResult: (params: { toolCallId: string; result: unknown }) => void;
  onExecutionStart?: (toolCallId: string) => void;
  onExecutionEnd?: (toolCallId: string, success: boolean) => void;
}

export function useToolApproval(options: UseToolApprovalOptions) {
  const { addToolResult, onExecutionStart, onExecutionEnd } = options;

  // Track executing tools for cancel functionality
  const executingRef = useRef<Map<string, AbortController>>(new Map());

  const approve = useCallback(async (invocation: UIToolInvocation) => {
    const controller = new AbortController();
    executingRef.current.set(invocation.toolCallId, controller);

    onExecutionStart?.(invocation.toolCallId);

    try {
      // Send approval to backend
      addToolResult({
        toolCallId: invocation.toolCallId,
        result: {
          approved: true,
          signal: controller.signal,  // For server-side cancellation
        },
      });

      onExecutionEnd?.(invocation.toolCallId, true);
    } catch (error) {
      onExecutionEnd?.(invocation.toolCallId, false);
      throw error;
    } finally {
      executingRef.current.delete(invocation.toolCallId);
    }
  }, [addToolResult, onExecutionStart, onExecutionEnd]);

  const reject = useCallback((invocation: UIToolInvocation) => {
    addToolResult({
      toolCallId: invocation.toolCallId,
      result: { approved: false, reason: 'User rejected' },
    });
  }, [addToolResult]);

  const cancel = useCallback((toolCallId: string) => {
    const controller = executingRef.current.get(toolCallId);
    if (controller) {
      controller.abort();
      executingRef.current.delete(toolCallId);

      // Notify backend of cancellation
      addToolResult({
        toolCallId,
        result: { canceled: true },
      });
    }
  }, [addToolResult]);

  const retry = useCallback((invocation: UIToolInvocation) => {
    // Re-approve the same invocation
    approve(invocation);
  }, [approve]);

  return { approve, reject, cancel, retry };
}
```

### 5.5 Backend Tool Approval Handling

```typescript
// Backend: ai-saga/index.ts

import { streamText, tool } from 'ai';

const sagaTools = {
  create_entity: tool({
    description: 'Create a new entity in the world',
    parameters: createEntitySchema,
    // requiresConfirmation: true indicates UI should show approval dialog
  }),
  // ... other tools
};

// When tool result comes back with approval
async function handleToolResult(toolCallId: string, result: unknown) {
  const { approved, canceled, reason } = result as {
    approved?: boolean;
    canceled?: boolean;
    reason?: string;
  };

  if (canceled) {
    // Abort any in-progress execution
    return { status: 'canceled' };
  }

  if (!approved) {
    return { status: 'rejected', reason };
  }

  // Execute the tool
  const toolResult = await executeToolCall(toolCallId);
  return toolResult;
}
```

---

## 6. State Management

### 6.1 Decision: Keep Zustand or Use useChat State?

| Approach | Pros | Cons |
|----------|------|------|
| **A: Replace with useChat** | Less code, native reactivity | Migration complexity, feature gaps |
| **B: Sync useChat to Zustand** | Gradual migration, preserves selectors | Dual state, sync overhead |
| **C: Hybrid** | Best of both | Complexity |

**Recommendation: Approach B (Sync) during migration, then A (Replace)**

### 6.2 Sync Strategy

```typescript
// hooks/useSagaChatWithStore.ts

import { useEffect } from 'react';
import { useSagaChat } from './useSagaChat';
import { useMythosStore, type ChatMessage } from '../stores';

export function useSagaChatWithStore(options?: UseSagaChatOptions) {
  const sagaChat = useSagaChat(options);

  // Store actions
  const setChatMessages = useMythosStore((s) => s.setChatMessages);
  const setChatStreaming = useMythosStore((s) => s.setChatStreaming);
  const setChatError = useMythosStore((s) => s.setChatError);
  const setChatContext = useMythosStore((s) => s.setChatContext);

  // Sync messages to Zustand
  useEffect(() => {
    const storeMessages: ChatMessage[] = sagaChat.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: m.createdAt ?? new Date(),
      isStreaming: sagaChat.isLoading && m.role === 'assistant',
      // Map tool invocations
      kind: m.toolInvocations?.length ? 'tool' : 'text',
      tool: m.toolInvocations?.[0] ? mapToolInvocation(m.toolInvocations[0]) : undefined,
    }));

    setChatMessages(storeMessages);
  }, [sagaChat.messages, sagaChat.isLoading, setChatMessages]);

  // Sync streaming state
  useEffect(() => {
    setChatStreaming(sagaChat.isLoading);
  }, [sagaChat.isLoading, setChatStreaming]);

  // Sync error
  useEffect(() => {
    setChatError(sagaChat.error?.message ?? null);
  }, [sagaChat.error, setChatError]);

  // Sync RAG context
  useEffect(() => {
    setChatContext(sagaChat.ragContext);
  }, [sagaChat.ragContext, setChatContext]);

  return sagaChat;
}

function mapToolInvocation(ui: UIToolInvocation): ChatToolInvocation {
  return {
    toolCallId: ui.toolCallId,
    toolName: ui.toolName as ToolName,
    args: ui.args,
    status: mapStateToStatus(ui.state),
    result: ui.result,
  };
}

function mapStateToStatus(state: UIToolInvocation['state']): ToolInvocationStatus {
  switch (state) {
    case 'partial-call': return 'proposed';
    case 'call': return 'proposed';
    case 'result': return 'executed';
  }
}
```

### 6.3 Entity/Relationship Store Updates

Tool execution results need to update the world store:

```typescript
// In useSagaChat or useToolApproval

const addEntity = useMythosStore((s) => s.addEntity);
const addRelationship = useMythosStore((s) => s.addRelationship);

// When tool result arrives
useEffect(() => {
  for (const message of messages) {
    for (const invocation of message.toolInvocations ?? []) {
      if (invocation.state === 'result' && invocation.result) {
        handleToolResult(invocation);
      }
    }
  }
}, [messages]);

function handleToolResult(invocation: UIToolInvocation) {
  const result = invocation.result as unknown;

  switch (invocation.toolName) {
    case 'create_entity': {
      const { entityId, name, type } = result as CreateEntityResult;
      // Fetch full entity and add to store
      // Or if result includes full entity, add directly
      break;
    }
    case 'create_relationship': {
      const rel = result as CreateRelationshipResult;
      addRelationship(rel);
      break;
    }
    // ... other tools
  }
}
```

---

## 7. Risks and Mitigations

### 7.1 Breaking Changes

| Risk | Impact | Mitigation |
|------|--------|------------|
| Message format differences | High | Adapter layer, comprehensive testing |
| Tool state mapping | Medium | Custom states via annotations |
| Error handling differences | Medium | Wrap in try-catch, normalize errors |
| Streaming timing differences | Low | Test with various payloads |

### 7.2 Feature Parity Concerns

| Feature | Risk Level | Mitigation |
|---------|------------|------------|
| RAG context display | Medium | Message annotations |
| Progress updates | Medium | Message annotations + polling |
| Cancel execution | High | Custom AbortController + backend changes |
| Retry failed tools | Medium | Re-send tool result |
| Mentions in messages | Low | Body payload |
| Editor context | Low | Body payload |

### 7.3 Rollback Strategy

1. **Feature flag**: `VITE_USE_NEW_CHAT=true/false`
2. **Parallel implementations**: Keep `useSagaAgent` alongside `useSagaChat`
3. **A/B testing**: Route subset of users to new implementation
4. **Gradual rollout**: Enable for internal users first

```typescript
// hooks/useChat.ts (facade)

import { useSagaAgent } from './useSagaAgent';
import { useSagaChatWithStore } from './useSagaChatWithStore';

const USE_NEW_CHAT = import.meta.env.VITE_USE_NEW_CHAT === 'true';

export function useChat(options?: UseChatOptions) {
  if (USE_NEW_CHAT) {
    return useSagaChatWithStore(options);
  }
  return useSagaAgent(options);
}
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: Create parallel implementation without breaking existing functionality

#### Tasks:

- [ ] **1.1** Add AI SDK 6 dependencies
  ```bash
  cd muse/apps/web
  bun add @ai-sdk/react@latest ai@latest
  ```

- [ ] **1.2** Create `useSagaChat` hook (from Section 3.2)
  - Basic useChat wrapper
  - Editor context injection
  - Mentions support
  - Mode handling

- [ ] **1.3** Create `useToolApproval` hook (from Section 5.4)
  - Approve/reject/cancel/retry functions
  - AbortController management

- [ ] **1.4** Add feature flag infrastructure
  - Environment variable
  - Hook facade

- [ ] **1.5** Create type definitions (from Section 4)
  - `SagaToolInvocation`
  - Type guards

#### Deliverables:
- New hooks in `hooks/useSagaChat.ts`, `hooks/useToolApproval.ts`
- Feature flag in `.env.example`
- No changes to existing code

### Phase 2: Backend Compatibility (Week 2)

**Goal**: Update edge function to support AI SDK format

#### Tasks:

- [ ] **2.1** Update `ai-saga` edge function response format
  - Switch to `createDataStreamResponse`
  - Maintain backward compatibility via query param

- [ ] **2.2** Implement message annotations
  - RAG context as annotation
  - Progress updates as annotation

- [ ] **2.3** Update tool result handling
  - Support approval/rejection payloads
  - Cancellation support

- [ ] **2.4** Add integration tests
  - Test both old and new formats
  - Test tool approval flow

#### Deliverables:
- Updated `ai-saga/index.ts`
- New tests in `ai-saga/__tests__/`

### Phase 3: UI Integration (Week 3)

**Goal**: Update UI components to work with both implementations

#### Tasks:

- [ ] **3.1** Update `ToolResultCard` component
  - Accept `UIToolInvocation` type
  - Map states appropriately

- [ ] **3.2** Update `ChatMessages` component
  - Handle AI SDK message format
  - Display annotations (RAG context)

- [ ] **3.3** Create `useSagaChatWithStore` (from Section 6.2)
  - Sync to Zustand for existing selectors
  - Map message formats

- [ ] **3.4** Update `AISidebar` to use facade hook
  - Feature-flagged implementation

#### Deliverables:
- Updated UI components
- Store sync hook

### Phase 4: Testing & Migration (Week 4)

**Goal**: Comprehensive testing and gradual rollout

#### Tasks:

- [ ] **4.1** Manual testing matrix
  - All tool types
  - Error scenarios
  - Edge cases (abort, retry)

- [ ] **4.2** Enable for internal testing
  - Set `VITE_USE_NEW_CHAT=true` in staging

- [ ] **4.3** Fix issues discovered in testing

- [ ] **4.4** Performance comparison
  - Measure streaming latency
  - Memory usage

- [ ] **4.5** Documentation updates
  - Update CLAUDE.md
  - Architecture diagrams

#### Deliverables:
- Test reports
- Performance metrics
- Updated documentation

### Phase 5: Cleanup (Week 5)

**Goal**: Remove old implementation, finalize migration

#### Tasks:

- [ ] **5.1** Enable new implementation by default

- [ ] **5.2** Remove old code (with feature flag escape hatch)
  - `useSagaAgent.ts`
  - `sagaClient.ts` streaming code
  - `createAgentHook.ts` (if no longer needed)

- [ ] **5.3** Remove Zustand sync (if direct useChat state is adopted)
  - Update selectors to use hook state
  - Remove chat slice from store

- [ ] **5.4** Final cleanup
  - Remove feature flag
  - Update all imports

#### Deliverables:
- Removed ~1,000+ lines of custom code
- Clean, maintainable implementation

---

## Appendix A: File Changes Summary

### Files to Create
| File | Purpose |
|------|---------|
| `hooks/useSagaChat.ts` | New AI SDK-based hook |
| `hooks/useToolApproval.ts` | Tool approval utilities |
| `types/saga-chat.ts` | Type definitions |

### Files to Modify
| File | Changes |
|------|---------|
| `supabase/functions/ai-saga/index.ts` | Response format |
| `components/console/AISidebar/ToolResultCard.tsx` | Type updates |
| `components/console/AISidebar/ChatMessages.tsx` | Message format |
| `components/console/AISidebar/AISidebar.tsx` | Hook usage |
| `.env.example` | Feature flag |

### Files to Delete (Phase 5)
| File | Lines Saved |
|------|-------------|
| `hooks/useSagaAgent.ts` | 336 |
| `services/ai/sagaClient.ts` (partial) | ~200 |
| `hooks/createAgentHook.ts` | 456 |

---

## Appendix B: Dependencies

### Current
```json
{
  "dependencies": {
    "ai": "^4.0.34"
  }
}
```

### After Migration
```json
{
  "dependencies": {
    "@ai-sdk/react": "^1.x.x",
    "ai": "^6.x.x"
  }
}
```

---

## Appendix C: Related Documentation

- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [useChat Reference](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)
- [Tool Calling Guide](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [Streaming Guide](https://sdk.vercel.ai/docs/ai-sdk-ui/streaming)
- Current: `SEMANTIC_SEARCH.md`, `NOTION_FEATURES_PLAN.md`
