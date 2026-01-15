/**
 * AI Tool Execution
 *
 * Handles execution of AI tools for the saga agent.
 * Tools can create/update entities, check consistency, generate content, etc.
 */

"use node";

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateEmbedding, isDeepInfraConfigured } from "../lib/embeddings";
import { searchPoints, isQdrantConfigured, upsertPoints, type QdrantFilter } from "../lib/qdrant";
import { fetchPinnedProjectMemories, formatMemoriesForPrompt, type DecisionCategory } from "./canon";
import { CLARITY_CHECK_SYSTEM } from "./prompts/clarity";
import { POLICY_CHECK_SYSTEM } from "./prompts/policy";
import type {
  AnalyzeContentArgs,
  AnalyzeContentResult,
  AnalyzeImageArgs,
  AnalyzeImageResult,
  GenerateTemplateArgs,
  GenerateTemplateResult,
  GenesisEntity,
  ProjectManageResult,
  TemplateDraft,
  TemplateDocumentKind,
  TemplateEntityKind,
  TemplateLinterRule,
  TemplateRelationshipKind,
  TemplateUIModule,
} from "../../packages/agent-protocol/src/tools";

// ============================================================
// Constants
// ============================================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const MAX_DECISION_LENGTH = 10000;
const MAX_DECISION_EMBEDDING_CHARS = 8000;
const SAGA_VECTORS_COLLECTION = "saga_vectors";
const SAGA_IMAGES_COLLECTION = "saga_images";
const DEFAULT_ANALYZE_TEXT_MAX_CHARS = 20000;
const ANALYZE_TEXT_MAX_CHARS = resolveAnalyzeTextMaxChars();

function resolveAnalyzeTextMaxChars(): number {
  const raw = process.env["ANALYZE_TEXT_MAX_CHARS"];
  if (!raw) return DEFAULT_ANALYZE_TEXT_MAX_CHARS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ANALYZE_TEXT_MAX_CHARS;
  return Math.floor(parsed);
}

function truncateAnalyzeText(text: string): { text: string; truncated: boolean } {
  if (text.length <= ANALYZE_TEXT_MAX_CHARS) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, ANALYZE_TEXT_MAX_CHARS), truncated: true };
}

type OpenRouterJsonRequest = {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
};

async function callOpenRouterJson<T>(params: OpenRouterJsonRequest): Promise<T> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://mythos.app",
      "X-Title": "Saga AI",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      response_format: { type: "json_object" },
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  return JSON.parse(content) as T;
}

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
      case "analyze_content":
        return executeAnalyzeContent(ctx, input as AnalyzeContentArgs, projectId, userId);

      case "detect_entities": {
        const result = await executeAnalyzeContent(
          ctx,
          {
            mode: "entities",
            text: input.text,
            options: {
              entityTypes: input.entityTypes,
              minConfidence: input.minConfidence,
            },
          },
          projectId,
          userId
        );
        const stats = result.mode === "entities" ? (result.stats as { warnings?: unknown[] } | undefined) : undefined;
        return {
          entities: result.mode === "entities" ? result.entities : [],
          warnings: stats?.warnings,
        };
      }

      case "check_consistency": {
        const result = await executeAnalyzeContent(
          ctx,
          {
            mode: "consistency",
            text: input.text,
            options: { focus: input.focus },
          },
          projectId,
          userId
        );
        const stats = result.mode === "consistency" ? (result.stats as { rawIssues?: unknown[] } | undefined) : undefined;
        return {
          issues: Array.isArray(stats?.rawIssues) ? stats?.rawIssues : [],
          summary: result.summary,
        };
      }

      case "project_manage":
        return executeProjectManage(ctx, input, projectId);

      case "generate_template":
        return executeGenerateTemplate(input);

      case "clarity_check": {
        const result = await executeAnalyzeContent(
          ctx,
          {
            mode: "clarity",
            text: input.text,
            options: { maxIssues: input.maxIssues },
          },
          projectId,
          userId
        );
        const stats = result.mode === "clarity" ? (result.stats as { rawIssues?: unknown[]; readability?: unknown } | undefined) : undefined;
        return {
          issues: Array.isArray(stats?.rawIssues) ? stats?.rawIssues : [],
          summary: result.summary,
          readability: stats?.readability,
        };
      }

      case "policy_check": {
        const result = await executeAnalyzeContent(
          ctx,
          {
            mode: "policy",
            text: input.text,
            options: { maxIssues: input.maxIssues },
          },
          projectId,
          userId
        );
        const stats = result.mode === "policy" ? (result.stats as { rawIssues?: unknown[]; compliance?: unknown } | undefined) : undefined;
        return {
          issues: Array.isArray(stats?.rawIssues) ? stats?.rawIssues : [],
          summary: result.summary,
          compliance: stats?.compliance,
        };
      }

      case "name_generator":
        return executeNameGenerator(input);

      case "commit_decision":
        return executeCommitDecision(ctx, input, projectId, userId, source ?? undefined);

      case "search_images": {
        // Legacy alias: route through unified analyze_image with mode="search"
        const searchResult = await executeAnalyzeImage(ctx, {
          mode: "search",
          query: input.query,
          options: {
            limit: input.limit,
            assetType: input.assetType,
            entityType: input.entityType,
            style: input.style,
          },
        }, projectId, userId);
        // Transform to legacy shape
        if (searchResult.mode === "search") {
          return { query: searchResult.query, results: searchResult.results };
        }
        throw new Error("Unexpected result mode from search_images");
      }

      case "find_similar_images": {
        // Legacy alias: route through unified analyze_image with mode="similar"
        const similarResult = await executeAnalyzeImage(ctx, {
          mode: "similar",
          assetId: input.assetId,
          entityName: input.entityName,
          options: {
            limit: input.limit,
            assetType: input.assetType,
            entityType: input.entityType,
          },
        }, projectId, userId);
        // Transform to legacy shape
        if (similarResult.mode === "similar") {
          return { referenceAssetId: similarResult.referenceAssetId, results: similarResult.results };
        }
        throw new Error("Unexpected result mode from find_similar_images");
      }

      case "check_logic": {
        const result = await executeAnalyzeContent(
          ctx,
          {
            mode: "logic",
            text: input.text,
            options: { focus: input.focus, strictness: input.strictness },
          },
          projectId,
          userId
        );
        const stats = result.mode === "logic" ? (result.stats as { rawIssues?: unknown[] } | undefined) : undefined;
        return {
          issues: Array.isArray(stats?.rawIssues) ? stats?.rawIssues : [],
          summary: result.summary,
        };
      }

      case "generate_content":
        return executeGenerateContent(input, projectId);

      case "analyze_image":
        return executeAnalyzeImage(ctx, input as AnalyzeImageArgs, projectId, userId);

      default:
        throw new Error(
          `Unknown tool: ${toolName}. Supported tools: project_manage, analyze_content, detect_entities, check_consistency, generate_template, clarity_check, policy_check, check_logic, name_generator, commit_decision, search_images, find_similar_images, generate_content, analyze_image`
        );
    }
  },
});

