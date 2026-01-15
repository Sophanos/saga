/**
 * Saga Agent Runtime
 *
 * Bridges the Convex Agent component with the Saga SSE stream model.
 */

"use node";

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { api, internal, components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { Agent } from "@convex-dev/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from "@ai-sdk/provider";
import { buildSystemPrompt, retrieveRAGContext, type RAGContext } from "./rag";
import { askQuestionTool, writeContentTool } from "./tools/editorTools";
import { commitDecisionTool } from "./tools/memoryTools";
import { searchContextTool, readDocumentTool, getEntityTool } from "./tools/ragTools";
import { analyzeImageTool, graphMutationTool } from "./tools/projectGraphTools";
import { analyzeContentTool } from "./tools/analysisTools";
import { spawnTaskTool, writeTodosTool } from "./tools/planningTools";
import { generateTemplateTool } from "./tools/templateTools";
import { projectManageTool } from "./tools/projectManageTools";
import { webSearchTool, webExtractTool } from "./tools/webSearchTools";
import {
  viewVersionHistoryTool,
  viewCommentsTool,
  addCommentTool,
  searchUsersTool,
  deleteDocumentTool,
} from "./tools/collaborationTools";
import {
  artifactTool,
  artifactStageTool,
  artifactDiagramTool,
  artifactTableTool,
  artifactTimelineTool,
  artifactProseTool,
  artifactLinkTool,
} from "./tools/artifactTools";
import { getEmbeddingModelForTask } from "../lib/embeddings";
import { ServerAgentEvents } from "../lib/analytics";
import { createUsageHandler } from "../lib/rateLimiting";
import { assertAiAllowed } from "../lib/quotaEnforcement";
import { resolveOpenRouterKey, isByokRequest } from "../lib/openRouterKey";
import {
  hasIdentityChange,
  isSignificantStrengthChange,
  needsToolApproval,
} from "../lib/approvalConfig";
import type { ProjectTypeRegistryResolved, RiskLevel } from "../lib/typeRegistry";

const AI_PRESENCE_ROOM_PREFIXES = {
  project: "project",
  document: "document",
};

// Pre-extract function references to avoid deep type instantiation
const internalAny: Record<string, Record<string, unknown>> = internal as Record<string, Record<string, unknown>>;

function resolveEditorDocumentId(editorContext: unknown): string | undefined {
  if (!editorContext || typeof editorContext !== "object") return undefined;
  const maybe = (editorContext as { documentId?: unknown }).documentId;
  return typeof maybe === "string" && maybe.length > 0 ? maybe : undefined;
}

type SuggestionEditorContext = {
  documentId?: string;
  documentTitle?: string;
  documentExcerpt?: string;
  selectionText?: string;
  selectionContext?: string;
};

function resolveSuggestionEditorContext(
  toolName: string,
  editorContext: unknown
): SuggestionEditorContext | undefined {
  if (toolName !== "write_content") return undefined;
  if (!editorContext || typeof editorContext !== "object") return undefined;
  const record = editorContext as Record<string, unknown>;
  const context: SuggestionEditorContext = {
    documentId: typeof record["documentId"] === "string" ? (record["documentId"] as string) : undefined,
    documentTitle:
      typeof record["documentTitle"] === "string" ? (record["documentTitle"] as string) : undefined,
    documentExcerpt:
      typeof record["documentExcerpt"] === "string" ? (record["documentExcerpt"] as string) : undefined,
    selectionText:
      typeof record["selectionText"] === "string" ? (record["selectionText"] as string) : undefined,
    selectionContext:
      typeof record["selectionContext"] === "string" ? (record["selectionContext"] as string) : undefined,
  };
  const hasValue = Object.values(context).some(
    (value) => typeof value === "string" && value.length > 0
  );
  return hasValue ? context : undefined;
}

async function setAiPresence(
  ctx: ActionCtx,
  projectId: string,
  documentId: string | undefined,
  isTyping: boolean
) {
  if (!documentId) return;

  const roomIds = [
    `${AI_PRESENCE_ROOM_PREFIXES.document}:${documentId}`,
    `${AI_PRESENCE_ROOM_PREFIXES.project}:${projectId}`,
  ];
  const runMutation = ctx.runMutation as (mutation: unknown, args: Record<string, unknown>) => Promise<unknown>;
  const setAiPresenceMutation = internalAny["presence"]["setAiPresence"];

  await Promise.all(
    roomIds.map((roomId) =>
      runMutation(setAiPresenceMutation, {
        roomId,
        documentId,
        isTyping,
      })
    )
  );
}

const AI_KEEPALIVE_INTERVAL_MS = 8_000;
const MAX_BASE64_IMAGE_CHARS = 5_000_000;

async function maybeKeepAiTypingAlive(opts: {
  ctx: ActionCtx;
  projectId: string;
  presenceDocumentId?: string;
  isTemplateBuilder: boolean;
  lastAiPresenceAt: number;
}): Promise<number> {
  const { ctx, projectId, presenceDocumentId, isTemplateBuilder, lastAiPresenceAt } = opts;
  if (isTemplateBuilder || !presenceDocumentId) return lastAiPresenceAt;

  const now = Date.now();
  if (now - lastAiPresenceAt < AI_KEEPALIVE_INTERVAL_MS) return lastAiPresenceAt;

  try {
    await setAiPresence(ctx, projectId, presenceDocumentId, true);
  } catch (error) {
    console.warn("[agentRuntime] Failed to keep AI presence alive:", error);
  }

  return now;
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const LEXICAL_LIMIT = 20;
const E2E_TEST_MODE = process.env["E2E_TEST_MODE"] === "true";
const SAGA_TEST_MODE = process.env["SAGA_TEST_MODE"] === "true";
const TEST_MODE = E2E_TEST_MODE || SAGA_TEST_MODE;

/**
 * Creates an OpenRouter client with the given API key.
 * Used for both platform key and BYOK.
 */
function createOpenRouterClient(apiKey: string) {
  return createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    headers: {
      "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://rhei.team",
      "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Rhei",
    },
  });
}

// Default client using platform key (for backward compatibility)
const openrouter = createOpenRouterClient(process.env["OPENROUTER_API_KEY"] ?? "");

export type SagaTestStreamChunk = LanguageModelV3StreamPart;

export interface SagaTestStreamStep {
  chunks: SagaTestStreamChunk[];
}

let sagaTestScript: SagaTestStreamStep[] = [];

function normalizeTestChunks(chunks: SagaTestStreamChunk[]): SagaTestStreamChunk[] {
  const normalized = [...chunks];
  if (!normalized.some((chunk) => chunk.type === "stream-start")) {
    normalized.unshift({ type: "stream-start", warnings: [] });
  }
  if (!normalized.some((chunk) => chunk.type === "finish")) {
    normalized.push({
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
    });
  }
  return normalized;
}

function createTestLanguageModel() {
  const generateResult: LanguageModelV3GenerateResult = {
    content: [],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };

  const doStream = async (): Promise<LanguageModelV3StreamResult> => {
    const step = sagaTestScript.shift();
    if (!step) {
      throw new Error("No saga test script step available");
    }
    return {
      stream: simulateReadableStream<LanguageModelV3StreamPart>({
        chunks: normalizeTestChunks(step.chunks),
      }),
    };
  };

  return new MockLanguageModelV3({
    doGenerate: generateResult,
    doStream,
  });
}

function createSagaAgent(byokKey?: string, model?: string) {
  const testMode = TEST_MODE;
  const client = byokKey ? createOpenRouterClient(byokKey) : openrouter;
  const modelId = model ?? DEFAULT_MODEL;
  const languageModel = testMode ? createTestLanguageModel() : client.chat(modelId);

  return new Agent(components.agent, {
    name: "Saga",
    languageModel,
    usageHandler: createUsageHandler(),

    // Thread memory: vector search for similar past messages
    textEmbeddingModel: testMode ? undefined : getEmbeddingModelForTask("embed_document"),
    contextOptions: testMode
      ? {
          recentMessages: 0,
          searchOptions: {
            limit: 0,
            vectorSearch: false,
            textSearch: false,
            messageRange: { before: 0, after: 0 },
          },
          searchOtherThreads: false,
        }
      : {
          recentMessages: 20,
          searchOptions: {
            limit: 10,
            vectorSearch: true,
            textSearch: true,
            messageRange: { before: 2, after: 1 },
          },
          searchOtherThreads: false,
        },

    tools: {
      ask_question: askQuestionTool,
      write_content: writeContentTool,
      commit_decision: commitDecisionTool,
      search_context: searchContextTool,
      read_document: readDocumentTool,
      get_entity: getEntityTool,
      project_manage: projectManageTool,
      generate_template: generateTemplateTool,
      graph_mutation: graphMutationTool,
      analyze_content: analyzeContentTool,
      analyze_image: analyzeImageTool,
      write_todos: writeTodosTool,
      spawn_task: spawnTaskTool,
      web_search: webSearchTool,
      web_extract: webExtractTool,
      view_version_history: viewVersionHistoryTool,
      view_comments: viewCommentsTool,
      add_comment: addCommentTool,
      search_users: searchUsersTool,
      delete_document: deleteDocumentTool,
      // Artifact tools
      artifact_tool: artifactTool,
      artifact_stage: artifactStageTool,
      artifact_diagram: artifactDiagramTool,
      artifact_table: artifactTableTool,
      artifact_timeline: artifactTimelineTool,
      artifact_prose: artifactProseTool,
      artifact_link: artifactLinkTool,
    },
    maxSteps: 8,
  });
}

export function setSagaTestScript(steps: SagaTestStreamStep[]) {
  sagaTestScript = [...steps];
}

type ToolCategory = "rag" | "graph" | "web" | "hitl" | "analysis" | "project" | "artifact";

type ToolPolicy = {
  category: ToolCategory;
  autoExecute: boolean;
};

const TOOL_POLICY: Record<string, ToolPolicy> = {
  ask_question: { category: "hitl", autoExecute: false },
  write_content: { category: "hitl", autoExecute: false },
  commit_decision: { category: "hitl", autoExecute: false },
  search_context: { category: "rag", autoExecute: true },
  read_document: { category: "rag", autoExecute: true },
  get_entity: { category: "rag", autoExecute: true },
  web_search: { category: "web", autoExecute: true },
  web_extract: { category: "web", autoExecute: true },
  project_manage: { category: "project", autoExecute: false },
  generate_template: { category: "project", autoExecute: false },
  graph_mutation: { category: "graph", autoExecute: false },
  analyze_content: { category: "analysis", autoExecute: true },
  analyze_image: { category: "analysis", autoExecute: true },
  write_todos: { category: "analysis", autoExecute: true },
  spawn_task: { category: "project", autoExecute: true },
  view_version_history: { category: "rag", autoExecute: true },
  view_comments: { category: "rag", autoExecute: true },
  search_users: { category: "rag", autoExecute: true },
  add_comment: { category: "hitl", autoExecute: false },
  delete_document: { category: "hitl", autoExecute: false },
  // Artifact tools - auto-execute, client handles UI effects
  artifact_tool: { category: "artifact", autoExecute: true },
  artifact_stage: { category: "artifact", autoExecute: true },
  artifact_diagram: { category: "artifact", autoExecute: true },
  artifact_table: { category: "artifact", autoExecute: true },
  artifact_timeline: { category: "artifact", autoExecute: true },
  artifact_prose: { category: "artifact", autoExecute: true },
  artifact_link: { category: "artifact", autoExecute: true },
};

