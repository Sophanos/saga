/**
 * AI Saga Edge Function
 *
 * Unified agent endpoint that handles:
 * - kind: "chat" - Streaming chat with tool proposals (SSE)
 * - kind: "execute_tool" - Non-streaming tool execution
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { streamText } from "https://esm.sh/ai@6.0.0";
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
  executeCheckLogic,
  executeNameGenerator,
} from "../_shared/saga/executors.ts";
import {
  executeSearchImages,
  executeFindSimilarImages,
  resolveEntityPortraitAssetId,
} from "../_shared/images/executors.ts";
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

/**
 * Request to respond to a tool approval (AI SDK 6 needsApproval flow)
 */
interface SagaToolApprovalRequest {
  kind: "tool-approval";
  projectId: string;
  /** The tool call ID from the original tool-approval-request */
  toolCallId: string;
  /** Whether the user approved or denied the tool */
  approved: boolean;
  /** Original messages to continue the conversation */
  messages: Message[];
  /** Optional mentions for context */
  mentions?: Mention[];
  /** Editor context for prompts */
  editorContext?: EditorContext;
  /** Current saga mode */
  mode?: SagaMode;
  /** Conversation ID for memory continuity */
  conversationId?: string;
}

type SagaRequest = SagaChatRequest | SagaExecuteToolRequest | SagaToolApprovalRequest;

// RAGContext type imported from ../shared/rag.ts

// =============================================================================
// Constants
// =============================================================================

const MAX_HISTORY_MESSAGES = 20;

// RAG retrieval extracted to ../shared/rag.ts as retrieveRAGContext

// Memory retrieval extracted to ../_shared/memory/retrieval.ts

// =============================================================================
// Shared Context Preparation
// =============================================================================

interface SagaContextParams {
  messages: Message[];
  projectId: string;
  editorContext?: EditorContext;
  mode?: SagaMode;
  conversationId?: string;
  billing: BillingCheck;
  supabase: ReturnType<typeof createSupabaseClient>;
  logPrefix: string;
}

interface PreparedContext {
  ragContext: RAGContext;
  systemPrompt: string;
  apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

/**
 * Prepare context for a Saga conversation.
 * Shared between handleChat and handleToolApproval.
 */
async function prepareSagaContext(params: SagaContextParams): Promise<PreparedContext> {
  const { messages, projectId, editorContext, mode, conversationId, billing, supabase, logPrefix } = params;

  // Get last user message for RAG query
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUserMessage?.content ?? "";

  // Determine owner ID for memory isolation (userId or anonDeviceId)
  const ownerId = billing.userId ?? billing.anonDeviceId ?? null;

  // Retrieve all contexts in parallel
  const [ragContext, memoryContext, profileContext] = await Promise.all([
    retrieveRAGContext(query, projectId, {
      logPrefix,
      excludeMemories: true,
    }),
    retrieveMemoryContext(query, projectId, ownerId, conversationId, DEFAULT_SAGA_LIMITS, logPrefix, supabase),
    retrieveProfileContext(supabase, billing.userId, logPrefix),
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

  return { ragContext, systemPrompt, apiMessages };
}

/**
 * Stream AI SDK response to SSE.
 * Shared between handleChat and handleToolApproval.
 */
async function streamToSSE(
  sse: SSEStreamController,
  result: Awaited<ReturnType<typeof streamText>>
): Promise<void> {
  const fullStream = result.fullStream;

  for await (const part of fullStream) {
    switch (part.type) {
      case "text-delta":
        sse.sendDelta(part.text);
        break;

      case "tool-call":
        sse.sendTool(part.toolCallId, part.toolName, part.input);
        break;

      case "tool-approval-request":
        sse.sendToolApprovalRequest(
          part.toolCallId,
          part.toolName,
          part.input
        );
        break;

      case "finish":
        break;

      case "error":
        sse.sendError(part.error);
        break;
    }
  }

  sse.complete();
}

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
  const { messages, projectId, editorContext, mode, conversationId } = req;

  // Prepare context using shared helper
  const { ragContext, apiMessages } = await prepareSagaContext({
    messages,
    projectId,
    editorContext,
    mode,
    conversationId,
    billing,
    supabase,
    logPrefix: "[ai-saga]",
  });

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
    // Stream using shared helper
    await streamToSSE(sse, result);
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
  origin: string | null,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>
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

      case "check_logic": {
        const typedInput = input as {
          text: string;
          focus?: string[];
          strictness?: "strict" | "balanced" | "lenient";
          magicSystems?: Array<{
            id: string;
            name: string;
            rules: string[];
            limitations: string[];
            costs?: string[];
          }>;
          characters?: Array<{
            id: string;
            name: string;
            powerLevel?: number;
            knowledge?: string[];
          }>;
          preferences?: Record<string, unknown>;
        };
        if (!typedInput.text) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Text is required for logic check",
            origin
          );
        }
        result = await executeCheckLogic(typedInput, apiKey);
        break;
      }