// ============================================================
// Tool Implementations
// ============================================================

async function executeProjectManage(
  ctx: ActionCtx,
  input: unknown,
  projectId: string
): Promise<ProjectManageResult> {
  if (!input || typeof input !== "object") {
    throw new Error("project_manage input is required");
  }

  const record = input as Record<string, unknown>;
  const action = record["action"];

  if (action === "bootstrap") {
    const description =
      typeof record["description"] === "string" ? record["description"].trim() : "";
    if (!description) {
      throw new Error("project_manage.bootstrap requires a description");
    }

    const seedRaw = record["seed"];
    const seed = typeof seedRaw === "boolean" ? seedRaw : true;

    const genre = typeof record["genre"] === "string" ? (record["genre"] as string) : undefined;
    const entityCount =
      typeof record["entityCount"] === "number" ? (record["entityCount"] as number) : undefined;
    const detailLevelRaw = typeof record["detailLevel"] === "string" ? record["detailLevel"] : undefined;
    const detailLevel =
      detailLevelRaw === "minimal" || detailLevelRaw === "standard" || detailLevelRaw === "detailed"
        ? detailLevelRaw
        : undefined;
    const includeOutline =
      typeof record["includeOutline"] === "boolean" ? (record["includeOutline"] as boolean) : true;
    const skipEntityTypes = Array.isArray(record["skipEntityTypes"])
      ? (record["skipEntityTypes"] as unknown[]).filter((t) => typeof t === "string")
      : undefined;

    let templateComplexity: "simple" | "standard" | "complex" = "standard";
    if (detailLevel === "minimal") {
      templateComplexity = "simple";
    } else if (detailLevel === "detailed") {
      templateComplexity = "complex";
    }

    // Always generate template structure
    const templateResult = await executeGenerateTemplate({
      storyDescription: description,
      genreHints: genre ? [genre] : undefined,
      complexity: detailLevel ? templateComplexity : undefined,
    });

    // Structure-only: return template without running genesis
    if (!seed) {
      return {
        action: "bootstrap",
        status: "ok",
        persisted: false,
        template: templateResult?.template,
        suggestedStarterEntities: templateResult?.suggestedStarterEntities,
        worldSummary: "",
        entities: [],
        relationships: [],
      };
    }

    const genesisResult = await ctx.runAction((internal as any)["ai/genesis"].runGenesis, {
      prompt: description,
      genre,
      entityCount,
      detailLevel,
      includeOutline,
    });

    const entities = Array.isArray(genesisResult?.entities)
      ? (genesisResult.entities as Array<{
          name: string;
          type: string;
          description: string;
          properties?: Record<string, unknown>;
          relationships?: Array<{
            targetName: string;
            type: string;
            description?: string;
          }>;
        }>)
      : [];

    const relationships = entities.flatMap((entity) => {
      const rels = Array.isArray(entity.relationships) ? entity.relationships : [];
      return rels
        .filter((rel) => typeof rel?.targetName === "string" && rel.targetName.length > 0)
        .map((rel) => ({
          source: entity.name,
          target: rel.targetName,
          type: rel.type,
          description: rel.description,
        }));
    });

    const baseResult: ProjectManageResult = {
      action: "bootstrap",
      status: "ok",
      persisted: seed,
      template: templateResult?.template,
      suggestedStarterEntities: templateResult?.suggestedStarterEntities,
      worldSummary: typeof genesisResult?.worldSummary === "string" ? genesisResult.worldSummary : "",
      suggestedTitle:
        typeof genesisResult?.suggestedTitle === "string" ? genesisResult.suggestedTitle : undefined,
      outline: Array.isArray(genesisResult?.outline)
        ? (genesisResult.outline as Array<{ title: string; summary: string }>)
        : undefined,
      entities: entities.map((entity) => ({
        name: entity.name,
        type: entity.type,
        description: entity.description,
        properties: entity.properties,
      })),
      relationships,
    };

    if (!seed) {
      return baseResult;
    }

    if (projectId === "template-builder") {
      return {
        action: "bootstrap",
        status: "ok",
        persisted: false,
        worldSummary: baseResult.worldSummary,
        suggestedTitle: baseResult.suggestedTitle,
        outline: baseResult.outline,
        entities: baseResult.entities,
        relationships: baseResult.relationships,
        persistence: {
          success: false,
          entitiesCreated: 0,
          relationshipsCreated: 0,
          errors: ["Cannot persist bootstrap results in template-builder mode."],
        },
      };
    }

    const persistResult = await ctx.runAction((internal as any)["ai/genesis"].persistGenesisWorld, {
      projectId: projectId as Id<"projects">,
      result: genesisResult,
      skipEntityTypes,
    });

    return {
      ...baseResult,
      persistence: {
        success: !!persistResult?.success,
        entitiesCreated: typeof persistResult?.entitiesCreated === "number" ? persistResult.entitiesCreated : 0,
        relationshipsCreated:
          typeof persistResult?.relationshipsCreated === "number" ? persistResult.relationshipsCreated : 0,
        errors: Array.isArray(persistResult?.errors)
          ? (persistResult.errors as unknown[]).filter((e) => typeof e === "string")
          : [],
      },
    };
  }

  if (action === "restructure" || action === "pivot") {
    return {
      action,
      status: "not_implemented",
      message: "project_manage currently supports action: bootstrap only.",
      supportedActions: ["bootstrap"],
    } satisfies ProjectManageResult;
  }

  throw new Error('project_manage requires action: "bootstrap" | "restructure" | "pivot"');
}

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
  type ConsistencyIssue = {
    type: string;
    severity: string;
    description: string;
    location?: string;
    suggestion?: string;
  };

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

  const parsed = await callOpenRouterJson<{ issues?: Array<Record<string, unknown>> }>({
    model: DEFAULT_MODEL,
    system: systemPrompt,
    user: `Check this text for consistency issues:\n\n${input.text}`,
    maxTokens: 4096,
  });

  const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
  const issues: ConsistencyIssue[] = rawIssues.map((issue) => {
    const record =
      typeof issue === "object" && issue !== null ? (issue as Record<string, unknown>) : ({} as Record<string, unknown>);
    const type = typeof record["type"] === "string" ? record["type"] : "consistency";
    const severity = typeof record["severity"] === "string" ? record["severity"] : "warning";
    const description = typeof record["description"] === "string" ? record["description"] : "";
    const location = typeof record["location"] === "string" ? record["location"] : undefined;
    const suggestion = typeof record["suggestion"] === "string" ? record["suggestion"] : undefined;
    return { type, severity, description, location, suggestion };
  });

  const bySeverity: Record<string, number> = {};
  for (const issue of issues) {
    const severity = issue.severity || "unknown";
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  }

  return { issues, stats: { total: issues.length, bySeverity } };
}

