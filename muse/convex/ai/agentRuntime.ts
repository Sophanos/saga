/**
 * Saga Agent Runtime
 *
 * Bridges the Convex Agent component with the Saga SSE stream model.
 */

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { internal, components } from "../_generated/api";
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
import {
  searchContextTool,
  readDocumentTool,
  searchChaptersTool,
  searchWorldTool,
  getEntityTool,
} from "./tools/ragTools";
import {
  createEntityTool,
  updateEntityTool,
  createRelationshipTool,
  updateRelationshipTool,
  createNodeTool,
  updateNodeTool,
  createEdgeTool,
  updateEdgeTool,
} from "./tools/projectGraphTools";
import { generateTemplateTool } from "./tools/templateTools";
import { projectManageTool } from "./tools/projectManageTools";
import { webSearchTool, webExtractTool } from "./tools/webSearchTools";
import { getEmbeddingModelForTask } from "../lib/embeddings";
import { ServerAgentEvents } from "../lib/analytics";
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

  await Promise.all(
    roomIds.map((roomId) =>
      ctx.runMutation((internal as any)["presence"].setAiPresence, {
        roomId,
        documentId,
        isTyping,
      })
    )
  );
}

const AI_KEEPALIVE_INTERVAL_MS = 8_000;

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

const openrouter = createOpenAI({
  apiKey: process.env["OPENROUTER_API_KEY"],
  baseURL: OPENROUTER_BASE_URL,
  headers: {
    "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
    "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
  },
});

export type SagaTestStreamChunk = LanguageModelV3StreamPart;

export interface SagaTestStreamStep {
  chunks: SagaTestStreamChunk[];
}

let sagaTestScript: SagaTestStreamStep[] = [];
let _agent: Agent | null = null;

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

function createSagaAgent() {
  const testMode = TEST_MODE;
  const languageModel = testMode ? createTestLanguageModel() : openrouter.chat(DEFAULT_MODEL);

  return new Agent(components.agent, {
    name: "Saga",
    languageModel,

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
      search_chapters: searchChaptersTool,
      search_world: searchWorldTool,
      get_entity: getEntityTool,
      project_manage: projectManageTool,
      generate_template: generateTemplateTool,
      create_entity: createEntityTool,
      update_entity: updateEntityTool,
      create_relationship: createRelationshipTool,
      update_relationship: updateRelationshipTool,
      create_node: createNodeTool,
      update_node: updateNodeTool,
      create_edge: createEdgeTool,
      update_edge: updateEdgeTool,
      web_search: webSearchTool,
      web_extract: webExtractTool,
    },
    maxSteps: 8,
  });
}

function getSagaAgent(): Agent {
  if (!_agent) {
    _agent = createSagaAgent();
  }
  return _agent;
}

export function setSagaTestScript(steps: SagaTestStreamStep[]) {
  sagaTestScript = [...steps];
  _agent = null;
}

const autoExecuteTools = new Set([
  "search_context",
  "read_document",
  "search_chapters",
  "search_world",
  "get_entity",
  "web_search",
  "web_extract",
]);
const projectGraphTools = new Set([
  "create_entity",
  "update_entity",
  "create_relationship",
  "update_relationship",
  "create_node",
  "update_node",
  "create_edge",
  "update_edge",
]);

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

