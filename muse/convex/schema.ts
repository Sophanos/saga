import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Subscription status values
 */
export const subscriptionStatus = v.union(
  v.literal("active"),
  v.literal("trialing"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("expired"),
  v.literal("paused"),
  v.literal("grace_period")
);

/**
 * Subscription provider/store
 */
export const subscriptionStore = v.union(
  v.literal("APP_STORE"),
  v.literal("MAC_APP_STORE"),
  v.literal("PLAY_STORE"),
  v.literal("STRIPE"),
  v.literal("PROMOTIONAL")
);

/**
 * Saga Convex Schema
 *
 * Convex is the single source of truth for all application data.
 * User identity is provided by Better Auth (ctx.auth.getUserIdentity().subject).
 * Vector data is stored in Qdrant with eventual consistency via outbox patterns.
 */
export default defineSchema({
  // ============================================================
  // PROJECTS
  // ============================================================
  projects: defineTable({
    supabaseId: v.optional(v.string()), // Legacy migration field (deprecated)
    name: v.string(),
    description: v.optional(v.string()),
    templateId: v.optional(v.string()), // "writer" | "product" | "engineering" | "design" | "comms" | "custom"
    templateOverrides: v.optional(v.any()),
    metadata: v.optional(v.any()), // Project metadata (domain-specific)
    settings: v.optional(v.any()), // Runtime settings (AI, review, etc.)
    orgId: v.optional(v.id("organizations")),
    teamId: v.optional(v.id("teams")),
    genre: v.optional(v.string()), // Deprecated (writer template only)
    styleConfig: v.optional(v.any()), // Deprecated (writer template only)
    linterConfig: v.optional(v.any()), // Deprecated (writer template only)
    ownerId: v.string(), // Better Auth user ID
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_template", ["templateId"])
    .index("by_org", ["orgId"])
    .index("by_team", ["teamId"])
    .index("by_supabase_id", ["supabaseId"])
    .index("by_updated", ["updatedAt"]),

  // ============================================================
  // ORGANIZATIONS & TEAMS
  // ============================================================
  organizations: defineTable({
    name: v.string(),
    ownerId: v.string(), // Better Auth user ID
    slug: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"]),

  organizationMembers: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"]),

  teams: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),

  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.string(),
    role: v.union(v.literal("lead"), v.literal("member")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_team_user", ["teamId", "userId"]),

  // ============================================================
  // PROJECT TYPE REGISTRY (Project Graph schema + approval policy)
  // ============================================================
  projectTypeRegistry: defineTable({
    projectId: v.id("projects"),
    entityTypes: v.array(
      v.object({
        type: v.string(),
        displayName: v.string(),
        riskLevel: v.optional(
          v.union(v.literal("low"), v.literal("high"), v.literal("core"))
        ),
        schema: v.optional(v.any()),
        icon: v.optional(v.string()),
        color: v.optional(v.string()),
      })
    ),
    relationshipTypes: v.array(
      v.object({
        type: v.string(),
        displayName: v.string(),
        riskLevel: v.optional(
          v.union(v.literal("low"), v.literal("high"), v.literal("core"))
        ),
        schema: v.optional(v.any()),
      })
    ),
    locked: v.optional(v.boolean()),
    lockedAt: v.optional(v.number()),
    lockedByUserId: v.optional(v.string()),
    revision: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // ============================================================
  // DOCUMENTS (chapters, scenes, notes)
  // ============================================================
  documents: defineTable({
    projectId: v.id("projects"),
    supabaseId: v.optional(v.string()), // Legacy migration field (deprecated)
    parentId: v.optional(v.id("documents")), // Hierarchical structure
    type: v.string(), // Document kind (scene, chapter, note, outline, worldbuilding, spec, brief)
    kind: v.optional(v.string()), // Optional alias for type (future)
    title: v.optional(v.string()),
    content: v.optional(v.any()), // ProseMirror JSON
    contentText: v.optional(v.string()), // Plain text for search
    orderIndex: v.number(),
    wordCount: v.number(),
    metadata: v.optional(v.any()), // Document metadata (template-specific)
    // Deprecated writer-only metadata
    beat: v.optional(v.string()),
    tensionLevel: v.optional(v.number()),
    povCharacterId: v.optional(v.id("entities")),
    locationId: v.optional(v.id("entities")),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_parent", ["parentId"])
    .index("by_project_type", ["projectId", "type"])
    .index("by_project_order", ["projectId", "orderIndex"])
    .index("by_supabase_id", ["supabaseId"])
    .searchIndex("search_documents", {
      searchField: "contentText",
      filterFields: ["projectId", "type"],
    }),

  // ============================================================
  // DOCUMENT SUGGESTIONS (AI + collaborator review)
  // ============================================================
  documentSuggestions: defineTable({
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    suggestionId: v.string(),
    type: v.string(), // "insert" | "replace" | "delete"
    content: v.string(),
    originalContent: v.optional(v.string()),
    status: v.string(), // "proposed" | "accepted" | "rejected" | "resolved"
    anchorStart: v.optional(
      v.object({
        blockId: v.string(),
        offset: v.number(),
      })
    ),
    anchorEnd: v.optional(
      v.object({
        blockId: v.string(),
        offset: v.number(),
      })
    ),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    agentId: v.optional(v.string()),
    model: v.optional(v.string()),
    format: v.optional(v.string()),
    createdByUserId: v.optional(v.string()),
    resolvedByUserId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_document_status_createdAt", ["documentId", "status", "createdAt"])
    .index("by_document_createdAt", ["documentId", "createdAt"])
    .index("by_suggestion_id", ["suggestionId"])
    .index("by_project", ["projectId"]),

  // ============================================================
  // KNOWLEDGE SUGGESTIONS (Graph + memory proposals / review)
  // ============================================================
  knowledgeSuggestions: defineTable({
    projectId: v.id("projects"),
    targetType: v.union(
      v.literal("document"),
      v.literal("entity"),
      v.literal("relationship"),
      v.literal("memory")
    ),
    targetId: v.optional(v.string()),
    operation: v.string(),
    proposedPatch: v.any(),
    normalizedPatch: v.optional(v.any()),
    editorContext: v.optional(
      v.object({
        documentId: v.optional(v.string()),
        documentTitle: v.optional(v.string()),
        documentExcerpt: v.optional(v.string()),
        selectionText: v.optional(v.string()),
        selectionContext: v.optional(v.string()),
      })
    ),
    status: v.union(
      v.literal("proposed"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("resolved")
    ),
    resolution: v.optional(
      v.union(
        v.literal("executed"),
        v.literal("user_rejected"),
        v.literal("execution_failed"),
        v.literal("rolled_back"),
        v.literal("applied_in_editor")
      )
    ),
    preflight: v.optional(v.any()),
    rolledBackAt: v.optional(v.number()),
    rolledBackByUserId: v.optional(v.string()),
    // Provenance
    actorType: v.string(), // "user" | "ai" | "system"
    actorUserId: v.optional(v.string()),
    actorAgentId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    toolName: v.string(),
    toolCallId: v.string(),
    approvalType: v.string(),
    danger: v.optional(v.string()),
    riskLevel: v.optional(v.union(v.literal("low"), v.literal("high"), v.literal("core"))),
    approvalReasons: v.optional(v.array(v.string())),
    preview: v.optional(v.any()),
    streamId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    promptMessageId: v.optional(v.string()),
    model: v.optional(v.string()),
    // Resolution
    resolvedByUserId: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_createdAt", ["projectId", "createdAt"])
    .index("by_project_status_createdAt", ["projectId", "status", "createdAt"])
    .index("by_project_targetType_createdAt", ["projectId", "targetType", "createdAt"])
    .index("by_project_status_targetType_createdAt", ["projectId", "status", "targetType", "createdAt"])
    .index("by_tool_call_id", ["toolCallId"]),

  // ============================================================
  // KNOWLEDGE CITATIONS (Canon references for review)
  // ============================================================
  knowledgeCitations: defineTable({
    projectId: v.id("projects"),
    targetKind: v.union(
      v.literal("knowledgeSuggestion"),
      v.literal("documentSuggestion"),
      v.literal("linterIssue"),
      v.literal("coachIssue")
    ),
    targetId: v.string(),
    phase: v.union(v.literal("proposal"), v.literal("review"), v.literal("result")),
    memoryId: v.string(),
    memoryCategory: v.optional(v.union(v.literal("decision"), v.literal("policy"))),
    excerpt: v.optional(v.string()),
    reason: v.optional(v.string()),
    confidence: v.optional(v.number()),
    actorType: v.string(),
    actorUserId: v.optional(v.string()),
    actorAgentId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    visibility: v.union(v.literal("project"), v.literal("private"), v.literal("redacted")),
    redactionReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_target", ["projectId", "targetKind", "targetId"])
    .index("by_project_memory", ["projectId", "memoryId"])
    .index("by_project_createdAt", ["projectId", "createdAt"]),

  // ============================================================
  // DOCUMENT REVISIONS (version history)
  // ============================================================
  documentRevisions: defineTable({
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    snapshotJson: v.string(),
    contentHash: v.string(),
    prosemirrorVersion: v.optional(v.number()),
    reason: v.string(),
    actorType: v.string(), // "user" | "ai" | "system"
    actorUserId: v.optional(v.string()),
    actorAgentId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    toolName: v.optional(v.string()),
    summary: v.optional(v.string()),
    sourceSuggestionId: v.optional(v.string()),
    sourceStreamId: v.optional(v.string()),
    sourceRevisionId: v.optional(v.id("documentRevisions")),
    wordCount: v.optional(v.number()),
    deltaWordCount: v.optional(v.number()),
    createdAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_document_createdAt", ["documentId", "createdAt"])
    .index("by_document_actor_createdAt", ["documentId", "actorType", "createdAt"])
    .index("by_project", ["projectId"]),

  // ============================================================
  // ENTITIES (characters, locations, items, etc.)
  // ============================================================
  entities: defineTable({
    projectId: v.id("projects"),
    supabaseId: v.optional(v.string()), // Legacy migration field (deprecated)
    type: v.string(), // "character", "location", "item", "magic_system", "faction", "event", "concept"
    name: v.string(),
    canonicalName: v.string(),
    aliases: v.array(v.string()),
    properties: v.any(), // Type-specific properties (archetype, traits, status, etc.)
    notes: v.optional(v.string()),
    portraitUrl: v.optional(v.string()),
    // Visual customization
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    // Visibility
    visibleIn: v.optional(v.array(v.string())), // ["writer", "dm"]
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_type", ["projectId", "type"])
    .index("by_project_type_canonical", ["projectId", "type", "canonicalName"])
    .index("by_project_canonical", ["projectId", "canonicalName"])
    .index("by_project_name", ["projectId", "name"])
    .index("by_supabase_id", ["supabaseId"])
    .searchIndex("search_entities", {
      searchField: "name",
      filterFields: ["projectId", "type"],
    }),

  // ============================================================
  // RELATIONSHIPS (Project Graph edges)
  // ============================================================
  relationships: defineTable({
    projectId: v.id("projects"),
    supabaseId: v.optional(v.string()),
    sourceId: v.id("entities"),
    targetId: v.id("entities"),
    type: v.string(), // "knows", "loves", "hates", "parent_of", "allied_with", etc.
    bidirectional: v.boolean(),
    strength: v.optional(v.number()), // 1-10
    metadata: v.optional(v.any()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_source", ["sourceId"])
    .index("by_target", ["targetId"])
    .index("by_supabase_id", ["supabaseId"]),

  // ============================================================
  // MENTIONS (entity references in documents)
  // ============================================================
  mentions: defineTable({
    projectId: v.id("projects"),
    supabaseId: v.optional(v.string()),
    entityId: v.id("entities"),
    documentId: v.id("documents"),
    positionStart: v.number(), // Character position
    positionEnd: v.number(),
    context: v.string(), // Surrounding text
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_document", ["documentId"])
    .index("by_entity", ["entityId"])
    .index("by_project_document", ["projectId", "documentId"])
    .index("by_supabase_id", ["supabaseId"]),

  // ============================================================
  // CAPTURES (mobile capture items)
  // ============================================================
  captures: defineTable({
    projectId: v.id("projects"),
    supabaseId: v.optional(v.string()),
    createdBy: v.string(), // Supabase user ID
    kind: v.string(), // "text", "voice", "image", "link"
    status: v.string(), // "inbox", "pending", "processed", "archived"
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaMimeType: v.optional(v.string()),
    payload: v.optional(v.any()), // Additional data
    source: v.optional(v.string()), // "mobile", "web", "share_extension"
    processedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_creator", ["createdBy"])
    .index("by_supabase_id", ["supabaseId"]),

  // ============================================================
  // PRESENCE (real-time collaboration)
  // ============================================================
  presence: defineTable({
    projectId: v.id("projects"),
    userId: v.string(), // Supabase user ID
    userName: v.string(),
    userAvatarUrl: v.optional(v.string()),
    color: v.string(), // Cursor/selection color
    documentId: v.optional(v.id("documents")), // Currently viewing
    cursor: v.optional(
      v.object({
        from: v.number(),
        to: v.number(),
      })
    ),
    selection: v.optional(
      v.object({
        anchor: v.number(),
        head: v.number(),
      })
    ),
    lastSeen: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_document", ["projectId", "documentId"])
    .index("by_user", ["userId"]),

  // ============================================================
  // ACTIVITY LOG (audit trail)
  // ============================================================
  activityLog: defineTable({
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),
    suggestionId: v.optional(v.id("knowledgeSuggestions")),
    toolCallId: v.optional(v.string()),
    actorType: v.string(), // "user" | "ai" | "system"
    actorUserId: v.optional(v.string()),
    actorAgentId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    action: v.string(),
    summary: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_project_createdAt", ["projectId", "createdAt"])
    .index("by_document_createdAt", ["documentId", "createdAt"])
    .index("by_actor", ["projectId", "actorType", "createdAt"])
    .index("by_project_suggestion_createdAt", ["projectId", "suggestionId", "createdAt"])
    .index("by_project_toolCallId_createdAt", ["projectId", "toolCallId", "createdAt"]),

  // ============================================================
  // ANALYSIS RECORDS (writing analysis history)
  // ============================================================
  analysisRecords: defineTable({
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),
    sceneId: v.string(),
    metrics: v.any(),
    wordCount: v.optional(v.number()),
    analyzedAt: v.number(),
  })
    .index("by_project_analyzedAt", ["projectId", "analyzedAt"])
    .index("by_document_analyzedAt", ["documentId", "analyzedAt"])
    .index("by_scene_analyzedAt", ["sceneId", "analyzedAt"]),

  // ============================================================
  // CHAT SESSIONS (assistant chat history)
  // ============================================================
  chatSessions: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    threadId: v.string(),
    name: v.optional(v.string()),
    messageCount: v.number(),
    lastMessageAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_user", ["projectId", "userId"])
    .index("by_user", ["userId"])
    .index("by_thread", ["threadId"]),

  // ============================================================
  // CHAT MESSAGES
  // ============================================================
  chatMessages: defineTable({
    projectId: v.id("projects"),
    sessionId: v.id("chatSessions"),
    threadId: v.string(),
    userId: v.string(),
    messageId: v.optional(v.string()),
    role: v.string(),
    content: v.string(),
    mentions: v.optional(v.any()),
    tool: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_session_createdAt", ["sessionId", "createdAt"])
    .index("by_thread_createdAt", ["threadId", "createdAt"])
    .index("by_project", ["projectId"]),

  // ============================================================
  // AI THREAD MAPPINGS
  // ============================================================
  sagaThreads: defineTable({
    threadId: v.string(),
    projectId: v.id("projects"),
    scope: v.union(v.literal("project"), v.literal("document"), v.literal("private")),
    documentId: v.optional(v.id("documents")),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_project", ["projectId"])
    .index("by_project_scope", ["projectId", "scope"])
    .index("by_project_document", ["projectId", "documentId"])
    .index("by_project_creator", ["projectId", "createdBy"]),

  // ============================================================
  // AI GENERATION STREAMS (for polling-based streaming)
  // ============================================================
  generationStreams: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    type: v.string(), // "chat", "detect", "lint", "coach", "genesis", "saga", "saga-approval"
    status: v.string(), // "pending", "streaming", "done", "error"
    chunkCount: v.number(),
    // Legacy storage (deprecated); kept for compatibility with older streams.
    chunks: v.optional(
      v.array(
        v.object({
          index: v.number(),
          content: v.string(),
          type: v.string(), // "delta", "tool", "tool-approval-request", "context", "error"
          // Tool-related fields (optional)
          toolCallId: v.optional(v.string()),
          toolName: v.optional(v.string()),
          approvalId: v.optional(v.string()),
          suggestionId: v.optional(v.string()),
          approvalType: v.optional(v.string()),
          danger: v.optional(v.string()),
          args: v.optional(v.any()),
          data: v.optional(v.any()),
          promptMessageId: v.optional(v.string()),
        })
      )
    ),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_created", ["userId", "createdAt"]),

  generationStreamChunks: defineTable({
    streamId: v.id("generationStreams"),
    index: v.number(),
    type: v.string(),
    content: v.string(),
    toolCallId: v.optional(v.string()),
    toolName: v.optional(v.string()),
    approvalId: v.optional(v.string()),
    suggestionId: v.optional(v.string()),
    approvalType: v.optional(v.string()),
    danger: v.optional(v.string()),
    args: v.optional(v.any()),
    data: v.optional(v.any()),
    promptMessageId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_stream", ["streamId"])
    .index("by_stream_index", ["streamId", "index"]),

  // ============================================================
  // EMBEDDING OUTBOX
  // ============================================================
  embeddingJobs: defineTable({
    projectId: v.id("projects"),
    targetType: v.string(), // "document" | "entity"
    targetId: v.string(),
    status: v.string(), // "pending" | "processing" | "synced" | "failed"
    attempts: v.number(),
    lastError: v.optional(v.string()),
    chunksProcessed: v.optional(v.number()),
    desiredContentHash: v.optional(v.string()),
    processedContentHash: v.optional(v.string()),
    dirty: v.optional(v.boolean()),
    processingRunId: v.optional(v.string()),
    processingStartedAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    queuedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_status_queued", ["status", "queuedAt"])
    .index("by_status_nextRunAt", ["status", "nextRunAt"])
    .index("by_status_processingStartedAt", ["status", "processingStartedAt"])
    .index("by_project_target", ["projectId", "targetType", "targetId"])
    .index("by_target_status", ["targetType", "targetId", "status"]),

  // ============================================================
  // AI MEMORIES
  // ============================================================
  memories: defineTable({
    projectId: v.id("projects"),
    userId: v.optional(v.string()),
    text: v.string(),
    type: v.string(), // "decision" | "fact" | "preference" | "style"
    confidence: v.float64(),
    source: v.string(), // "user" | "agent" | "inferred"
    entityIds: v.optional(v.array(v.string())),
    documentId: v.optional(v.id("documents")),
    pinned: v.boolean(),
    scope: v.optional(v.union(v.literal("project"), v.literal("private"))),
    sourceSuggestionId: v.optional(v.id("knowledgeSuggestions")),
    sourceToolCallId: v.optional(v.string()),
    sourceStreamId: v.optional(v.string()),
    sourceThreadId: v.optional(v.string()),
    promptMessageId: v.optional(v.string()),
    model: v.optional(v.string()),
    expiresAt: v.optional(v.number()), // null = never (pro), 90 days (free)
    vectorId: v.optional(v.string()),
    vectorSyncedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_type", ["projectId", "type"])
    .index("by_pinned", ["projectId", "pinned"])
    .index("by_expiry", ["expiresAt"])
    .searchIndex("search_memories", {
      searchField: "text",
      filterFields: ["projectId", "type"],
    }),

  // ============================================================
  // SUBSCRIPTIONS (RevenueCat unified)
  // ============================================================
  subscriptions: defineTable({
    // User reference (Better Auth user ID)
    userId: v.string(),
    // RevenueCat customer ID
    revenuecatId: v.string(),
    // Current subscription status
    status: subscriptionStatus,
    // Store that processed the purchase
    store: subscriptionStore,
    // Product/plan identifier
    productId: v.string(),
    // Entitlement IDs granted
    entitlements: v.array(v.string()),
    // Subscription timing
    purchasedAt: v.number(),
    expiresAt: v.optional(v.number()),
    // Grace period (for billing issues)
    gracePeriodExpiresAt: v.optional(v.number()),
    // Cancellation
    canceledAt: v.optional(v.number()),
    willRenew: v.boolean(),
    // Trial info
    isTrialPeriod: v.boolean(),
    trialExpiresAt: v.optional(v.number()),
    // Pricing (for analytics)
    priceInCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    // Metadata
    lastSyncedAt: v.number(),
    rawEvent: v.optional(v.any()), // Last webhook event for debugging
  })
    .index("by_user", ["userId"])
    .index("by_revenuecat", ["revenuecatId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"]),

  // ============================================================
  // SUBSCRIPTION EVENTS (Audit log)
  // ============================================================
  subscriptionEvents: defineTable({
    userId: v.string(),
    revenuecatId: v.string(),
    eventType: v.string(), // INITIAL_PURCHASE, RENEWAL, CANCELLATION, etc.
    store: subscriptionStore,
    productId: v.string(),
    transactionId: v.optional(v.string()),
    environment: v.string(), // SANDBOX or PRODUCTION
    priceInCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    rawEvent: v.any(),
    processedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_revenuecat", ["revenuecatId"])
    .index("by_type", ["eventType"]),

  // ============================================================
  // E2E TEST FIXTURES (guarded by E2E_TEST_MODE)
  // ============================================================
  e2eDetectionFixtures: defineTable({
    projectId: v.id("projects"),
    key: v.string(),
    entities: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        aliases: v.array(v.string()),
        confidence: v.number(),
        properties: v.any(),
      })
    ),
    stats: v.optional(
      v.object({
        totalFound: v.number(),
        byType: v.any(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_key", ["projectId", "key"]),

  e2eSagaScripts: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    scenario: v.string(),
    steps: v.array(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_user_scenario", ["projectId", "userId", "scenario"]),

  // ============================================================
  // MIGRATIONS
  // ============================================================
  migrations: defineTable({
    name: v.string(),
    version: v.number(),
    status: v.string(), // "pending" | "running" | "completed" | "failed" | "rolled_back"
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    recordsProcessed: v.number(),
    recordsFailed: v.number(),
    metadata: v.optional(v.any()),
  }).index("by_name", ["name"]),

  migrationIdMappings: defineTable({
    supabaseId: v.string(),
    convexId: v.string(),
    table: v.string(),
    createdAt: v.number(),
  })
    .index("by_supabase", ["supabaseId", "table"])
    .index("by_convex", ["convexId", "table"]),

  // ============================================================
  // TIER CONFIGURATION
  // ============================================================
  tierConfigs: defineTable({
    // Core identification
    tier: v.string(), // "free" | "pro" | "team" | "enterprise"
    name: v.string(),
    description: v.optional(v.string()),

    // Pricing (in cents)
    priceMonthlyCents: v.number(),
    priceYearlyCents: v.number(),

    // AI Limits
    ai: v.object({
      tokensPerMonth: v.optional(v.number()), // null = unlimited
      callsPerDay: v.number(),
      concurrentRequests: v.number(),
      models: v.array(v.string()),
    }),

    // AI Feature Flags
    aiFeatures: v.object({
      chat: v.boolean(),
      lint: v.boolean(),
      coach: v.boolean(),
      detect: v.boolean(),
      search: v.boolean(),
      webSearch: v.boolean(),
      imageGeneration: v.boolean(),
      styleAdaptation: v.boolean(),
    }),

    // Memory/RAG Limits
    memory: v.object({
      retentionDays: v.optional(v.number()), // null = forever
      maxPerProject: v.number(),
      maxPinned: v.number(),
    }),

    // Embedding Limits
    embeddings: v.object({
      operationsPerDay: v.number(),
      maxVectorsPerProject: v.number(),
      queuePriority: v.number(),
    }),

    // Project Limits
    projects: v.object({
      maxProjects: v.number(),
      maxDocumentsPerProject: v.number(),
      maxEntitiesPerProject: v.number(),
      maxWordsPerMonth: v.optional(v.number()),
      storageMB: v.number(),
    }),

    // Collaboration
    collaboration: v.object({
      enabled: v.boolean(),
      maxCollaboratorsPerProject: v.optional(v.number()),
    }),

    // Other Features
    features: v.object({
      prioritySupport: v.boolean(),
      customModels: v.boolean(),
      apiAccess: v.boolean(),
      exportEnabled: v.boolean(),
    }),

    // Metadata
    metadata: v.optional(v.any()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tier", ["tier"])
    .index("by_active", ["isActive"]),

  // ============================================================
  // PROJECT COLLABORATION
  // ============================================================
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
    isOwner: v.boolean(),
    invitedBy: v.optional(v.string()),
    invitedAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_user", ["projectId", "userId"])
    .index("by_project_role", ["projectId", "role"])
    .index("by_project_owner", ["projectId", "isOwner"]),

  projectInvitations: defineTable({
    projectId: v.id("projects"),
    email: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("revoked")
    ),
    invitedBy: v.string(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_status", ["status"])
    .index("by_project_status", ["projectId", "status"]),

  // ============================================================
  // PROJECT ASSETS (File Storage)
  // ============================================================
  projectAssets: defineTable({
    projectId: v.id("projects"),
    entityId: v.optional(v.id("entities")),
    type: v.union(
      v.literal("portrait"),
      v.literal("scene"),
      v.literal("map"),
      v.literal("cover"),
      v.literal("reference"),
      v.literal("other")
    ),
    filename: v.string(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    sizeBytes: v.number(),
    altText: v.optional(v.string()),
    generationPrompt: v.optional(v.string()),
    generationModel: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_entity", ["entityId"])
    .index("by_project_type", ["projectId", "type"])
    .index("by_deleted", ["deletedAt"]),

  // ============================================================
  // LLM PROVIDERS
  // ============================================================
  llmProviders: defineTable({
    slug: v.string(),
    displayName: v.string(),
    baseUrl: v.string(),
    apiKeyEnv: v.string(),
    adapterType: v.union(
      v.literal("vercel-openai"),
      v.literal("vercel-anthropic"),
      v.literal("vercel-google"),
      v.literal("vercel-deepinfra"),
      v.literal("openrouter"),
      v.literal("deepinfra-openai"),
      v.literal("custom-fetch")
    ),
    supportsStreaming: v.boolean(),
    priority: v.number(),
    enabled: v.boolean(),
    markupPercent: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_enabled", ["enabled"])
    .index("by_priority", ["priority"]),

  // ============================================================
  // LLM TASK CONFIGS
  // ============================================================
  llmTaskConfigs: defineTable({
    taskSlug: v.string(),
    modality: v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("audio"),
      v.literal("video"),
      v.literal("world")
    ),
    description: v.optional(v.string()),

    // Model chain
    directModel: v.string(),
    directProvider: v.string(),
    fallback1Model: v.optional(v.string()),
    fallback1Provider: v.optional(v.string()),
    fallback2Model: v.optional(v.string()),
    fallback2Provider: v.optional(v.string()),

    // Limits
    maxTokensIn: v.optional(v.number()),
    maxTokensOut: v.optional(v.number()),
    maxTokensOutBrief: v.optional(v.number()),
    maxTokensOutStandard: v.optional(v.number()),
    maxTokensOutDeep: v.optional(v.number()),
    maxCostUsd: v.optional(v.number()),

    // Generation params
    temperature: v.optional(v.number()),
    topP: v.optional(v.number()),
    reasoningEffort: v.optional(
      v.union(
        v.literal("none"),
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("xhigh")
      )
    ),
    responseFormat: v.union(
      v.literal("text"),
      v.literal("json_object"),
      v.literal("json_schema")
    ),

    // Pricing (per 1M tokens)
    priceInPerM: v.optional(v.number()),
    priceOutPerM: v.optional(v.number()),
    fallback1PriceInPerM: v.optional(v.number()),
    fallback1PriceOutPerM: v.optional(v.number()),
    fallback2PriceInPerM: v.optional(v.number()),
    fallback2PriceOutPerM: v.optional(v.number()),

    // Access control
    minTier: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("team"),
      v.literal("enterprise")
    ),
    enabled: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_task", ["taskSlug"])
    .index("by_modality", ["modality"])
    .index("by_enabled_modality", ["enabled", "modality"]),

  // ============================================================
  // PROJECT IMAGES (AI-generated images)
  // ============================================================
  projectImages: defineTable({
    projectId: v.id("projects"),

    // Context - where/how the image is used
    context: v.union(
      v.literal("inline"),
      v.literal("character_portrait"),
      v.literal("character_full"),
      v.literal("location_scene"),
      v.literal("location_map"),
      v.literal("item"),
      v.literal("faction_emblem"),
      v.literal("cover"),
      v.literal("world_map")
    ),

    // Target - what the image is attached to
    targetType: v.union(
      v.literal("document"),
      v.literal("entity"),
      v.literal("project")
    ),
    targetId: v.optional(v.string()),

    // Generation params
    prompt: v.string(),
    negativePrompt: v.optional(v.string()),
    style: v.string(),
    aspectRatio: v.string(),
    tier: v.string(),

    // Result
    storageId: v.optional(v.id("_storage")),
    thumbnailStorageId: v.optional(v.id("_storage")),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("complete"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),

    // Metadata
    model: v.string(),
    provider: v.string(),
    costUsd: v.optional(v.number()),
    seed: v.optional(v.number()),
    generatedBy: v.string(), // userId

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_target", ["targetType", "targetId"])
    .index("by_status", ["status"])
    .index("by_project_context", ["projectId", "context"]),

  // ============================================================
  // AI USAGE TRACKING
  // ============================================================
  aiUsage: defineTable({
    userId: v.string(),
    projectId: v.optional(v.id("projects")),
    threadId: v.optional(v.string()), // Agent thread ID
    agentName: v.optional(v.string()), // "saga", "detect", "coach", etc.
    provider: v.optional(v.string()), // "openai", "anthropic", "openrouter"
    endpoint: v.string(), // "chat", "embed", "search", "detect", etc.
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    // Cost tracking (in microdollars for precision)
    costMicros: v.optional(v.number()),
    billingMode: v.string(), // "byok", "managed", "anonymous"
    latencyMs: v.optional(v.number()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_thread", ["threadId"])
    .index("by_user_date", ["userId", "createdAt"])
    .index("by_endpoint", ["endpoint"]),

  // ============================================================
  // VECTOR DELETE OUTBOX
  // ============================================================
  vectorDeleteJobs: defineTable({
    projectId: v.id("projects"),
    filter: v.any(), // Qdrant filter JSON
    targetType: v.optional(v.string()), // "document" | "entity" | "memory" | "project"
    targetId: v.optional(v.string()),
    reason: v.optional(v.string()),
    status: v.string(), // "pending" | "processing" | "completed" | "failed"
    attempts: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_project", ["projectId"])
    .index("by_project_target_status", ["projectId", "targetType", "targetId", "status"]),
});