function getToolPolicy(toolName: string): ToolPolicy | undefined {
  return TOOL_POLICY[toolName];
}

function isAutoExecuteTool(toolName: string): boolean {
  return getToolPolicy(toolName)?.autoExecute ?? false;
}

function isGraphTool(toolName: string): boolean {
  return getToolPolicy(toolName)?.category === "graph";
}

type ToolActorContext = {
  actorType: "ai" | "user" | "system";
  actorUserId?: string;
  actorAgentId?: string;
  actorName?: string;
};

type ToolSourceContext = {
  streamId?: string;
  threadId?: string;
  toolCallId?: string;
  promptMessageId?: string;
};

type ToolApprovalType = "execution" | "input" | "apply";

type ToolApprovalDanger = "safe" | "costly" | "destructive";

type GraphApprovalChange = {
  key: string;
  from?: unknown;
  to?: unknown;
};

type GraphApprovalPreview =
  | {
      kind: "entity_create";
      type: string;
      name: string;
      aliases?: string[];
      notes?: string;
      properties?: Record<string, unknown>;
      note?: string;
    }
  | {
      kind: "entity_update";
      entityId?: string;
      name?: string;
      type?: string;
      changes: GraphApprovalChange[];
      note?: string;
    }
  | {
      kind: "relationship_create";
      type: string;
      sourceName?: string;
      targetName?: string;
      sourceId?: string;
      targetId?: string;
      bidirectional?: boolean;
      strength?: number;
      notes?: string;
      metadata?: Record<string, unknown>;
      note?: string;
    }
  | {
      kind: "relationship_update";
      relationshipId?: string;
      type?: string;
      sourceName?: string;
      targetName?: string;
      changes: GraphApprovalChange[];
      note?: string;
    };

type KnowledgeSuggestionTargetType = "document" | "entity" | "relationship" | "memory";

function classifyKnowledgeSuggestion(
  toolName: string,
  args: Record<string, unknown>
): { targetType: KnowledgeSuggestionTargetType; operation: string } | null {
  switch (toolName) {
    case "graph_mutation": {
      const action = typeof args["action"] === "string" ? (args["action"] as string) : "unknown";
      const target = typeof args["target"] === "string" ? (args["target"] as string) : "unknown";
      const targetType = target === "relationship" || target === "edge" ? "relationship" : "entity";
      return { targetType, operation: `${action}_${target}` };
    }
    case "create_entity":
    case "update_entity":
    case "create_node":
    case "update_node":
      return { targetType: "entity", operation: toolName };
    case "create_relationship":
    case "update_relationship":
    case "create_edge":
    case "update_edge":
      return { targetType: "relationship", operation: toolName };
    case "write_content":
    case "add_comment":
    case "delete_document":
      return { targetType: "document", operation: toolName };
    case "commit_decision":
      return { targetType: "memory", operation: toolName };
    default:
      return null;
  }
}

function getIdentityFields(def?: { approval?: { identityFields?: readonly string[] } }): readonly string[] {
  return def?.approval?.identityFields ?? [];
}

type NormalizedGraphToolCall = {
  toolName:
    | "create_entity"
    | "update_entity"
    | "create_relationship"
    | "update_relationship"
    | "create_node"
    | "update_node"
    | "create_edge"
    | "update_edge";
  args: Record<string, unknown>;
  kind: "entity" | "relationship";
};

function normalizeGraphToolCall(
  toolName: string,
  args: Record<string, unknown>
): NormalizedGraphToolCall | null {
  if (toolName !== "graph_mutation") return null;
  const action = typeof args["action"] === "string" ? (args["action"] as string) : undefined;
  const target = typeof args["target"] === "string" ? (args["target"] as string) : undefined;
  if (!action || !target || action === "delete") return null;

  if (target === "entity" || target === "node") {
    const baseArgs: Record<string, unknown> = {
      type: args["type"],
      name: args["name"],
      aliases: args["aliases"],
      notes: args["notes"],
      properties: args["properties"],
      archetype: args["archetype"],
      backstory: args["backstory"],
      goals: args["goals"],
      fears: args["fears"],
      citations: args["citations"],
    };

    if (action === "create") {
      return {
        toolName: target === "node" ? "create_node" : "create_entity",
        args: baseArgs,
        kind: "entity",
      };
    }

    return {
      toolName: target === "node" ? "update_node" : "update_entity",
      args:
        target === "node"
          ? {
              nodeName: args["entityName"],
              nodeType: args["entityType"],
              updates: args["updates"],
              citations: args["citations"],
            }
          : {
              entityName: args["entityName"],
              entityType: args["entityType"],
              updates: args["updates"],
              citations: args["citations"],
            },
      kind: "entity",
    };
  }

  if (action === "create") {
    return {
      toolName: target === "edge" ? "create_edge" : "create_relationship",
      args: {
        type: args["type"],
        sourceName: args["sourceName"],
        targetName: args["targetName"],
        bidirectional: args["bidirectional"],
        strength: args["strength"],
        notes: args["notes"],
        metadata: args["metadata"],
        citations: args["citations"],
      },
      kind: "relationship",
    };
  }

  return {
    toolName: target === "edge" ? "update_edge" : "update_relationship",
    args: {
      type: args["type"],
      sourceName: args["sourceName"],
      targetName: args["targetName"],
      updates: args["updates"],
      citations: args["citations"],
    },
    kind: "relationship",
  };
}

function buildEntityPropertiesFromArgs(args: Record<string, unknown>): Record<string, unknown> {
  const base =
    args["properties"] && typeof args["properties"] === "object" && !Array.isArray(args["properties"])
      ? (args["properties"] as Record<string, unknown>)
      : {};
  const next: Record<string, unknown> = { ...base };

  const entries: Array<[string, string]> = [
    ["archetype", "archetype"],
    ["backstory", "backstory"],
    ["goals", "goals"],
    ["fears", "fears"],
    ["voiceNotes", "voiceNotes"],
    ["parentLocation", "parentLocation"],
    ["climate", "climate"],
    ["atmosphere", "atmosphere"],
    ["category", "category"],
    ["rarity", "rarity"],
    ["abilities", "abilities"],
    ["leader", "leader"],
    ["headquarters", "headquarters"],
    ["factionGoals", "factionGoals"],
    ["rivals", "rivals"],
    ["allies", "allies"],
    ["rules", "rules"],
    ["limitations", "limitations"],
    ["costs", "costs"],
  ];

  for (const [key, propKey] of entries) {
    if (args[key] !== undefined) {
      next[propKey] = args[key];
    }
  }

  return next;
}

function buildEntityUpdateChanges(
  entity: Doc<"entities"> | null,
  updates: Record<string, unknown>
): GraphApprovalChange[] {
  const changes: GraphApprovalChange[] = [];

  if (updates["name"] !== undefined) {
    changes.push({ key: "name", from: entity?.name, to: updates["name"] });
  }
  if (updates["aliases"] !== undefined) {
    changes.push({ key: "aliases", from: entity?.aliases, to: updates["aliases"] });
  }
  if (updates["notes"] !== undefined) {
    changes.push({ key: "notes", from: entity?.notes, to: updates["notes"] });
  }

  const propertyUpdates = buildEntityPropertiesFromArgs(updates);
  for (const [key, value] of Object.entries(propertyUpdates)) {
    changes.push({ key: `properties.${key}`, from: entity?.properties?.[key], to: value });
  }

  return changes;
}

function buildRelationshipUpdateChanges(
  relationship: Doc<"relationships"> | null,
  updates: Record<string, unknown>
): GraphApprovalChange[] {
  const changes: GraphApprovalChange[] = [];

  if (updates["notes"] !== undefined) {
    changes.push({ key: "notes", from: relationship?.notes, to: updates["notes"] });
  }
  if (updates["strength"] !== undefined) {
    changes.push({ key: "strength", from: relationship?.strength, to: updates["strength"] });
  }
    if (updates["bidirectional"] !== undefined) {
    changes.push({
      key: "bidirectional",
      from: relationship?.bidirectional ?? false,
      to: updates["bidirectional"],
    });
  }
  if (updates["metadata"] !== undefined) {
    changes.push({ key: "metadata", from: relationship?.metadata, to: updates["metadata"] });
  }

  return changes;
}

async function resolveEntityForPreview(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  name: string,
  type?: string
): Promise<{ entity: Doc<"entities"> | null; error?: string }> {
  const runQuery = ctx.runQuery as (query: unknown, args: unknown) => Promise<unknown>;
  const matches = (await runQuery(
    internalAny["ai/tools/projectGraphHandlers"]["findEntityByCanonical"],
    { projectId, name, type }
  )) as Doc<"entities">[] | null;

  if (!matches || matches.length === 0) {
    return { entity: null };
  }

  if (matches.length > 1) {
    const types = Array.from(new Set(matches.map((match) => match.type)));
    return {
      entity: null,
      error: `Multiple entities named "${name}" found (${types.join(", ")})`,
    };
  }

  return { entity: matches[0] };
}