async function executeAnalyzeContent(
  ctx: ActionCtx,
  input: AnalyzeContentArgs,
  projectId: string,
  userId: string
): Promise<AnalyzeContentResult> {
  const truncatedInput = truncateAnalyzeText(input.text);
  if (truncatedInput.truncated) {
    console.warn("[tools.analyze_content] Truncated analysis input", {
      originalLength: input.text.length,
      truncatedLength: truncatedInput.text.length,
      mode: input.mode,
      projectId,
    });
  }
  const text = truncatedInput.text;

  switch (input.mode) {
    case "entities": {
      const result = await ctx.runAction((internal as any)["ai/detect"].detectEntities, {
        text,
        projectId,
        userId,
        entityTypes: input.options?.entityTypes,
        minConfidence: input.options?.minConfidence,
      });
      const entities = Array.isArray(result?.entities) ? result.entities : [];
      const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
      const summary = entities.length > 0
        ? `Detected ${entities.length} entities.`
        : "No entities detected.";
      return {
        mode: "entities",
        summary,
        entities,
        stats: { warnings },
      };
    }
    case "consistency": {
      const result = await executeCheckConsistency({
        text,
        focus: input.options?.focus,
      });
      const issues = result.issues ?? [];
      const normalized = issues.map((issue, index) => ({
        id: `consistency-${Date.now()}-${index}`,
        type: issue.type ?? "consistency",
        severity: issue.severity ?? "warning",
        message: issue.description ?? "",
        suggestion: issue.suggestion,
        locations: issue.location ? [{ text: issue.location }] : undefined,
      }));
      const summary = `Found ${issues.length} consistency issue${issues.length === 1 ? "" : "s"}.`;
      return {
        mode: "consistency",
        summary,
        issues: normalized,
        stats: { rawIssues: issues, totals: result.stats },
      };
    }
    case "logic": {
      const result = await executeCheckLogic(
        {
          text,
          focus: input.options?.focus as CheckLogicInput["focus"],
          strictness: input.options?.strictness as CheckLogicInput["strictness"],
        },
        projectId
      );
      const issues = result.issues ?? [];
      const normalized = issues.map((issue, index) => ({
        id: issue.id ?? `logic-${Date.now()}-${index}`,
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        suggestion: issue.suggestion,
        locations: issue.locations,
      }));
      const summary = result.summary ?? `Found ${issues.length} logic issue${issues.length === 1 ? "" : "s"}.`;
      return {
        mode: "logic",
        summary,
        issues: normalized,
        stats: { rawIssues: issues },
      };
    }
    case "clarity": {
      const result = await executeClarityCheck(
        { text, maxIssues: input.options?.maxIssues },
        projectId
      );
      const issues = result.issues ?? [];
      const normalized = issues.map((issue, index) => ({
        id: issue.id ?? `clarity-${Date.now()}-${index}`,
        type: issue.type,
        severity: "warning",
        message: issue.text,
        suggestion: issue.suggestion,
        locations: issue.line ? [{ line: issue.line, text: issue.text }] : undefined,
      }));
      return {
        mode: "clarity",
        summary: result.summary || `Found ${issues.length} clarity issue${issues.length === 1 ? "" : "s"}.`,
        issues: normalized,
        stats: { rawIssues: issues, readability: result.readability },
      };
    }
    case "policy": {
      const result = await executePolicyCheck(
        { text, maxIssues: input.options?.maxIssues },
        projectId
      );
      const issues = result.issues ?? [];
      const normalized = issues.map((issue, index) => ({
        id: issue.id ?? `policy-${Date.now()}-${index}`,
        type: issue.type,
        severity: "warning",
        message: issue.text,
        suggestion: issue.suggestion,
        locations: issue.line ? [{ line: issue.line, text: issue.text }] : undefined,
      }));
      return {
        mode: "policy",
        summary: result.summary,
        issues: normalized,
        stats: { rawIssues: issues, compliance: result.compliance },
      };
    }
    default:
      return {
        mode: "consistency",
        summary: "Unsupported analysis mode.",
        issues: [],
      };
  }
}

type NormalizedGenerateTemplateArgs = {
  prompt: string;
  baseTemplateId?: string;
  complexity: "simple" | "standard" | "complex";
  genreHints?: string[];
};

type DomainKey = "story" | "product" | "engineering" | "design" | "comms" | "cinema";

type DomainBlueprint = {
  label: string;
  summary: string;
  tags: string[];
  entityKindSeeds: Array<{ kind: string; label: string; category: TemplateEntityKind["category"] }>;
  relationshipKindSeeds: Array<{ kind: string; label: string; category: TemplateRelationshipKind["category"] }>;
  documentKindSeeds: TemplateDocumentKind[];
  uiModuleSeeds: TemplateUIModule[];
  linterRuleSeeds: TemplateLinterRule[];
};

const ENTITY_CATEGORY_VALUES: TemplateEntityKind["category"][] = [
  "agent",
  "place",
  "object",
  "system",
  "organization",
  "temporal",
  "abstract",
];

const RELATIONSHIP_CATEGORY_VALUES: TemplateRelationshipKind["category"][] = [
  "interpersonal",
  "familial",
  "power",
  "ability",
  "custom",
];

const FIELD_KIND_VALUES: TemplateEntityKind["fields"][number]["kind"][] = [
  "string",
  "text",
  "number",
  "boolean",
  "enum",
  "tags",
  "entity_ref",
];

const LINTER_SEVERITY_VALUES: TemplateLinterRule["defaultSeverity"][] = [
  "error",
  "warning",
  "info",
];

