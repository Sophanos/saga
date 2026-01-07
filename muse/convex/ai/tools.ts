/**
 * AI Tool Execution
 *
 * Handles execution of AI tools for the saga agent.
 * Tools can create/update entities, check consistency, generate content, etc.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { generateEmbedding, isDeepInfraConfigured } from "../lib/embeddings";
import { searchPoints, isQdrantConfigured, upsertPoints, type QdrantFilter } from "../lib/qdrant";

// ============================================================
// Constants
// ============================================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const MAX_DECISION_LENGTH = 10000;
const MAX_DECISION_EMBEDDING_CHARS = 8000;
const SAGA_VECTORS_COLLECTION = "saga_vectors";
const SAGA_IMAGES_COLLECTION = "saga_images";

// ============================================================
// Tool Execution Action
// ============================================================

export const execute = internalAction({
  args: {
    toolName: v.string(),
    input: v.any(),
    projectId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { toolName, input, projectId, userId } = args;

    console.log(`[tools.execute] ${toolName}`, { projectId, userId });

    switch (toolName) {
      case "detect_entities":
        return ctx.runAction(internal.ai.detect.detectEntities, {
          text: input.text,
          projectId,
          userId,
          entityTypes: input.entityTypes,
          minConfidence: input.minConfidence,
        });

      case "check_consistency":
        return executeCheckConsistency(input);

      case "genesis_world":
        return executeGenesisWorld(input);

      case "generate_template":
        return executeGenerateTemplate(input);

      case "clarity_check":
        return executeClarityCheck(input);

      case "name_generator":
        return executeNameGenerator(input);

      case "commit_decision":
        return executeCommitDecision(input, projectId, userId);

      case "search_images":
        return executeSearchImages(input, projectId);

      case "find_similar_images":
        return executeFindSimilarImages(input, projectId);

      default:
        throw new Error(
          `Unknown tool: ${toolName}. Supported tools: detect_entities, check_consistency, genesis_world, generate_template, clarity_check, name_generator, commit_decision, search_images, find_similar_images`
        );
    }
  },
});

// ============================================================
// Tool Implementations
// ============================================================

async function executeCheckConsistency(input: {
  text: string;
  focus?: string[];
  entities?: Array<{
    id: string;
    name: string;
    type: string;
    properties?: Record<string, unknown>;
  }>;
}): Promise<{
  issues: Array<{
    type: string;
    severity: string;
    description: string;
    location?: string;
    suggestion?: string;
  }>;
  stats: { total: number; bySeverity: Record<string, number> };
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const focusAreas = input.focus?.length
    ? `Focus on: ${input.focus.join(", ")}`
    : "Check all consistency areas: timeline, character behavior, world rules, relationships";

  const entityContext = input.entities?.length
    ? `\nKnown entities:\n${input.entities.map((e) => `- ${e.name} (${e.type})`).join("\n")}`
    : "";

  const systemPrompt = `You are a story consistency checker. Analyze text for logical inconsistencies, timeline issues, and character behavior problems.

${focusAreas}
${entityContext}

For each issue found, provide:
- type: timeline, character, world_rule, relationship, logic
- severity: error, warning, info
- description: What the issue is
- location: Where in the text (quote if possible)
- suggestion: How to fix it

Respond with JSON containing an "issues" array.`;

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
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Check this text for consistency issues:\n\n${input.text}` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return { issues: [], stats: { total: 0, bySeverity: {} } };
  }

  const parsed = JSON.parse(content);
  const issues = parsed.issues || [];

  const bySeverity: Record<string, number> = {};
  for (const issue of issues) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
  }

  return { issues, stats: { total: issues.length, bySeverity } };
}

async function executeGenesisWorld(input: {
  prompt: string;
  genre?: string;
  entityCount?: number;
  detailLevel?: "minimal" | "standard" | "detailed";
}): Promise<{
  world: {
    name: string;
    description: string;
    genre: string;
    themes: string[];
  };
  entities: Array<{
    name: string;
    type: string;
    description: string;
    properties: Record<string, unknown>;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    description: string;
  }>;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const entityCount = input.entityCount || 10;
  const detailLevel = input.detailLevel || "standard";
  const genre = input.genre || "fantasy";

  const systemPrompt = `You are a worldbuilding assistant. Create a story world based on the user's prompt.

Genre: ${genre}
Entity count: approximately ${entityCount}
Detail level: ${detailLevel}

Generate:
1. World overview (name, description, themes)
2. Key entities (characters, locations, factions, items)
3. Relationships between entities

Respond with JSON containing: world, entities, relationships arrays.`;

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
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content);
}

async function executeGenerateTemplate(input: {
  storyDescription: string;
  genreHints?: string[];
  complexity?: "simple" | "standard" | "complex";
}): Promise<{
  template: {
    genre: string;
    themes: string[];
    structure: string;
  };
  entityTypes: Array<{
    type: string;
    count: number;
    examples: string[];
  }>;
  plotPoints: Array<{
    name: string;
    description: string;
    order: number;
  }>;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const complexity = input.complexity || "standard";
  const genres = input.genreHints?.join(", ") || "any genre";

  const systemPrompt = `You are a story template generator. Create a story structure template based on the description.

Complexity: ${complexity}
Genre hints: ${genres}

Generate:
1. Template overview (genre, themes, narrative structure)
2. Recommended entity types with counts
3. Key plot points in order

Respond with JSON containing: template, entityTypes, plotPoints.`;

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
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.storyDescription },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content || "{}");
}

async function executeClarityCheck(input: {
  text: string;
  maxIssues?: number;
}): Promise<{
  issues: Array<{
    type: string;
    text: string;
    suggestion: string;
    location?: { start: number; end: number };
  }>;
  score: number;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const maxIssues = input.maxIssues || 10;

  const systemPrompt = `You are a writing clarity checker. Analyze text for clarity issues.

Look for:
- Ambiguous pronouns
- Unclear references
- Confusing sentence structure
- Missing context

Return up to ${maxIssues} issues, plus an overall clarity score (0-100).

Respond with JSON containing: issues array and score number.`;

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
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.text },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content || '{"issues":[],"score":100}');
}

async function executeNameGenerator(input: {
  entityType: string;
  genre?: string;
  culture?: string;
  count?: number;
  tone?: string;
}): Promise<{
  names: Array<{
    name: string;
    meaning?: string;
    origin?: string;
  }>;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const count = input.count || 10;
  const genre = input.genre || "fantasy";
  const culture = input.culture || "varied";
  const tone = input.tone || "neutral";

  const systemPrompt = `You are a name generator for fiction. Generate ${count} names.

Entity type: ${input.entityType}
Genre: ${genre}
Cultural inspiration: ${culture}
Tone: ${tone}

For each name, optionally provide meaning and origin.

Respond with JSON containing a "names" array.`;

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
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate ${count} names for a ${input.entityType}` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content || '{"names":[]}');
}

// ============================================================
// Commit Decision Tool
// ============================================================

interface CommitDecisionInput {
  decision: string;
  rationale?: string;
  entityIds?: string[];
  documentId?: string;
  confidence?: number;
  pinned?: boolean;
}

interface CommitDecisionResult {
  memoryId: string;
  content: string;
}

async function executeCommitDecision(
  input: CommitDecisionInput,
  projectId: string,
  userId: string
): Promise<CommitDecisionResult> {
  // Validate input
  const decision = input.decision?.trim();
  if (!decision) {
    throw new Error("decision is required and cannot be empty");
  }
  if (decision.length > MAX_DECISION_LENGTH) {
    throw new Error(`decision exceeds maximum length of ${MAX_DECISION_LENGTH} characters`);
  }

  if (!isDeepInfraConfigured()) {
    throw new Error("Embedding service not configured");
  }

  // Build content with rationale
  const rationale = input.rationale?.trim();
  const content = rationale
    ? `Decision: ${decision}\nRationale: ${rationale}`
    : decision;

  if (content.length > MAX_DECISION_LENGTH) {
    throw new Error(`decision content exceeds maximum length of ${MAX_DECISION_LENGTH} characters`);
  }

  // Generate embedding
  const embeddingText = content.length > MAX_DECISION_EMBEDDING_CHARS
    ? content.slice(0, MAX_DECISION_EMBEDDING_CHARS)
    : content;

  const embedding = await generateEmbedding(embeddingText);
  const memoryId = crypto.randomUUID();
  const now = Date.now();
  const isoNow = new Date(now).toISOString();

  // Calculate expiry (decisions expire in 1 year by default if not pinned)
  const expiresAt = input.pinned !== false
    ? null // Pinned decisions don't expire
    : new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();

  // Build Qdrant payload
  const payload: Record<string, unknown> = {
    project_id: projectId,
    memory_id: memoryId,
    type: "memory",
    category: "decision",
    scope: "project",
    text: content,
    source: "user",
    confidence: input.confidence ?? 1.0,
    entity_ids: input.entityIds ?? [],
    document_id: input.documentId,
    tool_name: "commit_decision",
    pinned: input.pinned ?? true,
    created_at: isoNow,
    created_at_ts: now,
    expires_at: expiresAt,
  };

  // Upsert to Qdrant
  if (isQdrantConfigured()) {
    try {
      await upsertPoints(
        [{
          id: memoryId,
          vector: embedding,
          payload,
        }],
        { collection: SAGA_VECTORS_COLLECTION }
      );
      console.log(`[tools.commit_decision] Stored memory ${memoryId} in Qdrant`);
    } catch (error) {
      console.error("[tools.commit_decision] Qdrant upsert failed:", error);
      // Continue - memory is still valid even without vector storage
    }
  }

  return {
    memoryId,
    content,
  };
}

// ============================================================
// Image Search Tools
// ============================================================

interface SearchImagesInput {
  query: string;
  projectId?: string;
  limit?: number;
  assetType?: string;
  entityId?: string;
  entityType?: string;
  style?: string;
}

interface ImageSearchResult {
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl?: string;
    description?: string;
    entityId?: string;
    entityName?: string;
    assetType?: string;
    style?: string;
    score: number;
  }>;
  total: number;
}

async function executeSearchImages(
  input: SearchImagesInput,
  projectId: string
): Promise<ImageSearchResult> {
  if (!input.query) {
    throw new Error("query is required for image search");
  }

  if (!isDeepInfraConfigured()) {
    throw new Error("Embedding service not configured");
  }

  if (!isQdrantConfigured()) {
    throw new Error("Vector search not configured");
  }

  const limit = Math.min(input.limit ?? 10, 50);

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(input.query);

  // Build filter
  const filter: QdrantFilter = {
    must: [
      { key: "project_id", match: { value: projectId } },
      { key: "type", match: { value: "image" } },
    ],
  };

  if (input.assetType) {
    filter.must!.push({ key: "asset_type", match: { value: input.assetType } });
  }
  if (input.entityId) {
    filter.must!.push({ key: "entity_id", match: { value: input.entityId } });
  }
  if (input.entityType) {
    filter.must!.push({ key: "entity_type", match: { value: input.entityType } });
  }
  if (input.style) {
    filter.must!.push({ key: "style", match: { value: input.style } });
  }

  // Search Qdrant
  const results = await searchPoints(
    queryEmbedding,
    limit,
    filter,
    { collection: SAGA_IMAGES_COLLECTION }
  );

  return {
    images: results.map((r) => ({
      id: r.id,
      url: r.payload.url as string,
      thumbnailUrl: r.payload.thumbnail_url as string | undefined,
      description: r.payload.description as string | undefined,
      entityId: r.payload.entity_id as string | undefined,
      entityName: r.payload.entity_name as string | undefined,
      assetType: r.payload.asset_type as string | undefined,
      style: r.payload.style as string | undefined,
      score: r.score,
    })),
    total: results.length,
  };
}

interface FindSimilarImagesInput {
  assetId: string;
  projectId?: string;
  limit?: number;
  assetType?: string;
}

interface SimilarImagesResult {
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl?: string;
    description?: string;
    entityId?: string;
    entityName?: string;
    assetType?: string;
    similarity: number;
  }>;
  sourceImage?: {
    id: string;
    url: string;
    description?: string;
  };
}

async function executeFindSimilarImages(
  input: FindSimilarImagesInput,
  projectId: string
): Promise<SimilarImagesResult> {
  if (!input.assetId) {
    throw new Error("assetId is required for similar image search");
  }

  if (!isQdrantConfigured()) {
    throw new Error("Vector search not configured");
  }

  const limit = Math.min(input.limit ?? 10, 50);

  // First, get the source image's vector from Qdrant
  // We need to scroll to find the source point
  const sourceFilter: QdrantFilter = {
    must: [{ has_id: [input.assetId] }],
  };

  const sourceResults = await searchPoints(
    [], // Empty vector - we'll use filter
    1,
    sourceFilter,
    { collection: SAGA_IMAGES_COLLECTION }
  );

  if (sourceResults.length === 0) {
    throw new Error(`Source image ${input.assetId} not found`);
  }

  const sourceImage = sourceResults[0];
  const sourceVector = sourceImage.vector;

  if (!sourceVector) {
    throw new Error(`Source image ${input.assetId} has no vector`);
  }

  // Build filter for similar images
  const filter: QdrantFilter = {
    must: [
      { key: "project_id", match: { value: projectId } },
      { key: "type", match: { value: "image" } },
    ],
    must_not: [{ has_id: [input.assetId] }], // Exclude source image
  };

  if (input.assetType) {
    filter.must!.push({ key: "asset_type", match: { value: input.assetType } });
  }

  // Search for similar images
  const results = await searchPoints(
    sourceVector,
    limit,
    filter,
    { collection: SAGA_IMAGES_COLLECTION }
  );

  return {
    images: results.map((r) => ({
      id: r.id,
      url: r.payload.url as string,
      thumbnailUrl: r.payload.thumbnail_url as string | undefined,
      description: r.payload.description as string | undefined,
      entityId: r.payload.entity_id as string | undefined,
      entityName: r.payload.entity_name as string | undefined,
      assetType: r.payload.asset_type as string | undefined,
      similarity: r.score,
    })),
    sourceImage: {
      id: sourceImage.id,
      url: sourceImage.payload.url as string,
      description: sourceImage.payload.description as string | undefined,
    },
  };
}
