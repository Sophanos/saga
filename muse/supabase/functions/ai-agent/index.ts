import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { streamText } from "https://esm.sh/ai@3.4.0";
import { tool } from "https://esm.sh/ai@3.4.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
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
// Tool Definitions
// =============================================================================

const createEntityTool = tool({
  description: "Propose creating a new entity (character, location, item, faction, or magic system) in the author's world",
  parameters: z.object({
    type: z.enum(["character", "location", "item", "faction", "magic_system"]),
    name: z.string().describe("The name of the entity"),
    aliases: z.array(z.string()).optional().describe("Alternative names or nicknames"),
    notes: z.string().optional().describe("General notes about the entity"),
    // Character-specific
    archetype: z.string().optional().describe("Character archetype (hero, mentor, shadow, etc.)"),
    backstory: z.string().optional().describe("Character's background story"),
    goals: z.array(z.string()).optional().describe("Character's goals and motivations"),
    fears: z.array(z.string()).optional().describe("Character's fears"),
    // Location-specific
    climate: z.string().optional().describe("Climate or weather of the location"),
    atmosphere: z.string().optional().describe("Mood and feeling of the place"),
    // Item-specific
    category: z.enum(["weapon", "armor", "artifact", "consumable", "key", "other"]).optional(),
    abilities: z.array(z.string()).optional().describe("Special abilities or properties"),
    // Faction-specific
    leader: z.string().optional().describe("Name of the faction leader"),
    headquarters: z.string().optional().describe("Main base or location"),
    factionGoals: z.array(z.string()).optional().describe("Faction's goals"),
    // Magic System-specific
    rules: z.array(z.string()).optional().describe("Rules of the magic system"),
    limitations: z.array(z.string()).optional().describe("Limitations and costs"),
  }),
  execute: async (args) => {
    // Tool returns the proposal data - client will handle actual creation
    return {
      toolName: "create_entity",
      proposal: args,
      message: `Proposed creating ${args.type}: "${args.name}"`,
    };
  },
});

const createRelationshipTool = tool({
  description: "Propose creating a relationship between two entities",
  parameters: z.object({
    sourceName: z.string().describe("Name of the source entity"),
    targetName: z.string().describe("Name of the target entity"),
    type: z.enum([
      "knows", "loves", "hates", "killed", "created", "owns", "guards",
      "weakness", "strength", "parent_of", "child_of", "sibling_of",
      "married_to", "allied_with", "enemy_of", "member_of", "rules", "serves"
    ]),
    bidirectional: z.boolean().optional().describe("Whether the relationship goes both ways"),
    notes: z.string().optional().describe("Additional context about the relationship"),
  }),
  execute: async (args) => {
    return {
      toolName: "create_relationship",
      proposal: args,
      message: `Proposed relationship: ${args.sourceName} → ${args.type} → ${args.targetName}`,
    };
  },
});

const generateContentTool = tool({
  description: "Generate creative content like backstories, descriptions, or dialogue",
  parameters: z.object({
    contentType: z.enum(["description", "backstory", "dialogue", "scene"]),
    subject: z.string().describe("What the content is about"),
    tone: z.string().optional().describe("Desired tone (dark, humorous, dramatic, etc.)"),
    length: z.enum(["short", "medium", "long"]).optional(),
  }),
  execute: async (args) => {
    return {
      toolName: "generate_content",
      request: args,
      message: `Generating ${args.contentType} for: ${args.subject}`,
    };
  },
});

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

    // Build messages array
    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    // Get model
    const model = getOpenRouterModel(apiKey, "chat");

    // Stream response with tools
    const result = streamText({
      model,
      messages: apiMessages,
      tools: {
        create_entity: createEntityTool,
        create_relationship: createRelationshipTool,
        generate_content: generateContentTool,
      },
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

          // Stream text and tool results
          for await (const chunk of result.textStream) {
            const event = `data: ${JSON.stringify({ type: "delta", content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(event));
          }

          // Get final result for tool calls
          const finalResult = await result;
          
          // Send any tool calls
          if (finalResult.toolCalls && finalResult.toolCalls.length > 0) {
            for (const toolCall of finalResult.toolCalls) {
              const toolEvent = `data: ${JSON.stringify({
                type: "tool",
                toolName: toolCall.toolName,
                args: toolCall.args,
              })}\n\n`;
              controller.enqueue(encoder.encode(toolEvent));
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