      case "name_generator": {
        const typedInput = input as {
          entityType: string;
          genre?: string;
          culture?: string;
          count?: number;
          seed?: string;
          avoid?: string[];
          tone?: string;
          style?: string;
          preferences?: Record<string, unknown>;
        };
        if (!typedInput.entityType) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Entity type is required for name generation",
            origin
          );
        }
        result = await executeNameGenerator(typedInput, apiKey);
        break;
      }

      case "search_images": {
        const typedInput = input as {
          projectId?: string;
          query: string;
          limit?: number;
          assetType?: string;
          entityName?: string;
          entityType?: string;
          style?: string;
        };
        const projectId = typedInput.projectId ?? req.projectId;
        if (!projectId) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "projectId is required for image search",
            origin
          );
        }
        if (!typedInput.query) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "query is required for image search",
            origin
          );
        }
        // Resolve entityName to entityId if provided
        let entityId: string | undefined;
        if (typedInput.entityName) {
          const resolved = await resolveEntityPortraitAssetId(
            supabase,
            projectId,
            typedInput.entityName,
            typedInput.entityType as EntityType | undefined
          );
          // For search, we use the entity filter, not asset ID
          // So we need a different resolution - just get entity ID
          const { data: entity } = await supabase
            .from("entities")
            .select("id")
            .eq("project_id", projectId)
            .ilike("name", typedInput.entityName)
            .limit(1)
            .single();
          entityId = entity?.id;
        }
        result = await executeSearchImages(
          {
            projectId,
            query: typedInput.query,
            limit: typedInput.limit,
            assetType: typedInput.assetType as import("../_shared/tools/types.ts").AssetType | undefined,
            entityId,
            entityType: typedInput.entityType as EntityType | undefined,
            style: typedInput.style as import("../_shared/tools/types.ts").ImageStyle | undefined,
          },
          { supabase, billing }
        );
        break;
      }

      case "find_similar_images": {
        const typedInput = input as {
          projectId?: string;
          assetId?: string;
          entityName?: string;
          entityType?: string;
          limit?: number;
          assetType?: string;
        };
        const projectId = typedInput.projectId ?? req.projectId;
        if (!projectId) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "projectId is required for similar image search",
            origin
          );
        }
        // Resolve assetId from entityName if not provided directly
        let assetId = typedInput.assetId;
        if (!assetId && typedInput.entityName) {
          const resolved = await resolveEntityPortraitAssetId(
            supabase,
            projectId,
            typedInput.entityName,
            typedInput.entityType as EntityType | undefined
          );
          if (!resolved) {
            return createErrorResponse(
              ErrorCode.NOT_FOUND,
              `Entity "${typedInput.entityName}" not found or has no portrait`,
              origin
            );
          }
          assetId = resolved;
        }
        if (!assetId) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Either assetId or entityName is required for similar image search",
            origin
          );
        }
        result = await executeFindSimilarImages(
          {
            projectId,
            assetId,
            limit: typedInput.limit,
            assetType: typedInput.assetType as import("../_shared/tools/types.ts").AssetType | undefined,
          },
          { supabase, billing }
        );
        break;
      }

      default:
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `Unknown tool: ${toolName}. Supported tools: genesis_world, detect_entities, check_consistency, generate_template, clarity_check, check_logic, name_generator, search_images, find_similar_images`,
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
// Tool Approval Handler (AI SDK 6 needsApproval flow)
// =============================================================================

async function handleToolApproval(
  req: SagaToolApprovalRequest,
  apiKey: string,
  origin: string | null,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<Response> {
  const { projectId, toolCallId, approved, messages, editorContext, mode, conversationId } = req;

  console.log(`[ai-saga] Tool approval response: ${toolCallId} = ${approved ? "approved" : "denied"}`);

  // If denied, just return a success response - client handles UI state
  if (!approved) {
    return createSuccessResponse({
      toolCallId,
      approved: false,
      message: "Tool execution was denied by user"
    }, origin);
  }

  // Prepare context using shared helper
  const { ragContext, apiMessages } = await prepareSagaContext({
    messages,
    projectId,
    editorContext,
    mode,
    conversationId,
    billing,
    supabase,
    logPrefix: "[ai-saga-approval]",
  });

  // Get model
  const model = getOpenRouterModel(apiKey, "creative");

  // Continue with tool approval response added to messages
  // AI SDK 6: Add tool-approval-response to indicate user approved the tool
  const result = await streamText({
    model,
    messages: [
      ...apiMessages,
      // Add tool approval response to indicate the user approved
      {
        role: "assistant" as const,
        content: [
          {
            type: "tool-approval-response" as const,
            toolCallId,
            approved: true,
          },
        ],
      },
    ],
    tools: agentTools,
    maxSteps: 5,
  });

  // Stream the response
  const stream = createSSEStream(async (sse: SSEStreamController) => {
    sse.sendContext(ragContext);
    await streamToSSE(sse, result);
  });

  return new Response(stream, {
    headers: getStreamingHeaders(origin),
  });
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
      return handleExecuteTool(body, billing.apiKey, origin, billing, supabase);
    } else if (body.kind === "tool-approval") {
      // AI SDK 6: Handle tool approval response
      if (!body.projectId || !body.toolCallId || body.approved === undefined) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "projectId, toolCallId, and approved are required for tool-approval",
          origin
        );
      }
      return handleToolApproval(body, billing.apiKey, origin, billing, supabase);
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
