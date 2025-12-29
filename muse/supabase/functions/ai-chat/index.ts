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
import { streamText, generateText } from "https://esm.sh/ai@3.4.0";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";
import {
  generateEmbedding,
  DeepInfraError,
  isDeepInfraConfigured,
} from "../_shared/deepinfra.ts";
import {
  searchPoints,
  isQdrantConfigured,
  QdrantError,
  type QdrantFilter,
} from "../_shared/qdrant.ts";
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
}

/**
 * Context item from RAG
 */
interface ContextItem {
  id: string;
  title: string;
  type: string;
  preview: string;
}

/**
 * RAG context
 */
interface RAGContext {
  documents: ContextItem[];
  entities: ContextItem[];
}

/**
 * Perform RAG retrieval using the last user message
 */
async function retrieveContext(
  query: string,
  projectId: string,
  limit: number = 5
): Promise<RAGContext> {
  // Check if RAG is configured
  if (!isDeepInfraConfigured() || !isQdrantConfigured()) {
    console.log("[ai-chat] RAG not configured, skipping retrieval");
    return { documents: [], entities: [] };
  }

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Search Qdrant with project filter
    const filter: QdrantFilter = {
      must: [{ key: "project_id", match: { value: projectId } }],
    };

    const results = await searchPoints(queryEmbedding, limit * 2, filter);

    // Transform results into context
    const documents: ContextItem[] = [];
    const entities: ContextItem[] = [];

    for (const hit of results) {
      const payload = hit.payload as Record<string, unknown>;
      const type = payload.type as string;

      const item: ContextItem = {
        id: String(hit.id),
        title: String(payload.title || "Untitled"),
        type,
        preview: String(payload.content_preview || ""),
      };

      if (type === "document") {
        if (documents.length < limit) {
          documents.push(item);
        }
      } else if (type === "entity") {
        if (entities.length < limit) {
          entities.push(item);
        }
      }
    }

    return { documents, entities };
  } catch (error) {
    console.error("[ai-chat] RAG retrieval failed:", error);
    return { documents: [], entities: [] };
  }
}

/**
 * Build context string from RAG results
 */
function buildContextString(context: RAGContext, mentions?: Mention[]): string {
  const parts: string[] = [];

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

/**
 * Get CORS headers for streaming
 */
function getStreamingHeaders(origin: string | null): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-openrouter-key",
  };
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
    // Check billing and get API key
    const billing = await checkBillingAndGetKey(req, supabase);
    if (!billing.canProceed) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        billing.error ?? "Unable to process request",
        origin
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

    // Perform RAG retrieval
    const context = await retrieveContext(
      lastUserMessage.content,
      request.projectId
    );

    // Build context string
    const contextString = buildContextString(context, request.mentions);

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

      // Create a readable stream for SSE
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send context metadata first
            const contextEvent = `data: ${JSON.stringify({ type: "context", data: context })}\n\n`;
            controller.enqueue(encoder.encode(contextEvent));

            // Stream text chunks
            for await (const chunk of result.textStream) {
              const event = `data: ${JSON.stringify({ type: "delta", content: chunk })}\n\n`;
              controller.enqueue(encoder.encode(event));
            }

            // Record usage after stream completes
            const finalUsage = await result.usage;
            await recordAIRequest(supabase, billing, {
              endpoint: "chat",
              model: "stream",
              modelType,
              usage: extractTokenUsage(finalUsage),
              latencyMs: Date.now() - startTime,
              metadata: { stream: true },
            });

            // Send done event
            const doneEvent = `data: ${JSON.stringify({ type: "done" })}\n\n`;
            controller.enqueue(encoder.encode(doneEvent));

            controller.close();
          } catch (error) {
            console.error("[ai-chat] Streaming error:", error);
            const errorEvent = `data: ${JSON.stringify({
              type: "error",
              message: error instanceof Error ? error.message : "Unknown error",
            })}\n\n`;
            controller.enqueue(encoder.encode(errorEvent));
            controller.close();
          }
        },
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