function resolveGraphApprovalReasons(params: {
  toolName: string;
  args: Record<string, unknown>;
  registry: ProjectTypeRegistryResolved | null;
  resolvedType?: string;
}): string[] {
  const { toolName, args, registry, resolvedType } = params;
  const reasons = new Set<string>();

  if (!registry) {
    reasons.add("registry_unknown");
    return Array.from(reasons);
  }

  const normalized = normalizeGraphToolCall(toolName, args);
  if (toolName === "graph_mutation" && !normalized) {
    reasons.add("mutation_unresolved");
    return Array.from(reasons);
  }

  const effectiveToolName = normalized?.toolName ?? toolName;
  const effectiveArgs = normalized?.args ?? args;

  const addRiskReason = (level?: RiskLevel): void => {
    if (level === "core") {
      reasons.add("risk_core");
    } else if (level === "high") {
      reasons.add("risk_high");
    }
  };

  if (effectiveToolName === "create_entity" || effectiveToolName === "create_node") {
    const type = typeof effectiveArgs["type"] === "string"
      ? (effectiveArgs["type"] as string)
      : resolvedType;
    if (!type) {
      reasons.add("invalid_type");
      return Array.from(reasons);
    }
    const def = registry.entityTypes[type];
    if (!def) {
      reasons.add("invalid_type");
      return Array.from(reasons);
    }
    addRiskReason(def.riskLevel);
    if (def.approval?.createRequiresApproval) {
      reasons.add("create_requires_approval");
    }
    return Array.from(reasons);
  }

  if (effectiveToolName === "update_entity" || effectiveToolName === "update_node") {
    const type =
      resolvedType ??
      (typeof effectiveArgs["entityType"] === "string" ? (effectiveArgs["entityType"] as string) : undefined) ??
      (typeof effectiveArgs["nodeType"] === "string" ? (effectiveArgs["nodeType"] as string) : undefined);
    if (!type) {
      reasons.add("invalid_type");
      return Array.from(reasons);
    }
    const def = registry.entityTypes[type];
    if (!def) {
      reasons.add("invalid_type");
      return Array.from(reasons);
    }
    addRiskReason(def.riskLevel);
    if (def.approval?.updateAlwaysRequiresApproval) {
      reasons.add("update_requires_approval");
    }
    const updates = (effectiveArgs["updates"] as Record<string, unknown> | undefined) ?? {};
    const identityFields = getIdentityFields(def);
    if (identityFields.length > 0 && hasIdentityChange(updates, identityFields)) {
      reasons.add("identity_change");
    }
    return Array.from(reasons);
  }

  if (effectiveToolName === "create_relationship" || effectiveToolName === "create_edge") {
    const type = typeof effectiveArgs["type"] === "string"
      ? (effectiveArgs["type"] as string)
      : resolvedType;
    if (!type) {
      reasons.add("invalid_type");
      return Array.from(reasons);
    }
    const def = registry.relationshipTypes[type];
    if (!def) {
      reasons.add("invalid_type");
      return Array.from(reasons);
    }
    addRiskReason(def.riskLevel);
    return Array.from(reasons);
  }

  if (effectiveToolName === "update_relationship" || effectiveToolName === "update_edge") {
    const type = typeof effectiveArgs["type"] === "string"
      ? (effectiveArgs["type"] as string)
      : resolvedType;
    if (!type) {
      reasons.add("invalid_type");
      return Array.from(reasons);
    }
    const def = registry.relationshipTypes[type];
    if (!def) {
      reasons.add("invalid_type");
      return Array.from(reasons);
    }
    addRiskReason(def.riskLevel);

    const updates = (effectiveArgs["updates"] as Record<string, unknown> | undefined) ?? {};
    if (updates["bidirectional"] !== undefined) {
      reasons.add("bidirectional_change");
    }
    if (isSignificantStrengthChange(updates["strength"] as number | undefined)) {
      reasons.add("strength_sensitive");
    }
    return Array.from(reasons);
  }

  return Array.from(reasons);
}

async function buildProjectGraphApprovalPreview(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  toolName: string,
  args: Record<string, unknown>,
  registry: ProjectTypeRegistryResolved | null
): Promise<{ preview: GraphApprovalPreview | null; reasons: string[] }> {
  let preview: GraphApprovalPreview | null = null;
  let resolvedType: string | undefined;

  const normalized = normalizeGraphToolCall(toolName, args);
  if (toolName === "graph_mutation" && !normalized) {
    const reasons = resolveGraphApprovalReasons({ toolName, args, registry, resolvedType });
    return { preview: null, reasons };
  }

  const effectiveToolName = normalized?.toolName ?? toolName;
  const effectiveArgs = normalized?.args ?? args;

  if (effectiveToolName === "create_entity" || effectiveToolName === "create_node") {
    const type = typeof effectiveArgs["type"] === "string" ? (effectiveArgs["type"] as string) : "unknown";
    const name = typeof effectiveArgs["name"] === "string" ? (effectiveArgs["name"] as string) : "";
    const aliases = Array.isArray(effectiveArgs["aliases"]) ? (effectiveArgs["aliases"] as string[]) : undefined;
    const notes = typeof effectiveArgs["notes"] === "string" ? (effectiveArgs["notes"] as string) : undefined;
    const properties = buildEntityPropertiesFromArgs(effectiveArgs);
    resolvedType = type;
    preview = {
      kind: "entity_create",
      type,
      name,
      aliases,
      notes,
      properties: Object.keys(properties).length > 0 ? properties : undefined,
    };
  }

  if (effectiveToolName === "update_entity" || effectiveToolName === "update_node") {
    const nameKey = effectiveToolName === "update_entity" ? "entityName" : "nodeName";
    const typeKey = effectiveToolName === "update_entity" ? "entityType" : "nodeType";
    const name = typeof effectiveArgs[nameKey] === "string" ? (effectiveArgs[nameKey] as string) : undefined;
    const typeHint = typeof effectiveArgs[typeKey] === "string" ? (effectiveArgs[typeKey] as string) : undefined;
    const updates = (effectiveArgs["updates"] as Record<string, unknown> | undefined) ?? {};

    let entity: Doc<"entities"> | null = null;
    let note: string | undefined;
    if (name) {
      const resolved = await resolveEntityForPreview(ctx, projectId, name, typeHint);
      entity = resolved.entity;
      if (resolved.error) {
        note = resolved.error;
      } else if (!entity) {
        note = `Entity "${name}" not found`;
      }
    } else {
      note = "Entity name missing";
    }

    resolvedType = entity?.type ?? typeHint;

    const changes = buildEntityUpdateChanges(entity, updates);
    preview = {
      kind: "entity_update",
      entityId: entity?._id,
      name: entity?.name ?? name,
      type: resolvedType,
      changes,
      note,
    };
  }

  if (effectiveToolName === "create_relationship" || effectiveToolName === "create_edge") {
    const type = typeof effectiveArgs["type"] === "string" ? (effectiveArgs["type"] as string) : "unknown";
    const sourceName = typeof effectiveArgs["sourceName"] === "string" ? (effectiveArgs["sourceName"] as string) : undefined;
    const targetName = typeof effectiveArgs["targetName"] === "string" ? (effectiveArgs["targetName"] as string) : undefined;
    const bidirectional = typeof effectiveArgs["bidirectional"] === "boolean" ? (effectiveArgs["bidirectional"] as boolean) : undefined;
    const strength = typeof effectiveArgs["strength"] === "number" ? (effectiveArgs["strength"] as number) : undefined;
    const notes = typeof effectiveArgs["notes"] === "string" ? (effectiveArgs["notes"] as string) : undefined;
    const metadata =
      effectiveArgs["metadata"] && typeof effectiveArgs["metadata"] === "object" && !Array.isArray(effectiveArgs["metadata"])
        ? (effectiveArgs["metadata"] as Record<string, unknown>)
        : undefined;

    let note: string | undefined;
    let sourceEntity: Doc<"entities"> | null = null;
    let targetEntity: Doc<"entities"> | null = null;

    if (sourceName) {
      const resolvedSource = await resolveEntityForPreview(ctx, projectId, sourceName);
      sourceEntity = resolvedSource.entity;
      if (resolvedSource.error) {
        note = resolvedSource.error;
      } else if (!sourceEntity) {
        note = `Source entity "${sourceName}" not found`;
      }
    }

    if (targetName) {
      const resolvedTarget = await resolveEntityForPreview(ctx, projectId, targetName);
      targetEntity = resolvedTarget.entity;
      if (!note && resolvedTarget.error) {
        note = resolvedTarget.error;
      } else if (!note && !targetEntity) {
        note = `Target entity "${targetName}" not found`;
      }
    }

    resolvedType = type;
    preview = {
      kind: "relationship_create",
      type,
      sourceName: sourceEntity?.name ?? sourceName,
      targetName: targetEntity?.name ?? targetName,
      sourceId: sourceEntity?._id,
      targetId: targetEntity?._id,
      bidirectional,
      strength,
      notes,
      metadata,
      note,
    };
  }

  if (effectiveToolName === "update_relationship" || effectiveToolName === "update_edge") {
    const type = typeof effectiveArgs["type"] === "string" ? (effectiveArgs["type"] as string) : "unknown";
    const sourceName = typeof effectiveArgs["sourceName"] === "string" ? (effectiveArgs["sourceName"] as string) : undefined;
    const targetName = typeof effectiveArgs["targetName"] === "string" ? (effectiveArgs["targetName"] as string) : undefined;
    const updates = (effectiveArgs["updates"] as Record<string, unknown> | undefined) ?? {};

    let note: string | undefined;
    let sourceEntity: Doc<"entities"> | null = null;
    let targetEntity: Doc<"entities"> | null = null;

    if (sourceName) {
      const resolvedSource = await resolveEntityForPreview(ctx, projectId, sourceName);
      sourceEntity = resolvedSource.entity;
      if (resolvedSource.error) {
        note = resolvedSource.error;
      } else if (!sourceEntity) {
        note = `Source entity "${sourceName}" not found`;
      }
    }

    if (targetName) {
      const resolvedTarget = await resolveEntityForPreview(ctx, projectId, targetName);
      targetEntity = resolvedTarget.entity;
      if (!note && resolvedTarget.error) {
        note = resolvedTarget.error;
      } else if (!note && !targetEntity) {
        note = `Target entity "${targetName}" not found`;
      }
    }

    let relationship: Doc<"relationships"> | null = null;
    const runQuery = ctx.runQuery as (query: unknown, args: unknown) => Promise<unknown>;
    if (sourceEntity && targetEntity && type !== "unknown") {
      relationship = (await runQuery(
        internalAny["ai/tools/projectGraphHandlers"]["findRelationship"],
        { projectId, sourceId: sourceEntity._id, targetId: targetEntity._id, type }
      )) as Doc<"relationships"> | null;
      if (!relationship && !note) {
        note = "Relationship not found";
      }
    } else if (!note) {
      note = "Relationship lookup incomplete";
    }

    resolvedType = type;
    const changes = buildRelationshipUpdateChanges(relationship, updates);
    preview = {
      kind: "relationship_update",
      relationshipId: relationship?._id,
      type,
      sourceName: sourceEntity?.name ?? sourceName,
      targetName: targetEntity?.name ?? targetName,
      changes,
      note,
    };
  }

  const reasons = resolveGraphApprovalReasons({ toolName, args, registry, resolvedType });
  return { preview, reasons };
}

async function resolveUniqueEntityTypeForUpdate(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  name: string,
  typeHint?: string
): Promise<string | null> {
  const runQuery = ctx.runQuery as (query: unknown, args: unknown) => Promise<unknown>;
  const matches = (await runQuery(
    internalAny["ai/tools/projectGraphHandlers"]["findEntityByCanonical"],
    { projectId, name, type: typeHint }
  )) as Array<{ type: string }> | null;

  if (!matches || matches.length !== 1) return null;
  return matches[0]?.type ?? null;
}


function resolveApprovalType(toolName: string): ToolApprovalType {
  if (toolName === "ask_question") return "input";
  if (toolName === "write_content") return "apply";
  return "execution";
}

function resolveApprovalDanger(toolName: string, args: Record<string, unknown>): ToolApprovalDanger {
  if (toolName === "write_content") {
    const content = typeof args["content"] === "string" ? (args["content"] as string) : "";
    const operation =
      typeof args["operation"] === "string" ? (args["operation"] as string) : undefined;
    if (operation === "append_document" || content.length > 800) {
      return "costly";
    }
    return "safe";
  }
  if (toolName === "project_manage") {
    const action = typeof args["action"] === "string" ? (args["action"] as string) : undefined;
    if (action === "restructure" || action === "pivot") {
      return "destructive";
    }
    return "costly";
  }
  if (toolName === "delete_document") return "destructive";
  if (isGraphTool(toolName)) return "destructive";
  return "safe";
}

