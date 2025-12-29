/**
 * Document mappers: DB <-> Core type conversions
 */

import type { Database } from "../types/database";
import type { Document } from "@mythos/core";

// DB types
export type DbDocument = Database["public"]["Tables"]["documents"]["Row"];

export function mapDbDocumentToDocument(dbDoc: DbDocument): Document {
  return {
    id: dbDoc.id,
    projectId: dbDoc.project_id,
    parentId: dbDoc.parent_id ?? undefined,
    type: dbDoc.type as Document["type"],
    title: dbDoc.title ?? undefined,
    content: dbDoc.content,
    orderIndex: dbDoc.order_index,
    wordCount: dbDoc.word_count,
    createdAt: new Date(dbDoc.created_at),
    updatedAt: new Date(dbDoc.updated_at),
  };
}
