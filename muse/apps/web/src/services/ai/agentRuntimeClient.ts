/**
 * Agent Runtime Client - Web Platform Wrapper
 *
 * Thin wrapper around @mythos/ai/client that adds web-specific auth and headers.
 */

import {
  sendSagaChatStreaming as sharedSendSagaChatStreaming,
  executeGenerateTemplate as sharedExecuteGenerateTemplate,
  SagaApiError,
  type SagaChatPayload as SharedSagaChatPayload,
  type SagaStreamOptions as SharedStreamOptions,
  type ExecuteToolOptions as SharedExecuteToolOptions,
  type ToolCallResult,
  API_TIMEOUTS,
  RETRY_CONFIG,
} from '@mythos/ai/client';
import type { ChatContext } from '../../stores';
import type {
  ToolName,
  ProjectManageArgs,
  ProjectManageResult,
  GenesisWorldArgs,
  GenesisWorldResult,
  DetectEntitiesArgs,
  DetectEntitiesResult,
  CheckConsistencyArgs,
  CheckConsistencyResult,
  GenerateTemplateArgs,
  GenerateTemplateResult,
  ClarityCheckArgs,
  ClarityCheckResult,
  PolicyCheckArgs,
  PolicyCheckResult,
  CheckLogicArgs,
  CheckLogicResult,
  NameGeneratorArgs,
  NameGeneratorResult,
  AnalyzeContentArgs,
  AnalyzeContentResult,
  SagaMode,
  EditorContext,
  ToolApprovalType,
  ToolApprovalDanger,
} from '@mythos/agent-protocol';
import { getAnonHeaders } from '../anonymousSession';
import { authClient } from '../../lib/auth';

// Re-export from shared
export { SagaApiError, API_TIMEOUTS, RETRY_CONFIG };
export type { SagaMode, EditorContext, ToolCallResult };
export type { ChatContext, ChatMention } from '../../stores';
export type SagaApiErrorCode = import('@mythos/ai/client').SagaApiErrorCode;

// Web-specific SagaChatPayload that uses store's ChatMention type
import type { ChatMention as StoreChatMention } from '../../stores';
import type { UnifiedContextHints } from '@mythos/context';
export interface SagaChatPayload {
  prompt: string;
  projectId: string;
  mentions?: StoreChatMention[];
  editorContext?: EditorContext;
  contextHints?: UnifiedContextHints;
  mode?: SagaMode;
  threadId?: string;
}

// Platform config
const CONVEX_SITE_URL = import.meta.env['VITE_CONVEX_SITE_URL'] || 'https://cascada.vision';

async function resolveAuthHeader(authToken?: string): Promise<string | null> {
  if (authToken) {
    return authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
  }
  try {
    const response = await authClient.$fetch('/api/auth/convex-token', { method: 'GET' });
    const tokenData = response?.data as { token?: string } | undefined;
    return tokenData?.token ? `Bearer ${tokenData.token}` : null;
  } catch {
    return null;
  }
}

// Extended types for web
export interface SagaMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolApprovalRequest {
  approvalId: string;
  toolCallId?: string;
  toolName: ToolName;
  args: unknown;
  approvalType: ToolApprovalType;
  danger?: ToolApprovalDanger;
  suggestionId?: string;
  promptMessageId?: string;
}