async function resolveSuggestionRiskLevel(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  toolName: string,
  args: Record<string, unknown>,
  registry: ProjectTypeRegistryResolved | null
): Promise<RiskLevel> {
  if (toolName === "commit_decision") return "core";

  if (toolName === "write_content") {
    const danger = resolveApprovalDanger(toolName, args);
    return danger === "safe" ? "low" : "high";
  }

  const normalized = normalizeGraphToolCall(toolName, args);
  if (toolName === "graph_mutation" && !normalized) return "high";

  const effectiveToolName = normalized?.toolName ?? toolName;
  const effectiveArgs = normalized?.args ?? args;

  if (!registry) return "high";

  switch (effectiveToolName) {
    case "create_entity":
    case "create_node": {
      const type = typeof effectiveArgs["type"] === "string" ? (effectiveArgs["type"] as string) : undefined;
      if (!type) return "high";
      const def = registry.entityTypes[type];
      if (!def) return "high";
      if (def.approval?.createRequiresApproval) return "high";
      return def.riskLevel;
    }
    case "update_entity":
    case "update_node": {
      const updates = (effectiveArgs["updates"] as Record<string, unknown> | undefined) ?? {};
      let typeHint: string | undefined;
      if (typeof effectiveArgs["entityType"] === "string") {
        typeHint = effectiveArgs["entityType"] as string;
      } else if (typeof effectiveArgs["nodeType"] === "string") {
        typeHint = effectiveArgs["nodeType"] as string;
      }

      let name: string | undefined;
      if (typeof effectiveArgs["entityName"] === "string") {
        name = effectiveArgs["entityName"] as string;
      } else if (typeof effectiveArgs["nodeName"] === "string") {
        name = effectiveArgs["nodeName"] as string;
      }

      let resolvedType: string | null = null;
      if (typeHint) {
        resolvedType = typeHint;
      } else if (name) {
        resolvedType = await resolveUniqueEntityTypeForUpdate(ctx, projectId, name, typeHint);
      }

      if (!resolvedType) return "high";
      const def = registry.entityTypes[resolvedType];
      if (!def) return "high";
      if (def.riskLevel === "core") return "core";
      if (def.approval?.updateAlwaysRequiresApproval) return "high";
      const identityFields = getIdentityFields(def);
      if (identityFields.length > 0 && hasIdentityChange(updates, identityFields)) {
        return "high";
      }
      return def.riskLevel;
    }
    case "create_relationship":
    case "create_edge": {
      const type = typeof effectiveArgs["type"] === "string" ? (effectiveArgs["type"] as string) : undefined;
      if (!type) return "high";
      const def = registry.relationshipTypes[type];
      return def?.riskLevel ?? "high";
    }
    case "update_relationship":
    case "update_edge": {
      const type = typeof effectiveArgs["type"] === "string" ? (effectiveArgs["type"] as string) : undefined;
      if (!type) return "high";
      const def = registry.relationshipTypes[type];
      if (!def) return "high";
      if (def.riskLevel === "core") return "core";
      const updates = effectiveArgs["updates"] as Record<string, unknown> | undefined;
      if (updates?.["bidirectional"] !== undefined) return "high";
      if (isSignificantStrengthChange(updates?.["strength"] as number | undefined)) {
        return "high";
      }
      return def.riskLevel;
    }
    default:
      return "low";
  }
}

async function executeRagTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  projectId: string
): Promise<unknown> {
  // @ts-expect-error - Convex generated types are too deep
  const apiAny: any = api;
  switch (toolName) {
    case "search_context":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeSearchContext, {
        projectId,
        query: args["query"] as string,
        scope: args["scope"] as string | undefined,
        limit: args["limit"] as number | undefined,
      });
    case "read_document":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeReadDocument, {
        projectId,
        documentId: args["documentId"] as string,
      });
    case "get_entity":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeGetEntity, {
        projectId,
        entityId: args["entityId"] as string,
        includeRelationships: args["includeRelationships"] as boolean | undefined,
      });
    case "view_version_history":
      return ctx.runQuery(apiAny.revisions.viewVersionHistory, {
        documentId: args["documentId"] as Id<"documents">,
        limit: args["limit"] as number | undefined,
        cursor: args["cursor"] as string | undefined,
      });
    case "view_comments":
      return ctx.runQuery(apiAny.comments.listByDocument, {
        projectId: projectId as Id<"projects">,
        documentId: args["documentId"] as Id<"documents">,
        limit: args["limit"] as number | undefined,
        cursor: args["cursor"] as string | undefined,
      });
    case "search_users":
      return ctx.runQuery(apiAny.users.searchProjectUsers, {
        projectId: projectId as Id<"projects">,
        query: args["query"] as string,
        limit: args["limit"] as number | undefined,
      });
    default:
      throw new Error(`Unknown RAG tool: ${toolName}`);
  }
}

async function executeWebTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "web_search":
      return (webSearchTool as any).execute?.(args, {}) ?? Promise.reject(new Error("web_search executor unavailable"));
    case "web_extract":
      return (webExtractTool as any).execute?.(args, {}) ?? Promise.reject(new Error("web_extract executor unavailable"));
    default:
      throw new Error(`Unknown web tool: ${toolName}`);
  }
}

function buildAnalyzeImagePrompt(args: {
  entityTypeHint?: string;
  extractionFocus?: string;
}): string | undefined {
  const focus = typeof args.extractionFocus === "string" ? args.extractionFocus : undefined;
  const hint = typeof args.entityTypeHint === "string" ? args.entityTypeHint : undefined;
  if (!focus && !hint) return undefined;
  const parts = ["Analyze this image and return JSON: { description, characters, mood, setting, style }."];
  if (focus) {
    parts.push(`Focus on ${focus} details.`);
  }
  if (hint) {
    parts.push(`Entity type hint: ${hint}.`);
  }
  return parts.join("\n");
}

async function resolveImageSourceForAnalysis(
  ctx: ActionCtx,
  projectId: string,
  imageSource: string
): Promise<{ imageUrl: string; assetId?: string }> {
  if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
    return { imageUrl: imageSource };
  }

  if (imageSource.startsWith("data:")) {
    const match = imageSource.match(/^data:(.+);base64,(.*)$/);
    if (!match) {
      throw new Error("Invalid base64 image source");
    }
    const base64Data = match[2] ?? "";
    if (base64Data.length > MAX_BASE64_IMAGE_CHARS) {
      throw new Error("Image payload too large");
    }
    return { imageUrl: imageSource };
  }

  const asset = await ctx.runQuery((internal as any).projectAssets.get, {
    id: imageSource as Id<"projectAssets">,
  });
  if (asset && String(asset.projectId) === projectId) {
    const imageUrl = await ctx.storage.getUrl(asset.storageId);
    if (!imageUrl) {
      throw new Error("Failed to resolve stored image URL");
    }
    return { imageUrl, assetId: asset._id };
  }

  const imageUrl = await ctx.storage.getUrl(imageSource as Id<"_storage">);
  if (!imageUrl) {
    throw new Error("Failed to resolve image source");
  }
  return { imageUrl };
}

async function executeAnalyzeImageTool(
  ctx: ActionCtx,
  args: Record<string, unknown>,
  projectId: string,
  userId: string
): Promise<unknown> {
  const imageSource = typeof args["imageSource"] === "string" ? (args["imageSource"] as string) : "";
  if (!imageSource) {
    throw new Error("imageSource is required");
  }

  const { imageUrl, assetId } = await resolveImageSourceForAnalysis(ctx, projectId, imageSource);
  const analysisPrompt = buildAnalyzeImagePrompt({
    entityTypeHint: typeof args["entityTypeHint"] === "string" ? (args["entityTypeHint"] as string) : undefined,
    extractionFocus: typeof args["extractionFocus"] === "string" ? (args["extractionFocus"] as string) : undefined,
  });

  const analysis = await ctx.runAction((internal as any)["ai/image"].analyzeImageAction, {
    projectId,
    userId,
    imageUrl,
    analysisPrompt,
  });

  const suggestedEntityType =
    typeof args["entityTypeHint"] === "string"
      ? (args["entityTypeHint"] as string)
      : Array.isArray((analysis as any)?.characters) && (analysis as any).characters.length > 0
      ? "character"
      : (analysis as any)?.setting
      ? "location"
      : "character";

  const suggestedName = Array.isArray((analysis as any)?.characters)
    ? (analysis as any).characters[0]
    : undefined;

  const visualDescription = {
    artStyle: typeof (analysis as any)?.style === "string" ? (analysis as any).style : undefined,
    mood: typeof (analysis as any)?.mood === "string" ? (analysis as any).mood : undefined,
    atmosphere: typeof (analysis as any)?.setting === "string" ? (analysis as any).setting : undefined,
  };

  return {
    suggestedEntityType,
    suggestedName,
    visualDescription,
    description: (analysis as any)?.description ?? "",
    confidence: 0.7,
    assetId,
    imageUrl,
  };
}

type SpawnedAgentType = "research" | "analysis" | "writing";

type SubAgentSpec = {
  name: string;
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: Record<string, any>;
};

function getSubAgentSpec(agent: SpawnedAgentType, requireCitations?: boolean): SubAgentSpec {
  const citationLine = requireCitations
    ? "Include citations with URLs for any external claims."
    : "Citations are optional; add them when useful.";

  switch (agent) {
    case "research":
      return {
        name: "Research",
        systemPrompt: [
          "You are a research sub-agent focused on sourcing accurate information.",
          "Use web_search and web_extract when external sources are needed.",
          "Summarize findings with clear bullet points.",
          citationLine,
        ].join("\n"),
        tools: {
          web_search: webSearchTool,
          web_extract: webExtractTool,
          search_context: searchContextTool,
          read_document: readDocumentTool,
          get_entity: getEntityTool,
        },
      };
    case "analysis":
      return {
        name: "Analysis",
        systemPrompt: [
          "You are an analysis sub-agent focused on identifying issues and recommendations.",
          "Use analyze_content when structured analysis helps.",
          "Provide concise bullet-pointed findings and next steps.",
          citationLine,
        ].join("\n"),
        tools: {
          analyze_content: analyzeContentTool,
          search_context: searchContextTool,
          read_document: readDocumentTool,
          get_entity: getEntityTool,
        },
      };
    case "writing":
    default:
      return {
        name: "Writing",
        systemPrompt: [
          "You are a writing sub-agent focused on producing draft text and suggestions.",
          "Provide clear output with brief rationale when helpful.",
          citationLine,
        ].join("\n"),
        tools: {
          search_context: searchContextTool,
          read_document: readDocumentTool,
          get_entity: getEntityTool,
        },
      };
  }
}

