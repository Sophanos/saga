/**
 * AI Chat Edge Function
 *
 * POST /ai-chat
 *
 * RAG-powered chat: retrieve context → generate response → stream.
 * Supports @mentions for explicit context injection.
 *
 * Request Body:
 * {
 *   messages: Array<{ role: "user" | "assistant", content: string }>,
 *   projectId: string,
 *   mentions?: Array<{ type: "entity" | "document", id: string, name: string }>,
 *   stream?: boolean  // Default: true
 * }
 *
 * Response (streaming):
 * Server-Sent Events with delta chunks
 *
 * Response (non-streaming):
 * { content: string, context: { documents: [], entities: [] } }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { streamText, generateText } from "../_shared/deps/ai.ts";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createSSEStream,
  getStreamingHeaders,
  type SSEStreamController,
} from "../_shared/streaming.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";
import { DeepInfraError } from "../_shared/deepinfra.ts";
import { QdrantError } from "../_shared/qdrant.ts";
import {
  retrieveRAGContext,
  type RAGContext,
  type RAGContextItem,
} from "../_shared/rag.ts";
import {
  retrieveMemoryContext,
  retrieveProfileContext,
  DEFAULT_CHAT_LIMITS,
  type RetrievedMemoryContext,
  type ProfileContext,
} from "../_shared/memory/retrieval.ts";
import {
  CHAT_SYSTEM,
  CHAT_CONTEXT_TEMPLATE,
  CHAT_NO_CONTEXT,
  CHAT_MENTION_CONTEXT,
} from "../_shared/prompts/mod.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  recordAIRequest,
  extractTokenUsage,
  type BillingCheck,
} from "../_shared/billing.ts";

/**
 * Chat message role
 */
type MessageRole = "user" | "assistant" | "system";

/**
 * Chat message
 */
interface ChatMessage {
  role: MessageRole;
  content: string;
}

/**
 * Mention reference
 */
interface Mention {
  type: "entity" | "document";
  id: string;
  name: string;
}

/**
 * Request body interface
 */
interface ChatRequest {
  messages: ChatMessage[];
  projectId: string;
  mentions?: Mention[];
  stream?: boolean;
  conversationId?: string; // MLP 2.x: For session memory continuity
}

// RAGContext and RAGContextItem types imported from ../shared/rag.ts

// retrieveContext function extracted to ../shared/rag.ts as retrieveRAGContext

// Memory retrieval extracted to ../_shared/memory/retrieval.ts

/**
 * Format memory context for prompt injection
 */
function formatMemoryContext(memory: RetrievedMemoryContext): string {
  const sections: string[] = [];

  if (memory.decisions.length > 0) {
    const items = memory.decisions.map((m) => `- ${m.content}`).join("\n");
    sections.push(`### Canon Decisions\n${items}`);
  }

  if (memory.style.length > 0) {
    const items = memory.style.map((m) => `- ${m.content}`).join("\n");
    sections.push(`### Writer Style\n${items}`);
  }

  return sections.length > 0 ? `## Remembered Context\n\n${sections.join("\n\n")}` : "";
}

/**
 * Format profile context for prompt injection
 */
function formatProfileContext(profile: ProfileContext): string {
  const parts: string[] = [];

  if (profile.preferredGenre) {
    parts.push(`- **Preferred Genre:** ${profile.preferredGenre}`);
  }
  if (profile.namingCulture) {
    parts.push(`- **Naming Culture:** ${profile.namingCulture}`);
  }

  return parts.length > 0 ? `## Writer Preferences\n\n${parts.join("\n")}` : "";
}

/**
 * Build context string from RAG results
 */
