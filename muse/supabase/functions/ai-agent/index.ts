import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { streamText } from "https://esm.sh/ai@3.4.0";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import { requireApiKey } from "../_shared/api-key.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  handleAIError,
  validateRequestBody,
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
import {
  AGENT_SYSTEM,
  AGENT_CONTEXT_TEMPLATE,
  AGENT_EDITOR_CONTEXT,
} from "../_shared/prompts/mod.ts";
import { agentTools } from "../_shared/tools/index.ts";

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

interface EditorContext {
  documentTitle?: string;
  selectionText?: string;
  selectionContext?: string;
}

interface AgentRequest {
  messages: Message[];
  projectId: string;
  mentions?: Mention[];
  editorContext?: EditorContext;
  stream?: boolean;
}

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
    console.log("[ai-agent] RAG not configured, skipping retrieval");
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
    console.error("[ai-agent] RAG retrieval error:", error);
    return { documents: [], entities: [] };
  }
}

function buildContextString(context: RAGContext, mentions?: Mention[]): string {
  const parts: string[] = [];

  if (mentions && mentions.length > 0) {
    parts.push("### Mentioned Items");
    for (const mention of mentions) {
      parts.push(`- @${mention.name} (${mention.type})`);
    }
    parts.push("");
  }

  if (context.entities.length > 0) {
    parts.push("### Relevant Entities");
    for (const entity of context.entities) {
      parts.push(`**${entity.name}** (${entity.type})`);
      parts.push(entity.preview);
      parts.push("");
    }
  }

  if (context.documents.length > 0) {
    parts.push("### Relevant Documents");
    for (const doc of context.documents) {
      parts.push(`**${doc.title}**`);
      parts.push(doc.preview);
      parts.push("");
    }
  }

  return parts.length > 0 ? parts.join("\n") : "";
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

  try {
    // Get API key
    const apiKey = requireApiKey(req);

    // Parse request body
    const body = await req.json();
    const validationError = validateRequestBody(body, ["messages", "projectId"]);
    if (validationError) {
      return createErrorResponse(validationError, ErrorCode.VALIDATION_ERROR, 400);
    }

    const {
      messages,
      projectId,
      mentions,
      editorContext,
      stream = true,
    } = body as AgentRequest;

    // Get last user message for RAG query
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUserMessage?.content ?? "";

    // Retrieve context
    const context = await retrieveContext(query, projectId);

    // Build system prompt with context
    let systemPrompt = AGENT_SYSTEM;

    const contextString = buildContextString(context, mentions);
    if (contextString) {
      systemPrompt += "\n\n" + AGENT_CONTEXT_TEMPLATE.replace("{context}", contextString);
    }

    if (editorContext?.documentTitle) {
      let editorContextStr = AGENT_EDITOR_CONTEXT
        .replace("{documentTitle}", editorContext.documentTitle);
      
      if (editorContext.selectionText) {
        editorContextStr = editorContextStr.replace(
          "{selectionContext}",
          `Selected text: "${editorContext.selectionText.slice(0, 500)}..."`
        );
      } else {
        editorContextStr = editorContextStr.replace("{selectionContext}", "");
      }
      
      systemPrompt += "\n\n" + editorContextStr;
    }

    // Build messages array with sliding window to prevent token overflow
    const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...recentMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    // Get model
    const model = getOpenRouterModel(apiKey, "chat");

    // Stream response with tools using modular registry
    const result = streamText({
      model,
      messages: apiMessages,
      tools: agentTools,
      maxSteps: 3, // Allow up to 3 tool calls
    });

    // Create streaming response
    const origin = req.headers.get("Origin");
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send context metadata first
          const contextEvent = `data: ${JSON.stringify({ type: "context", data: context })}\n\n`;
          controller.enqueue(encoder.encode(contextEvent));

          // Use fullStream to get tool call IDs
          const fullStream = result.fullStream;

          for await (const part of fullStream) {
            switch (part.type) {
              case "text-delta":
                // Stream text chunks
                const deltaEvent = `data: ${JSON.stringify({
                  type: "delta",
                  content: part.textDelta
                })}\n\n`;
                controller.enqueue(encoder.encode(deltaEvent));
                break;

              case "tool-call":
                // Send tool call with stable ID from the LLM
                const toolEvent = `data: ${JSON.stringify({
                  type: "tool",
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  args: part.args,
                })}\n\n`;
                controller.enqueue(encoder.encode(toolEvent));
                break;

              case "finish":
                // Stream complete
                break;

              case "error":
                // Handle stream errors
                const errorEvent = `data: ${JSON.stringify({
                  type: "error",
                  message: part.error instanceof Error ? part.error.message : "Stream error",
                })}\n\n`;
                controller.enqueue(encoder.encode(errorEvent));
                break;
            }
          }

          // Send done event
          const doneEvent = `data: ${JSON.stringify({ type: "done" })}\n\n`;
          controller.enqueue(encoder.encode(doneEvent));

          controller.close();
        } catch (error) {
          console.error("[ai-agent] Stream error:", error);
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
  } catch (error) {
    console.error("[ai-agent] Handler error:", error);
    return handleAIError(error);
  }
});
