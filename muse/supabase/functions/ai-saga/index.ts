/**
 * AI Saga Edge Function
 *
 * Unified agent endpoint that handles:
 * - kind: "chat" - Streaming chat with tool proposals (SSE)
 * - kind: "execute_tool" - Non-streaming tool execution
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { streamText } from "https://esm.sh/ai@4.0.0";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createSSEStream,
  getStreamingHeaders,
  type SSEStreamController,
} from "../_shared/streaming.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  ErrorCode,
} from "../_shared/errors.ts";
import {
  getProjectId,
  getPayloadTitle,
  getPayloadPreview,
  getPayloadType,
  getEntityType,
  getMemoryCategory,
} from "../_shared/vectorPayload.ts";
import {
  retrieveMemoryContext,
  retrieveProfileContext,
  DEFAULT_SAGA_LIMITS,
  type RetrievedMemoryContext,
  type ProfileContext,
} from "../_shared/memory/retrieval.ts";
import {
  retrieveRAGContext,
  type RAGContext,
} from "../_shared/rag.ts";
import { buildSagaSystemPrompt } from "../_shared/prompts/mod.ts";
import { agentTools } from "../_shared/tools/index.ts";
import {
  executeGenesisWorld,
  executeDetectEntities,
  executeCheckConsistency,
  executeGenerateTemplate,
  executeClarityCheck,
} from "../_shared/saga/executors.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  type BillingCheck,
} from "../_shared/billing.ts";
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
  conversationId?: string;
}

interface SagaExecuteToolRequest {
  kind: "execute_tool";
  toolName: string;
  input: unknown;
  projectId?: string;
}

type SagaRequest = SagaChatRequest | SagaExecuteToolRequest;

// RAGContext type imported from ../shared/rag.ts

// =============================================================================
// Constants
// =============================================================================

const MAX_HISTORY_MESSAGES = 20;

// RAG retrieval extracted to ../shared/rag.ts as retrieveRAGContext

// Memory retrieval extracted to ../_shared/memory/retrieval.ts

// =============================================================================
// Chat Handler (Streaming)
// =============================================================================

async function handleChat(
  req: SagaChatRequest,
  apiKey: string,
  origin: string | null,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<Response> {
  const { messages, projectId, mentions, editorContext, mode, conversationId } = req;

  // Get last user message for RAG query
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUserMessage?.content ?? "";

  // Determine owner ID for memory isolation (userId or anonDeviceId)
  const ownerId = billing.userId ?? billing.anonDeviceId ?? null;

  // Retrieve all contexts in parallel
  const [ragContext, memoryContext, profileContext] = await Promise.all([
    retrieveRAGContext(query, projectId, {
      logPrefix: "[ai-saga]",
      excludeMemories: true,
    }),
    // Pass ownerId for proper user/conversation scope isolation
    retrieveMemoryContext(query, projectId, ownerId, conversationId, DEFAULT_SAGA_LIMITS, "[ai-saga]"),
    retrieveProfileContext(supabase, billing.userId, "[ai-saga]"),
  ]);

  // Build system prompt with all contexts
  const systemPrompt = buildSagaSystemPrompt({
    mode,
    ragContext,
    editorContext,
    profileContext,
    memoryContext,
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
  const result = await streamText({
    model,
    messages: apiMessages,
    tools: agentTools,
    maxSteps: 5,
  });

  // Create SSE stream using shared utility
  const stream = createSSEStream(async (sse: SSEStreamController) => {
    // Send context metadata first
    sse.sendContext(ragContext);

    // Use fullStream to get tool call IDs
    const fullStream = result.fullStream;

    for await (const part of fullStream) {
      switch (part.type) {
        case "text-delta":
          sse.sendDelta(part.textDelta);
          break;

        case "tool-call":
          sse.sendTool(part.toolCallId, part.toolName, part.args);
          break;

        case "finish":
          break;

        case "error":
          sse.sendError(part.error);
          break;
      }
    }

    sse.complete();
  });

  return new Response(stream, {
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
            ErrorCode.VALIDATION_ERROR,
            "Text is required for entity detection",
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
            ErrorCode.VALIDATION_ERROR,
            "Text is required for consistency check",
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
            ErrorCode.VALIDATION_ERROR,
            "Story description is required for template generation",
            origin
          );
        }
        result = await executeGenerateTemplate(typedInput, apiKey);
        break;
      }

      case "clarity_check": {
        const typedInput = input as {
          text: string;
          maxIssues?: number;
        };
        if (!typedInput.text) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Text is required for clarity check",
            origin
          );
        }
        result = await executeClarityCheck(typedInput, apiKey);
        break;
      }

      default:
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `Unknown tool: ${toolName}. Supported tools: genesis_world, detect_entities, check_consistency, generate_template, clarity_check`,
          origin
        );
    }

    return createSuccessResponse({ toolName, result }, origin);
  } catch (error) {
    console.error(`[ai-saga] Tool execution error (${toolName}):`, error);
    return handleAIError(error, origin, { providerName: toolName });
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
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, "Method not allowed", null);
  }

  const origin = req.headers.get("Origin");
  const supabase = createSupabaseClient();

  try {
    // Check billing (allow anonymous trial)
    const billing = await checkBillingAndGetKey(req, supabase, {
      endpoint: "agent",
      allowAnonymousTrial: true,
    });
    if (!billing.canProceed || !billing.apiKey) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        billing.error ?? "API key required",
        origin,
        billing.errorCode ? { code: billing.errorCode } : undefined
      );
    }

    // Parse request body
    const body = (await req.json()) as SagaRequest;

    // Route based on request kind
    if (body.kind === "execute_tool") {
      // Validate execute_tool request
      if (!body.toolName) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "toolName is required for execute_tool",
          origin
        );
      }
      return handleExecuteTool(body, billing.apiKey, origin);
    } else {
      // Default to chat
      if (!body.messages || !body.projectId) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "messages and projectId are required for chat",
          origin
        );
      }
      return handleChat(body as SagaChatRequest, billing.apiKey, origin, billing, supabase);
    }
  } catch (error) {
    console.error("[ai-saga] Handler error:", error);
    return handleAIError(error, origin, { providerName: "saga" });
  }
});
