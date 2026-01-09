/**
 * Migration System Types
 *
 * Types for the Supabase → Convex migration system.
 */

import type { Id } from "../_generated/dataModel";

// ============================================================
// Migration Status
// ============================================================

export type MigrationStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "rolled_back";

export interface MigrationRecord {
  _id: Id<"migrations">;
  name: string;
  version: number;
  status: MigrationStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  recordsProcessed: number;
  recordsFailed: number;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Migration Definition
// ============================================================

export interface MigrationDefinition {
  name: string;
  version: number;
  description: string;

  // Dependencies (migrations that must run first)
  dependsOn?: string[];

  // Batch size for processing records
  batchSize?: number;

  // Whether this migration can be safely re-run
  idempotent: boolean;
}

// ============================================================
// Migration Context
// ============================================================

export interface MigrationContext {
  dryRun: boolean;
  batchSize: number;
  continueOnError: boolean;
  verbose: boolean;
}

// ============================================================
// Migration Results
// ============================================================

export interface MigrationResult {
  success: boolean;
  recordsProcessed: number;
  recordsFailed: number;
  errors: MigrationError[];
  duration: number;
}

export interface MigrationError {
  recordId: string;
  table: string;
  error: string;
  data?: unknown;
}

// ============================================================
// Supabase Source Types (for reference)
// ============================================================

export interface SupabaseProject {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  genre?: string;
  style_config?: unknown;
  linter_config?: unknown;
  created_at: string;
  updated_at: string;
}

export interface SupabaseDocument {
  id: string;
  project_id: string;
  parent_id?: string;
  type: string;
  title?: string;
  content?: unknown;
  content_text?: string;
  order_index: number;
  word_count: number;
  beat?: string;
  tension_level?: number;
  pov_character_id?: string;
  location_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SupabaseEntity {
  id: string;
  project_id: string;
  type: string;
  name: string;
  aliases: string[];
  properties: unknown;
  notes?: string;
  portrait_url?: string;
  icon?: string;
  color?: string;
  visible_in?: string[];
  created_at: string;
  updated_at: string;
}

export interface SupabaseRelationship {
  id: string;
  project_id: string;
  source_id: string;
  target_id: string;
  type: string;
  bidirectional: boolean;
  strength?: number;
  metadata?: unknown;
  notes?: string;
  created_at: string;
}

export interface SupabaseTierConfig {
  id: string;
  tier: string;
  name: string;
  description?: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  tokens_included: number;
  max_projects?: number;
  max_collaborators_per_project?: number;
  max_words_per_month?: number;
  ai_chat_enabled: boolean;
  ai_lint_enabled: boolean;
  ai_coach_enabled: boolean;
  ai_detect_enabled: boolean;
  ai_search_enabled: boolean;
  priority_support: boolean;
  custom_models: boolean;
  api_access: boolean;
  export_enabled: boolean;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
}

// ============================================================
// ID Mapping (Supabase UUID → Convex ID)
// ============================================================

export interface IdMapping {
  supabaseId: string;
  convexId: string;
  table: string;
}