const LINTER_CATEGORY_VALUES: TemplateLinterRule["category"][] = [
  "character",
  "world",
  "plot",
  "timeline",
  "style",
];

const UI_MODULE_ALLOWLIST = new Set<string>([
  "manifest",
  "console",
  "hud",
  "chat",
  "linter",
  "dynamics",
  "coach",
  "history",
  "editor",
  "project_graph",
  "map",
  "timeline",
  "codex",
  "storyboard",
  "outline",
  "character_arcs",
  "scene_beats",
]);

const ENTITY_CATEGORY_COLORS: Record<TemplateEntityKind["category"], string> = {
  agent: "#f97316",
  place: "#06b6d4",
  object: "#f59e0b",
  system: "#8b5cf6",
  organization: "#10b981",
  temporal: "#6366f1",
  abstract: "#64748b",
};

const DOMAIN_BLUEPRINTS: Record<DomainKey, DomainBlueprint> = {
  story: {
    label: "Story / World",
    summary: "Fictional worlds with characters, locations, and narrative arcs.",
    tags: ["story", "world", "character", "arc", "lore"],
    entityKindSeeds: [
      { kind: "character", label: "Character", category: "agent" },
      { kind: "location", label: "Location", category: "place" },
      { kind: "faction", label: "Faction", category: "organization" },
      { kind: "magic_system", label: "Magic System", category: "system" },
      { kind: "artifact", label: "Artifact", category: "object" },
      { kind: "event", label: "Event", category: "temporal" },
    ],
    relationshipKindSeeds: [
      { kind: "allied_with", label: "Allied With", category: "interpersonal" },
      { kind: "enemy_of", label: "Enemy Of", category: "power" },
      { kind: "mentors", label: "Mentors", category: "familial" },
      { kind: "located_in", label: "Located In", category: "custom" },
    ],
    documentKindSeeds: [
      { kind: "chapter", label: "Chapter", allowChildren: true },
      { kind: "scene", label: "Scene", allowChildren: false },
      { kind: "worldbuilding", label: "World Note", allowChildren: false },
      { kind: "timeline", label: "Timeline", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "project_graph", enabled: true, order: 3 },
      { module: "timeline", enabled: true, order: 4 },
      { module: "codex", enabled: true, order: 5 },
    ],
    linterRuleSeeds: [
      {
        id: "character_consistency",
        label: "Character Consistency",
        description: "Keep character motivations and traits consistent across scenes.",
        defaultSeverity: "warning",
        category: "character",
      },
      {
        id: "world_rules",
        label: "World Rules",
        description: "Ensure magic or tech rules remain consistent.",
        defaultSeverity: "warning",
        category: "world",
      },
      {
        id: "plot_continuity",
        label: "Plot Continuity",
        description: "Avoid timeline contradictions and plot holes.",
        defaultSeverity: "warning",
        category: "plot",
      },
    ],
  },
  product: {
    label: "Product",
    summary: "Product strategy, features, and releases.",
    tags: ["product", "roadmap", "feature", "persona"],
    entityKindSeeds: [
      { kind: "persona", label: "Persona", category: "agent" },
      { kind: "feature", label: "Feature", category: "object" },
      { kind: "epic", label: "Epic", category: "temporal" },
      { kind: "metric", label: "Metric", category: "abstract" },
      { kind: "release", label: "Release", category: "temporal" },
      { kind: "market", label: "Market", category: "organization" },
    ],
    relationshipKindSeeds: [
      { kind: "depends_on", label: "Depends On", category: "custom" },
      { kind: "owned_by", label: "Owned By", category: "power" },
      { kind: "ships_in", label: "Ships In", category: "custom" },
      { kind: "measured_by", label: "Measured By", category: "custom" },
    ],
    documentKindSeeds: [
      { kind: "prd", label: "PRD", allowChildren: false },
      { kind: "spec", label: "Spec", allowChildren: false },
      { kind: "roadmap", label: "Roadmap", allowChildren: false },
      { kind: "release_notes", label: "Release Notes", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "project_graph", enabled: true, order: 3 },
      { module: "timeline", enabled: true, order: 4 },
      { module: "console", enabled: true, order: 5 },
    ],
    linterRuleSeeds: [
      {
        id: "user_focus",
        label: "User Focus",
        description: "Ensure each feature references a primary user or persona.",
        defaultSeverity: "warning",
        category: "character",
      },
      {
        id: "metric_alignment",
        label: "Metric Alignment",
        description: "Tie initiatives to measurable outcomes.",
        defaultSeverity: "info",
        category: "plot",
      },
    ],
  },
  engineering: {
    label: "Engineering",
    summary: "Systems, services, and operational plans.",
    tags: ["service", "architecture", "runbook", "reliability"],
    entityKindSeeds: [
      { kind: "service", label: "Service", category: "system" },
      { kind: "api", label: "API Endpoint", category: "object" },
      { kind: "database", label: "Database", category: "place" },
      { kind: "incident", label: "Incident", category: "temporal" },
      { kind: "runbook", label: "Runbook", category: "system" },
      { kind: "environment", label: "Environment", category: "system" },
    ],
    relationshipKindSeeds: [
      { kind: "calls", label: "Calls", category: "custom" },
      { kind: "depends_on", label: "Depends On", category: "power" },
      { kind: "impacts", label: "Impacts", category: "custom" },
      { kind: "owned_by", label: "Owned By", category: "power" },
    ],
    documentKindSeeds: [
      { kind: "architecture", label: "Architecture", allowChildren: false },
      { kind: "runbook", label: "Runbook", allowChildren: false },
      { kind: "postmortem", label: "Postmortem", allowChildren: false },
      { kind: "spec", label: "Spec", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "project_graph", enabled: true, order: 3 },
      { module: "timeline", enabled: true, order: 4 },
      { module: "console", enabled: true, order: 5 },
    ],
    linterRuleSeeds: [
      {
        id: "reliability_targets",
        label: "Reliability Targets",
        description: "Document SLAs and error budgets for critical services.",
        defaultSeverity: "warning",
        category: "timeline",
      },
      {
        id: "ownership_clarity",
        label: "Ownership Clarity",
        description: "Every service should have a clear owner or team.",
        defaultSeverity: "info",
        category: "style",
      },
    ],
  },
  design: {
    label: "Design",
    summary: "Design systems, screens, and visual language.",
    tags: ["design", "system", "component", "visual"],
    entityKindSeeds: [
      { kind: "component", label: "Component", category: "object" },
      { kind: "screen", label: "Screen", category: "place" },
      { kind: "token", label: "Token", category: "system" },
      { kind: "pattern", label: "Pattern", category: "abstract" },
      { kind: "guideline", label: "Guideline", category: "system" },
    ],
    relationshipKindSeeds: [
      { kind: "uses", label: "Uses", category: "custom" },
      { kind: "variant_of", label: "Variant Of", category: "custom" },
      { kind: "composed_of", label: "Composed Of", category: "custom" },
    ],
    documentKindSeeds: [
      { kind: "design_brief", label: "Design Brief", allowChildren: false },
      { kind: "spec", label: "Spec", allowChildren: false },
      { kind: "guidelines", label: "Guidelines", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "project_graph", enabled: true, order: 3 },
      { module: "console", enabled: true, order: 4 },
    ],
    linterRuleSeeds: [
      {
        id: "consistency_tokens",
        label: "Token Consistency",
        description: "Ensure design tokens are referenced consistently.",
        defaultSeverity: "warning",
        category: "style",
      },
    ],
  },
  comms: {
    label: "Communications",
    summary: "Messaging, campaigns, and channel strategy.",
    tags: ["comms", "campaign", "message", "audience"],
    entityKindSeeds: [
      { kind: "campaign", label: "Campaign", category: "system" },
      { kind: "message", label: "Message", category: "abstract" },
      { kind: "audience", label: "Audience", category: "organization" },
      { kind: "channel", label: "Channel", category: "system" },
      { kind: "asset", label: "Asset", category: "object" },
    ],
    relationshipKindSeeds: [
      { kind: "targets", label: "Targets", category: "custom" },
      { kind: "published_on", label: "Published On", category: "custom" },
      { kind: "measured_by", label: "Measured By", category: "custom" },
    ],
    documentKindSeeds: [
      { kind: "campaign_brief", label: "Campaign Brief", allowChildren: false },
      { kind: "content_calendar", label: "Content Calendar", allowChildren: false },
      { kind: "press_release", label: "Press Release", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "project_graph", enabled: true, order: 3 },
      { module: "timeline", enabled: true, order: 4 },
    ],
    linterRuleSeeds: [
      {
        id: "message_clarity",
        label: "Message Clarity",
        description: "Ensure key messages stay concise and consistent.",
        defaultSeverity: "warning",
        category: "style",
      },
    ],
  },
  cinema: {
    label: "Cinema / Film",
    summary: "Screen stories, scenes, and production planning.",
    tags: ["cinema", "screenplay", "scene", "shot"],
    entityKindSeeds: [
      { kind: "character", label: "Character", category: "agent" },
      { kind: "location", label: "Location", category: "place" },
      { kind: "scene", label: "Scene", category: "temporal" },
      { kind: "shot", label: "Shot", category: "temporal" },
      { kind: "prop", label: "Prop", category: "object" },
      { kind: "crew_role", label: "Crew Role", category: "organization" },
    ],
    relationshipKindSeeds: [
      { kind: "appears_in", label: "Appears In", category: "custom" },
      { kind: "transitions_to", label: "Transitions To", category: "custom" },
      { kind: "motivates", label: "Motivates", category: "interpersonal" },
    ],
    documentKindSeeds: [
      { kind: "screenplay", label: "Screenplay", allowChildren: false },
      { kind: "scene_breakdown", label: "Scene Breakdown", allowChildren: false },
      { kind: "shot_list", label: "Shot List", allowChildren: false },
      { kind: "production_notes", label: "Production Notes", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "storyboard", enabled: true, order: 3 },
      { module: "timeline", enabled: true, order: 4 },
    ],
    linterRuleSeeds: [
      {
        id: "scene_coverage",
        label: "Scene Coverage",
        description: "Scenes should list required locations and props.",
        defaultSeverity: "info",
        category: "timeline",
      },
    ],
  },
};

