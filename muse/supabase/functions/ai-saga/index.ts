/**
 * AI Saga Edge Function
 *
 * Unified agent endpoint that handles:
 * - kind: "chat" - Streaming chat with tool proposals (SSE)
 * - kind: "execute_tool" - Non-streaming tool execution
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { streamText } from "https://esm.sh/ai@3.4.0";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import { requireApiKey } from "../_shared/api-key.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  ErrorCode,
} from "../_shared/errors.ts";
import {
  generateEmbedding,
  isDeepInfraConfigured,
} from "../_shared/deepinfra.ts";
import {
  searchPoints,
  isQdrantConfigured,
  type QdrantFilter,
} from "../_shared/qdrant.ts";
import { buildSagaSystemPrompt } from "../_shared/prompts/mod.ts";
import { agentTools } from "../_shared/tools/index.ts";
import {
  executeGenesisWorld,
  executeDetectEntities,
  executeCheckConsistency,
  executeGenerateTemplate,
} from "../_shared/saga/executors.ts";
import type { SagaMode, EditorContext } from "../_shared/tools/types.ts";
import {
  type EntityType,
  type ConsistencyFocus,
} from "../_shared/tools/types.ts";

// =============================================================================
// Types
// =============================================================================

type MessageRole = "user" | "assistant" | "system";

interface Message {
  role: MessageRole;
  content: string;
}

interface Mention {
  type: "entity" | "document";
  id: string;
  name: string;
}

// EditorContext and SagaMode imported from ../shared/tools/types.ts

interface SagaChatRequest {
  kind?: "chat";
  messages: Message[];
  projectId: string;
  mentions?: Mention[];
  editorContext?: EditorContext;
  mode?: SagaMode;
  stream?: boolean;
}

interface SagaExecuteToolRequest {
  kind: "execute_tool";
  toolName: string;
  input: unknown;
  projectId?: string;
}

type SagaRequest = SagaChatRequest | SagaExecuteToolRequest;

interface RAGContext {
  documents: Array<{ id: string; title: string; preview: string }>;
  entities: Array<{ id: string; name: string; type: string; preview: string }>;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_HISTORY_MESSAGES = 20;

// =============================================================================
// RAG Context Retrieval
// =============================================================================

async function retrieveContext(
  query: string,
  projectId: string,
  limit: number = 5
): Promise<RAGContext> {
  if (!isDeepInfraConfigured() || !isQdrantConfigured()) {
    console.log("[ai-saga] RAG not configured, skipping retrieval");
    return { documents: [], entities: [] };
  }

  try {
    const embedding = await generateEmbedding(query);

    const filter: QdrantFilter = {
      must: [{ key: "projectId", match: { value: projectId } }],
    };

    const results = await searchPoints("mythos-embeddings", embedding, limit, filter);

    const documents: RAGContext["documents"] = [];
    const entities: RAGContext["entities"] = [];

    for (const point of results) {
      const payload = point.payload;
      if (payload.type === "document") {
        documents.push({
          id: payload.id as string,
          title: payload.title as string,
          preview: (payload.text as string).slice(0, 200),
        });
      } else if (payload.type === "entity") {
        entities.push({
          id: payload.id as string,
          name: payload.title as string,
          type: payload.entityType as string,
          preview: (payload.text as string).slice(0, 200),
        });
      }
    }

    return { documents, entities };
  } catch (error) {
    console.error("[ai-saga] RAG retrieval error:", error);
    return { documents: [], entities: [] };
  }
}

// =============================================================================
// Streaming Response Helpers
// =============================================================================

function getStreamingHeaders(origin: string | null): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-openrouter-key",
  };
}

// =============================================================================
// Chat Handler (Streaming)
// =============================================================================

async function handleChat(
  req: SagaChatRequest,
  apiKey: string,
  origin: string | null
): Promise<Response> {
  const { messages, projectId, mentions, editorContext, mode } = req;

  // Get last user message for RAG query
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUserMessage?.content ?? "";

  // Retrieve context
  const ragContext = await retrieveContext(query, projectId);

  // Build system prompt
  const systemPrompt = buildSagaSystemPrompt({
    mode,
    ragContext,
    editorContext,
  });

  // Build messages array with sliding window
  const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);
  const apiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Get model
  const model = getOpenRouterModel(apiKey, "creative");

  // Stream response with all tools
  const result = streamText({
    model,
    messages: apiMessages,
    tools: agentTools,
    maxSteps: 5,
  });

  // Create streaming response
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Send context metadata first
        const contextEvent = `data: ${JSON.stringify({
          type: "context",
          data: ragContext,
        })}\n\n`;
        controller.enqueue(encoder.encode(contextEvent));

        // Use fullStream to get tool call IDs
        const fullStream = result.fullStream;

        for await (const part of fullStream) {
          switch (part.type) {
            case "text-delta": {
              const deltaEvent = `data: ${JSON.stringify({
                type: "delta",
                content: part.textDelta,
              })}\n\n`;
              controller.enqueue(encoder.encode(deltaEvent));
              break;
            }

            case "tool-call": {
              const toolEvent = `data: ${JSON.stringify({
                type: "tool",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.args,
              })}\n\n`;
              controller.enqueue(encoder.encode(toolEvent));
              break;
            }

            case "finish":
              break;

            case "error": {
              const errorEvent = `data: ${JSON.stringify({
                type: "error",
                message:
                  part.error instanceof Error ? part.error.message : "Stream error",
              })}\n\n`;
              controller.enqueue(encoder.encode(errorEvent));
              break;
            }
          }
        }

        // Send done event
        const doneEvent = `data: ${JSON.stringify({ type: "done" })}\n\n`;
        controller.enqueue(encoder.encode(doneEvent));

        controller.close();
      } catch (error) {
        console.error("[ai-saga] Stream error:", error);
        const errorEvent = `data: ${JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Stream error",
        })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: getStreamingHeaders(origin),
  });
}

// =============================================================================
// Execute Tool Handler (Non-Streaming)
// =============================================================================

async function handleExecuteTool(
  req: SagaExecuteToolRequest,
  apiKey: string,
  origin: string | null
): Promise<Response> {
  const { toolName, input } = req;

  console.log(`[ai-saga] Executing tool: ${toolName}`);

  try {
    let result: unknown;

    switch (toolName) {
      case "genesis_world": {
        const typedInput = input as {
          prompt: string;
          genre?: string;
          entityCount?: number;
          detailLevel?: "minimal" | "standard" | "detailed";
          includeOutline?: boolean;
        };
        result = await executeGenesisWorld(typedInput, apiKey);
        break;
      }

      case "detect_entities": {
        const typedInput = input as {
          text: string;
          minConfidence?: number;
          maxEntities?: number;
          entityTypes?: EntityType[];
        };
        if (!typedInput.text) {
          return createErrorResponse(
            "Text is required for entity detection",
            ErrorCode.VALIDATION_ERROR,
            400,
            origin
          );
        }
        result = await executeDetectEntities(typedInput, apiKey);
        break;
      }

      case "check_consistency": {
        const typedInput = input as {
          text: string;
          focus?: ConsistencyFocus[];
          entities?: Array<{
            id: string;
            name: string;
            type: EntityType;
            properties?: Record<string, unknown>;
          }>;
        };
        if (!typedInput.text) {
          return createErrorResponse(
            "Text is required for consistency check",
            ErrorCode.VALIDATION_ERROR,
            400,
            origin
          );
        }
        result = await executeCheckConsistency(typedInput, apiKey);
        break;
      }

      case "generate_template": {
        const typedInput = input as {
          storyDescription: string;
          genreHints?: string[];
          complexity?: "simple" | "standard" | "complex";
          baseTemplateId?: string;
        };
        if (!typedInput.storyDescription) {
          return createErrorResponse(
            "Story description is required for template generation",
            ErrorCode.VALIDATION_ERROR,
            400,
            origin
          );
        }
        result = await executeGenerateTemplate(typedInput, apiKey);
        break;
      }

      default:
        return createErrorResponse(
          `Unknown tool: ${toolName}. Supported tools: genesis_world, detect_entities, check_consistency, generate_template`,
          ErrorCode.VALIDATION_ERROR,
          400,
          origin
        );
    }

    return createSuccessResponse({ toolName, result }, origin);
  } catch (error) {
    console.error(`[ai-saga] Tool execution error (${toolName}):`, error);
    return handleAIError(error, origin, { operation: toolName });
  }
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only allow POST
  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", ErrorCode.VALIDATION_ERROR, 405);
  }

  const origin = req.headers.get("Origin");

  try {
    // Get API key
    const apiKey = requireApiKey(req);

    // Parse request body
    const body = (await req.json()) as SagaRequest;

    // Route based on request kind
    if (body.kind === "execute_tool") {
      // Validate execute_tool request
      if (!body.toolName) {
        return createErrorResponse(
          "toolName is required for execute_tool",
          ErrorCode.VALIDATION_ERROR,
          400,
          origin
        );
      }
      return handleExecuteTool(body, apiKey, origin);
    } else {
      // Default to chat
      if (!body.messages || !body.projectId) {
        return createErrorResponse(
          "messages and projectId are required for chat",
          ErrorCode.VALIDATION_ERROR,
          400,
          origin
        );
      }
      return handleChat(body as SagaChatRequest, apiKey, origin);
    }
  } catch (error) {
    console.error("[ai-saga] Handler error:", error);
    return handleAIError(error, origin, { operation: "saga" });
  }
});