function createSubAgent(spec: SubAgentSpec, maxSteps: number): Agent {
  const testMode = TEST_MODE;
  const languageModel = testMode ? createTestLanguageModel() : openrouter.chat(DEFAULT_MODEL);

  return new Agent(components.agent, {
    name: spec.name,
    languageModel,
    usageHandler: createUsageHandler(),
    textEmbeddingModel: undefined,
    contextOptions: {
      recentMessages: 0,
      searchOptions: {
        limit: 0,
        vectorSearch: false,
        textSearch: false,
        messageRange: { before: 0, after: 0 },
      },
      searchOtherThreads: false,
    },
    tools: spec.tools,
    maxSteps,
  });
}

async function executeWriteTodosTool(
  ctx: ActionCtx,
  args: Record<string, unknown>,
  projectId: string,
  userId: string,
  threadId?: string
): Promise<unknown> {
  const todos = Array.isArray(args["todos"]) ? (args["todos"] as unknown[]) : [];
  if (todos.length === 0) {
    throw new Error("todos is required");
  }

  const title = typeof args["title"] === "string" ? (args["title"] as string) : undefined;
  const target =
    args["target"] && typeof args["target"] === "object"
      ? (args["target"] as Record<string, unknown>)
      : undefined;

  const result = await ctx.runMutation((internal as any)["ai/todos"].createTodos, {
    projectId: projectId as Id<"projects">,
    userId,
    threadId,
    title,
    todos,
    target,
  });

  return {
    todoCount: todos.length,
    stored: true,
    todoIds: (result as { todoIds?: string[] }).todoIds,
  };
}

async function executeSpawnTaskTool(
  ctx: ActionCtx,
  args: Record<string, unknown>,
  projectId: string,
  userId: string
): Promise<unknown> {
  const agent = args["agent"] as SpawnedAgentType | undefined;
  const title = typeof args["title"] === "string" ? (args["title"] as string) : "Spawned Task";
  const instructions =
    typeof args["instructions"] === "string" ? (args["instructions"] as string) : "";
  if (!agent || !instructions) {
    throw new Error("agent and instructions are required");
  }

  const maxSteps =
    typeof args["maxSteps"] === "number" && Number.isFinite(args["maxSteps"])
      ? Math.max(1, Math.min(12, args["maxSteps"] as number))
      : 6;
  const requireCitations = Boolean(args["requireCitations"]);

  const spec = getSubAgentSpec(agent, requireCitations);
  const subAgent = createSubAgent(spec, maxSteps);

  const { threadId } = await subAgent.createThread(ctx, {
    userId,
    title: `${spec.name}: ${title}`,
  });

  const { messageId: promptMessageId } = await subAgent.saveMessage(ctx, {
    threadId,
    userId,
    message: { role: "user", content: instructions },
    metadata: {
      providerMetadata: { saga: { projectId, parentTool: "spawn_task" } },
    },
  });

  let output = "";
  let result = await subAgent.streamText(
    ctx,
    { threadId },
    { promptMessageId, system: spec.systemPrompt } as any
  );

  for await (const delta of result.textStream) {
    if (delta) output += delta;
  }

  let toolCalls = await result.toolCalls;
  let loopCount = 0;

  while (toolCalls.length > 0 && loopCount < 4) {
    loopCount += 1;

    for (const call of toolCalls) {
      const toolResult = await executeAutoTool(
        ctx,
        call.toolName,
        call.input as Record<string, unknown>,
        projectId,
        userId,
        threadId
      );

      await subAgent.saveMessage(ctx, {
        threadId,
        userId,
        message: {
          role: "tool",
          content: [{ type: "tool-result", toolCallId: call.toolCallId, toolName: call.toolName, result: toolResult }],
        },
      });
    }

    result = await subAgent.streamText(
      ctx,
      { threadId },
      { promptMessageId, system: spec.systemPrompt } as any
    );

    for await (const delta of result.textStream) {
      if (delta) output += delta;
    }

    toolCalls = await result.toolCalls;
  }

  return {
    agent,
    output: output.trim(),
  };
}

async function executeAutoTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  projectId: string,
  userId: string,
  threadId?: string
): Promise<unknown> {
  const category = getToolPolicy(toolName)?.category;
  if (category === "web") {
    return executeWebTool(toolName, args);
  }
  if (category === "rag") {
    return executeRagTool(ctx, toolName, args, projectId);
  }
  if (toolName === "analyze_content") {
    return ctx.runAction((internal as any)["ai/tools"].execute, {
      toolName,
      input: args,
      projectId,
      userId,
    });
  }
  if (toolName === "analyze_image") {
    return executeAnalyzeImageTool(ctx, args, projectId, userId);
  }
  if (toolName === "write_todos") {
    return executeWriteTodosTool(ctx, args, projectId, userId, threadId);
  }
  if (toolName === "spawn_task") {
    return executeSpawnTaskTool(ctx, args, projectId, userId);
  }
  if (category === "artifact") {
    return executeArtifactTool(ctx, toolName, args, projectId, userId);
  }
  throw new Error(`Unknown auto-execute tool: ${toolName}`);
}

async function executeArtifactTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  projectId: string,
  userId: string
): Promise<unknown> {
  const now = Date.now();

  // artifact_link - pure computation, no mutations
  if (toolName === "artifact_link") {
    const target = args["target"] as string;
    const baseUrl = process.env.SITE_URL ?? "https://cascada.vision";
    switch (target) {
      case "project":
        return { ok: true, url: `${baseUrl}/project/${args["projectId"]}` };
      case "document":
        return {
          ok: true,
          url: `${baseUrl}/project/${args["projectId"]}/doc/${args["documentId"]}${args["focusId"] ? `#${args["focusId"]}` : ""}`,
        };
      case "entity":
        return { ok: true, url: `${baseUrl}/project/${args["projectId"]}/entity/${args["entityId"]}` };
      case "artifact":
        return {
          ok: true,
          url: `${baseUrl}/project/${args["projectId"]}/artifact/${args["artifactKey"]}${args["focusId"] ? `#${args["focusId"]}` : ""}`,
        };
      default:
        return { ok: false, error: `Unknown link target: ${target}` };
    }
  }

  // artifact_stage - UI commands, no server mutations
  if (toolName === "artifact_stage") {
    const action = args["action"] as string;
    return { ok: true, action, ...args };
  }

  // artifact_tool - create/update/apply_op/remove
  if (toolName === "artifact_tool") {
    const action = args["action"] as string;

    if (action === "create") {
      const artifactKey = (args["artifactKey"] as string) ?? `artifact-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const title = args["title"] as string;
      const type = args["type"] as string;
      const format = (args["format"] as string) ?? "json";
      const content = (args["content"] as string) ?? (args["envelope"] ? JSON.stringify(args["envelope"], null, 2) : "");

      await ctx.runMutation((api as any).artifacts.create, {
        projectId,
        artifactKey,
        type,
        title,
        content,
        format,
        executionContext: {
          widgetId: "agent_artifact_tools",
          widgetVersion: "v1",
          model: "saga-agent",
          inputs: args,
          startedAt: now,
          completedAt: Date.now(),
        },
      });

      return {
        ok: true,
        artifactKey,
        artifact: { artifactKey, title, type, format, status: "draft", updatedAt: now },
        open: args["open"] ?? true,
        setActive: args["setActive"] ?? true,
        focusId: args["focusId"],
      };
    }

    if (action === "update") {
      const artifactKey = args["artifactKey"] as string;
      const patch = args["patch"] as Record<string, unknown>;
      if (patch["content"] || patch["format"]) {
        await ctx.runMutation((api as any).artifacts.updateContent, {
          projectId,
          artifactKey,
          content: patch["content"] as string | undefined,
          format: patch["format"] as string | undefined,
        });
      }
      return { ok: true, artifactKey, updatedAt: Date.now(), patchApplied: patch };
    }

    if (action === "apply_op") {
      const artifactKey = args["artifactKey"] as string;
      const op = args["op"];
      const result = await ctx.runMutation((api as any).artifacts.applyOp, {
        projectId,
        artifactKey,
        op,
      });
      return { ok: true, artifactKey, nextEnvelope: result };
    }

    if (action === "remove") {
      return { ok: false, error: "Artifact removal not implemented" };
    }

    return { ok: false, error: `Unknown artifact_tool action: ${action}` };
  }

  // Convenience tools - delegate to artifact_tool internally
  if (toolName === "artifact_diagram" || toolName === "artifact_table" || toolName === "artifact_timeline" || toolName === "artifact_prose") {
    const action = args["action"] as string;

    if (action === "create") {
      const artifactKey = `artifact-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const title = args["title"] as string;
      const type = toolName.replace("artifact_", "") as string;
      const envelope = buildConvenienceEnvelope(toolName, args, artifactKey, now);

      await ctx.runMutation((api as any).artifacts.create, {
        projectId,
        artifactKey,
        type,
        title,
        content: JSON.stringify(envelope, null, 2),
        format: "json",
        executionContext: {
          widgetId: "agent_artifact_tools",
          widgetVersion: "v1",
          model: "saga-agent",
          inputs: args,
          startedAt: now,
          completedAt: Date.now(),
        },
      });

      return {
        ok: true,
        artifactKey,
        artifact: { artifactKey, title, type, format: "json", status: "draft", updatedAt: now },
        open: true,
        setActive: true,
      };
    }

    // Non-create actions map to applyOp
    const artifactKey = args["artifactKey"] as string;
    const op = mapConvenienceActionToOp(toolName, action, args);
    if (!op) {
      return { ok: false, error: `Unknown ${toolName} action: ${action}` };
    }

    const result = await ctx.runMutation((api as any).artifacts.applyOp, {
      projectId,
      artifactKey,
      op,
    });
    return { ok: true, artifactKey, nextEnvelope: result };
  }

  return { ok: false, error: `Unknown artifact tool: ${toolName}` };
}

