/**
 * AI Tool Execution
 *
 * Handles execution of AI tools for the saga agent.
 * Tools can create/update entities, check consistency, generate content, etc.
 */

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateEmbedding, isDeepInfraConfigured } from "../lib/embeddings";
import { searchPoints, isQdrantConfigured, upsertPoints, type QdrantFilter } from "../lib/qdrant";
import { fetchPinnedProjectMemories, formatMemoriesForPrompt } from "./canon";
import { CLARITY_CHECK_SYSTEM } from "./prompts/clarity";
import { POLICY_CHECK_SYSTEM } from "./prompts/policy";

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
    source: v.optional(
      v.object({
        suggestionId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
        model: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const { toolName, input, projectId, userId, source } = args;

    console.log(`[tools.execute] ${toolName}`, { projectId, userId });

    switch (toolName) {
      case "detect_entities":
        return ctx.runAction((internal as any)["ai/detect"].detectEntities, {
          text: input.text,
          projectId,
          userId,
          entityTypes: input.entityTypes,
          minConfidence: input.minConfidence,
        });

      case "check_consistency":
        return executeCheckConsistency(input);

      case "genesis_world":
        return ctx.runAction((internal as any)["ai/genesis"].runGenesisLegacy, {
          prompt: input.prompt,
          genre: input.genre,
          entityCount: input.entityCount,
          detailLevel: input.detailLevel,
        });

      case "genesis_world_enhanced":
        return ctx.runAction((internal as any)["ai/genesis"].runGenesis, {
          prompt: input.prompt,
          genre: input.genre,
          entityCount: input.entityCount,
          detailLevel: input.detailLevel,
          includeOutline: input.includeOutline,
        });

      case "persist_genesis_world":
        return ctx.runAction((internal as any)["ai/genesis"].persistGenesisWorld, {
          projectId,
          result: input.result,
          skipEntityTypes: input.skipEntityTypes,
        });

      case "generate_template":
        return executeGenerateTemplate(input);

      case "clarity_check":
        return executeClarityCheck(input, projectId);

      case "policy_check":
        return executePolicyCheck(input, projectId);

      case "name_generator":
        return executeNameGenerator(input);

      case "commit_decision":
        return executeCommitDecision(ctx, input, projectId, userId, source ?? undefined);

      case "search_images":
        return executeSearchImages(input, projectId);

      case "find_similar_images":
        return executeFindSimilarImages(input, projectId);

      case "check_logic":
        return executeCheckLogic(input, projectId);

      case "generate_content":
        return executeGenerateContent(input, projectId);

      case "analyze_image":
        return executeAnalyzeImage(input, projectId);

      default:
        throw new Error(
          `Unknown tool: ${toolName}. Supported tools: detect_entities, check_consistency, genesis_world, genesis_world_enhanced, persist_genesis_world, generate_template, clarity_check, policy_check, name_generator, commit_decision, search_images, find_similar_images, check_logic, generate_content, analyze_image`
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
  const apiKey = process.env["OPENROUTER_API_KEY"];
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
  const apiKey = process.env["OPENROUTER_API_KEY"];
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

interface ClarityCheckResult {
  issues: Array<{
    id?: string;
    type: string;
    text: string;
    line?: number;
    suggestion: string;
    fix?: { oldText: string; newText: string };
  }>;
  summary: string;
  readability?: {
    wordCount: number;
    sentenceCount: number;
    avgWordsPerSentence: number;
    fleschReadingEase: number;
    fleschKincaidGrade: number;
    longSentencePct: number;
  };
}

async function executeClarityCheck(
  input: { text: string; maxIssues?: number },
  projectId: string
): Promise<ClarityCheckResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  // Fetch pinned policies for policy-aware clarity checking
  let policyText: string | undefined;
  try {
    const pinned = await fetchPinnedProjectMemories(projectId, {
      limit: 25,
      categories: ["policy"],
    });
    policyText = pinned.length ? formatMemoriesForPrompt(pinned) : undefined;
  } catch (error) {
    console.warn("[tools.clarity_check] Failed to fetch pinned policies:", error);
    // Continue without policy context
  }

  // Build user content with optional policy context
  const userContent = policyText
    ? `## Pinned Policies:\n${policyText}\n\n## Text to Analyze:\n${input.text}`
    : input.text;

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
        { role: "system", content: CLARITY_CHECK_SYSTEM },
        { role: "user", content: userContent },
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
    return {
      issues: [],
      summary: "Unable to analyze text.",
    };
  }

  const parsed = JSON.parse(content);
  
  // Add IDs to issues for UI tracking
  const issues = (parsed.issues || []).map((issue: Record<string, unknown>, idx: number) => ({
    id: `clarity-${Date.now()}-${idx}`,
    type: issue.type as string,
    text: issue.text as string,
    line: issue.line as number | undefined,
    suggestion: issue.suggestion as string,
    fix: issue.fix as { oldText: string; newText: string } | undefined,
  }));

  return {
    issues,
    summary: parsed.summary || "Clarity analysis complete.",
    readability: parsed.readability,
  };
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
  const apiKey = process.env["OPENROUTER_API_KEY"];
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
// Policy Check Tool
// ============================================================

interface PolicyCheckResult {
  issues: Array<{
    id?: string;
    type: "policy_conflict" | "unverifiable" | "not_testable" | "policy_gap";
    text: string;
    line?: number;
    suggestion: string;
    canonCitations?: Array<{
      memoryId: string;
      excerpt?: string;
      reason?: string;
    }>;
  }>;
  summary: string;
  compliance?: {
    score: number;
    policiesChecked: number;
    conflictsFound: number;
  };
}

async function executePolicyCheck(
  input: { text: string; maxIssues?: number },
  projectId: string
): Promise<PolicyCheckResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  // Fetch pinned policies - this is REQUIRED for policy check
  let policies: Awaited<ReturnType<typeof fetchPinnedProjectMemories>> = [];
  try {
    policies = await fetchPinnedProjectMemories(projectId, {
      limit: 50,
      categories: ["policy", "decision"],
    });
  } catch (error) {
    console.warn("[tools.policy_check] Failed to fetch pinned policies:", error);
  }

  // If no policies exist, return early with helpful message
  if (policies.length === 0) {
    return {
      issues: [],
      summary: "No policies pinned; nothing to check. Pin some style rules or project policies first.",
      compliance: {
        score: 100,
        policiesChecked: 0,
        conflictsFound: 0,
      },
    };
  }

  const policyText = formatMemoriesForPrompt(policies);

  // Build user content with policy context
  const userContent = `## Pinned Policies (${policies.length}):\n${policyText}\n\n## Text to Check:\n${input.text}`;

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
        { role: "system", content: POLICY_CHECK_SYSTEM },
        { role: "user", content: userContent },
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
    return {
      issues: [],
      summary: "Unable to analyze text against policies.",
      compliance: {
        score: 100,
        policiesChecked: policies.length,
        conflictsFound: 0,
      },
    };
  }

  const parsed = JSON.parse(content);

  // Add IDs to issues for UI tracking
  const issues = (parsed.issues || []).map((issue: Record<string, unknown>, idx: number) => ({
    id: `policy-${Date.now()}-${idx}`,
    type: issue.type as PolicyCheckResult["issues"][0]["type"],
    text: issue.text as string,
    line: issue.line as number | undefined,
    suggestion: issue.suggestion as string,
    canonCitations: issue.canonCitations as PolicyCheckResult["issues"][0]["canonCitations"],
  }));

  return {
    issues,
    summary: parsed.summary || `Checked against ${policies.length} policies.`,
    compliance: parsed.compliance || {
      score: 100 - issues.filter((i: { type: string }) => i.type === "policy_conflict").length * 10,
      policiesChecked: policies.length,
      conflictsFound: issues.filter((i: { type: string }) => i.type === "policy_conflict").length,
    },
  };
}

// ============================================================
// Commit Decision Tool
// ============================================================

interface CommitDecisionInput {
  decision: string;
  category?: "decision" | "policy";
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
  ctx: ActionCtx,
  input: CommitDecisionInput,
  projectId: string,
  userId: string,
  source?: {
    suggestionId?: string;
    toolCallId?: string;
    streamId?: string;
    threadId?: string;
    promptMessageId?: string;
    model?: string;
  }
): Promise<CommitDecisionResult> {
  // Validate input
  const decision = input.decision?.trim();
  if (!decision) {
    throw new Error("decision is required and cannot be empty");
  }
  if (input.category && input.category !== "decision" && input.category !== "policy") {
    throw new Error('category must be "decision" or "policy"');
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

  const embedding = await generateEmbedding(embeddingText, { task: "embed_document" });
  const now = Date.now();
  const isoNow = new Date(now).toISOString();

  // Calculate expiry (decisions expire in 1 year by default if not pinned)
  const expiresAtMs =
    input.pinned !== false ? undefined : now + 365 * 24 * 60 * 60 * 1000;
  const expiresAtIso = expiresAtMs ? new Date(expiresAtMs).toISOString() : null;

  const memoryId = await ctx.runMutation(
    (internal as any).memories.createFromDecision,
    {
      projectId: projectId as Id<"projects">,
      userId,
      text: content,
      type: input.category ?? "decision",
      confidence: input.confidence ?? 1.0,
      source: "user",
      entityIds: input.entityIds,
      documentId: input.documentId
        ? (input.documentId as Id<"documents">)
        : undefined,
      pinned: input.pinned ?? true,
      expiresAt: expiresAtMs,
      scope: "project",
      sourceSuggestionId: source?.suggestionId
        ? (source.suggestionId as Id<"knowledgeSuggestions">)
        : undefined,
      sourceToolCallId: source?.toolCallId,
      sourceStreamId: source?.streamId,
      sourceThreadId: source?.threadId,
      promptMessageId: source?.promptMessageId,
      model: source?.model,
    }
  );

  // Build Qdrant payload
  const payload: Record<string, unknown> = {
    project_id: projectId,
    memory_id: memoryId,
    type: "memory",
    category: input.category ?? "decision",
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
    expires_at: expiresAtIso,
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
      await ctx.runMutation((internal as any).memories.updateVectorStatus, {
        memoryId,
        vectorId: memoryId,
      });
    } catch (error) {
      console.error("[tools.commit_decision] Qdrant upsert failed:", error);
      await ctx.runMutation((internal as any).memories.enqueueVectorSync, {
        memoryId,
        projectId: projectId as Id<"projects">,
      });
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
  const queryEmbedding = await generateEmbedding(input.query, { task: "embed_query" });

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
      url: r.payload["url"] as string,
      thumbnailUrl: r.payload["thumbnail_url"] as string | undefined,
      description: r.payload["description"] as string | undefined,
      entityId: r.payload["entity_id"] as string | undefined,
      entityName: r.payload["entity_name"] as string | undefined,
      assetType: r.payload["asset_type"] as string | undefined,
      style: r.payload["style"] as string | undefined,
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
  const sourceFilter: QdrantFilter = {
    must: [{ has_id: [input.assetId] }],
  };

  const sourceResults = await searchPoints(
    [],
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
    must_not: [{ has_id: [input.assetId] }],
  };

  if (input.assetType) {
    filter.must!.push({ key: "asset_type", match: { value: input.assetType } });
  }

  const results = await searchPoints(
    sourceVector,
    limit,
    filter,
    { collection: SAGA_IMAGES_COLLECTION }
  );

  return {
    images: results.map((r) => ({
      id: r.id,
      url: r.payload["url"] as string,
      thumbnailUrl: r.payload["thumbnail_url"] as string | undefined,
      description: r.payload["description"] as string | undefined,
      entityId: r.payload["entity_id"] as string | undefined,
      entityName: r.payload["entity_name"] as string | undefined,
      assetType: r.payload["asset_type"] as string | undefined,
      similarity: r.score,
    })),
    sourceImage: {
      id: sourceImage.id,
      url: sourceImage.payload["url"] as string,
      description: sourceImage.payload["description"] as string | undefined,
    },
  };
}

// ============================================================
// Check Logic Tool
// ============================================================

interface CheckLogicInput {
  text: string;
  focus?: ("magic_rules" | "causality" | "knowledge_state" | "power_scaling")[];
  strictness?: "strict" | "balanced" | "lenient";
  magicSystems?: Array<{
    id: string;
    name: string;
    rules: string[];
    limitations: string[];
    costs?: string[];
  }>;
  characters?: Array<{
    id: string;
    name: string;
    powerLevel?: number;
    knowledge?: string[];
  }>;
}

interface LogicIssue {
  id: string;
  type: "magic_rule_violation" | "causality_break" | "knowledge_violation" | "power_scaling_violation";
  severity: "error" | "warning" | "info";
  message: string;
  violatedRule?: {
    source: string;
    ruleText: string;
    sourceEntityId?: string;
    sourceEntityName?: string;
  };
  suggestion?: string;
  locations?: Array<{
    line?: number;
    startOffset?: number;
    endOffset?: number;
    text: string;
  }>;
}

interface CheckLogicResult {
  issues: LogicIssue[];
  summary?: string;
}

const CHECK_LOGIC_SYSTEM = `You are a story logic validator. Check text for logical consistency against established rules and world state.

Analyze for:
1. Magic rule violations - actions that break the magic system's rules or limitations
2. Causality breaks - effects without causes, or impossible sequences of events
3. Knowledge violations - characters knowing things they shouldn't
4. Power scaling violations - characters doing things beyond their established abilities

For each issue, provide:
- type: magic_rule_violation, causality_break, knowledge_violation, power_scaling_violation
- severity: error (definitely wrong), warning (likely wrong), info (might be intentional)
- message: What the issue is
- violatedRule: { source, ruleText, sourceEntityId?, sourceEntityName? } if applicable
- suggestion: How to fix it
- locations: Array of { line?, text } showing where the issue occurs

Respond with JSON containing an "issues" array and optional "summary".`;

async function executeCheckLogic(
  input: CheckLogicInput,
  projectId: string
): Promise<CheckLogicResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const strictness = input.strictness ?? "balanced";
  const focusAreas = input.focus?.length
    ? `Focus on: ${input.focus.join(", ")}`
    : "Check all logic areas";

  // Build context from magic systems and characters
  let contextParts: string[] = [];
  
  if (input.magicSystems?.length) {
    const magicContext = input.magicSystems.map((ms) => {
      const parts = [`Magic System: ${ms.name} (${ms.id})`];
      parts.push(`Rules: ${ms.rules.join("; ")}`);
      parts.push(`Limitations: ${ms.limitations.join("; ")}`);
      if (ms.costs?.length) parts.push(`Costs: ${ms.costs.join("; ")}`);
      return parts.join("\n");
    }).join("\n\n");
    contextParts.push(`## Magic Systems:\n${magicContext}`);
  }

  if (input.characters?.length) {
    const charContext = input.characters.map((c) => {
      const parts = [`Character: ${c.name} (${c.id})`];
      if (c.powerLevel !== undefined) parts.push(`Power Level: ${c.powerLevel}`);
      if (c.knowledge?.length) parts.push(`Known: ${c.knowledge.join(", ")}`);
      return parts.join(" | ");
    }).join("\n");
    contextParts.push(`## Characters:\n${charContext}`);
  }

  const contextBlock = contextParts.length
    ? `\n\n${contextParts.join("\n\n")}`
    : "";

  const userContent = `${focusAreas}\nStrictness: ${strictness}${contextBlock}\n\n## Text to Analyze:\n${input.text}`;

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
        { role: "system", content: CHECK_LOGIC_SYSTEM },
        { role: "user", content: userContent },
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
    return { issues: [], summary: "Unable to analyze text." };
  }

  const parsed = JSON.parse(content);
  const issues = (parsed.issues || []).map((issue: Record<string, unknown>, idx: number) => ({
    id: `logic-${Date.now()}-${idx}`,
    type: issue.type as LogicIssue["type"],
    severity: issue.severity as LogicIssue["severity"],
    message: issue.message as string,
    violatedRule: issue.violatedRule as LogicIssue["violatedRule"],
    suggestion: issue.suggestion as string | undefined,
    locations: issue.locations as LogicIssue["locations"],
  }));

  return {
    issues,
    summary: parsed.summary || `Found ${issues.length} logic issues.`,
  };
}

// ============================================================
// Generate Content Tool
// ============================================================

interface GenerateContentInput {
  entityId: string;
  contentType: "description" | "backstory" | "dialogue" | "scene";
  context?: string;
  length?: "short" | "medium" | "long";
}

interface GenerateContentResult {
  content: string;
  contentType: string;
  entityId: string;
  wordCount: number;
}

const GENERATE_CONTENT_SYSTEM = `You are a creative writing assistant. Generate high-quality content for worldbuilding entities.

Content types:
- description: Vivid, sensory description of appearance/location/object
- backstory: Character history and formative experiences
- dialogue: In-character speech samples that reveal personality
- scene: A short narrative scene featuring the entity

Write in a literary style appropriate for fiction. Focus on showing rather than telling.
Be specific and evocative. Avoid generic descriptions.

Respond with JSON containing:
- content: The generated text
- wordCount: Approximate word count`;

async function executeGenerateContent(
  input: GenerateContentInput,
  projectId: string
): Promise<GenerateContentResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const length = input.length ?? "medium";
  const wordTargets = { short: 100, medium: 250, long: 500 };
  const targetWords = wordTargets[length];

  const userContent = `Generate ${input.contentType} content for entity ${input.entityId}.

Target length: ~${targetWords} words (${length})
${input.context ? `\nContext: ${input.context}` : ""}

Generate ${input.contentType} content now.`;

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
        { role: "system", content: GENERATE_CONTENT_SYSTEM },
        { role: "user", content: userContent },
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
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content generated");
  }

  const parsed = JSON.parse(content);

  return {
    content: parsed.content || "",
    contentType: input.contentType,
    entityId: input.entityId,
    wordCount: parsed.wordCount || parsed.content?.split(/\s+/).length || 0,
  };
}

