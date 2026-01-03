import { createDocument } from "@mythos/db";
import { embedTextViaEdge, EmbeddingApiError } from "../ai";

export const WORLD_SEED_TITLE = "World Seed";
const WORLD_SEED_TYPE = "worldbuilding";
const EMBEDDINGS_ENABLED = import.meta.env["VITE_EMBEDDINGS_ENABLED"] !== "false";
const DEFAULT_ORDER_INDEX = 1;

export type SeedWorldbuildingSource =
  | {
      kind: "blank";
      projectName: string;
      projectDescription?: string;
      genre?: string;
      genesisPrompt?: string;
    }
  | {
      kind: "template";
      projectName: string;
      projectDescription?: string;
      templateId: string;
      templateName: string;
      templateDescription: string;
      entityKinds?: string[];
      relationshipKinds?: string[];
      genre?: string;
    };

export async function createSeedWorldbuildingDoc(params: {
  projectId: string;
  source: SeedWorldbuildingSource;
  orderIndex?: number;
}): Promise<{ documentId: string; contentText: string }> {
  const { projectId, source, orderIndex = DEFAULT_ORDER_INDEX } = params;
  const lines = buildSeedLines(source);
  const contentText = lines.join("\n");
  const content = buildTiptapDoc(lines);
  const wordCount = countWords(contentText);

  const doc = await createDocument({
    project_id: projectId,
    type: WORLD_SEED_TYPE,
    title: WORLD_SEED_TITLE,
    content,
    content_text: contentText,
    order_index: orderIndex,
    word_count: wordCount,
  });

  return { documentId: doc.id, contentText };
}

export async function embedSeedWorldbuildingDoc(params: {
  projectId: string;
  documentId: string;
  title: string;
  contentText: string;
}): Promise<void> {
  if (!EMBEDDINGS_ENABLED) {
    return;
  }

  const contentText = params.contentText.trim();
  if (!contentText) {
    return;
  }

  try {
    await embedTextViaEdge(contentText, {
      qdrant: {
        enabled: true,
        pointId: `doc_${params.documentId}`,
        payload: {
          project_id: params.projectId,
          type: "document",
          document_id: params.documentId,
          title: params.title,
          content_preview: contentText.slice(0, 500),
          updated_at: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    if (error instanceof EmbeddingApiError) {
      console.warn("[seedWorldbuilding] Embedding failed:", error.message);
    } else {
      console.warn("[seedWorldbuilding] Embedding failed:", error);
    }
  }
}

function buildSeedLines(source: SeedWorldbuildingSource): string[] {
  const lines: string[] = [];

  lines.push(`Project: ${source.projectName}`);

  if (source.genre) {
    lines.push(`Genre: ${source.genre}`);
  }

  if (source.projectDescription) {
    lines.push(`Description: ${source.projectDescription}`);
  }

  if (source.kind === "blank") {
    if (source.genesisPrompt) {
      lines.push(`World concept: ${source.genesisPrompt}`);
    }
    return lines;
  }

  lines.push(`Template: ${source.templateName} (${source.templateId})`);
  lines.push(`Template description: ${source.templateDescription}`);

  const entityKinds = formatList(source.entityKinds);
  if (entityKinds) {
    lines.push(`Entity kinds: ${entityKinds}`);
  }

  const relationshipKinds = formatList(source.relationshipKinds);
  if (relationshipKinds) {
    lines.push(`Relationship kinds: ${relationshipKinds}`);
  }

  return lines;
}

function formatList(items?: string[]): string | undefined {
  if (!items || items.length === 0) {
    return undefined;
  }
  return items.join(", ");
}

function buildTiptapDoc(lines: string[]): Record<string, unknown> {
  if (lines.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line
        ? [{ type: "text", text: line }]
        : [],
    })),
  };
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}