function classifyKnowledgeSuggestion(toolName: string): { targetType: KnowledgeSuggestionTargetType; operation: string } | null {
  switch (toolName) {
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
  const matches = (await ctx.runQuery(
    // @ts-expect-error Deep types
    internal["ai/tools/projectGraphHandlers"].findEntityByCanonical,
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

  const addRiskReason = (level?: RiskLevel): void => {
    if (level === "core") {
      reasons.add("risk_core");
    } else if (level === "high") {
      reasons.add("risk_high");
    }
  };

  if (toolName === "create_entity" || toolName === "create_node") {
    const type = typeof args["type"] === "string" ? (args["type"] as string) : resolvedType;
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

  if (toolName === "update_entity" || toolName === "update_node") {
    const type =
      resolvedType ??
      (typeof args["entityType"] === "string" ? (args["entityType"] as string) : undefined) ??
      (typeof args["nodeType"] === "string" ? (args["nodeType"] as string) : undefined);
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
    const updates = (args["updates"] as Record<string, unknown> | undefined) ?? {};
    const identityFields = getIdentityFields(def);
    if (identityFields.length > 0 && hasIdentityChange(updates, identityFields)) {
      reasons.add("identity_change");
    }
    return Array.from(reasons);
  }

  if (toolName === "create_relationship" || toolName === "create_edge") {
    const type = typeof args["type"] === "string" ? (args["type"] as string) : resolvedType;
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

  if (toolName === "update_relationship" || toolName === "update_edge") {
    const type = typeof args["type"] === "string" ? (args["type"] as string) : resolvedType;
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

    const updates = (args["updates"] as Record<string, unknown> | undefined) ?? {};
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

  if (toolName === "create_entity" || toolName === "create_node") {
    const type = typeof args["type"] === "string" ? (args["type"] as string) : "unknown";
    const name = typeof args["name"] === "string" ? (args["name"] as string) : "";
    const aliases = Array.isArray(args["aliases"]) ? (args["aliases"] as string[]) : undefined;
    const notes = typeof args["notes"] === "string" ? (args["notes"] as string) : undefined;
    const properties = buildEntityPropertiesFromArgs(args);
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

  if (toolName === "update_entity" || toolName === "update_node") {
    const nameKey = toolName === "update_entity" ? "entityName" : "nodeName";
    const typeKey = toolName === "update_entity" ? "entityType" : "nodeType";
    const name = typeof args[nameKey] === "string" ? (args[nameKey] as string) : undefined;
    const typeHint = typeof args[typeKey] === "string" ? (args[typeKey] as string) : undefined;
    const updates = (args["updates"] as Record<string, unknown> | undefined) ?? {};

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

  if (toolName === "create_relationship" || toolName === "create_edge") {
    const type = typeof args["type"] === "string" ? (args["type"] as string) : "unknown";
    const sourceName = typeof args["sourceName"] === "string" ? (args["sourceName"] as string) : undefined;
    const targetName = typeof args["targetName"] === "string" ? (args["targetName"] as string) : undefined;
    const bidirectional = typeof args["bidirectional"] === "boolean" ? (args["bidirectional"] as boolean) : undefined;
    const strength = typeof args["strength"] === "number" ? (args["strength"] as number) : undefined;
    const notes = typeof args["notes"] === "string" ? (args["notes"] as string) : undefined;
    const metadata =
      args["metadata"] && typeof args["metadata"] === "object" && !Array.isArray(args["metadata"])
        ? (args["metadata"] as Record<string, unknown>)
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

  if (toolName === "update_relationship" || toolName === "update_edge") {
    const type = typeof args["type"] === "string" ? (args["type"] as string) : "unknown";
    const sourceName = typeof args["sourceName"] === "string" ? (args["sourceName"] as string) : undefined;
    const targetName = typeof args["targetName"] === "string" ? (args["targetName"] as string) : undefined;
    const updates = (args["updates"] as Record<string, unknown> | undefined) ?? {};

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
    if (sourceEntity && targetEntity && type !== "unknown") {
      relationship = (await ctx.runQuery(
        // @ts-expect-error Deep types
        internal["ai/tools/projectGraphHandlers"].findRelationship,
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
  const matches = (await ctx.runQuery(
    // @ts-expect-error Deep types
    internal["ai/tools/projectGraphHandlers"].findEntityByCanonical,
    { projectId, name, type: typeHint }
  )) as Array<{ type: string }> | null;

  if (!matches || matches.length !== 1) return null;
  return matches[0]?.type ?? null;
}

async function needsProjectGraphToolApproval(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  toolName: string,
  args: Record<string, unknown>,
  registry: ProjectTypeRegistryResolved | null
): Promise<boolean> {
  if (!registry) return true;

  switch (toolName) {
    case "update_entity":
    case "update_node": {
      const updates = (args["updates"] as Record<string, unknown> | undefined) ?? {};
      let typeHint: string | undefined;
      if (typeof args["entityType"] === "string") {
        typeHint = args["entityType"] as string;
      } else if (typeof args["nodeType"] === "string") {
        typeHint = args["nodeType"] as string;
      }

      let name: string | undefined;
      if (typeof args["entityName"] === "string") {
        name = args["entityName"] as string;
      } else if (typeof args["nodeName"] === "string") {
        name = args["nodeName"] as string;
      }

      if (!name) return true;

      const resolvedType =
        typeHint ??
        (await resolveUniqueEntityTypeForUpdate(ctx, projectId, name, typeHint));
      if (!resolvedType) return true;

      const normalizedArgs =
        toolName === "update_entity"
          ? { ...args, entityType: resolvedType, updates }
          : { ...args, nodeType: resolvedType, updates };

      return needsToolApproval(registry, toolName, normalizedArgs);
    }

    default:
      return needsToolApproval(registry, toolName, args);
  }
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
  if (projectGraphTools.has(toolName)) return "destructive";
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

  if (!registry) return "high";

  switch (toolName) {
    case "create_entity":
    case "create_node": {
      const type = typeof args["type"] === "string" ? (args["type"] as string) : undefined;
      if (!type) return "high";
      const def = registry.entityTypes[type];
      if (!def) return "high";
      if (def.approval?.createRequiresApproval) return "high";
      return def.riskLevel;
    }
    case "update_entity":
    case "update_node": {
      const updates = (args["updates"] as Record<string, unknown> | undefined) ?? {};
      let typeHint: string | undefined;
      if (typeof args["entityType"] === "string") {
        typeHint = args["entityType"] as string;
      } else if (typeof args["nodeType"] === "string") {
        typeHint = args["nodeType"] as string;
      }

      let name: string | undefined;
      if (typeof args["entityName"] === "string") {
        name = args["entityName"] as string;
      } else if (typeof args["nodeName"] === "string") {
        name = args["nodeName"] as string;
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
      const type = typeof args["type"] === "string" ? (args["type"] as string) : undefined;
      if (!type) return "high";
      const def = registry.relationshipTypes[type];
      return def?.riskLevel ?? "high";
    }
    case "update_relationship":
    case "update_edge": {
      const type = typeof args["type"] === "string" ? (args["type"] as string) : undefined;
      if (!type) return "high";
      const def = registry.relationshipTypes[type];
      if (!def) return "high";
      if (def.riskLevel === "core") return "core";
      const updates = args["updates"] as Record<string, unknown> | undefined;
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
    case "search_chapters":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeSearchChapters, {
        projectId,
        query: args["query"] as string,
        type: args["type"] as string | undefined,
      });
    case "search_world":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeSearchWorld, {
        projectId,
        query: args["query"] as string,
        category: args["category"] as string | undefined,
      });
    case "get_entity":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeGetEntity, {
        projectId,
        entityId: args["entityId"] as string,
        includeRelationships: args["includeRelationships"] as boolean | undefined,
      });
    default:
      throw new Error(`Unknown RAG tool: ${toolName}`);
  }
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
    case "create_entity":
      return ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeCreateEntity, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    case "update_entity":
      return ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeUpdateEntity, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    case "create_relationship":
      return ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeCreateRelationship, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    case "update_relationship":
      return ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeUpdateRelationship, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    case "create_node":
      return ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeCreateNode, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    case "update_node":
      return ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeUpdateNode, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    case "create_edge":
      return ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeCreateEdge, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    case "update_edge":
      return ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeUpdateEdge, {
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
  },
  handler: async (ctx, args) => {
    const { streamId, projectId, userId, prompt, mode, editorContext, contextHints } = args;
    const isTemplateBuilder = projectId === "template-builder";
    const projectIdValue = projectId as Id<"projects">;
    const testMode = TEST_MODE;

    if (!testMode && !process.env["OPENROUTER_API_KEY"]) {
      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
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

      const sagaAgent = getSagaAgent();
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
            saga: { projectId, editorContext, contextHints },
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
        const ragCalls = toolCalls.filter((c) => autoExecuteTools.has(c.toolName));
        const projectGraphCalls = toolCalls.filter((c) => projectGraphTools.has(c.toolName));
        const otherCalls = toolCalls.filter(
          (c) => !autoExecuteTools.has(c.toolName) && !projectGraphTools.has(c.toolName)
        );

        // Execute RAG tools (always auto)
        for (const call of ragCalls) {
          const toolResult = await executeRagTool(ctx, call.toolName, call.input as Record<string, unknown>, projectId);

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
          const requiresApproval = await needsProjectGraphToolApproval(
            ctx,
            projectIdValue,
            call.toolName,
            args,
            registry
          );
          if (requiresApproval) {
            pendingProjectGraphCalls.push(call);
          } else {
            autoProjectGraphCalls.push(call);
          }
        }

        // Auto-execute low-impact project graph tools
        for (const call of autoProjectGraphCalls) {
          const toolResult = await executeProjectGraphTool(
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
          const suggestion = classifyKnowledgeSuggestion(call.toolName);
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
            const suggestion = classifyKnowledgeSuggestion(call.toolName);
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
        const autoExecutedCalls = [...ragCalls, ...autoProjectGraphCalls];
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

    if (!testMode && !process.env["OPENROUTER_API_KEY"]) {
      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
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

      const sagaAgent = getSagaAgent();
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
        const requiresApproval =
          projectGraphTools.has(call.toolName)
            ? await needsProjectGraphToolApproval(ctx, projectIdValue, call.toolName, callArgs, registry)
            : needsToolApproval(registry, call.toolName, callArgs);

        if (requiresApproval) {
          let suggestionId: string | undefined;
          const suggestion = classifyKnowledgeSuggestion(call.toolName);
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
