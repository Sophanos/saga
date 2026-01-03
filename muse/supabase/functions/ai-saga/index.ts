/**
 * AI Saga Edge Function
 *
 * Unified agent endpoint that handles:
 * - kind: "chat" - Streaming chat with tool proposals (SSE)
 * - kind: "execute_tool" - Non-streaming tool execution
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { streamText } from "../_shared/deps/ai.ts";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createSSEStream,
  getStreamingHeaders,
  type SSEStreamController,
} from "../_shared/streaming.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  ErrorCode,
} from "../_shared/errors.ts";
import {
  getProjectId,
  getPayloadTitle,
  getPayloadPreview,
  getPayloadType,
  getEntityType,
  getMemoryCategory,
  buildMemoryPayload,
} from "../_shared/vectorPayload.ts";
import { generateEmbeddings, isDeepInfraConfigured } from "../_shared/deepinfra.ts";
import { upsertPoints, isQdrantConfigured, QdrantError, type QdrantPoint } from "../_shared/qdrant.ts";
import { calculateExpiresAt } from "../_shared/memoryPolicy.ts";
import {
  retrieveMemoryContext,
  retrieveProfileContext,
  DEFAULT_SAGA_LIMITS,
  type RetrievedMemoryContext,
  type RetrievalLimits,
  type ProfileContext,
} from "../_shared/memory/retrieval.ts";
import {
  retrieveRAGContext,
  type RAGContext,
} from "../_shared/rag.ts";
import { buildSagaSystemPrompt } from "../_shared/prompts/mod.ts";
import { resolveMentionContext, type MentionRef, type ResolvedMentionContext } from "../_shared/mentions.ts";
import { agentTools } from "../_shared/tools/index.ts";
import { assertProjectAccess, ProjectAccessError } from "../_shared/projects.ts";
import type { UnifiedContextHints, ProjectPersonalizationContext } from "../_shared/contextHints.ts";
import {
  executeGenesisWorld,
  executeDetectEntities,
  executeCheckConsistency,
  executeGenerateTemplate,
  executeClarityCheck,
  executeCheckLogic,
  executeNameGenerator,
} from "../_shared/saga/executors.ts";
import {
  executeSearchImages,
  executeFindSimilarImages,
  resolveEntityPortraitAssetId,
} from "../_shared/images/executors.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  type BillingCheck,
} from "../_shared/billing.ts";
import type { SagaMode, EditorContext } from "../_shared/tools/types.ts";
import {
  type EntityType,
  type ConsistencyFocus,
} from "../_shared/tools/types.ts";

// =============================================================================
// Types
// =============================================================================

type MessageRole = "user" | "assistant" | "system";

interface Message {
  role: MessageRole;
  content: string;
}

// EditorContext and SagaMode imported from ../shared/tools/types.ts

interface SagaChatRequest {
  kind?: "chat";
  messages: Message[];
  projectId: string;
  mentions?: MentionRef[];
  editorContext?: EditorContext;
  contextHints?: UnifiedContextHints;
  mode?: SagaMode;
  stream?: boolean;
  conversationId?: string;
}

interface SagaExecuteToolRequest {
  kind: "execute_tool";
  toolName: string;
  input: unknown;
  projectId?: string;
}

/**
 * Request to respond to a tool approval (AI SDK 6 needsApproval flow)
 */
interface SagaToolApprovalRequest {
  kind: "tool-approval";
  projectId: string;
  /** The approval ID from the original tool-approval-request */
  approvalId?: string;
  /** Backwards-compatible alias for approvalId */
  toolCallId?: string;
  /** Whether the user approved or denied the tool */
  approved: boolean;
  /** Original messages to continue the conversation */
  messages: Message[];
  /** Optional mentions for context */
  mentions?: MentionRef[];
  /** Editor context for prompts */
  editorContext?: EditorContext;
  /** Optional client-side context hints */
  contextHints?: UnifiedContextHints;
  /** Current saga mode */
  mode?: SagaMode;
  /** Conversation ID for memory continuity */
  conversationId?: string;
}

