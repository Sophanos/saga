/**
 * useTemplateBuilderAgent Hook
 *
 * Shared hook for AI-assisted template generation in the workspace wizard.
 * Works on both web and React Native.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  sendSagaChatStreaming,
  executeGenerateTemplate,
  getErrorMessage,
  type ToolCallResult,
  type StreamContext,
} from '../client';
import type {
  GenerateTemplateArgs,
  GenerateTemplateResult,
  GenesisEntity,
  TemplateDraft,
  ToolName,
} from '@mythos/agent-protocol';
import {
  DOMAIN_QUESTIONS,
  PROJECT_TYPE_DEFS,
  type ProjectType,
  type TemplateBuilderPhase,
} from '@mythos/core';

// Import the API type - this works with any Convex app that has the templateBuilderSessions module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConvexAPI = any;

export interface BuilderMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface BuilderToolInvocation {
  toolCallId: string;
  toolName: ToolName;
  args: GenerateTemplateArgs;
  status: 'proposed' | 'executing' | 'executed' | 'rejected' | 'failed';
  result?: GenerateTemplateResult;
  error?: string;
}

export interface UseTemplateBuilderAgentOptions {
  projectType: ProjectType;
  /** Base URL for the API (e.g., 'https://cascada.vision') */
  baseUrl: string;
  /** Optional API key for BYOK mode */
  apiKey?: string;
  /** Convex API object */
  api: ConvexAPI;
}

export interface UseTemplateBuilderAgentResult {
  messages: BuilderMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  clearChat: () => void;
  pendingTool: BuilderToolInvocation | null;
  executeTool: () => Promise<GenerateTemplateResult | null>;
  rejectTool: () => void;
  draft: TemplateDraft | null;
  starterEntities: GenesisEntity[];
  phase: TemplateBuilderPhase;
  threadId: string | null;
  markAccepted: () => void;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function resolvePhase(
  draft: TemplateDraft | null,
  pendingTool: BuilderToolInvocation | null,
  accepted: boolean
): TemplateBuilderPhase {
  if (accepted) return 'done';
  if (draft) return 'review';
  if (pendingTool?.status === 'proposed' || pendingTool?.status === 'executing') {
    return 'generate';
  }
  return 'discovery';
}

function buildDiscoveryPrompt(projectType: ProjectType, userText: string): string {
  const typeDef = PROJECT_TYPE_DEFS[projectType];
  const questions = DOMAIN_QUESTIONS[projectType]
    .map((q, index) => `${index + 1}. ${q.question}`)
    .join('\n');

  return [
    `Project Type: ${typeDef.label}`,
    `Base template id: ${typeDef.baseTemplateId}`,
    'Goal: design a Mythos template (entity kinds, relationships, document kinds, UI modules, linter rules).',
    'Ask 4-7 targeted questions for this domain, then propose a generate_template tool call.',
    'When ready, propose generate_template with { storyDescription, baseTemplateId, complexity }.',
    '',
    'Question bank:',
    questions,
    '',
    `User idea: ${userText}`,
  ].join('\n');
}

function resolveToolArgs(
  args: GenerateTemplateArgs,
  projectType: ProjectType,
  messages: BuilderMessage[]
): GenerateTemplateArgs {
  const baseTemplateId = args.baseTemplateId ?? PROJECT_TYPE_DEFS[projectType].baseTemplateId;
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const storyDescription = args.storyDescription?.trim() || lastUserMessage.trim();
  return {
    ...args,
    baseTemplateId,
    storyDescription,
  };
}

export function useTemplateBuilderAgent({
  projectType,
  baseUrl,
  apiKey,
  api,
}: UseTemplateBuilderAgentOptions): UseTemplateBuilderAgentResult {
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTool, setPendingTool] = useState<BuilderToolInvocation | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [starterEntities, setStarterEntities] = useState<GenesisEntity[]>([]);
  const [accepted, setAccepted] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasSentInitialPromptRef = useRef(false);

  const latestSession = useQuery(api.templateBuilderSessions.getLatestForUser);
  const upsertSession = useMutation(api.templateBuilderSessions.upsertByThread);

  const phase = useMemo(
    () => resolvePhase(draft, pendingTool, accepted),
    [draft, pendingTool, accepted]
  );

  // Restore session from Convex
  useEffect(() => {
    if (!latestSession || threadId) return;
    if (latestSession.projectType && latestSession.projectType !== projectType) return;

    setThreadId(latestSession.threadId);
    if (latestSession.partialDraft && !draft) {
      setDraft(latestSession.partialDraft as TemplateDraft);
    }
    if (latestSession.phase === 'done') {
      setAccepted(true);
    }
    hasSentInitialPromptRef.current = true;
  }, [latestSession, threadId, projectType, draft]);

  useEffect(() => {
    if (!threadId) return;
    hasSentInitialPromptRef.current = true;
  }, [threadId]);