const GENERATE_TEMPLATE_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["template"],
  properties: {
    template: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "description",
        "category",
        "tags",
        "entityKinds",
        "relationshipKinds",
        "documentKinds",
        "uiModules",
        "linterRules",
      ],
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        baseTemplateId: { type: "string" },
        entityKinds: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "label", "labelPlural", "category", "color", "icon", "fields"],
            properties: {
              kind: { type: "string" },
              label: { type: "string" },
              labelPlural: { type: "string" },
              category: { type: "string", enum: ENTITY_CATEGORY_VALUES },
              color: { type: "string" },
              icon: { type: "string" },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "label", "kind"],
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    kind: { type: "string", enum: FIELD_KIND_VALUES },
                    description: { type: "string" },
                  },
                },
              },
            },
          },
        },
        relationshipKinds: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "label", "category"],
            properties: {
              kind: { type: "string" },
              label: { type: "string" },
              category: { type: "string", enum: RELATIONSHIP_CATEGORY_VALUES },
            },
          },
        },
        documentKinds: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "label"],
            properties: {
              kind: { type: "string" },
              label: { type: "string" },
              allowChildren: { type: "boolean" },
            },
          },
        },
        uiModules: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["module", "enabled"],
            properties: {
              module: { type: "string", enum: Array.from(UI_MODULE_ALLOWLIST) },
              enabled: { type: "boolean" },
              order: { type: "number" },
            },
          },
        },
        linterRules: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "description", "defaultSeverity", "category"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              description: { type: "string" },
              defaultSeverity: { type: "string", enum: LINTER_SEVERITY_VALUES },
              category: { type: "string", enum: LINTER_CATEGORY_VALUES },
            },
          },
        },
      },
    },
    suggestedStarterEntities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tempId", "name", "type"],
        properties: {
          tempId: { type: "string" },
          name: { type: "string" },
          type: { type: "string" },
          description: { type: "string" },
          properties: { type: "object", additionalProperties: true },
        },
      },
    },
  },
} as const;

function normalizeGenerateTemplateArgs(input: unknown): NormalizedGenerateTemplateArgs {
  if (!input || typeof input !== "object") {
    throw new Error("generate_template input is required");
  }
  const record = input as Record<string, unknown>;
  const prompt =
    (typeof record["prompt"] === "string" && (record["prompt"] as string).trim()) ||
    (typeof record["storyDescription"] === "string" && (record["storyDescription"] as string).trim()) ||
    (typeof record["description"] === "string" && (record["description"] as string).trim());

  if (!prompt) {
    throw new Error("generate_template requires a prompt");
  }

  const complexityRaw = typeof record["complexity"] === "string" ? record["complexity"] : "standard";
  const complexity =
    complexityRaw === "simple" || complexityRaw === "complex" ? complexityRaw : "standard";
  const baseTemplateId = typeof record["baseTemplateId"] === "string" ? record["baseTemplateId"] : undefined;
  const genreHints = Array.isArray(record["genreHints"])
    ? (record["genreHints"] as unknown[]).filter((hint) => typeof hint === "string")
    : undefined;

  return {
    prompt,
    baseTemplateId,
    complexity,
    genreHints,
  };
}