type SagaRequest = SagaChatRequest | SagaExecuteToolRequest | SagaToolApprovalRequest;

// RAGContext type imported from ../shared/rag.ts

// =============================================================================
// Constants
// =============================================================================

const MAX_HISTORY_MESSAGES = 20;
const MAX_DECISION_LENGTH = 32000;
const MAX_DECISION_EMBEDDING_CHARS = 8000;

// RAG retrieval extracted to ../shared/rag.ts as retrieveRAGContext

// Memory retrieval extracted to ../_shared/memory/retrieval.ts

// =============================================================================
// Shared Context Preparation
// =============================================================================

interface SagaContextParams {
  messages: Message[];
  projectId: string;
  mentions?: MentionRef[];
  editorContext?: EditorContext;
  mode?: SagaMode;
  conversationId?: string;
  contextHints?: UnifiedContextHints;
  billing: BillingCheck;
  supabase: ReturnType<typeof createSupabaseClient>;
  logPrefix: string;
}

interface PreparedContext {
  ragContext: RAGContext;
  mentionContext: ResolvedMentionContext;
  systemPrompt: string;
  apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

async function fetchProjectMemoryControls(
  supabase: ReturnType<typeof createSupabaseClient>,
  projectId: string,
  logPrefix: string
): Promise<Record<string, unknown> | undefined> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("style_config")
      .eq("id", projectId)
      .single();

    if (error || !data) {
      if (error) {
        console.warn(`${logPrefix} Failed to load project memory controls: ${error.message}`);
      }
      return undefined;
    }

    const styleConfig = data.style_config as Record<string, unknown> | null;
    return styleConfig?.memoryControls as Record<string, unknown> | undefined;
  } catch (error) {
    console.warn(`${logPrefix} Failed to load project memory controls:`, error);
    return undefined;
  }
}

async function fetchProjectPersonalization(
  supabase: ReturnType<typeof createSupabaseClient>,
  projectId: string,
  logPrefix: string
): Promise<ProjectPersonalizationContext | undefined> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("genre, style_config")
      .eq("id", projectId)
      .single();

    if (error || !data) {
      if (error) {
        console.warn(`${logPrefix} Failed to load project personalization: ${error.message}`);
      }
      return undefined;
    }

    const styleConfig = data.style_config as Record<string, unknown> | null;
    return {
      genre: (data.genre as string | null) ?? undefined,
      styleMode: (styleConfig?.styleMode as string | undefined) ?? undefined,
      guardrails: styleConfig?.guardrails as ProjectPersonalizationContext["guardrails"] | undefined,
      smartMode: styleConfig?.smartMode as ProjectPersonalizationContext["smartMode"] | undefined,
    };
  } catch (error) {
    console.warn(`${logPrefix} Failed to load project personalization:`, error);
    return undefined;
  }
}

type MemoryCategoryKey = "decisions" | "style" | "preferences" | "session";

interface MemoryRetrievalConfig {
  limits: RetrievalLimits;
  recencyWeight?: number;
  maxAgeDays?: Partial<Record<MemoryCategoryKey, number>>;
}

function clamp01(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(1, Math.max(0, value));
}

