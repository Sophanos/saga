/**
 * Migration Runner
 *
 * Orchestrates Supabase → Convex data migrations.
 * Run migrations via internal mutations from dashboard or CLI.
 */

import { v } from "convex/values";
import {
  query,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import type { MigrationStatus } from "./types";

// ============================================================
// Migration Registry
// ============================================================

export const MIGRATIONS = [
  {
    name: "001_tier_config",
    version: 1,
    description: "Seed tier configurations from defaults",
    dependsOn: [],
    idempotent: true,
  },
  {
    name: "002_projects",
    version: 2,
    description: "Migrate projects from Supabase",
    dependsOn: [],
    idempotent: true,
  },
  {
    name: "003_documents",
    version: 3,
    description: "Migrate documents from Supabase",
    dependsOn: ["002_projects"],
    idempotent: true,
  },
  {
    name: "004_entities",
    version: 4,
    description: "Migrate entities from Supabase",
    dependsOn: ["002_projects"],
    idempotent: true,
  },
  {
    name: "005_relationships",
    version: 5,
    description: "Migrate relationships from Supabase",
    dependsOn: ["004_entities"],
    idempotent: true,
  },
  {
    name: "006_users",
    version: 6,
    description: "Link Better Auth users to Supabase profiles",
    dependsOn: [],
    idempotent: true,
  },
] as const;

export type MigrationName = typeof MIGRATIONS[number]["name"];

// ============================================================
// Migration Status Queries
// ============================================================

/**
 * Get all migration statuses
 */
export const listMigrations = query({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("migrations").collect();

    return MIGRATIONS.map((def) => {
      const record = records.find((r) => r.name === def.name);
      return {
        ...def,
        status: record?.status ?? ("pending" as MigrationStatus),
        startedAt: record?.startedAt,
        completedAt: record?.completedAt,
        recordsProcessed: record?.recordsProcessed ?? 0,
        recordsFailed: record?.recordsFailed ?? 0,
        error: record?.error,
      };
    });
  },
});

/**
 * Get single migration status
 */
export const getMigrationStatus = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db
      .query("migrations")
      .filter((q) => q.eq(q.field("name"), name))
      .first();
  },
});

// ============================================================
// Migration Execution
// ============================================================

/**
 * Start a migration
 */
export const startMigration = internalMutation({
  args: {
    name: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { name, dryRun = false }) => {
    const migration = MIGRATIONS.find((m) => m.name === name);
    if (!migration) {
      throw new Error(`Migration "${name}" not found`);
    }

    // Check dependencies
    for (const dep of migration.dependsOn) {
      const depStatus = await ctx.db
        .query("migrations")
        .filter((q) => q.eq(q.field("name"), dep))
        .first();

      if (depStatus?.status !== "completed") {
        throw new Error(
          `Migration "${name}" depends on "${dep}" which has not completed`
        );
      }
    }

    // Check if already running
    const existing = await ctx.db
      .query("migrations")
      .filter((q) => q.eq(q.field("name"), name))
      .first();

    if (existing?.status === "running") {
      throw new Error(`Migration "${name}" is already running`);
    }

    // Create or update migration record
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "running",
        startedAt: now,
        completedAt: undefined,
        error: undefined,
        recordsProcessed: 0,
        recordsFailed: 0,
        metadata: { dryRun },
      });
      return existing._id;
    }

    return await ctx.db.insert("migrations", {
      name,
      version: migration.version,
      status: "running",
      startedAt: now,
      recordsProcessed: 0,
      recordsFailed: 0,
      metadata: { dryRun },
    });
  },
});

/**
 * Complete a migration
 */
export const completeMigration = internalMutation({
  args: {
    name: v.string(),
    result: v.object({
      success: v.boolean(),
      recordsProcessed: v.number(),
      recordsFailed: v.number(),
      error: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { name, result }) => {
    const existing = await ctx.db
      .query("migrations")
      .filter((q) => q.eq(q.field("name"), name))
      .first();

    if (!existing) {
      throw new Error(`Migration "${name}" not found`);
    }

    await ctx.db.patch(existing._id, {
      status: result.success ? "completed" : "failed",
      completedAt: Date.now(),
      recordsProcessed: result.recordsProcessed,
      recordsFailed: result.recordsFailed,
      error: result.error,
    });
  },
});

/**
 * Update migration progress
 */
export const updateMigrationProgress = internalMutation({
  args: {
    name: v.string(),
    recordsProcessed: v.number(),
    recordsFailed: v.number(),
  },
  handler: async (ctx, { name, recordsProcessed, recordsFailed }) => {
    const existing = await ctx.db
      .query("migrations")
      .filter((q) => q.eq(q.field("name"), name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        recordsProcessed,
        recordsFailed,
      });
    }
  },
});

/**
 * Reset a migration (for re-running)
 */
export const resetMigration = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const existing = await ctx.db
      .query("migrations")
      .filter((q) => q.eq(q.field("name"), name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "pending",
        startedAt: undefined,
        completedAt: undefined,
        error: undefined,
        recordsProcessed: 0,
        recordsFailed: 0,
      });
    }
  },
});

// ============================================================
// ID Mapping Helpers
// ============================================================

/**
 * Store ID mapping (Supabase UUID → Convex ID)
 */
export const storeIdMapping = internalMutation({
  args: {
    supabaseId: v.string(),
    convexId: v.string(),
    table: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if mapping already exists
    const existing = await ctx.db
      .query("migrationIdMappings")
      .filter((q) =>
        q.and(
          q.eq(q.field("supabaseId"), args.supabaseId),
          q.eq(q.field("table"), args.table)
        )
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("migrationIdMappings", {
      supabaseId: args.supabaseId,
      convexId: args.convexId,
      table: args.table,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get Convex ID from Supabase UUID
 */
export const getConvexId = internalQuery({
  args: {
    supabaseId: v.string(),
    table: v.string(),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.db
      .query("migrationIdMappings")
      .filter((q) =>
        q.and(
          q.eq(q.field("supabaseId"), args.supabaseId),
          q.eq(q.field("table"), args.table)
        )
      )
      .first();

    return mapping?.convexId;
  },
});