  // Persist session to Convex
  useEffect(() => {
    if (!threadId) return;
    const payload = {
      threadId,
      projectType,
      phase,
      partialDraft: draft ?? undefined,
    };

    void upsertSession(payload).catch((err) => {
      console.warn('[templateBuilder] Failed to persist session:', err);
    });
  }, [threadId, projectType, phase, draft, upsertSession]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const prompt = hasSentInitialPromptRef.current
        ? trimmed
        : buildDiscoveryPrompt(projectType, trimmed);
      hasSentInitialPromptRef.current = true;

      // Add user message
      const userMessage: BuilderMessage = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      // Add placeholder assistant message
      const assistantMessageId = generateId();
      const assistantMessage: BuilderMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev: BuilderMessage[]) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);
      setError(null);
      setPendingTool(null);

      try {
        await sendSagaChatStreaming(
          {
            prompt,
            projectId: 'template-builder',
            mode: 'creation',
            threadId: threadId ?? undefined,
            contextHints: {
              templateBuilder: {
                projectType,
                phase,
              },
            },
          },
          {
            signal: abortController.signal,
            apiKey: apiKey ?? undefined,
            baseUrl,
            onContext: (context: StreamContext) => {
              const nextThreadId = context.threadId;
              if (nextThreadId && nextThreadId !== threadId) {
                setThreadId(nextThreadId);
              }
            },
            onDelta: (delta: string) => {
              setMessages((prev: BuilderMessage[]) =>
                prev.map((m: BuilderMessage) =>
                  m.id === assistantMessageId ? { ...m, content: m.content + delta } : m
                )
              );
            },
            onTool: (tool: ToolCallResult) => {
              if (tool.toolName === 'generate_template') {
                setPendingTool({
                  toolCallId: tool.toolCallId,
                  toolName: tool.toolName,
                  args: tool.args as GenerateTemplateArgs,
                  status: 'proposed',
                });
              }
            },
            onDone: () => {
              setMessages((prev: BuilderMessage[]) =>
                prev.map((m: BuilderMessage) => (m.id === assistantMessageId ? { ...m, isStreaming: false } : m))
              );
              setIsStreaming(false);
            },
            onError: (err: Error) => {
              const msg = getErrorMessage(err);
              if (msg) setError(msg);
              setMessages((prev: BuilderMessage[]) =>
                prev.map((m: BuilderMessage) =>
                  m.id === assistantMessageId
                    ? { ...m, isStreaming: false, content: m.content || 'Sorry, an error occurred.' }
                    : m
                )
              );
              setIsStreaming(false);
            },
          }
        );
      } catch (err) {
        if (abortController.signal.aborted) {
          setMessages((prev: BuilderMessage[]) =>
            prev.map((m: BuilderMessage) => (m.id === assistantMessageId ? { ...m, isStreaming: false } : m))
          );
          setIsStreaming(false);
          return;
        }
        const msg = getErrorMessage(err);
        if (msg) setError(msg);
        setMessages((prev: BuilderMessage[]) =>
          prev.map((m: BuilderMessage) =>
            m.id === assistantMessageId
              ? { ...m, isStreaming: false, content: 'Sorry, an error occurred.' }
              : m
          )
        );
        setIsStreaming(false);
      }
    },
    [apiKey, baseUrl, projectType, phase, threadId]
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    setPendingTool(null);
    setIsStreaming(false);
    setDraft(null);
    setStarterEntities([]);
    setAccepted(false);
    hasSentInitialPromptRef.current = false;
  }, []);

  const executeTool = useCallback(async (): Promise<GenerateTemplateResult | null> => {
    if (!pendingTool || pendingTool.status !== 'proposed') return null;

    setPendingTool((prev: BuilderToolInvocation | null) => (prev ? { ...prev, status: 'executing' } : null));

    try {
      const resolvedArgs = resolveToolArgs(pendingTool.args, projectType, messages);
      if (!resolvedArgs.storyDescription) {
        throw new Error('Template description is missing.');
      }

      const result = await executeGenerateTemplate(resolvedArgs, {
        apiKey: apiKey ?? undefined,
        projectId: 'template-builder',
        baseUrl,
      });
      setPendingTool((prev: BuilderToolInvocation | null) => (prev ? { ...prev, status: 'executed', result } : null));
      setDraft(result.template);
      setStarterEntities(result.suggestedStarterEntities ?? []);
      return result;
    } catch (err) {
      const msg = getErrorMessage(err);
      setPendingTool((prev: BuilderToolInvocation | null) => (prev ? { ...prev, status: 'failed', error: msg } : null));
      setError(msg);
      return null;
    }
  }, [pendingTool, apiKey, baseUrl, projectType, messages]);

  const rejectTool = useCallback(() => {
    setPendingTool((prev: BuilderToolInvocation | null) => (prev ? { ...prev, status: 'rejected' } : null));
  }, []);

  const markAccepted = useCallback(() => {
    setAccepted(true);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
    pendingTool,
    executeTool,
    rejectTool,
    draft,
    starterEntities,
    phase,
    threadId,
    markAccepted,
  };
}