function buildRetrievalConfigFromControls(
  memoryControls: Record<string, unknown> | undefined,
  defaults: RetrievalLimits = DEFAULT_SAGA_LIMITS
): MemoryRetrievalConfig {
  const limits: RetrievalLimits = { ...defaults };
  const categories = memoryControls?.categories as Record<string, unknown> | undefined;

  if ((categories?.decision as { enabled?: boolean } | undefined)?.enabled === false) {
    limits.decisions = 0;
  }
  if ((categories?.style as { enabled?: boolean } | undefined)?.enabled === false) {
    limits.style = 0;
  }
  if ((categories?.preference as { enabled?: boolean } | undefined)?.enabled === false) {
    limits.preferences = 0;
  }
  if ((categories?.session as { enabled?: boolean } | undefined)?.enabled === false) {
    limits.session = 0;
  }

  const budgets = memoryControls?.injectionBudgets as Record<string, unknown> | undefined;
  if (typeof budgets?.decisions === "number") {
    limits.decisions = Math.max(0, Math.floor(budgets.decisions));
  }
  if (typeof budgets?.style === "number") {
    limits.style = Math.max(0, Math.floor(budgets.style));
  }
  if (typeof budgets?.preferences === "number") {
    limits.preferences = Math.max(0, Math.floor(budgets.preferences));
  }
  if (typeof budgets?.session === "number") {
    limits.session = Math.max(0, Math.floor(budgets.session));
  }

  const maxAgeDays: Partial<Record<MemoryCategoryKey, number>> = {};
  const decisionAge = (categories?.decision as { maxAgeDays?: number } | undefined)?.maxAgeDays;
  const styleAge = (categories?.style as { maxAgeDays?: number } | undefined)?.maxAgeDays;
  const preferenceAge = (categories?.preference as { maxAgeDays?: number } | undefined)?.maxAgeDays;
  const sessionAge = (categories?.session as { maxAgeDays?: number } | undefined)?.maxAgeDays;

  if (typeof decisionAge === "number") maxAgeDays.decisions = decisionAge;
  if (typeof styleAge === "number") maxAgeDays.style = styleAge;
  if (typeof preferenceAge === "number") maxAgeDays.preferences = preferenceAge;
  if (typeof sessionAge === "number") maxAgeDays.session = sessionAge;

  return {
    limits,
    recencyWeight: clamp01(memoryControls?.recencyWeight),
    maxAgeDays: Object.keys(maxAgeDays).length > 0 ? maxAgeDays : undefined,
  };
}

/**
 * Prepare context for a Saga conversation.
 * Shared between handleChat and handleToolApproval.
 */
async function prepareSagaContext(params: SagaContextParams): Promise<PreparedContext> {
  const { messages, projectId, mentions, editorContext, mode, conversationId, contextHints, billing, supabase, logPrefix } = params;

  // Get last user message for RAG query
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUserMessage?.content ?? "";

  // Determine owner ID for memory isolation (userId or anonDeviceId)
  const ownerId = billing.userId ?? billing.anonDeviceId ?? null;
  const effectiveConversationId = conversationId ?? contextHints?.conversationId;
  const [memoryControls, projectPersonalization] = await Promise.all([
    fetchProjectMemoryControls(supabase, projectId, logPrefix),
    fetchProjectPersonalization(supabase, projectId, logPrefix),
  ]);
  const memoryConfig = buildRetrievalConfigFromControls(memoryControls);

  // Retrieve all contexts in parallel
  const [ragContext, memoryContext, profileContext, mentionContext] = await Promise.all([
    retrieveRAGContext(query, projectId, {
      logPrefix,
      excludeMemories: true,
    }),
    retrieveMemoryContext(
      query,
      projectId,
      ownerId,
      effectiveConversationId,
      memoryConfig.limits,
      logPrefix,
      supabase,
      {
        recencyWeight: memoryConfig.recencyWeight,
        maxAgeDays: memoryConfig.maxAgeDays,
      }
    ),
    retrieveProfileContext(supabase, billing.userId, logPrefix),
    resolveMentionContext({
      supabase,
      projectId,
      mentions,
      logPrefix,
    }),
  ]);

  // Build system prompt with all contexts
  const systemPrompt = buildSagaSystemPrompt({
    mode,
    ragContext,
    mentionContext,
    editorContext,
    profileContext,
    memoryContext,
    contextHints,
    projectContext: projectPersonalization,
  });

  // Build messages array with sliding window
  const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);
  const apiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...recentMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  ];

  return { ragContext, mentionContext, systemPrompt, apiMessages };
}

/**
 * Stream AI SDK response to SSE.
 * Shared between handleChat and handleToolApproval.
 */
