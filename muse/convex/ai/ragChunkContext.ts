/**
 * RAG Chunk Context Helper
 *
 * Fetches adjacent document chunks from Qdrant for a specific hit.
 */

import { scrollPoints, type QdrantFilter } from "../lib/qdrant";
import { getReadQdrantConfig } from "../lib/qdrantCollections";

export interface ChunkContextOptions {
  before?: number;
  after?: number;
}

export interface ExpandedChunkContext {
  documentId: string;
  chunkIndex: number;
  startIndex: number;
  chunks: string[];
}

function getChunkText(payload: Record<string, unknown>): string {
  if (typeof payload["text"] === "string" && payload["text"]) return payload["text"];
  if (typeof payload["preview"] === "string" && payload["preview"]) return payload["preview"];
  return "";
}

export async function fetchDocumentChunkContext(
  projectId: string,
  documentId: string,
  chunkIndex: number,
  options?: ChunkContextOptions
): Promise<ExpandedChunkContext> {
  const before = options?.before ?? 2;
  const after = options?.after ?? 1;
  const startIndex = Math.max(0, chunkIndex - before);
  const endIndex = chunkIndex + after;

  const filter: QdrantFilter = {
    must: [
      { key: "project_id", match: { value: projectId } },
      { key: "type", match: { value: "document" } },
      { key: "document_id", match: { value: documentId } },
      { key: "chunk_index", range: { gte: startIndex, lte: endIndex } },
    ],
  };

  const points = await scrollPoints(
    filter,
    before + after + 1,
    { orderBy: { key: "chunk_index", direction: "asc" } },
    getReadQdrantConfig("text")
  );

  const chunks = points
    .slice()
    .sort((a, b) => {
      const aIndex = typeof a.payload["chunk_index"] === "number" ? a.payload["chunk_index"] : 0;
      const bIndex = typeof b.payload["chunk_index"] === "number" ? b.payload["chunk_index"] : 0;
      return aIndex - bIndex;
    })
    .map((point) => getChunkText(point.payload));

  return {
    documentId,
    chunkIndex,
    startIndex,
    chunks,
  };
}
