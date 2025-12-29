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
  generateEmbedding,
  isDeepInfraConfigured,
} from "../_shared/deepinfra.ts";
import {
  searchPoints,
  scrollPoints,
  isQdrantConfigured,
  type QdrantFilter,
} from "../_shared/qdrant.ts";
import {
  getProjectId,
  getPayloadTitle,
  getPayloadText,
  getPayloadPreview,
  getPayloadType,
  getEntityType,
  getMemoryCategory,
} from "../_shared/vectorPayload.ts";
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

// =============================================================================
// Memory Context Retrieval
// =============================================================================

interface MemoryRecord {
  id: string;
  content: string;
  category: string;
  score?: number;
}

interface MemoryContext {
  decisions: MemoryRecord[];
  style: MemoryRecord[];
  preferences: MemoryRecord[];
  session: MemoryRecord[];
}

interface ProfileContext {
  preferredGenre?: string;
  namingCulture?: string;
  namingStyle?: string;
  logicStrictness?: string;
}

/**
 * Retrieve memory context for the request
 */
async function retrieveMemoryContext(
  query: string,
  projectId: string,
  userId: string | null,
  conversationId?: string
): Promise<MemoryContext> {
  if (!isQdrantConfigured()) {
    return { decisions: [], style: [], preferences: [], session: [] };
  }

  const result: MemoryContext = {
    decisions: [],
    style: [],
    preferences: [],
    session: [],
  };

  try {
    // Retrieve project-scoped decisions (shared canon)
    const decisionFilter: QdrantFilter = {
      must: [
        { key: "type", match: { value: "memory" } },
        { key: "project_id", match: { value: projectId } },
        { key: "category", match: { value: "decision" } },
        { key: "scope", match: { value: "project" } },
      ],
    };

    // If we have a query, do semantic search; otherwise scroll recent
    if (query && isDeepInfraConfigured()) {
      const embedding = await generateEmbedding(query);
      const decisions = await searchPoints(embedding, 8, decisionFilter);
      result.decisions = decisions.map((p) => ({
        id: String(p.id),
        content: getPayloadText(p.payload),
        category: "decision",
        score: p.score,
      }));
    } else {
      const decisions = await scrollPoints(decisionFilter, 8);
      result.decisions = decisions.map((p) => ({
        id: p.id,
        content: getPayloadText(p.payload),
        category: "decision",
      }));
    }

    // Only retrieve user-scoped memories if we have a user
    if (userId) {
      // Retrieve style preferences
      const styleFilter: QdrantFilter = {
        must: [
          { key: "type", match: { value: "memory" } },
          { key: "project_id", match: { value: projectId } },
          { key: "category", match: { value: "style" } },
          { key: "owner_id", match: { value: userId } },
        ],
      };
      const styleResults = await scrollPoints(styleFilter, 6);
      result.style = styleResults.map((p) => ({
        id: p.id,
        content: getPayloadText(p.payload),
        category: "style",
      }));

      // Retrieve preference memories
      const prefFilter: QdrantFilter = {
        must: [
          { key: "type", match: { value: "memory" } },
          { key: "project_id", match: { value: projectId } },
          { key: "category", match: { value: "preference" } },
          { key: "owner_id", match: { value: userId } },
        ],
      };
      const prefResults = await scrollPoints(prefFilter, 6);
      result.preferences = prefResults.map((p) => ({
        id: p.id,
        content: getPayloadText(p.payload),
        category: "preference",
      }));
    }

    // Retrieve session memories if we have a conversation ID
    if (conversationId && userId) {
      const sessionFilter: QdrantFilter = {
        must: [
          { key: "type", match: { value: "memory" } },
          { key: "project_id", match: { value: projectId } },
          { key: "category", match: { value: "session" } },
          { key: "conversation_id", match: { value: conversationId } },
        ],
      };
      const sessionResults = await scrollPoints(sessionFilter, 3);
      result.session = sessionResults.map((p) => ({
        id: p.id,
        content: getPayloadText(p.payload),
        category: "session",
      }));
    }
  } catch (error) {
    console.error("[ai-saga] Memory retrieval error:", error);
  }

  return result;
}

/**
 * Retrieve profile context from user preferences
 */
async function retrieveProfileContext(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string | null
): Promise<ProfileContext | undefined> {
  if (!userId) {
    return undefined;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return undefined;
    }

    const prefs = data.preferences as Record<string, unknown> | null;
    const writing = prefs?.writing as Record<string, unknown> | undefined;

    if (!writing) {
      return undefined;
    }

    return {
      preferredGenre: writing.preferredGenre as string | undefined,
      namingCulture: writing.namingCulture as string | undefined,
      namingStyle: writing.namingStyle as string | undefined,
      logicStrictness: writing.logicStrictness as string | undefined,
    };
  } catch (error) {
    console.error("[ai-saga] Profile retrieval error:", error);
    return undefined;
  }
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
  const { messages, projectId, mentions, editorContext, mode, conversationId } = req;

  // Get last user message for RAG query
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUserMessage?.content ?? "";

  // Retrieve all contexts in parallel
  const [ragContext, memoryContext, profileContext] = await Promise.all([
    retrieveRAGContext(query, projectId, {
      logPrefix: "[ai-saga]",
      excludeMemories: true,
    }),
    retrieveMemoryContext(query, projectId, billing.userId, conversationId),
    retrieveProfileContext(supabase, billing.userId),
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
  const result = streamText({
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

      case "clarity_check": {
        const typedInput = input as {
          text: string;
          maxIssues?: number;
        };
        if (!typedInput.text) {
          return createErrorResponse(
            "Text is required for clarity check",
            ErrorCode.VALIDATION_ERROR,
            400,
            origin
          );
        }
        result = await executeClarityCheck(typedInput, apiKey);
        break;
      }

      default:
        return createErrorResponse(
          `Unknown tool: ${toolName}. Supported tools: genesis_world, detect_entities, check_consistency, generate_template, clarity_check`,
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
          "toolName is required for execute_tool",
          ErrorCode.VALIDATION_ERROR,
          400,
          origin
        );
      }
      return handleExecuteTool(body, billing.apiKey, origin);
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
      return handleChat(body as SagaChatRequest, billing.apiKey, origin, billing, supabase);
    }
  } catch (error) {
    console.error("[ai-saga] Handler error:", error);
    return handleAIError(error, origin, { operation: "saga" });
  }
});