async function streamToSSE(
  sse: SSEStreamController,
  result: Awaited<ReturnType<typeof streamText>>
): Promise<void> {
  const fullStream = result.fullStream;

  for await (const part of fullStream) {
    switch (part.type) {
      case "text-delta":
        sse.sendDelta(part.text);
        break;

      case "tool-call":
        sse.sendTool(part.toolCallId, part.toolName, part.input);
        break;

      case "tool-approval-request":
        {
          const approvalId =
            "approvalId" in part && typeof part.approvalId === "string"
              ? part.approvalId
              : part.toolCallId;
          const toolCall =
            "toolCall" in part && part.toolCall
              ? part.toolCall
              : {
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  input: part.input,
                };
          if (approvalId) {
            sse.sendToolApprovalRequest(
              approvalId,
              toolCall.toolName,
              toolCall.input,
              toolCall.toolCallId
            );
          } else {
            console.warn("[ai-saga] tool-approval-request missing approvalId");
          }
        }
        break;

      case "finish":
        break;

      case "error":
        sse.sendError(part.error);
        break;
    }
  }

  sse.complete();
}

// =============================================================================
// Chat Handler (Streaming)
// =============================================================================

async function handleChat(
  req: SagaChatRequest,
  apiKey: string,
  origin: string | null,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<Response> {
  const { messages, projectId, mentions, editorContext, mode, conversationId, contextHints } = req;

  // Prepare context using shared helper
  const { ragContext, apiMessages } = await prepareSagaContext({
    messages,
    projectId,
    mentions,
    editorContext,
    contextHints,
    mode,
    conversationId,
    billing,
    supabase,
    logPrefix: "[ai-saga]",
  });

  // Get model
  const model = getOpenRouterModel(apiKey, "creative");

  // Stream response with all tools
  const result = await streamText({
    model,
    messages: apiMessages,
    tools: agentTools,
    maxSteps: 5,
  });

  // Create SSE stream using shared utility
  const stream = createSSEStream(async (sse: SSEStreamController) => {
    // Send context metadata first
    sse.sendContext(ragContext);
    // Stream using shared helper
    await streamToSSE(sse, result);
  });

  return new Response(stream, {
    headers: getStreamingHeaders(origin),
  });
}

// =============================================================================
// Execute Tool Handler (Non-Streaming)
// =============================================================================

async function handleExecuteTool(
  req: SagaExecuteToolRequest,
  apiKey: string,
  origin: string | null,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<Response> {
  const { toolName, input } = req;

  console.log(`[ai-saga] Executing tool: ${toolName}`);

  try {
    let result: unknown;

    switch (toolName) {
      case "genesis_world": {
        const typedInput = input as {
          prompt: string;
          genre?: string;
          entityCount?: number;
          detailLevel?: "minimal" | "standard" | "detailed";
          includeOutline?: boolean;
        };
        result = await executeGenesisWorld(typedInput, apiKey);
        break;
      }

      case "detect_entities": {
        const typedInput = input as {
          text: string;
          minConfidence?: number;
          maxEntities?: number;
          entityTypes?: EntityType[];
        };
        if (!typedInput.text) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Text is required for entity detection",
            origin
          );
        }
        result = await executeDetectEntities(typedInput, apiKey);
        break;
      }

      case "check_consistency": {
        const typedInput = input as {
          text: string;
          focus?: ConsistencyFocus[];
          entities?: Array<{
            id: string;
            name: string;
            type: EntityType;
            properties?: Record<string, unknown>;
          }>;
        };
        if (!typedInput.text) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Text is required for consistency check",
            origin
          );
        }
        result = await executeCheckConsistency(typedInput, apiKey);
        break;
      }

      case "generate_template": {
        const typedInput = input as {
          storyDescription: string;
          genreHints?: string[];
          complexity?: "simple" | "standard" | "complex";
          baseTemplateId?: string;
        };
        if (!typedInput.storyDescription) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Story description is required for template generation",
            origin
          );
        }
        result = await executeGenerateTemplate(typedInput, apiKey);
        break;
      }

      case "clarity_check": {
        const typedInput = input as {
          text: string;
          maxIssues?: number;
        };
        if (!typedInput.text) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Text is required for clarity check",
            origin
          );
        }
        result = await executeClarityCheck(typedInput, apiKey);
        break;
      }

      case "check_logic": {
        const typedInput = input as {
          text: string;
          focus?: string[];
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
          preferences?: Record<string, unknown>;
        };
        if (!typedInput.text) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Text is required for logic check",
            origin
          );
        }
        result = await executeCheckLogic(typedInput, apiKey);
        break;
      }

      case "name_generator": {
        const typedInput = input as {
          entityType: string;
          genre?: string;
          culture?: string;
          count?: number;
          seed?: string;
          avoid?: string[];
          tone?: string;
          style?: string;
          preferences?: Record<string, unknown>;
        };
        if (!typedInput.entityType) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Entity type is required for name generation",
            origin
          );
        }
        result = await executeNameGenerator(typedInput, apiKey);
        break;
      }

      case "commit_decision": {
        const typedInput = input as {
          decision: string;
          rationale?: string;
          entityIds?: string[];
          documentId?: string;
          confidence?: number;
          pinned?: boolean;
        };
        const projectId = req.projectId;
        if (!projectId) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "projectId is required for commit_decision",
            origin
          );
        }
        if (!typedInput.decision || typeof typedInput.decision !== "string") {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "decision is required for commit_decision",
            origin
          );
        }
        const decision = typedInput.decision.trim();
        if (!decision) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "decision cannot be empty",
            origin
          );
        }
        if (decision.length > MAX_DECISION_LENGTH) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            `decision exceeds maximum length of ${MAX_DECISION_LENGTH} characters`,
            origin
          );
        }
        if (!isDeepInfraConfigured()) {
          return createErrorResponse(
            ErrorCode.INTERNAL_ERROR,
            "Embedding service not configured",
            origin
          );
        }

        try {
          await assertProjectAccess(supabase, projectId, billing.userId);
        } catch (error) {
          if (error instanceof ProjectAccessError) {
            return createErrorResponse(ErrorCode.FORBIDDEN, error.message, origin);
          }
          throw error;
        }

        const rationale = typedInput.rationale?.trim();
        const content = rationale
          ? `Decision: ${decision}\nRationale: ${rationale}`
          : decision;

        if (content.length > MAX_DECISION_LENGTH) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            `decision content exceeds maximum length of ${MAX_DECISION_LENGTH} characters`,
            origin
          );
        }

        const embeddingText = content.length > MAX_DECISION_EMBEDDING_CHARS
          ? content.slice(0, MAX_DECISION_EMBEDDING_CHARS)
          : content;

        if (embeddingText.length < content.length) {
          console.log(
            `[ai-saga] commit_decision truncated embedding input from ${content.length} to ${embeddingText.length} chars`
          );
        }

        const embeddingResult = await generateEmbeddings([embeddingText]);
        const memoryId = crypto.randomUUID();
        const expiresAt = calculateExpiresAt("decision");

        const payload = buildMemoryPayload({
          projectId,
          memoryId,
          category: "decision",
          scope: "project",
          text: content,
          source: "user",
          confidence: typedInput.confidence,
          entityIds: typedInput.entityIds,
          documentId: typedInput.documentId,
          toolName: "commit_decision",
          expiresAt,
          pinned: typedInput.pinned ?? true,
        });

        const { error } = await supabase.from("memories").upsert(
          {
            id: memoryId,
            project_id: payload.project_id,
            category: payload.category,
            scope: payload.scope,
            owner_id: payload.owner_id ?? null,
            conversation_id: payload.conversation_id ?? null,
            content: payload.text,
            metadata: {
              source: payload.source,
              confidence: payload.confidence,
              entity_ids: payload.entity_ids,
              document_id: payload.document_id,
              tool_call_id: payload.tool_call_id,
              tool_name: payload.tool_name,
              pinned: payload.pinned,
            },
            created_at: payload.created_at,
            updated_at: payload.updated_at,
            created_at_ts: payload.created_at_ts,
            expires_at: payload.expires_at ?? null,
            expires_at_ts: payload.expires_at
              ? new Date(payload.expires_at).getTime()
              : null,
            embedding: embeddingResult.embeddings[0],
            qdrant_sync_status: "pending",
          },
          { onConflict: "id" }
        );

        if (error) {
          console.error("[ai-saga] commit_decision Postgres upsert failed:", error);
          throw new Error(`Database error: ${error.message}`);
        }

        let qdrantResult: { success: boolean; error?: string } = {
          success: false,
          error: "Qdrant not configured",
        };

        if (isQdrantConfigured()) {
          try {
            const points: QdrantPoint[] = [
              {
                id: memoryId,
                vector: embeddingResult.embeddings[0],
                payload: payload as unknown as Record<string, unknown>,
              },
            ];
            await upsertPoints(points);
            qdrantResult = { success: true };
          } catch (qdrantError) {
            const errorMessage =
              qdrantError instanceof QdrantError
                ? qdrantError.message
                : qdrantError instanceof Error
                ? qdrantError.message
                : "Unknown Qdrant error";
            qdrantResult = { success: false, error: errorMessage };
            console.warn("[ai-saga] commit_decision Qdrant upsert failed:", errorMessage);
          }
        }

        const updates: Record<string, unknown> = {
          qdrant_sync_status: qdrantResult.success ? "synced" : "error",
        };
        if (qdrantResult.success) {
          updates.qdrant_synced_at = new Date().toISOString();
        } else if (qdrantResult.error) {
          updates.qdrant_last_error = qdrantResult.error;
        }

        await supabase.from("memories").update(updates).eq("id", memoryId);

        result = {
          memoryId,
          content,
        };
        break;
      }

      case "search_images": {
        const typedInput = input as {
          projectId?: string;
          query: string;
          limit?: number;
          assetType?: string;
          entityName?: string;
          entityType?: string;
          style?: string;
        };
        const projectId = typedInput.projectId ?? req.projectId;
        if (!projectId) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "projectId is required for image search",
            origin
          );
        }
        if (!typedInput.query) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "query is required for image search",
            origin
          );
        }
        // Resolve entityName to entityId if provided
        let entityId: string | undefined;
        if (typedInput.entityName) {
          // For search, we use the entity filter, not asset ID
          // So we just need to get the entity ID
          const { data: entity } = await supabase
            .from("entities")
            .select("id")
            .eq("project_id", projectId)
            .ilike("name", typedInput.entityName)
            .limit(1)
            .single();
          entityId = entity?.id;
        }
        result = await executeSearchImages(
          {
            projectId,
            query: typedInput.query,
            limit: typedInput.limit,
            assetType: typedInput.assetType as import("../_shared/tools/types.ts").AssetType | undefined,
            entityId,
            entityType: typedInput.entityType as EntityType | undefined,
            style: typedInput.style as import("../_shared/tools/types.ts").ImageStyle | undefined,
          },
          { supabase, billing }
        );
        break;
      }

      case "find_similar_images": {
        const typedInput = input as {
          projectId?: string;
          assetId?: string;
          entityName?: string;
          entityType?: string;
          limit?: number;
          assetType?: string;
        };
        const projectId = typedInput.projectId ?? req.projectId;
        if (!projectId) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "projectId is required for similar image search",
            origin
          );
        }
        // Resolve assetId from entityName if not provided directly
        let assetId = typedInput.assetId;
        if (!assetId && typedInput.entityName) {
          const resolved = await resolveEntityPortraitAssetId(
            supabase,
            projectId,
            typedInput.entityName,
            typedInput.entityType as EntityType | undefined
          );
          if (!resolved) {
            return createErrorResponse(
              ErrorCode.NOT_FOUND,
              `Entity "${typedInput.entityName}" not found or has no portrait`,
              origin
            );
          }
          assetId = resolved;
        }
        if (!assetId) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Either assetId or entityName is required for similar image search",
            origin
          );
        }
        result = await executeFindSimilarImages(
          {
            projectId,
            assetId,
            limit: typedInput.limit,
            assetType: typedInput.assetType as import("../_shared/tools/types.ts").AssetType | undefined,
          },
          { supabase, billing }
        );
        break;
      }

      default:
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `Unknown tool: ${toolName}. Supported tools: genesis_world, detect_entities, check_consistency, generate_template, clarity_check, check_logic, name_generator, commit_decision, search_images, find_similar_images`,
          origin
        );
    }

    return createSuccessResponse({ toolName, result }, origin);
  } catch (error) {
    console.error(`[ai-saga] Tool execution error (${toolName}):`, error);
    return handleAIError(error, origin, { providerName: toolName });
  }
}