function resolveDomainKey(baseTemplateId?: string): DomainKey {
  if (!baseTemplateId) return "story";
  const normalized = baseTemplateId.trim().toLowerCase();
  if (normalized === "writer" || normalized === "story" || normalized === "world") return "story";
  if (normalized === "product") return "product";
  if (normalized === "engineering") return "engineering";
  if (normalized === "design") return "design";
  if (normalized === "comms" || normalized === "communications") return "comms";
  if (normalized === "cinema" || normalized === "film") return "cinema";
  return "story";
}

function buildGenerateTemplatePrompts(params: {
  args: NormalizedGenerateTemplateArgs;
  domain: DomainBlueprint;
  resolvedBaseTemplateId: string | undefined;
}): { systemPrompt: string; userPrompt: string } {
  const { args, domain, resolvedBaseTemplateId } = params;
  const genreHints = args.genreHints?.length ? args.genreHints.join(", ") : "";

  const systemPrompt = [
    "You are a Mythos template architect.",
    "Your task is to generate a TemplateDraft that defines entity kinds, relationships, document kinds, UI modules, and linter rules.",
    "Return JSON only. Do not include commentary or markdown.",
    "Stay within 6-12 entity kinds, 4-10 relationship kinds, and 3-8 document kinds.",
    "Keep labels short, concrete, and readable.",
  ].join("\n");

  const userPrompt = [
    `Domain: ${domain.label}`,
    `Summary: ${domain.summary}`,
    resolvedBaseTemplateId ? `Base template id: ${resolvedBaseTemplateId}` : "",
    args.complexity ? `Complexity: ${args.complexity}` : "",
    genreHints ? `Genre hints: ${genreHints}` : "",
    "",
    "Use these blueprint seeds as a starting point:",
    JSON.stringify(
      {
        entityKindSeeds: domain.entityKindSeeds,
        relationshipKindSeeds: domain.relationshipKindSeeds,
        documentKindSeeds: domain.documentKindSeeds,
        uiModuleSeeds: domain.uiModuleSeeds,
        linterRuleSeeds: domain.linterRuleSeeds,
      },
      null,
      2
    ),
    "",
    `User idea: ${args.prompt}`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  return { systemPrompt, userPrompt };
}

function normalizeKind(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sanitizeStringArray(values: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) return fallback;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function ensureHexColor(value: string | undefined, category: TemplateEntityKind["category"]): string {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return ENTITY_CATEGORY_COLORS[category] ?? "#8b5cf6";
}

function sanitizeEntityKinds(
  values: unknown,
  fallback: DomainBlueprint
): TemplateEntityKind[] {
  const seeds = fallback.entityKindSeeds;
  const list = Array.isArray(values) ? (values as TemplateEntityKind[]) : [];
  const seen = new Set<string>();
  const result: TemplateEntityKind[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rawKind = typeof item.kind === "string" ? item.kind : "";
    const kind = normalizeKind(rawKind);
    if (!kind || seen.has(kind)) continue;
    const category = ENTITY_CATEGORY_VALUES.includes(item.category)
      ? item.category
      : "abstract";
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : kind.replace(/_/g, " ");
    const labelPlural = typeof item.labelPlural === "string" && item.labelPlural.trim()
      ? item.labelPlural.trim()
      : `${label}s`;
    const fields = Array.isArray(item.fields) ? item.fields : [];
    const normalizedFields = fields
      .map((field: unknown) => {
        if (!field || typeof field !== "object") return null;
        const f = field as Record<string, unknown>;
        const fieldId = typeof f["id"] === "string" ? normalizeKind(f["id"]) : "";
        const fieldLabel = typeof f["label"] === "string" ? (f["label"] as string).trim() : "";
        const fieldKind = (FIELD_KIND_VALUES as readonly string[]).includes(f["kind"] as string)
          ? (f["kind"] as TemplateEntityKind["fields"][number]["kind"])
          : "text";
        if (!fieldId || !fieldLabel) return null;
        return {
          id: fieldId,
          label: fieldLabel,
          kind: fieldKind,
          description: typeof f["description"] === "string" ? f["description"] : undefined,
        };
      })
      .filter(Boolean) as TemplateEntityKind["fields"];

    const fieldsWithDefault = normalizedFields.length
      ? normalizedFields
      : [
          { id: "summary", label: "Summary", kind: "text" as const },
          { id: "tags", label: "Tags", kind: "tags" as const },
        ];

    result.push({
      kind,
      label,
      labelPlural,
      category,
      color: ensureHexColor(item.color, category),
      icon: typeof item.icon === "string" && item.icon.trim() ? item.icon.trim() : "sparkles",
      fields: fieldsWithDefault,
    });
    seen.add(kind);
    if (result.length >= 18) break;
  }

  if (result.length > 0) return result;

  return seeds.map((seed) => {
    const labelPlural = `${seed.label}s`;
    return {
      kind: seed.kind,
      label: seed.label,
      labelPlural,
      category: seed.category,
      color: ensureHexColor(undefined, seed.category),
      icon: "sparkles",
      fields: [
        { id: "summary", label: "Summary", kind: "text" },
        { id: "tags", label: "Tags", kind: "tags" },
      ],
    };
  });
}

function sanitizeRelationshipKinds(
  values: unknown,
  fallback: DomainBlueprint
): TemplateRelationshipKind[] {
  const seeds = fallback.relationshipKindSeeds;
  const list = Array.isArray(values) ? (values as TemplateRelationshipKind[]) : [];
  const seen = new Set<string>();
  const result: TemplateRelationshipKind[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rawKind = typeof item.kind === "string" ? item.kind : "";
    const kind = normalizeKind(rawKind);
    if (!kind || seen.has(kind)) continue;
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : kind.replace(/_/g, " ");
    const category = RELATIONSHIP_CATEGORY_VALUES.includes(item.category)
      ? item.category
      : "custom";
    result.push({ kind, label, category });
    seen.add(kind);
    if (result.length >= 16) break;
  }

  if (result.length > 0) return result;

  return seeds.map((seed) => ({
    kind: seed.kind,
    label: seed.label,
    category: seed.category,
  }));
}

function sanitizeDocumentKinds(
  values: unknown,
  fallback: DomainBlueprint
): TemplateDocumentKind[] {
  const seeds = fallback.documentKindSeeds;
  const list = Array.isArray(values) ? (values as TemplateDocumentKind[]) : [];
  const seen = new Set<string>();
  const result: TemplateDocumentKind[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rawKind = typeof item.kind === "string" ? item.kind : "";
    const kind = normalizeKind(rawKind);
    if (!kind || seen.has(kind)) continue;
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : kind.replace(/_/g, " ");
    result.push({
      kind,
      label,
      allowChildren: typeof item.allowChildren === "boolean" ? item.allowChildren : false,
    });
    seen.add(kind);
    if (result.length >= 10) break;
  }

  if (result.length > 0) return result;

  return seeds.map((seed) => ({
    kind: seed.kind,
    label: seed.label,
    allowChildren: seed.allowChildren ?? false,
  }));
}

function sanitizeUIModules(values: unknown, fallback: DomainBlueprint): TemplateUIModule[] {
  const seeds = fallback.uiModuleSeeds;
  const list = Array.isArray(values) ? (values as TemplateUIModule[]) : [];
  const result: TemplateUIModule[] = [];
  const seen = new Set<string>();

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const moduleName = typeof item.module === "string" ? item.module : "";
    if (!moduleName || !UI_MODULE_ALLOWLIST.has(moduleName) || seen.has(moduleName)) continue;
    result.push({
      module: moduleName,
      enabled: typeof item.enabled === "boolean" ? item.enabled : true,
      order: typeof item.order === "number" ? item.order : undefined,
    });
    seen.add(moduleName);
  }

  if (result.length > 0) return result;

  return seeds.filter((seed) => UI_MODULE_ALLOWLIST.has(seed.module as string));
}

function sanitizeLinterRules(values: unknown, fallback: DomainBlueprint): TemplateLinterRule[] {
  const seeds = fallback.linterRuleSeeds;
  const list = Array.isArray(values) ? (values as TemplateLinterRule[]) : [];
  const seen = new Set<string>();
  const result: TemplateLinterRule[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rawId = typeof item.id === "string" ? item.id : "";
    const id = normalizeKind(rawId);
    if (!id || seen.has(id)) continue;
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : id.replace(/_/g, " ");
    const description = typeof item.description === "string" && item.description.trim()
      ? item.description.trim()
      : label;
    const defaultSeverity = LINTER_SEVERITY_VALUES.includes(item.defaultSeverity)
      ? item.defaultSeverity
      : "info";
    const category = LINTER_CATEGORY_VALUES.includes(item.category)
      ? item.category
      : "style";
    result.push({ id, label, description, defaultSeverity, category });
    seen.add(id);
    if (result.length >= 12) break;
  }

  if (result.length > 0) return result;

  return seeds.map((seed) => ({
    id: seed.id,
    label: seed.label,
    description: seed.description,
    defaultSeverity: seed.defaultSeverity,
    category: seed.category,
  }));
}

function sanitizeTemplateDraft(
  draft: TemplateDraft,
  domain: DomainBlueprint,
  baseTemplateId?: string
): TemplateDraft {
  const name = typeof draft.name === "string" && draft.name.trim()
    ? draft.name.trim()
    : `${domain.label} Template`;
  const description = typeof draft.description === "string" && draft.description.trim()
    ? draft.description.trim()
    : domain.summary;
  const category = typeof draft.category === "string" && draft.category.trim()
    ? draft.category.trim()
    : domain.tags[0] ?? "custom";
  const tags = sanitizeStringArray(draft.tags, domain.tags);

  return {
    name,
    description,
    category,
    tags,
    baseTemplateId: baseTemplateId ?? draft.baseTemplateId,
    entityKinds: sanitizeEntityKinds(draft.entityKinds, domain),
    relationshipKinds: sanitizeRelationshipKinds(draft.relationshipKinds, domain),
    documentKinds: sanitizeDocumentKinds(draft.documentKinds, domain),
    uiModules: sanitizeUIModules(draft.uiModules, domain),
    linterRules: sanitizeLinterRules(draft.linterRules, domain),
  };
}

async function requestGenerateTemplateResult(params: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  responseFormat: Record<string, unknown>;
}): Promise<GenerateTemplateResult> {
  const { apiKey, systemPrompt, userPrompt, responseFormat } = params;
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
        { role: "user", content: userPrompt },
      ],
      response_format: responseFormat,
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
    throw new Error("OpenRouter returned empty content");
  }

  return JSON.parse(content) as GenerateTemplateResult;
}

