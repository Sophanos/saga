import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Saga Convex Schema
 *
 * This schema mirrors the core Supabase tables that need real-time sync.
 * Tables NOT migrated (kept in Supabase):
 * - subscriptions, profiles (auth/billing)
 * - memories (Qdrant sync tracking)
 * - ai_request_logs, activity_log (append-only analytics)
 */
export default defineSchema({
  // ============================================================
  // PROJECTS
  // ============================================================
  projects: defineTable({
    supabaseId: v.string(), // Link to Supabase project for billing/auth
    name: v.string(),
    description: v.optional(v.string()),
    genre: v.optional(v.string()),
    styleConfig: v.optional(v.any()), // Writing style preferences
    linterConfig: v.optional(v.any()), // Consistency linter rules
    ownerId: v.string(), // Supabase user ID
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
    supabaseId: v.optional(v.string()), // For migration tracking
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
    .index("by_supabase_id", ["supabaseId"]),

  // ============================================================
  // ENTITIES (characters, locations, items, etc.)
  // ============================================================
  entities: defineTable({
    projectId: v.id("projects"),
    supabaseId: v.optional(v.string()), // For migration tracking
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
    .index("by_supabase_id", ["supabaseId"]),

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
  // AI USAGE TRACKING
  // ============================================================
  aiUsage: defineTable({
    userId: v.string(),
    projectId: v.optional(v.id("projects")),
    endpoint: v.string(), // "embed", "search", "detect", etc.
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    billingMode: v.string(), // "byok", "managed", "anonymous"
    latencyMs: v.optional(v.number()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_endpoint", ["endpoint"]),
});
