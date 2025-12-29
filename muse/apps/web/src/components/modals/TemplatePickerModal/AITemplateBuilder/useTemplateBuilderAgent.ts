/**
 * useTemplateBuilderAgent Hook
 *
 * Simplified saga agent for template generation in the modal.
 * Uses local state (not global store) since this is transient.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  sendSagaChatStreaming,
  executeGenerateTemplate,
  SagaApiError,
  type SagaChatPayload,
  type ToolCallResult,
} from "../../../../services/ai/sagaClient";
import { useApiKey } from "../../../../hooks/useApiKey";
import type {
  ToolName,
  GenerateTemplateArgs,
  GenerateTemplateResult,
} from "@mythos/agent-protocol";

export interface BuilderMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface BuilderToolInvocation {
  toolCallId: string;
  toolName: ToolName;
  args: GenerateTemplateArgs;
  status: "proposed" | "executing" | "executed" | "rejected" | "failed";
  result?: GenerateTemplateResult;
  error?: string;
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
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof SagaApiError) {
    switch (error.sagaCode) {
      case "UNAUTHORIZED":
        return "Please configure your API key in settings.";
      case "RATE_LIMITED":
        return "Too many requests. Please wait a moment.";
      case "ABORTED":
        return "";
      default:
        return error.message;
    }
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") return "";
    return error.message;
  }
  return "An unexpected error occurred.";
}

export function useTemplateBuilderAgent(): UseTemplateBuilderAgentResult {
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTool, setPendingTool] = useState<BuilderToolInvocation | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { key: apiKey } = useApiKey();

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Add user message
      const userMessage: BuilderMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      // Add placeholder assistant message
      const assistantMessageId = generateId();
      const assistantMessage: BuilderMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);
      setError(null);
      setPendingTool(null);

      try {
        // Build API messages (exclude streaming placeholder)
        const apiMessages: SagaChatPayload["messages"] = [
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user" as const, content: content.trim() },
        ];

        const payload: SagaChatPayload = {
          messages: apiMessages,
          projectId: "template-builder", // No real project context
          mode: "creation",
        };

        await sendSagaChatStreaming(payload, {
          signal: abortController.signal,
          apiKey: apiKey ?? undefined,
          onDelta: (delta: string) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: m.content + delta }
                  : m
              )
            );
          },
          onTool: (tool: ToolCallResult) => {
            if (tool.toolName === "generate_template") {
              setPendingTool({
                toolCallId: tool.toolCallId,
                toolName: tool.toolName,
                args: tool.args as GenerateTemplateArgs,
                status: "proposed",
              });
            }
          },
          onDone: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, isStreaming: false } : m
              )
            );
            setIsStreaming(false);
          },
          onError: (err: Error) => {
            const msg = getErrorMessage(err);
            if (msg) setError(msg);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, isStreaming: false, content: m.content || "Sorry, an error occurred." }
                  : m
              )
            );
            setIsStreaming(false);
          },
        });
      } catch (err) {
        if (abortController.signal.aborted) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, isStreaming: false } : m
            )
          );
          setIsStreaming(false);
          return;
        }
        const msg = getErrorMessage(err);
        if (msg) setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, isStreaming: false, content: "Sorry, an error occurred." }
              : m
          )
        );
        setIsStreaming(false);
      }
    },
    [messages, apiKey]
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
  }, []);

  const executeTool = useCallback(async (): Promise<GenerateTemplateResult | null> => {
    if (!pendingTool || pendingTool.status !== "proposed") return null;

    setPendingTool((prev) => (prev ? { ...prev, status: "executing" } : null));

    try {
      const result = await executeGenerateTemplate(pendingTool.args, {
        apiKey: apiKey ?? undefined,
      });
      setPendingTool((prev) =>
        prev ? { ...prev, status: "executed", result } : null
      );
      return result;
    } catch (err) {
      const msg = getErrorMessage(err);
      setPendingTool((prev) =>
        prev ? { ...prev, status: "failed", error: msg } : null
      );
      setError(msg);
      return null;
    }
  }, [pendingTool, apiKey]);

  const rejectTool = useCallback(() => {
    setPendingTool((prev) => (prev ? { ...prev, status: "rejected" } : null));
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
  };
}
