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
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";
// DeepInfra and Qdrant imports moved to _shared/rag.ts
import {
  retrieveRAGContext,
  type RAGContext,
} from "../_shared/rag.ts";
import {
  AGENT_SYSTEM,
  AGENT_CONTEXT_TEMPLATE,
  AGENT_EDITOR_CONTEXT,
} from "../_shared/prompts/mod.ts";
import { agentTools } from "../_shared/tools/index.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  recordAIRequest,
  extractTokenUsage,
} from "../_shared/billing.ts";

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

// RAGContext type imported from ../shared/rag.ts

// =============================================================================
// Constants
// =============================================================================

const MAX_HISTORY_MESSAGES = 20;

// RAG retrieval extracted to ../shared/rag.ts as retrieveRAGContext
// Fixed bugs: projectId -> project_id, incorrect searchPoints API call

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
      parts.push(`**${entity.title}** (${entity.type})`);
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
// Main Handler
// =============================================================================

serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  const origin = req.headers.get("Origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only allow POST
  if (req.method !== "POST") {
    return createErrorResponse(ErrorCode.BAD_REQUEST, "Method not allowed", origin);
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

    const {
      messages,
      projectId,
      mentions,
      editorContext,
      stream: shouldStream = true,
    } = body as AgentRequest;

    // Get last user message for RAG query
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUserMessage?.content ?? "";

    // Retrieve context (uses shared module with correct project_id key)
    const context = await retrieveRAGContext(query, projectId, {
      logPrefix: "[ai-agent]",
    });

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

    // Get model - using "analysis" for deep understanding in agent interactions
    const modelType = "analysis";
    const model = getOpenRouterModel(billing.apiKey!, modelType);

    // Stream response with tools using modular registry
    const result = streamText({
      model,
      messages: apiMessages,
      tools: agentTools,
      maxSteps: 3, // Allow up to 3 tool calls
    });

    // Create SSE stream using shared utility
    const sseStream = createSSEStream(async (sse: SSEStreamController) => {
      try {
        // Send context metadata first
        sse.sendContext(context);

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

        // Fire-and-forget: don't block stream completion
        result.usage.then((finalUsage) => {
          recordAIRequest(supabase, billing, {
            endpoint: "agent",
            model: "stream",
            modelType,
            usage: extractTokenUsage(finalUsage),
            latencyMs: Date.now() - startTime,
            metadata: { stream: true },
          }).catch((err) => console.error("[ai-agent] Failed to record usage:", err));
        });

        sse.complete();
      } catch (error) {
        console.error("[ai-agent] Stream error:", error);
        // Record failed request
        await recordAIRequest(supabase, billing, {
          endpoint: "agent",
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

    return new Response(sseStream, {
      headers: getStreamingHeaders(origin),
    });
  } catch (error) {
    console.error("[ai-agent] Handler error:", error);
    return handleAIError(error, origin);
  }
});