export interface SagaStreamOptions {
  signal?: AbortSignal;
  apiKey?: string;
  authToken?: string;
  onContext?: (context: ChatContext) => void;
  onDelta?: (delta: string) => void;
  onTool?: (tool: ToolCallResult) => void;
  onToolApprovalRequest?: (request: ToolApprovalRequest) => void;
  onProgress?: (toolCallId: string, progress: { pct?: number; stage?: string }) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface ExecuteToolOptions {
  projectId: string;
  signal?: AbortSignal;
  apiKey?: string;
  authToken?: string;
}

export type SagaStreamEvent = import('@mythos/ai/client').SagaStreamEvent;
export type SagaStreamEventType = import('@mythos/ai/client').SagaStreamEventType;

/**
 * Send a chat message to Saga AI with streaming response.
 */
export async function sendSagaChatStreaming(
  payload: SagaChatPayload,
  opts?: SagaStreamOptions
): Promise<void> {
  const resolvedAuth = await resolveAuthHeader(opts?.authToken);
  const extraHeaders: Record<string, string> = {
    ...getAnonHeaders(),
    ...(resolvedAuth ? { Authorization: resolvedAuth } : {}),
  };

  return sharedSendSagaChatStreaming(payload as unknown as SharedSagaChatPayload, {
    ...opts,
    baseUrl: CONVEX_SITE_URL,
    extraHeaders,
  } as SharedStreamOptions);
}

// Tool execution helper
async function executeSagaTool<T>(
  toolName: string,
  input: unknown,
  opts: ExecuteToolOptions
): Promise<T> {
  const { projectId, signal, apiKey, authToken } = opts;

  if (!projectId) {
    throw new SagaApiError('projectId is required for tool execution', 400, 'TOOL_EXECUTION_ERROR');
  }

  const resolvedAuth = await resolveAuthHeader(authToken);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAnonHeaders(),
    ...(resolvedAuth ? { Authorization: resolvedAuth } : {}),
    ...(apiKey ? { 'x-openrouter-key': apiKey } : {}),
  };

  const url = `${CONVEX_SITE_URL}/api/ai/saga`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind: 'execute_tool', projectId, toolName, input }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Tool execution failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new SagaApiError(errorMessage, response.status, 'TOOL_EXECUTION_ERROR');
  }

  const data = (await response.json()) as { result: T };
  return data.result;
}

// Typed tool wrappers
export async function executeGenesisWorld(input: GenesisWorldArgs, opts: ExecuteToolOptions): Promise<GenesisWorldResult> {
  return executeSagaTool<GenesisWorldResult>('genesis_world', input, opts);
}

export async function executeProjectManage(input: ProjectManageArgs, opts: ExecuteToolOptions): Promise<ProjectManageResult> {
  return executeSagaTool<ProjectManageResult>('project_manage', input, opts);
}

export async function executeAnalyzeContent(input: AnalyzeContentArgs, opts: ExecuteToolOptions): Promise<AnalyzeContentResult> {
  return executeSagaTool<AnalyzeContentResult>('analyze_content', input, opts);
}

export async function executeDetectEntities(
  input: DetectEntitiesArgs & { text: string },
  opts: ExecuteToolOptions
): Promise<DetectEntitiesResult> {
  const result = await executeAnalyzeContent(
    {
      mode: "entities",
      text: input.text,
      options: {
        entityTypes: input.entityTypes,
        minConfidence: input.minConfidence,
      },
    },
    opts
  );

  if (result.mode !== "entities") {
    throw new SagaApiError("analyze_content returned non-entities result", 500, "TOOL_EXECUTION_ERROR");
  }

  return {
    entities: result.entities ?? [],
    warnings: result.stats?.warnings as DetectEntitiesResult["warnings"] | undefined,
  };
}

export async function executeCheckConsistency(
  input: CheckConsistencyArgs & { text: string; entities?: unknown[] },
  opts: ExecuteToolOptions
): Promise<CheckConsistencyResult> {
  const result = await executeAnalyzeContent(
    {
      mode: "consistency",
      text: input.text,
      options: { focus: input.focus },
    },
    opts
  );

  if (result.mode !== "consistency") {
    throw new SagaApiError("analyze_content returned non-consistency result", 500, "TOOL_EXECUTION_ERROR");
  }

  return {
    issues: (result.issues ?? []) as CheckConsistencyResult["issues"],
    summary: result.summary,
  };
}

export async function executeGenerateTemplate(input: GenerateTemplateArgs, opts: ExecuteToolOptions): Promise<GenerateTemplateResult> {
  return sharedExecuteGenerateTemplate(input, {
    ...opts,
    baseUrl: CONVEX_SITE_URL,
    extraHeaders: getAnonHeaders(),
  } as SharedExecuteToolOptions);
}

