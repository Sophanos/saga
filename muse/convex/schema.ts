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
    genre: v.optional(v.string()),
    styleConfig: v.optional(v.any()), // Writing style preferences
    linterConfig: v.optional(v.any()), // Consistency linter rules
    ownerId: v.string(), // Better Auth user ID
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_supabase_id", ["supabaseId"])
    .index("by_updated", ["updatedAt"]),

  // ============================================================
  // DOCUMENTS (chapters, scenes, notes)
  // ============================================================
  documents: defineTable({
    projectId: v.id("projects"),
    supabaseId: v.optional(v.string()), // Legacy migration field (deprecated)
    parentId: v.optional(v.id("documents")), // Hierarchical structure
    type: v.string(), // "chapter", "scene", "note", "outline", "worldbuilding"
    title: v.optional(v.string()),
    content: v.optional(v.any()), // ProseMirror JSON
    contentText: v.optional(v.string()), // Plain text for search
    orderIndex: v.number(),
    wordCount: v.number(),
    // Metadata
    beat: v.optional(v.string()), // Narrative beat
    tensionLevel: v.optional(v.number()), // 1-10
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
  // ENTITIES (characters, locations, items, etc.)
  // ============================================================
  entities: defineTable({
    projectId: v.id("projects"),
    supabaseId: v.optional(v.string()), // Legacy migration field (deprecated)
    type: v.string(), // "character", "location", "item", "magic_system", "faction", "event", "concept"
    name: v.string(),
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
    .index("by_project_name", ["projectId", "name"])
    .index("by_supabase_id", ["supabaseId"])
    .searchIndex("search_entities", {
      searchField: "name",
      filterFields: ["projectId", "type"],
    }),

  // ============================================================
  // RELATIONSHIPS (World Graph edges)
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
  // AI THREAD MAPPINGS
  // ============================================================
  sagaThreads: defineTable({
    threadId: v.string(),
    projectId: v.id("projects"),
    userId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_project", ["projectId"])
    .index("by_project_user", ["projectId", "userId"]),

  // ============================================================
  // AI GENERATION STREAMS (for polling-based streaming)
  // ============================================================
  generationStreams: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    type: v.string(), // "chat", "detect", "lint", "coach", "genesis", "saga", "saga-approval"
    status: v.string(), // "pending", "streaming", "done", "error"
    chunks: v.array(
      v.object({
        index: v.number(),
        content: v.string(),
        type: v.string(), // "delta", "tool", "tool-approval-request", "context", "error"
        // Tool-related fields (optional)
        toolCallId: v.optional(v.string()),
        toolName: v.optional(v.string()),
        approvalId: v.optional(v.string()),
        args: v.optional(v.any()),
        data: v.optional(v.any()),
      })
    ),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_created", ["userId", "createdAt"]),

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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_project_target", ["projectId", "targetType", "targetId"]),

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
    .index("by_project", ["projectId"]),
});