// =============================================================================
// Tool Approval Handler (AI SDK 6 needsApproval flow)
// =============================================================================

async function handleToolApproval(
  req: SagaToolApprovalRequest,
  apiKey: string,
  origin: string | null,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<Response> {
  const { projectId, approved, messages, mentions, editorContext, mode, conversationId, contextHints } = req;
  const approvalId = req.approvalId ?? req.toolCallId;

  console.log(
    `[ai-saga] Tool approval response: ${approvalId ?? "unknown"} = ${approved ? "approved" : "denied"}`
  );

  if (!approvalId) {
    return createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      "approvalId is required for tool-approval",
      origin
    );
  }

  // If denied, just return a success response - client handles UI state
  if (!approved) {
    return createSuccessResponse({
      approvalId,
      toolCallId: req.toolCallId,
      approved: false,
      message: "Tool execution was denied by user"
    }, origin);
  }

  // Prepare context using shared helper
  const { ragContext, apiMessages } = await prepareSagaContext({
    messages,
    projectId,
    mentions,
    editorContext,
    contextHints,
    mode,
    conversationId,
    billing,
    supabase,
    logPrefix: "[ai-saga-approval]",
  });

  // Get model
  const model = getOpenRouterModel(apiKey, "creative");

  // Continue with tool approval response added to messages
  // AI SDK 6: Add tool-approval-response to indicate user approved the tool
  const result = await streamText({
    model,
    messages: [
      ...apiMessages,
      // Add tool approval response to indicate the user approved
      {
        role: "tool" as const,
        content: [
          {
            type: "tool-approval-response" as const,
            approvalId,
            approved: true,
          },
        ],
      },
    ],
    tools: agentTools,
    maxSteps: 5,
  });

  // Stream the response
  const stream = createSSEStream(async (sse: SSEStreamController) => {
    sse.sendContext(ragContext);
    await streamToSSE(sse, result);
  });

  return new Response(stream, {
    headers: getStreamingHeaders(origin),
  });
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only allow POST
  if (req.method !== "POST") {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, "Method not allowed", null);
  }

  const origin = req.headers.get("Origin");
  const supabase = createSupabaseClient();

  try {
    // Check billing (allow anonymous trial)
    const billing = await checkBillingAndGetKey(req, supabase, {
      endpoint: "agent",
      allowAnonymousTrial: true,
    });
    if (!billing.canProceed || !billing.apiKey) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        billing.error ?? "API key required",
        origin,
        billing.errorCode ? { code: billing.errorCode } : undefined
      );
    }

    // Parse request body
    const body = (await req.json()) as SagaRequest;

    // Route based on request kind
    if (body.kind === "execute_tool") {
      // Validate execute_tool request
      if (!body.toolName) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "toolName is required for execute_tool",
          origin
        );
      }
      return handleExecuteTool(body, billing.apiKey, origin, billing, supabase);
    } else if (body.kind === "tool-approval") {
    // AI SDK 6: Handle tool approval response
      if (!body.projectId || (!body.approvalId && !body.toolCallId) || body.approved === undefined) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "projectId, approvalId, and approved are required for tool-approval",
          origin
        );
      }
      return handleToolApproval(body, billing.apiKey, origin, billing, supabase);
    } else {
      // Default to chat
      if (!body.messages || !body.projectId) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "messages and projectId are required for chat",
          origin
        );
      }
      return handleChat(body as SagaChatRequest, billing.apiKey, origin, billing, supabase);
    }
  } catch (error) {
    console.error("[ai-saga] Handler error:", error);
    return handleAIError(error, origin, { providerName: "saga" });
  }
});