async function executeGenerateTemplate(input: GenerateTemplateArgs): Promise<GenerateTemplateResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const normalized = normalizeGenerateTemplateArgs(input);
  const domainKey = resolveDomainKey(normalized.baseTemplateId);
  const domain = DOMAIN_BLUEPRINTS[domainKey];
  const fallbackBaseTemplateId: Record<DomainKey, string> = {
    story: "writer",
    product: "product",
    engineering: "engineering",
    design: "design",
    comms: "comms",
    cinema: "cinema",
  };
  const resolvedBaseTemplateId = normalized.baseTemplateId ?? fallbackBaseTemplateId[domainKey];
  const { systemPrompt, userPrompt } = buildGenerateTemplatePrompts({
    args: normalized,
    domain,
    resolvedBaseTemplateId,
  });

  let rawResult: GenerateTemplateResult;
  try {
    rawResult = await requestGenerateTemplateResult({
      apiKey,
      systemPrompt,
      userPrompt,
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "generate_template_result",
          schema: GENERATE_TEMPLATE_RESULT_SCHEMA,
        },
      },
    });
  } catch (error) {
    rawResult = await requestGenerateTemplateResult({
      apiKey,
      systemPrompt,
      userPrompt,
      responseFormat: { type: "json_object" },
    });
  }

  const template = rawResult?.template ?? {
    name: "",
    description: "",
    category: "custom",
    tags: [],
    baseTemplateId: resolvedBaseTemplateId,
    entityKinds: [],
    relationshipKinds: [],
    documentKinds: [],
    uiModules: [],
    linterRules: [],
  };

  const sanitizedTemplate = sanitizeTemplateDraft(template, domain, resolvedBaseTemplateId);
  const suggestedStarterEntities = Array.isArray(rawResult?.suggestedStarterEntities)
    ? (rawResult.suggestedStarterEntities as GenesisEntity[])
    : undefined;

  return {
    template: sanitizedTemplate,
    suggestedStarterEntities,
  };
}

