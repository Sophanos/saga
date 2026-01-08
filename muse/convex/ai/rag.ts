/**
 * Saga RAG Helpers
 *
 * Retrieves project context from Qdrant and builds system prompts.
 */

import {
  searchPoints,
  isQdrantConfigured,
  type QdrantFilter,
} from "../lib/qdrant";
import { generateEmbedding, isDeepInfraConfigured } from "../lib/embeddings";

const RAG_LIMIT = 10;

export interface RAGContext {
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

export async function retrieveRAGContext(
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
    const queryEmbedding = await generateEmbedding(query);

    const filter: QdrantFilter = {
      must: [{ key: "project_id", match: { value: projectId } }],
    };

    if (options?.excludeMemories) {
      filter.must_not = [{ key: "type", match: { value: "memory" } }];
    }

    const results = await searchPoints(queryEmbedding, RAG_LIMIT, filter);

    for (const result of results) {
      const payload = result.payload;
      const type = payload.type as string;

      if (type === "document") {
        context.documents.push({
          id: payload.id as string,
          title: payload.title as string | undefined,
          excerpt: payload.text as string,
          score: result.score,
          type: (payload.document_type as string) || "document",
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

export function buildSystemPrompt(options: {
  mode?: string;
  ragContext: RAGContext;
  editorContext?: Record<string, unknown>;
}): string {
  const { mode = "editing", ragContext, editorContext } = options;

  let prompt = `You are Saga, an AI writing assistant for fiction authors. You help with worldbuilding, character development, plot consistency, and creative writing.\n\nCurrent mode: ${mode}\n\n## Your Capabilities\n- Detect and track story entities (characters, locations, items, factions, magic systems)\n- Check consistency across the narrative\n- Provide writing feedback and suggestions\n- Help with worldbuilding and plot development\n- Answer questions about the story world\n\n## Guidelines\n- Be concise and helpful\n- Respect the author's creative vision\n- Point out inconsistencies gently\n- Suggest rather than dictate\n- Stay in character as a supportive writing assistant\n`;

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

  if (editorContext?.documentTitle) {
    prompt += `\n## Current Document: ${editorContext.documentTitle}\n`;
  }

  if (editorContext?.selectionText) {
    prompt += `\n## Selected Text\n\`\`\`\n${editorContext.selectionText}\n\`\`\`\n`;
  }

  return prompt;
}