function buildContextString(
  context: RAGContext,
  mentions?: Mention[],
  memoryContext?: RetrievedMemoryContext,
  profileContext?: ProfileContext
): string {
  const parts: string[] = [];

  // Add profile context first
  if (profileContext) {
    const profileStr = formatProfileContext(profileContext);
    if (profileStr) {
      parts.push(profileStr);
    }
  }

  // Add memory context
  if (memoryContext) {
    const memoryStr = formatMemoryContext(memoryContext);
    if (memoryStr) {
      parts.push(memoryStr);
    }
  }

  // Add retrieved context
  if (context.documents.length > 0 || context.entities.length > 0) {
    let contextStr = CHAT_CONTEXT_TEMPLATE;

    // Format documents
    const docsStr = context.documents.length > 0
      ? context.documents
          .map((d) => `- **${d.title}**: ${d.preview}`)
          .join("\n")
      : "No relevant documents found.";
    contextStr = contextStr.replace("{{documents}}", docsStr);

    // Format entities
    const entitiesStr = context.entities.length > 0
      ? context.entities
          .map((e) => `- **${e.title}** (${e.type}): ${e.preview}`)
          .join("\n")
      : "No relevant entities found.";
    contextStr = contextStr.replace("{{entities}}", entitiesStr);

    parts.push(contextStr);
  } else if (!mentions || mentions.length === 0) {
    parts.push(CHAT_NO_CONTEXT);
  }

  // Add mentions context
  if (mentions && mentions.length > 0) {
    let mentionsStr = CHAT_MENTION_CONTEXT;
    const mentionsList = mentions
      .map((m) => `- **${m.name}** (${m.type})`)
      .join("\n");
    mentionsStr = mentionsStr.replace("{{mentions}}", mentionsList);
    parts.push(mentionsStr);
  }

  return parts.join("\n\n");
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return createErrorResponse(
      ErrorCode.BAD_REQUEST,
      "Method not allowed. Use POST.",
      origin
    );
  }

  const supabase = createSupabaseClient();

  try {
    // Check billing and get API key (allow anonymous trial for chat)
    const billing = await checkBillingAndGetKey(req, supabase, {
      endpoint: "chat",
      allowAnonymousTrial: true,
    });
    if (!billing.canProceed) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        billing.error ?? "Unable to process request",
        origin,
        billing.errorCode ? { code: billing.errorCode, anonTrialRemaining: billing.anonTrialRemaining } : undefined
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        ErrorCode.BAD_REQUEST,
        "Invalid JSON in request body",
        origin
      );
    }

    // Validate required fields
    const validation = validateRequestBody(body, ["messages", "projectId"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as ChatRequest;

    // Validate messages
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "messages must be a non-empty array",
        origin
      );
    }

    // Validate projectId
    if (typeof request.projectId !== "string" || request.projectId.trim().length === 0) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "projectId must be a non-empty string",
        origin
      );
    }

    const shouldStream = request.stream !== false;

    // Get the last user message for RAG query
    const lastUserMessage = [...request.messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMessage) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "At least one user message is required",
        origin
      );
    }

    // Determine owner ID for memory isolation (userId or anonDeviceId)
    const ownerId = billing.userId ?? billing.anonDeviceId ?? null;

    // Perform RAG and memory/profile retrieval in parallel
    const [context, memoryContext, profileContext] = await Promise.all([
      retrieveRAGContext(lastUserMessage.content, request.projectId, {
        logPrefix: "[ai-chat]",
      }),
      // Pass ownerId and conversationId for proper user/conversation scope isolation
      retrieveMemoryContext(
        lastUserMessage.content,
        request.projectId,
        ownerId,
        request.conversationId,
        DEFAULT_CHAT_LIMITS,
        "[ai-chat]"
      ),
      retrieveProfileContext(supabase, billing.userId, "[ai-chat]"),
    ]);

    // Build context string with all contexts
    const contextString = buildContextString(context, request.mentions, memoryContext, profileContext);

    // Build system prompt with context
    const systemPrompt = `${CHAT_SYSTEM}\n\n${contextString}`;

    // Get the model (use "analysis" for thoughtful responses)
    const modelType = "analysis";
    const model = getOpenRouterModel(billing.apiKey!, modelType);

    // Build messages for AI
    const aiMessages = request.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    if (shouldStream) {
      // Streaming response
      const result = streamText({
        model,
        system: systemPrompt,
        messages: aiMessages,
        temperature: 0.7,
        maxTokens: 2048,
      });

      // Create SSE stream using shared utility
      const stream = createSSEStream(async (sse: SSEStreamController) => {
        try {
          // Send context metadata first
          sse.sendContext(context);

          // Stream text chunks
          for await (const chunk of result.textStream) {
            sse.sendDelta(chunk);
          }

          // Fire-and-forget: don't block stream completion
          result.usage.then((finalUsage) => {
            recordAIRequest(supabase, billing, {
              endpoint: "chat",
              model: "stream",
              modelType,
              usage: extractTokenUsage(finalUsage),
              latencyMs: Date.now() - startTime,
              metadata: { stream: true },
            }).catch((err) => console.error("[ai-chat] Failed to record usage:", err));
          });

          sse.complete();
        } catch (error) {
          console.error("[ai-chat] Streaming error:", error);
          // Record failed request
          await recordAIRequest(supabase, billing, {
            endpoint: "chat",
            model: "stream",
            modelType,
            usage: extractTokenUsage(undefined),
            latencyMs: Date.now() - startTime,
            success: false,
            errorCode: "STREAM_ERROR",
            errorMessage: error instanceof Error ? error.message : "Stream error",
          });
          sse.fail(error);
        }
      });

      return new Response(stream, {
        status: 200,
        headers: getStreamingHeaders(origin),
      });
    } else {
      // Non-streaming response
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: aiMessages,
        temperature: 0.7,
        maxTokens: 2048,
      });

      // Record usage
      const usage = extractTokenUsage(result.usage);
      await recordAIRequest(supabase, billing, {
        endpoint: "chat",
        model: result.response?.modelId ?? "unknown",
        modelType,
        usage,
        latencyMs: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          content: result.text,
          context,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin || "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, x-openrouter-key",
          },
        }
      );
    }
  } catch (error) {
    // Handle DeepInfra errors
    if (error instanceof DeepInfraError) {
      console.warn("[ai-chat] DeepInfra error during RAG:", error.message);
      // Continue without RAG context
    }

    // Handle Qdrant errors
    if (error instanceof QdrantError) {
      console.warn("[ai-chat] Qdrant error during RAG:", error.message);
      // Continue without RAG context
    }

    // Handle AI provider errors
    return handleAIError(error, origin);
  }
});