type PinnedPolicyContext = { text: string; count: number };

async function getPinnedPoliciesForProject(
  projectId: string,
  options?: { limit?: number; categories?: DecisionCategory[] }
): Promise<PinnedPolicyContext | null> {
  try {
    const pinned = await fetchPinnedProjectMemories(projectId, {
      limit: options?.limit ?? 50,
      categories: options?.categories ?? ["policy", "decision"],
    });
    if (pinned.length === 0) return null;
    return { text: formatMemoriesForPrompt(pinned), count: pinned.length };
  } catch (error) {
    console.warn("[tools.policy_context] Failed to fetch pinned policies:", error);
    return null;
  }
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
  metrics?: {
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

  const policyContext = await getPinnedPoliciesForProject(projectId, {
    limit: 25,
    categories: ["policy"],
  });
  const policyText = policyContext?.text;

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
    type: issue["type"] as string,
    text: issue["text"] as string,
    line: issue["line"] as number | undefined,
    suggestion: issue["suggestion"] as string,
    fix: issue["fix"] as { oldText: string; newText: string } | undefined,
  }));

  const readability = parsed.readability as ClarityCheckResult["readability"] | undefined;

  return {
    issues,
    summary: parsed.summary || "Clarity analysis complete.",
    readability,
    metrics: readability,
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

  const policyContext = await getPinnedPoliciesForProject(projectId, {
    limit: 50,
    categories: ["policy", "decision"],
  });

  if (!policyContext) {
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

  const { text: policyText, count: policyCount } = policyContext;
  const userContent = `## Pinned Policies:\n${policyText}\n\n## Text to Check:\n${input.text}`;

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
        policiesChecked: policyCount,
        conflictsFound: 0,
      },
    };
  }

  const parsed = JSON.parse(content);

  // Add IDs to issues for UI tracking
  const issues = (parsed.issues || []).map((issue: Record<string, unknown>, idx: number) => ({
    id: `policy-${Date.now()}-${idx}`,
    type: issue["type"] as PolicyCheckResult["issues"][0]["type"],
    text: issue["text"] as string,
    line: issue["line"] as number | undefined,
    suggestion: issue["suggestion"] as string,
    canonCitations: issue["canonCitations"] as PolicyCheckResult["issues"][0]["canonCitations"],
  }));

  return {
    issues,
    summary: parsed.summary || `Checked against ${policyCount} policies.`,
    compliance: parsed.compliance || {
      score: 100 - issues.filter((i: { type: string }) => i.type === "policy_conflict").length * 10,
      policiesChecked: policyCount,
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
// Unified Image Analysis Tool
// ============================================================

/**
 * Unified analyze_image executor with mode dispatch.
 * Consolidates vision analysis, text→image search, and image→image similarity.
 */
async function executeAnalyzeImage(
  ctx: ActionCtx,
  input: AnalyzeImageArgs,
  projectId: string,
  userId: string
): Promise<AnalyzeImageResult> {
  // Default to vision mode for backwards compatibility (no mode specified)
  const mode = input.mode ?? "vision";

  switch (mode) {
    case "vision": {
      // Call the vision LLM action
      if (!input.imageSource) {
        throw new Error("imageSource is required for vision mode");
      }
      const visionResult = await ctx.runAction(
        (internal as any)["ai/image"].analyzeImageAction,
        {
          projectId,
          userId,
          imageUrl: input.imageSource,
          analysisPrompt: input.analysisPrompt,
          entityTypeHint: input.entityTypeHint,
          extractionFocus: input.extractionFocus,
        }
      );
      return {
        mode: "vision",
        suggestedEntityType: visionResult.suggestedEntityType,
        suggestedName: visionResult.suggestedName,
        visualDescription: visionResult.visualDescription ?? {},
        description: visionResult.description ?? "",
        confidence: visionResult.confidence ?? 0.8,
        assetId: visionResult.assetId,
        imageUrl: visionResult.imageUrl,
      };
    }

    case "search": {
      // Text → image search via Qdrant
      if (!input.query) {
        throw new Error("query is required for search mode");
      }
      const searchResult = await executeAnalyzeImageSearch(
        {
          query: input.query,
          limit: input.options?.limit,
          assetType: input.options?.assetType,
          entityType: input.options?.entityType,
          style: input.options?.style,
        },
        projectId
      );
      return {
        mode: "search",
        query: input.query,
        results: searchResult.images.map((img) => ({
          assetId: img.id,
          imageUrl: img.url,
          score: img.score,
          entityId: img.entityId,
          assetType: img.assetType as any,
          style: img.style as any,
        })),
      };
    }

    case "similar": {
      // Image → image similarity via Qdrant
      if (!input.assetId && !input.entityName) {
        throw new Error("assetId or entityName is required for similar mode");
      }
      const similarResult = await executeAnalyzeImageSimilar(
        {
          assetId: input.assetId ?? "",
          entityName: input.entityName,
          limit: input.options?.limit,
          assetType: input.options?.assetType,
        },
        projectId
      );
      return {
        mode: "similar",
        referenceAssetId: similarResult.sourceImage?.id ?? input.assetId ?? "",
        results: similarResult.images.map((img) => ({
          assetId: img.id,
          imageUrl: img.url,
          score: img.similarity,
          entityId: img.entityId,
          assetType: img.assetType as any,
        })),
      };
    }

    default:
      throw new Error(`Unknown analyze_image mode: ${mode}`);
  }
}

// ============================================================
// Image Search Tools (Internal Helpers)
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

async function executeAnalyzeImageSearch(
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
  entityName?: string;
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

async function executeAnalyzeImageSimilar(
  input: FindSimilarImagesInput,
  projectId: string
): Promise<SimilarImagesResult> {
  if (!input.assetId && !input.entityName) {
    throw new Error("assetId or entityName is required for similar image search");
  }
  // TODO: If entityName is provided without assetId, look up entity portrait
  if (!input.assetId) {
    throw new Error("entityName lookup not yet implemented - please provide assetId directly");
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
  _projectId: string
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
    type: issue["type"] as LogicIssue["type"],
    severity: issue["severity"] as LogicIssue["severity"],
    message: issue["message"] as string,
    violatedRule: issue["violatedRule"] as LogicIssue["violatedRule"],
    suggestion: issue["suggestion"] as string | undefined,
    locations: issue["locations"] as LogicIssue["locations"],
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
  _projectId: string
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