export async function executeClarityCheck(
  input: ClarityCheckArgs & { text: string },
  opts: ExecuteToolOptions
): Promise<ClarityCheckResult> {
  const result = await executeAnalyzeContent(
    {
      mode: "clarity",
      text: input.text,
      options: { maxIssues: input.maxIssues },
    },
    opts
  );

  if (result.mode !== "clarity") {
    throw new SagaApiError("analyze_content returned non-clarity result", 500, "TOOL_EXECUTION_ERROR");
  }

  const metrics =
    (result.stats?.readability as ClarityCheckResult["metrics"] | undefined) ?? {
      wordCount: 0,
      sentenceCount: 0,
      avgWordsPerSentence: 0,
      fleschReadingEase: 0,
      fleschKincaidGrade: 0,
      longSentencePct: 0,
    };

  return {
    issues: (result.stats?.rawIssues ?? []) as ClarityCheckResult["issues"],
    summary: result.summary,
    metrics,
  };
}

export async function executePolicyCheck(
  input: PolicyCheckArgs,
  opts: ExecuteToolOptions
): Promise<PolicyCheckResult> {
  const result = await executeAnalyzeContent(
    {
      mode: "policy",
      text: input.text,
      options: { maxIssues: input.maxIssues },
    },
    opts
  );

  if (result.mode !== "policy") {
    throw new SagaApiError("analyze_content returned non-policy result", 500, "TOOL_EXECUTION_ERROR");
  }

  return {
    issues: (result.stats?.rawIssues ?? []) as PolicyCheckResult["issues"],
    summary: result.summary ?? "Policy check complete.",
    compliance: result.stats?.compliance as PolicyCheckResult["compliance"],
  };
}

export async function executeCheckLogic(
  input: CheckLogicArgs & {
    text: string;
    magicSystems?: Array<{ id: string; name: string; rules: string[]; limitations: string[]; costs?: string[] }>;
    characters?: Array<{ id: string; name: string; powerLevel?: number; knowledge?: string[] }>;
  },
  opts: ExecuteToolOptions
): Promise<CheckLogicResult> {
  const result = await executeAnalyzeContent(
    {
      mode: "logic",
      text: input.text,
      options: { focus: input.focus, strictness: input.strictness },
    },
    opts
  );

  if (result.mode !== "logic") {
    throw new SagaApiError("analyze_content returned non-logic result", 500, "TOOL_EXECUTION_ERROR");
  }

  return {
    issues: (result.stats?.rawIssues ?? []) as CheckLogicResult["issues"],
    summary: result.summary,
  };
}

export async function executeNameGenerator(input: NameGeneratorArgs, opts: ExecuteToolOptions): Promise<NameGeneratorResult> {
  return executeSagaTool<NameGeneratorResult>('name_generator', input, opts);
}

// Tool result streaming (human-in-the-loop)
export interface ToolResultPayload {
  projectId: string;
  threadId: string;
  promptMessageId: string;
  toolCallId: string;
  toolName: ToolName;
  result: unknown;
  editorContext?: EditorContext;
}

export async function sendToolResultStreaming(payload: ToolResultPayload, opts?: SagaStreamOptions): Promise<void> {
  const resolvedAuth = await resolveAuthHeader(opts?.authToken);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAnonHeaders(),
    ...(resolvedAuth ? { Authorization: resolvedAuth } : {}),
    ...(opts?.apiKey ? { 'x-openrouter-key': opts.apiKey } : {}),
  };

  const url = `${CONVEX_SITE_URL}/api/ai/saga`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind: 'tool-result', ...payload }),
    signal: opts?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new SagaApiError(errorText || `Tool result failed: ${response.status}`, response.status);
  }

  // Process SSE stream - simplified inline since this is web-specific
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);
          if (event.type === 'delta' && event.content) opts?.onDelta?.(event.content);
          if (event.type === 'context' && event.data) opts?.onContext?.(event.data);
          if (event.type === 'tool' && event.toolName) opts?.onTool?.(event as ToolCallResult);
          if (event.type === 'done') opts?.onDone?.();
          if (event.type === 'error') opts?.onError?.(new SagaApiError(event.message));
        } catch {}
      }
    }
    opts?.onDone?.();
  } finally {
    reader.releaseLock();
  }
}