function buildConvenienceEnvelope(
  toolName: string,
  args: Record<string, unknown>,
  artifactId: string,
  now: number
): Record<string, unknown> {
  const base = {
    schemaVersion: "1.0",
    artifactId,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  switch (toolName) {
    case "artifact_diagram": {
      const nodes = (args["nodes"] as Array<Record<string, unknown>>) ?? [];
      const edges = (args["edges"] as Array<Record<string, unknown>>) ?? [];
      return {
        ...base,
        type: "diagram",
        data: {
          nodes: nodes.map((n, i) => ({
            nodeId: n["nodeId"] ?? `node-${i}`,
            title: n["title"],
            subtitle: n["subtitle"],
            x: n["x"] ?? i * 150,
            y: n["y"] ?? 100,
            nodeKind: n["nodeKind"] ?? "entity",
            entityId: n["entityId"],
          })),
          edges: edges.map((e, i) => ({
            edgeId: e["edgeId"] ?? `edge-${i}`,
            source: e["source"],
            target: e["target"],
            label: e["label"],
            kind: e["kind"],
          })),
        },
      };
    }
    case "artifact_table": {
      const columns = (args["columns"] as Array<Record<string, unknown>>) ?? [];
      const rows = (args["rows"] as Array<Record<string, unknown>>) ?? [];
      return {
        ...base,
        type: "table",
        data: {
          columns: columns.map((c, i) => ({
            columnId: c["columnId"] ?? `col-${i}`,
            label: c["label"],
            valueType: c["valueType"] ?? "text",
            enumOptions: c["enumOptions"],
          })),
          rowOrder: rows.map((_, i) => `row-${i}`),
          rows: Object.fromEntries(rows.map((r, i) => [`row-${i}`, { rowId: r["rowId"] ?? `row-${i}`, cells: r["cells"] ?? {} }])),
        },
      };
    }
    case "artifact_timeline": {
      const groups = (args["groups"] as Array<Record<string, unknown>>) ?? [];
      const items = (args["items"] as Array<Record<string, unknown>>) ?? [];
      return {
        ...base,
        type: "timeline",
        data: {
          groups: groups.map((g, i) => ({
            groupId: g["groupId"] ?? `group-${i}`,
            label: g["label"],
            kind: g["kind"],
            entityId: g["entityId"],
          })),
          items: items.map((item, i) => ({
            itemId: item["itemId"] ?? `item-${i}`,
            start: item["start"],
            end: item["end"],
            content: item["content"],
            groupId: item["groupId"],
          })),
        },
      };
    }
    case "artifact_prose": {
      const markdown = args["markdown"] as string;
      const type = (args["type"] as string) ?? "prose";
      return {
        ...base,
        type,
        data: {
          blockOrder: ["block-1"],
          blocks: {
            "block-1": { blockId: "block-1", content: markdown },
          },
        },
      };
    }
    default:
      return base;
  }
}

function mapConvenienceActionToOp(
  toolName: string,
  action: string,
  args: Record<string, unknown>
): Record<string, unknown> | null {
  switch (toolName) {
    case "artifact_diagram":
      switch (action) {
        case "upsert_node":
          return { type: "diagram.node.upsert", nodeId: args["nodeId"], title: args["title"], subtitle: args["subtitle"], nodeKind: args["nodeKind"], entityId: args["entityId"] };
        case "move_node":
          return { type: "diagram.node.move", nodeId: args["nodeId"], x: args["x"], y: args["y"] };
        case "add_edge":
          return { type: "diagram.edge.add", source: args["source"], target: args["target"], label: args["label"], kind: args["kind"] };
        case "update_edge":
          return { type: "diagram.edge.update", edgeId: args["edgeId"], label: args["label"], kind: args["kind"] };
      }
      break;
    case "artifact_table":
      switch (action) {
        case "add_row":
          return { type: "table.row.add", rowId: args["rowId"], cells: args["cells"], afterRowId: args["afterRowId"] };
        case "update_cell":
          return { type: "table.cell.update", rowId: args["rowId"], columnId: args["columnId"], value: args["value"] };
        case "remove_rows":
          return { type: "table.rows.remove", rowIds: args["rowIds"] };
        case "reorder_rows":
          return { type: "table.row.reorder", rowIds: args["rowIds"] };
      }
      break;
    case "artifact_timeline":
      switch (action) {
        case "upsert_item":
          return { type: "timeline.item.upsert", itemId: args["itemId"], start: args["start"], end: args["end"], content: args["content"], groupId: args["groupId"] };
        case "update_item":
          return { type: "timeline.item.update", itemId: args["itemId"], start: args["start"], end: args["end"], content: args["content"], groupId: args["groupId"] };
      }
      break;
    case "artifact_prose":
      switch (action) {
        case "replace_block":
          return { type: "prose.block.replace", blockId: args["blockId"], markdown: args["markdown"] };
      }
      break;
  }
  return null;
}

async function executeProjectGraphTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  projectId: string,
  actor?: ToolActorContext,
  source?: ToolSourceContext
): Promise<unknown> {
  switch (toolName) {
    case "graph_mutation":
      return ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeGraphMutation, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    default:
      throw new Error(`Unknown project graph tool: ${toolName}`);
  }
}

async function appendStreamChunk(
  ctx: ActionCtx,
  streamId: string,
  chunk: {
    type: string;
    content: string;
    toolCallId?: string;
    toolName?: string;
    approvalId?: string;
    suggestionId?: string;
    approvalType?: ToolApprovalType;
    danger?: ToolApprovalDanger;
    args?: unknown;
    data?: unknown;
    promptMessageId?: string;
  }
) {
  await ctx.runMutation((internal as any)["ai/streams"].appendChunk, {
    streamId,
    chunk,
  });
}

