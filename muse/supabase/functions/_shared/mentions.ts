import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export interface MentionRef {
  type: "entity" | "document";
  id: string;
  name: string;
}

export interface ResolvedMentionContext {
  documents: Array<{
    id: string;
    title: string;
    contentText: string;
    docType?: string;
  }>;
  entities: Array<{
    id: string;
    name: string;
    entityType: string;
    summaryText: string;
  }>;
}

const DEFAULT_LIMITS = {
  maxDocuments: 3,
  maxEntities: 5,
  maxCharsPerDocument: 1200,
  maxCharsPerEntity: 600,
};

export async function resolveMentionContext(params: {
  supabase: SupabaseClient;
  projectId: string;
  mentions?: MentionRef[];
  limits?: {
    maxDocuments?: number;
    maxEntities?: number;
    maxCharsPerDocument?: number;
    maxCharsPerEntity?: number;
  };
  logPrefix?: string;
}): Promise<ResolvedMentionContext> {
  const { supabase, projectId, mentions, limits, logPrefix = "[mentions]" } = params;

  if (!mentions || mentions.length === 0) {
    return { documents: [], entities: [] };
  }

  const mergedLimits = { ...DEFAULT_LIMITS, ...limits };
  const deduped = new Map<string, MentionRef>();
  for (const mention of mentions) {
    const key = `${mention.type}:${mention.id}`;
    if (!deduped.has(key)) {
      deduped.set(key, mention);
    }
  }

  const docIds = Array.from(deduped.values())
    .filter((mention) => mention.type === "document")
    .map((mention) => mention.id)
    .slice(0, mergedLimits.maxDocuments);

  const entityIds = Array.from(deduped.values())
    .filter((mention) => mention.type === "entity")
    .map((mention) => mention.id)
    .slice(0, mergedLimits.maxEntities);

  const [documents, entities] = await Promise.all([
    fetchMentionedDocuments(
      supabase,
      projectId,
      docIds,
      mergedLimits.maxCharsPerDocument,
      logPrefix
    ),
    fetchMentionedEntities(
      supabase,
      projectId,
      entityIds,
      mergedLimits.maxCharsPerEntity,
      logPrefix
    ),
  ]);

  return { documents, entities };
}

async function fetchMentionedDocuments(
  supabase: SupabaseClient,
  projectId: string,
  docIds: string[],
  maxChars: number,
  logPrefix: string
): Promise<ResolvedMentionContext["documents"]> {
  if (docIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id,title,type,content_text")
    .eq("project_id", projectId)
    .in("id", docIds);

  if (error) {
    console.warn(`${logPrefix} Failed to resolve document mentions: ${error.message}`);
    return [];
  }

  return (data ?? []).map((doc) => {
    const rawText = typeof doc.content_text === "string" ? doc.content_text : "";
    const contentText = truncateText(normalizeText(rawText), maxChars);
    return {
      id: doc.id,
      title: doc.title ?? "Untitled",
      contentText,
      docType: typeof doc.type === "string" ? doc.type : undefined,
    };
  });
}

async function fetchMentionedEntities(
  supabase: SupabaseClient,
  projectId: string,
  entityIds: string[],
  maxChars: number,
  logPrefix: string
): Promise<ResolvedMentionContext["entities"]> {
  if (entityIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("entities")
    .select("id,name,type,aliases,properties")
    .eq("project_id", projectId)
    .in("id", entityIds);

  if (error) {
    console.warn(`${logPrefix} Failed to resolve entity mentions: ${error.message}`);
    return [];
  }

  return (data ?? []).map((entity) => {
    const summaryText = truncateText(formatEntitySummary(entity), maxChars);
    return {
      id: entity.id,
      name: entity.name ?? "Unknown",
      entityType: entity.type ?? "unknown",
      summaryText,
    };
  });
}

function formatEntitySummary(entity: {
  name?: string | null;
  aliases?: string[] | null;
  properties?: Record<string, unknown> | null;
}): string {
  const parts: string[] = [];

  if (entity.aliases && entity.aliases.length > 0) {
    parts.push(`Aliases: ${entity.aliases.join(", ")}`);
  }

  const properties = entity.properties ?? {};
  const description = typeof properties.description === "string" ? properties.description : "";
  if (description) {
    parts.push(`Description: ${description}`);
  }

  const propertyPairs = Object.entries(properties)
    .filter(([key, value]) =>
      key !== "description" &&
      (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    )
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${value}`);

  if (propertyPairs.length > 0) {
    parts.push(`Properties: ${propertyPairs.join(", ")}`);
  }

  return normalizeText(parts.join(" ")) || "No additional details provided.";
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncateText(text: string, maxChars: number): string {
  if (maxChars <= 0) {
    return "";
  }
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars).trim() + "...";
}
