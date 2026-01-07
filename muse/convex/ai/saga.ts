/**
 * Saga AI Agent Actions
 *
 * Streaming chat agent with RAG context and tool support.
 * Uses Convex actions for external API calls (OpenRouter, Qdrant, DeepInfra).
 *
 * Features:
 * - RAG context retrieval from Qdrant
 * - SSE streaming via delta persistence
 * - Tool proposals and execution
 * - Memory and profile context
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  searchPoints,
  isQdrantConfigured,
  type QdrantFilter,
  type QdrantSearchResult,
} from "../lib/qdrant";
import { generateEmbedding, isDeepInfraConfigured } from "../lib/embeddings";

// ============================================================
// Constants
// ============================================================

const MAX_HISTORY_MESSAGES = 20;
const RAG_LIMIT = 10;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

// ============================================================
// Types
// ============================================================

interface RAGContext {
  documents: Array<{
    id: string;
    title?: string;
    excerpt: string;
    score: number;
    type: string;
  }>;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    excerpt: string;
    score: number;
  }>;
  memories: Array<{
    id: string;
    content: string;
    category: string;
    score: number;
  }>;
}

interface Message {
  role: string;
  content: string;
}

// ============================================================
// RAG Context Retrieval
// ============================================================

async function retrieveRAGContext(
  query: string,
  projectId: string,
  options?: { excludeMemories?: boolean }
): Promise<RAGContext> {
  const context: RAGContext = {
    documents: [],
    entities: [],
    memories: [],
  };

  if (!isQdrantConfigured() || !isDeepInfraConfigured()) {
    console.warn("[saga] Qdrant or DeepInfra not configured, skipping RAG");
    return context;
  }

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Search Qdrant with project filter
    const filter: QdrantFilter = {
      must: [{ key: "project_id", match: { value: projectId } }],
    };

    // Exclude memories if requested
    if (options?.excludeMemories) {
      filter.must_not = [{ key: "type", match: { value: "memory" } }];
    }

    const results = await searchPoints(queryEmbedding, RAG_LIMIT, filter);

    // Categorize results
    for (const result of results) {
      const payload = result.payload;
      const type = payload.type as string;

      if (type === "document") {
        context.documents.push({
          id: payload.id as string,
          title: payload.title as string | undefined,
          excerpt: payload.text as string,
          score: result.score,
          type: payload.document_type as string || "document",
        });
      } else if (type === "entity") {
        context.entities.push({
          id: payload.id as string,
          name: payload.name as string,
          type: payload.entity_type as string,
          excerpt: payload.text as string,
          score: result.score,
        });
      } else if (type === "memory" && !options?.excludeMemories) {
        context.memories.push({
          id: payload.id as string,
          content: payload.text as string,
          category: payload.category as string,
          score: result.score,
        });
      }
    }

    console.log(
      `[saga] RAG context: ${context.documents.length} docs, ` +
      `${context.entities.length} entities, ${context.memories.length} memories`
    );

    return context;
  } catch (error) {
    console.error("[saga] RAG retrieval error:", error);
    return context;
  }
}

// ============================================================
// System Prompt Builder
// ============================================================

function buildSystemPrompt(options: {
  mode?: string;
  ragContext: RAGContext;
  editorContext?: Record<string, unknown>;
}): string {
  const { mode = "editing", ragContext, editorContext } = options;

  let prompt = `You are Saga, an AI writing assistant for fiction authors. You help with worldbuilding, character development, plot consistency, and creative writing.

Current mode: ${mode}

## Your Capabilities
- Detect and track story entities (characters, locations, items, factions, magic systems)
- Check consistency across the narrative
- Provide writing feedback and suggestions
- Help with worldbuilding and plot development
- Answer questions about the story world

## Guidelines
- Be concise and helpful
- Respect the author's creative vision
- Point out inconsistencies gently
- Suggest rather than dictate
- Stay in character as a supportive writing assistant
`;

  // Add RAG context
  if (ragContext.documents.length > 0) {
    prompt += `\n## Relevant Story Content\n`;
    for (const doc of ragContext.documents.slice(0, 5)) {
      prompt += `- ${doc.title || "Untitled"}: ${doc.excerpt.slice(0, 200)}...\n`;
    }
  }

  if (ragContext.entities.length > 0) {
    prompt += `\n## Known Entities\n`;
    for (const entity of ragContext.entities.slice(0, 10)) {
      prompt += `- ${entity.name} (${entity.type}): ${entity.excerpt.slice(0, 100)}...\n`;
    }
  }

  if (ragContext.memories.length > 0) {
    prompt += `\n## Previous Decisions & Context\n`;
    for (const memory of ragContext.memories.slice(0, 5)) {
      prompt += `- [${memory.category}] ${memory.content.slice(0, 150)}...\n`;
    }
  }

  // Add editor context
  if (editorContext?.documentTitle) {
    prompt += `\n## Current Document: ${editorContext.documentTitle}\n`;
  }

  if (editorContext?.selectionText) {
    prompt += `\n## Selected Text\n\`\`\`\n${editorContext.selectionText}\n\`\`\`\n`;
  }

  return prompt;
}

// ============================================================
// Streaming Chat Action
// ============================================================

export const streamChat = internalAction({
  args: {
    streamId: v.string(),
    projectId: v.string(),
    userId: v.string(),
    messages: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
    mentions: v.optional(v.array(v.object({
      type: v.string(),
      id: v.string(),
      name: v.string(),
    }))),
    mode: v.optional(v.string()),
    editorContext: v.optional(v.any()),
    contextHints: v.optional(v.any()),
    conversationId: v.optional(v.string()),
    persistDeltas: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const {
      streamId,
      projectId,
      messages,
      mode,
      editorContext,
      persistDeltas = true,
    } = args;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.ai.streams.fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
    }

    try {
      // Get last user message for RAG query
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
      const query = lastUserMessage?.content || "";

      // Retrieve RAG context
      const ragContext = await retrieveRAGContext(query, projectId, {
        excludeMemories: false,
      });

      // Send context event
      if (persistDeltas) {
        await ctx.runMutation(internal.ai.streams.appendChunk, {
          streamId,
          chunk: {
            type: "context",
            content: "",
            data: ragContext,
          },
        });
      }

      // Build system prompt
      const systemPrompt = buildSystemPrompt({
        mode,
        ragContext,
        editorContext,
      });

      // Build API messages
      const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...recentMessages,
      ];

      // Call OpenRouter with streaming
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://mythos.app",
          "X-Title": "Saga AI",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: apiMessages,
          stream: true,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;

            if (content && persistDeltas) {
              await ctx.runMutation(internal.ai.streams.appendChunk, {
                streamId,
                chunk: {
                  type: "delta",
                  content,
                },
              });
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }

      // Mark stream as complete
      await ctx.runMutation(internal.ai.streams.complete, {
        streamId,
      });

    } catch (error) {
      console.error("[saga.streamChat] Error:", error);
      await ctx.runMutation(internal.ai.streams.fail, {
        streamId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

// ============================================================
// Tool Approval Continuation
// ============================================================

export const continueWithApproval = internalAction({
  args: {
    streamId: v.string(),
    approvalId: v.string(),
    projectId: v.string(),
    userId: v.string(),
    messages: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const { streamId, approvalId, projectId, userId, messages } = args;

    // TODO: Implement tool approval continuation
    // For now, just complete the stream
    await ctx.runMutation(internal.ai.streams.complete, {
      streamId,
      result: { approvalId, approved: true },
    });
  },
});