async function emitActivity(
  ctx: ActionCtx,
  payload: {
    projectId: Id<"projects">;
    documentId?: Id<"documents">;
    actorType: "ai" | "user" | "system";
    actorUserId?: string;
    actorAgentId?: string;
    actorName?: string;
    action: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await ctx.runMutation((internal as any)["activity"].emit, payload);
}

function buildEmptyContext(): RAGContext {
  return { documents: [], entities: [], memories: [] };
}

function resolveE2EScenario(contextHints: unknown): string | undefined {
  if (!contextHints || typeof contextHints !== "object") return undefined;
  const hints = contextHints as { e2eScenario?: unknown; testScenario?: unknown };
  if (typeof hints.e2eScenario === "string" && hints.e2eScenario.trim().length > 0) {
    return hints.e2eScenario;
  }
  if (typeof hints.testScenario === "string" && hints.testScenario.trim().length > 0) {
    return hints.testScenario;
  }
  return undefined;
}

function resolveTemplateBuilderHints(contextHints: unknown): { projectType?: string; phase?: string } | null {
  if (!contextHints || typeof contextHints !== "object") return null;
  const templateBuilder = (contextHints as { templateBuilder?: unknown }).templateBuilder;
  if (!templateBuilder || typeof templateBuilder !== "object") return null;
  const record = templateBuilder as Record<string, unknown>;
  return {
    projectType: typeof record["projectType"] === "string" ? (record["projectType"] as string) : undefined,
    phase: typeof record["phase"] === "string" ? (record["phase"] as string) : undefined,
  };
}

function buildTemplateBuilderSystemPrompt(hints: { projectType?: string; phase?: string } | null): string {
  const projectType = hints?.projectType ?? "story";
  const phase = hints?.phase ?? "discovery";
  return [
    "You are Muse, a Mythos template architect.",
    "You design structured project templates across fiction, product, engineering, design, communications, and cinema.",
    `Current project type: ${projectType}.`,
    `Current phase: ${phase}.`,
    "Ask concise, targeted questions to gather missing constraints.",
    "When ready, propose a generate_template tool call with the required fields.",
  ].join("\n");
}

export const runSagaAgentChatToStream = internalAction({
  args: {
    streamId: v.string(),
    projectId: v.string(),
    userId: v.string(),
    prompt: v.string(),
    threadId: v.optional(v.string()),
    mode: v.optional(v.string()),
    editorContext: v.optional(v.any()),
    contextHints: v.optional(v.any()),
    attachments: v.optional(v.array(v.any())),
    byokKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { streamId, projectId, userId, prompt, mode, editorContext, contextHints, attachments, byokKey } = args;
    const isTemplateBuilder = projectId === "template-builder";
    const projectIdValue = projectId as Id<"projects">;
    const testMode = TEST_MODE;
    const isByok = isByokRequest(byokKey);

    // Validate API key is available (BYOK or platform)
    if (!testMode) {
      try {
        resolveOpenRouterKey(byokKey);
      } catch {
        await ctx.runMutation((internal as any)["ai/streams"].fail, {
          streamId,
          error: "OPENROUTER_API_KEY not configured",
        });
        return;
      }
    }

    // Skip quota check for BYOK users - they pay their own API costs
    if (!testMode && !isTemplateBuilder && !isByok) {
      try {
        await assertAiAllowed(ctx, {
          userId,
          endpoint: "chat",
          promptText: prompt,
        });
      } catch (error) {
        await ctx.runMutation((internal as any)["ai/streams"].fail, {
          streamId,
          error: error instanceof Error ? error.message : "Quota enforcement failed",
        });
        return;
      }
    }

    let presenceDocumentId: string | undefined;
    let lastAiPresenceAt = 0;

    const clearAiPresence = async (): Promise<void> => {
      if (isTemplateBuilder || !presenceDocumentId) return;
      try {
        await setAiPresence(ctx, projectId, presenceDocumentId, false);
      } catch (error) {
        console.warn("[agentRuntime] Failed to clear AI presence:", error);
      }
    };

    try {
      const startTime = Date.now();
      const registry = isTemplateBuilder
        ? null
        : ((await ctx.runQuery((internal as any).projectTypeRegistry.getResolvedInternal, {
            projectId: projectIdValue,
          })) as ProjectTypeRegistryResolved);

      if (E2E_TEST_MODE) {
        const scenario = resolveE2EScenario(contextHints) ?? "default";
        const script = await ctx.runQuery((internal as any)["e2e"].getSagaScript, {
          projectId: projectIdValue,
          userId,
          scenario,
        });
        if (!script) {
          throw new Error(`Missing E2E saga script for scenario: ${scenario}`);
        }
        setSagaTestScript(script.steps as SagaTestStreamStep[]);
      }

      // Get user's preferred model (for BYOK users)
      const preferredModel = isByok
        ? await ctx.runQuery((internal as any).billingSettings.getPreferredModel, { userId })
        : undefined;

      const sagaAgent = createSagaAgent(isByok ? byokKey : undefined, preferredModel);
      const templateHints = resolveTemplateBuilderHints(contextHints);
      let threadId = args.threadId;
      const editorDocumentId = resolveEditorDocumentId(editorContext);
      let threadScope: "project" | "document" | "private" = editorDocumentId ? "document" : "project";
      let threadDocumentId: Id<"documents"> | undefined = editorDocumentId
        ? (editorDocumentId as Id<"documents">)
        : undefined;

      if (threadId) {
        if (isTemplateBuilder) {
          await ctx.runQuery((internal as any).templateBuilderSessions.assertThreadOwner, {
            threadId,
            userId,
          });
        } else {
          const threadAccess = await ctx.runQuery((internal as any)["ai/threads"].assertThreadAccess, {
            threadId,
            projectId: projectIdValue,
            userId,
          });
          threadScope = threadAccess.scope;
          threadDocumentId = threadAccess.documentId ?? undefined;
        }
      } else {
        threadId = (await sagaAgent.createThread(ctx, {
          userId,
          title: "Saga Conversation",
        })).threadId;
      }

      const aiActor: ToolActorContext = {
        actorType: "ai",
        actorUserId: userId,
        actorAgentId: "muse",
        actorName: "Muse",
      };
      const activityDocumentId = threadDocumentId ?? undefined;

      if (!isTemplateBuilder) {
        await ctx.runMutation((internal as any)["ai/threads"].upsertThread, {
          threadId,
          projectId: projectIdValue,
          userId,
          scope: threadScope,
          documentId: threadDocumentId,
        });
      } else if (threadId) {
        await ctx.runMutation((internal as any).templateBuilderSessions.upsertInternal, {
          userId,
          threadId,
          projectType: templateHints?.projectType,
          phase: templateHints?.phase ?? "discovery",
        });
      }

      presenceDocumentId = editorDocumentId ?? (threadDocumentId ? String(threadDocumentId) : undefined);
      if (!isTemplateBuilder && presenceDocumentId) {
        const now = Date.now();
        try {
          await setAiPresence(ctx, projectId, presenceDocumentId, true);
        } catch (error) {
          console.warn("[agentRuntime] Failed to set AI presence:", error);
        }
        lastAiPresenceAt = now;
      }

      const { messageId: promptMessageId } = await sagaAgent.saveMessage(ctx, {
        threadId,
        userId,
        message: {
          role: "user",
          content: prompt,
        },
        metadata: {
          providerMetadata: {
            saga: { projectId, editorContext, contextHints, attachments },
          },
        },
      });

      // Track stream started
      await ServerAgentEvents.streamStarted(userId, projectId, threadId!, DEFAULT_MODEL);

      const shouldSkipRag = testMode || isTemplateBuilder;
      const lexicalDocuments = shouldSkipRag
        ? []
        : await ctx.runQuery((internal as any)["ai/lexical"].searchDocuments, {
            projectId: projectIdValue,
            query: prompt,
            limit: LEXICAL_LIMIT,
          });
      const lexicalEntities = shouldSkipRag
        ? []
        : await ctx.runQuery((internal as any)["ai/lexical"].searchEntities, {
            projectId: projectIdValue,
            query: prompt,
            limit: LEXICAL_LIMIT,
          });

      const ragContext = shouldSkipRag
        ? buildEmptyContext()
        : await retrieveRAGContext(prompt, projectId, {
            excludeMemories: false,
            lexical: { documents: lexicalDocuments, entities: lexicalEntities },
            chunkContext: { before: 2, after: 1 },
            telemetry: { distinctId: userId },
          });

      if (!shouldSkipRag) {
        // Track RAG context retrieved
        await ServerAgentEvents.ragContextRetrieved(
          userId,
          ragContext.documents.length,
          ragContext.entities.length,
          ragContext.memories.length
        );
      }

      await appendStreamChunk(ctx, streamId, {
        type: "context",
        content: "",
        data: {
          ...ragContext,
          threadId,
        },
      });

      const systemPrompt = isTemplateBuilder
        ? buildTemplateBuilderSystemPrompt(templateHints)
        : buildSystemPrompt({
            mode,
            ragContext,
            editorContext,
            attachments,
          });

      const result = await sagaAgent.streamText(
        ctx,
        { threadId },
        {
          promptMessageId,
          system: systemPrompt,
        } as any
      );

      for await (const delta of result.textStream) {
        if (delta) {
          await appendStreamChunk(ctx, streamId, {
            type: "delta",
            content: delta,
          });
        }
        lastAiPresenceAt = await maybeKeepAiTypingAlive({
          ctx,
          projectId,
          presenceDocumentId,
          isTemplateBuilder,
          lastAiPresenceAt,
        });
      }

      let toolCalls = await result.toolCalls;
      let currentResult = result;
      let currentPromptMessageId = promptMessageId;

      while (toolCalls.length > 0) {
        const autoCalls = toolCalls.filter((c) => isAutoExecuteTool(c.toolName));
        const projectGraphCalls = toolCalls.filter((c) => isGraphTool(c.toolName));
        const otherCalls = toolCalls.filter(
          (c) => !isAutoExecuteTool(c.toolName) && !isGraphTool(c.toolName)
        );

        // Execute auto tools (rag/web)
        for (const call of autoCalls) {
          let toolResult: unknown;
          try {
            toolResult = await executeAutoTool(
              ctx,
              call.toolName,
              call.input as Record<string, unknown>,
              projectId,
              userId,
              threadId ?? undefined
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown tool error";
            toolResult = { success: false, error: errorMessage };
            console.warn(`[agentRuntime] Auto tool failed: ${call.toolName}`, error);
          }

          await sagaAgent.saveMessage(ctx, {
            threadId: threadId!,
            userId,
            message: {
              role: "tool",
              content: [{ type: "tool-result", toolCallId: call.toolCallId, toolName: call.toolName, result: toolResult }],
            },
          });

          await appendStreamChunk(ctx, streamId, {
            type: "tool",
            content: "",
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.input,
            data: toolResult,
          });

          if (!isTemplateBuilder) {
            await emitActivity(ctx, {
              projectId: projectIdValue,
              documentId: activityDocumentId,
              ...aiActor,
              action: "ai_tool_executed",
              summary: `Executed ${call.toolName}`,
              metadata: {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                streamId,
                threadId,
                promptMessageId: currentPromptMessageId,
                args: call.input,
              },
            });
          }
        }

        // Process project graph tools - auto-execute or request approval based on impact
        const autoProjectGraphCalls: typeof projectGraphCalls = [];
        const pendingProjectGraphCalls: typeof projectGraphCalls = [];

        for (const call of projectGraphCalls) {
          const args = call.input as Record<string, unknown>;
          const requiresApproval = needsToolApproval(registry, call.toolName, args);
          if (requiresApproval) {
            pendingProjectGraphCalls.push(call);
          } else {
            autoProjectGraphCalls.push(call);
          }
        }

        // Auto-execute low-impact project graph tools
        for (const call of autoProjectGraphCalls) {
          let toolResult: unknown;
          try {
            toolResult = await executeProjectGraphTool(
              ctx,
              call.toolName,
              call.input as Record<string, unknown>,
              projectId,
              aiActor,
              {
                streamId,
                threadId,
                toolCallId: call.toolCallId,
                promptMessageId: currentPromptMessageId,
              }
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown tool error";
            toolResult = { success: false, error: errorMessage };
            console.warn(`[agentRuntime] Graph tool failed: ${call.toolName}`, error);
          }

          await sagaAgent.saveMessage(ctx, {
            threadId: threadId!,
            userId,
            message: {
              role: "tool",
              content: [{ type: "tool-result", toolCallId: call.toolCallId, toolName: call.toolName, result: toolResult }],
            },
          });

          await appendStreamChunk(ctx, streamId, {
            type: "tool",
            content: "",
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.input,
            data: toolResult,
          });

          if (!isTemplateBuilder) {
            await emitActivity(ctx, {
              projectId: projectIdValue,
              documentId: activityDocumentId,
              ...aiActor,
              action: "ai_tool_executed",
              summary: `Executed ${call.toolName}`,
              metadata: {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                streamId,
                threadId,
                promptMessageId: currentPromptMessageId,
                args: call.input,
              },
            });
          }
        }

        // Request approval for high-impact project graph tools
        for (const call of pendingProjectGraphCalls) {
          const approvalArgs = call.input as Record<string, unknown>;
          let suggestionId: string | undefined;
          const suggestion = classifyKnowledgeSuggestion(call.toolName, approvalArgs);
          if (suggestion && !isTemplateBuilder) {
            try {
              const suggestionEditorContext = resolveSuggestionEditorContext(call.toolName, editorContext);
              const suggestionTargetId = suggestionEditorContext?.documentId;
              const riskLevel = await resolveSuggestionRiskLevel(
                ctx,
                projectIdValue,
                call.toolName,
                approvalArgs,
                registry
              );
              const { preview, reasons } = await buildProjectGraphApprovalPreview(
                ctx,
                projectIdValue,
                call.toolName,
                approvalArgs,
                registry
              );
              suggestionId = (await ctx.runMutation(
                (internal as any).knowledgeSuggestions.upsertFromToolApprovalRequest,
                {
                  projectId: projectIdValue,
                  toolCallId: call.toolCallId,
                  toolName: call.toolName,
                  approvalType: resolveApprovalType(call.toolName),
                  danger: resolveApprovalDanger(call.toolName, approvalArgs),
                  riskLevel,
                  approvalReasons: reasons.length > 0 ? reasons : undefined,
                  preview: preview ?? undefined,
                  operation: suggestion.operation,
                  targetType: suggestion.targetType,
                  targetId: suggestionTargetId,
                  proposedPatch: call.input,
                  editorContext: suggestionEditorContext,
                  actorType: aiActor.actorType,
                  actorUserId: aiActor.actorUserId,
                  actorAgentId: aiActor.actorAgentId,
                  actorName: aiActor.actorName,
                  streamId,
                  threadId,
                  promptMessageId: currentPromptMessageId,
                  model: DEFAULT_MODEL,
                }
              )) as string;
            } catch (error) {
              console.warn("[agentRuntime] Failed to create knowledge suggestion:", error);
            }
          }
          await appendStreamChunk(ctx, streamId, {
            type: "tool-approval-request",
            content: "",
            approvalId: call.toolCallId,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            suggestionId,
            approvalType: resolveApprovalType(call.toolName),
            danger: resolveApprovalDanger(call.toolName, approvalArgs),
            args: call.input,
            promptMessageId: currentPromptMessageId,
          });

          if (!isTemplateBuilder) {
            await emitActivity(ctx, {
              projectId: projectIdValue,
              documentId: activityDocumentId,
              ...aiActor,
              action: "ai_tool_approval_requested",
              summary: `Approval requested for ${call.toolName}`,
              metadata: {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                streamId,
                threadId,
                promptMessageId: currentPromptMessageId,
                args: call.input,
              },
            });
          }
        }

        // Handle other tools (ask_question, write_content)
        for (const call of otherCalls) {
          const args = call.input as Record<string, unknown>;
          if (needsToolApproval(registry, call.toolName, args)) {
            let suggestionId: string | undefined;
            const suggestion = classifyKnowledgeSuggestion(call.toolName, args);
          if (suggestion && !isTemplateBuilder) {
            try {
              const suggestionEditorContext = resolveSuggestionEditorContext(call.toolName, editorContext);
              const suggestionTargetId = suggestionEditorContext?.documentId;
              const riskLevel = await resolveSuggestionRiskLevel(
                ctx,
                projectIdValue,
                call.toolName,
                args,
                registry
              );
              suggestionId = (await ctx.runMutation(
                (internal as any).knowledgeSuggestions.upsertFromToolApprovalRequest,
                {
                  projectId: projectIdValue,
                  toolCallId: call.toolCallId,
                  toolName: call.toolName,
                  approvalType: resolveApprovalType(call.toolName),
                  danger: resolveApprovalDanger(call.toolName, args),
                  riskLevel,
                  operation: suggestion.operation,
                  targetType: suggestion.targetType,
                  targetId: suggestionTargetId,
                  proposedPatch: call.input,
                  editorContext: suggestionEditorContext,
                  actorType: aiActor.actorType,
                  actorUserId: aiActor.actorUserId,
                  actorAgentId: aiActor.actorAgentId,
                  actorName: aiActor.actorName,
                    streamId,
                    threadId,
                    promptMessageId: currentPromptMessageId,
                    model: DEFAULT_MODEL,
                  }
                )) as string;
              } catch (error) {
                console.warn("[agentRuntime] Failed to create knowledge suggestion:", error);
              }
            }
            await appendStreamChunk(ctx, streamId, {
              type: "tool-approval-request",
              content: "",
              approvalId: call.toolCallId,
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              suggestionId,
              approvalType: resolveApprovalType(call.toolName),
              danger: resolveApprovalDanger(call.toolName, args),
              args: call.input,
              promptMessageId: currentPromptMessageId,
            });

            if (!isTemplateBuilder) {
              await emitActivity(ctx, {
                projectId: projectIdValue,
                documentId: activityDocumentId,
                ...aiActor,
                action: "ai_tool_approval_requested",
                summary: `Approval requested for ${call.toolName}`,
                metadata: {
                  toolName: call.toolName,
                  toolCallId: call.toolCallId,
                  streamId,
                  threadId,
                  promptMessageId: currentPromptMessageId,
                  args: call.input,
                },
              });
            }
          } else {
            await appendStreamChunk(ctx, streamId, {
              type: "tool",
              content: "",
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              args: call.input,
              promptMessageId: currentPromptMessageId,
            });

            if (!isTemplateBuilder) {
              await emitActivity(ctx, {
                projectId: projectIdValue,
                documentId: activityDocumentId,
                ...aiActor,
                action: "ai_tool_executed",
                summary: `Executed ${call.toolName}`,
                metadata: {
                  toolName: call.toolName,
                  toolCallId: call.toolCallId,
                  streamId,
                  threadId,
                  promptMessageId: currentPromptMessageId,
                  args: call.input,
                },
              });
            }
          }
        }

        // Stop if there are pending approvals
        const pendingCalls = [...pendingProjectGraphCalls, ...otherCalls];
        const autoExecutedCalls = [...autoCalls, ...autoProjectGraphCalls];
        if (pendingCalls.length > 0 || autoExecutedCalls.length === 0) {
          break;
        }

        currentResult = await sagaAgent.streamText(
          ctx,
          { threadId: threadId! },
          { promptMessageId: currentPromptMessageId, system: systemPrompt } as any
        );

        for await (const delta of currentResult.textStream) {
          if (delta) {
            await appendStreamChunk(ctx, streamId, { type: "delta", content: delta });
          }
          lastAiPresenceAt = await maybeKeepAiTypingAlive({
            ctx,
            projectId,
            presenceDocumentId,
            isTemplateBuilder,
            lastAiPresenceAt,
          });
        }

        toolCalls = await currentResult.toolCalls;
      }

      // Track stream completed
      await ServerAgentEvents.streamCompleted(userId, Date.now() - startTime);

      await ctx.runMutation((internal as any)["ai/streams"].complete, { streamId });
    } catch (error) {
      console.error("[agentRuntime.runSagaAgentChatToStream] Error:", error);

      // Track stream failed
      await ServerAgentEvents.streamFailed(userId, error instanceof Error ? error.message : "Unknown error");

      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      await clearAiPresence();
    }
  },
});

export const applyToolResultAndResumeToStream = internalAction({
  args: {
    streamId: v.string(),
    projectId: v.string(),
    userId: v.string(),
    threadId: v.string(),
    promptMessageId: v.string(),
    toolCallId: v.string(),
    toolName: v.string(),
    result: v.any(),
    editorContext: v.optional(v.any()),
    byokKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      streamId,
      projectId,
      userId,
      threadId,
      promptMessageId,
      toolCallId,
      toolName,
      result,
      editorContext,
      byokKey,
    } = args;
    const isTemplateBuilder = projectId === "template-builder";
    const projectIdValue = projectId as Id<"projects">;
    const aiActor: ToolActorContext = {
      actorType: "ai",
      actorUserId: userId,
      actorAgentId: "muse",
      actorName: "Muse",
    };
    const testMode = TEST_MODE;
    const isByok = isByokRequest(byokKey);

    // Resolve API key (BYOK or platform)
    if (!testMode) {
      try {
        resolveOpenRouterKey(byokKey);
      } catch {
        await ctx.runMutation((internal as any)["ai/streams"].fail, {
          streamId,
          error: "OPENROUTER_API_KEY not configured",
        });
        return;
      }
    }

    let presenceDocumentId: string | undefined;
    let activityDocumentId: Id<"documents"> | undefined;
    let lastAiPresenceAt = 0;

    const clearAiPresence = async (): Promise<void> => {
      if (isTemplateBuilder || !presenceDocumentId) return;
      try {
        await setAiPresence(ctx, projectId, presenceDocumentId, false);
      } catch (error) {
        console.warn("[agentRuntime] Failed to clear AI presence:", error);
      }
    };

    try {
      const registry = isTemplateBuilder
        ? null
        : ((await ctx.runQuery((internal as any).projectTypeRegistry.getResolvedInternal, {
            projectId: projectIdValue,
          })) as ProjectTypeRegistryResolved);

      if (E2E_TEST_MODE) {
        const script = await ctx.runQuery((internal as any)["e2e"].getSagaScript, {
          projectId: projectIdValue,
          userId,
          scenario: "default",
        });
        if (!script) {
          throw new Error("Missing E2E saga script for tool resume");
        }
        setSagaTestScript(script.steps as SagaTestStreamStep[]);
      }

      // Get user's preferred model (for BYOK users)
      const preferredModel = isByok
        ? await ctx.runQuery((internal as any).billingSettings.getPreferredModel, { userId })
        : undefined;

      const sagaAgent = createSagaAgent(isByok ? byokKey : undefined, preferredModel);
      if (isTemplateBuilder) {
        await ctx.runQuery((internal as any).templateBuilderSessions.assertThreadOwner, {
          threadId,
          userId,
        });
      } else {
        const threadAccess = await ctx.runQuery((internal as any)["ai/threads"].assertThreadAccess, {
          threadId,
          projectId: projectIdValue,
          userId,
        });
        presenceDocumentId =
          resolveEditorDocumentId(editorContext) ??
          (threadAccess.documentId ? String(threadAccess.documentId) : undefined);
        activityDocumentId = threadAccess.documentId ??
          (resolveEditorDocumentId(editorContext) as Id<"documents"> | undefined);

        if (presenceDocumentId) {
          const now = Date.now();
          try {
            await setAiPresence(ctx, projectId, presenceDocumentId, true);
          } catch (error) {
            console.warn("[agentRuntime] Failed to set AI presence:", error);
          }
          lastAiPresenceAt = now;
        }
      }

      await sagaAgent.saveMessage(ctx, {
        threadId,
        userId,
        message: {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId,
              toolName,
              result,
            },
          ],
        },
        metadata: {
          providerMetadata: { saga: { projectId } },
        },
      });

      if (!isTemplateBuilder) {
        await emitActivity(ctx, {
          projectId: projectIdValue,
          documentId: activityDocumentId,
          ...aiActor,
          action: "ai_tool_executed",
          summary: `Executed ${toolName}`,
          metadata: {
            toolName,
            toolCallId,
            streamId,
            threadId,
            promptMessageId,
          },
        });
      }

      if (!isTemplateBuilder) {
        try {
          await ctx.runMutation((internal as any).knowledgeSuggestions.resolveFromToolResult, {
            toolCallId,
            toolName,
            resolvedByUserId: userId,
            result,
          });
        } catch (error) {
          console.warn("[agentRuntime] Failed to resolve knowledge suggestion:", error);
        }
      }

      const systemPrompt = buildSystemPrompt({
        mode: "editing",
        ragContext: buildEmptyContext(),
        editorContext,
      });

      const resumeResult = await sagaAgent.streamText(
        ctx,
        { threadId },
        {
          promptMessageId,
          system: systemPrompt,
        } as any
      );

      for await (const delta of resumeResult.textStream) {
        if (delta) {
          await appendStreamChunk(ctx, streamId, {
            type: "delta",
            content: delta,
          });
        }
        lastAiPresenceAt = await maybeKeepAiTypingAlive({
          ctx,
          projectId,
          presenceDocumentId,
          isTemplateBuilder,
          lastAiPresenceAt,
        });
      }

      const toolCalls = await resumeResult.toolCalls;
      for (const call of toolCalls) {
        const callArgs = call.input as Record<string, unknown>;
        const requiresApproval = needsToolApproval(registry, call.toolName, callArgs);

        if (requiresApproval) {
          let suggestionId: string | undefined;
          const suggestion = classifyKnowledgeSuggestion(call.toolName, callArgs);
          if (suggestion && !isTemplateBuilder) {
            try {
              const suggestionEditorContext = resolveSuggestionEditorContext(call.toolName, editorContext);
              const suggestionTargetId = suggestionEditorContext?.documentId;
              const riskLevel = await resolveSuggestionRiskLevel(
                ctx,
                projectIdValue,
                call.toolName,
                callArgs,
                registry
              );
              suggestionId = (await ctx.runMutation(
                (internal as any).knowledgeSuggestions.upsertFromToolApprovalRequest,
                {
                  projectId: projectIdValue,
                  toolCallId: call.toolCallId,
                  toolName: call.toolName,
                  approvalType: resolveApprovalType(call.toolName),
                  danger: resolveApprovalDanger(call.toolName, callArgs),
                  riskLevel,
                  operation: suggestion.operation,
                  targetType: suggestion.targetType,
                  targetId: suggestionTargetId,
                  proposedPatch: call.input,
                  editorContext: suggestionEditorContext,
                  actorType: aiActor.actorType,
                  actorUserId: aiActor.actorUserId,
                  actorAgentId: aiActor.actorAgentId,
                  actorName: aiActor.actorName,
                  streamId,
                  threadId,
                  promptMessageId,
                  model: DEFAULT_MODEL,
                }
              )) as string;
            } catch (error) {
              console.warn("[agentRuntime] Failed to create knowledge suggestion:", error);
            }
          }
          await appendStreamChunk(ctx, streamId, {
            type: "tool-approval-request",
            content: "",
            approvalId: call.toolCallId,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            suggestionId,
            approvalType: resolveApprovalType(call.toolName),
            danger: resolveApprovalDanger(call.toolName, callArgs),
            args: call.input,
            promptMessageId,
          });

          if (!isTemplateBuilder) {
            await emitActivity(ctx, {
              projectId: projectIdValue,
              documentId: activityDocumentId,
              ...aiActor,
              action: "ai_tool_approval_requested",
              summary: `Approval requested for ${call.toolName}`,
              metadata: {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                streamId,
                threadId,
                promptMessageId,
                args: call.input,
              },
            });
          }
        } else {
          await appendStreamChunk(ctx, streamId, {
            type: "tool",
            content: "",
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.input,
            promptMessageId,
          });

          if (!isTemplateBuilder) {
            await emitActivity(ctx, {
              projectId: projectIdValue,
              documentId: activityDocumentId,
              ...aiActor,
              action: "ai_tool_executed",
              summary: `Executed ${call.toolName}`,
              metadata: {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                streamId,
                threadId,
                promptMessageId,
                args: call.input,
              },
            });
          }
        }
      }

      await ctx.runMutation((internal as any)["ai/streams"].complete, { streamId });
    } catch (error) {
      console.error("[agentRuntime.applyToolResultAndResumeToStream] Error:", error);

      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      await clearAiPresence();
    }
  },
});
