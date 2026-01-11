import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { getConvexToken } from "../../lib/tokenCache";

export const PROJECT_SEED_TITLE = "World Seed";
const WORLD_SEED_TYPE = "worldbuilding";
const DEFAULT_ORDER_INDEX = 1;
const CONVEX_URL = import.meta.env["VITE_CONVEX_URL"] || "https://convex.cascada.vision";

let cachedClient: ConvexHttpClient | null = null;
let cachedToken: string | null = null;

async function getConvexClient(): Promise<ConvexHttpClient> {
  if (!cachedClient) {
    cachedClient = new ConvexHttpClient(CONVEX_URL);
  }

  const nextToken = await getConvexToken();
  if (!nextToken) {
    throw new Error("Missing Convex auth token");
  }

  if (cachedToken !== nextToken) {
    cachedClient.setAuth(nextToken);
    cachedToken = nextToken;
  }

  return cachedClient;
}

export type SeedProjectContextSource =
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

export async function createSeedProjectContextDoc(params: {
  projectId: string;
  source: SeedProjectContextSource;
  orderIndex?: number;
}): Promise<{ documentId: string; contentText: string }> {
  const { projectId, source, orderIndex = DEFAULT_ORDER_INDEX } = params;
  const lines = buildSeedLines(source);
  const contentText = lines.join("\n");
  const content = buildTiptapDoc(lines);

  const client = await getConvexClient();
  const docId = await client.mutation(api.documents.create, {
    projectId: projectId as Id<"projects">,
    type: WORLD_SEED_TYPE,
    title: PROJECT_SEED_TITLE,
    content,
    contentText,
    orderIndex,
  });

  return { documentId: docId, contentText };
}

export async function embedSeedProjectContextDoc(params: {
  projectId: string;
  documentId: string;
  title: string;
  contentText: string;
}): Promise<void> {
  // Embeddings are enqueued server-side on document creation.
  void params;
}

function buildSeedLines(source: SeedProjectContextSource): string[] {
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