// ============================================================
// Analyze Image Tool
// ============================================================

interface AnalyzeImageInput {
  imageSource: string; // Base64 data URL or storage path
  entityTypeHint?: string;
  extractionFocus?: "full" | "appearance" | "environment" | "object";
}

interface AnalyzeImageResult {
  analysis: {
    description: string;
    extractedDetails: Record<string, unknown>;
    suggestedEntityType?: string;
    suggestedName?: string;
    colors: string[];
    mood?: string;
    style?: string;
  };
}

const ANALYZE_IMAGE_SYSTEM = `You are a visual analysis AI for worldbuilding. Analyze images to extract details useful for creating story entities.

Extract:
- description: Detailed visual description
- extractedDetails: Structured data (appearance, clothing, environment, objects, etc.)
- suggestedEntityType: character, location, item, etc.
- suggestedName: If text or obvious name is visible
- colors: Dominant colors
- mood: Overall mood/atmosphere
- style: Art style (realistic, anime, fantasy, etc.)

Be specific and thorough. Focus on details that would be useful for worldbuilding.`;

async function executeAnalyzeImage(
  input: AnalyzeImageInput,
  projectId: string
): Promise<AnalyzeImageResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const focus = input.extractionFocus ?? "full";
  const typeHint = input.entityTypeHint ? `\nEntity type hint: ${input.entityTypeHint}` : "";

  // Check if imageSource is a data URL
  const isDataUrl = input.imageSource.startsWith("data:");
  if (!isDataUrl) {
    throw new Error("Image analysis requires a base64 data URL. Storage path lookup not yet implemented.");
  }

  const userContent = `Analyze this image for worldbuilding details.\nFocus: ${focus}${typeHint}`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://mythos.app",
      "X-Title": "Saga AI",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4", // Vision-capable model
      messages: [
        { role: "system", content: ANALYZE_IMAGE_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: userContent },
            { type: "image_url", image_url: { url: input.imageSource } },
          ],
        },
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
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No analysis generated");
  }

  const parsed = JSON.parse(content);

  return {
    analysis: {
      description: parsed.description || "",
      extractedDetails: parsed.extractedDetails || {},
      suggestedEntityType: parsed.suggestedEntityType,
      suggestedName: parsed.suggestedName,
      colors: parsed.colors || [],
      mood: parsed.mood,
      style: parsed.style,
    },
  };
}
