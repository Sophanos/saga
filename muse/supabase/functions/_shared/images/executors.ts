/**
 * Image Search Executors
 *
 * Server-side execution logic for image search tools.
 * Uses CLIP embeddings for text→image and image→image similarity search.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { BillingCheck } from "../billing.ts";
import {
  generateClipTextEmbedding,
  fromPgVector,
  isClipConfigured,
} from "../clip.ts";
import {
  searchPoints,
  isQdrantConfigured,
  type QdrantFilter,
  type QdrantSearchResult,
} from "../qdrant.ts";
import type {
  EntityType,
  AssetType,
  ImageStyle,
} from "../tools/types.ts";

// =============================================================================
// Types
// =============================================================================

export interface ImageSearchHit {
  assetId: string;
  imageUrl: string;
  score: number;
  storagePath?: string;
  entityId?: string;
  entityType?: EntityType;
  assetType?: AssetType;
  style?: ImageStyle;
  createdAt?: string;
}

export interface SearchImagesInput {
  projectId: string;
  query: string;
  limit?: number;
  assetType?: AssetType;
  entityId?: string;
  entityType?: EntityType;
  style?: ImageStyle;
}

export interface SearchImagesResult {
  query: string;
  results: ImageSearchHit[];
}

export interface FindSimilarImagesInput {
  projectId: string;
  assetId: string;
  limit?: number;
  assetType?: AssetType;
}

export interface FindSimilarImagesResult {
  referenceAssetId: string;
  results: ImageSearchHit[];
}

interface ExecutorDeps {
  supabase: SupabaseClient;
  billing: BillingCheck;
}

// =============================================================================
// Constants
// =============================================================================

const SAGA_IMAGES_COLLECTION = "saga_images";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Assert user has access to the project.
 */
async function assertProjectAccess(
  supabase: SupabaseClient,
  projectId: string,
  userId: string | null
): Promise<void> {
  if (!userId) {
    throw new Error("Authentication required");
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error || !project) {
    const { data: collab, error: collabError } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (collabError || !collab) {
      throw new Error("Access denied to project");
    }
  }
}

/**
 * Build Qdrant filter for image search.
 */
function buildImageFilter(
  projectId: string,
  options?: {
    assetType?: AssetType;
    entityId?: string;
    entityType?: EntityType;
    style?: ImageStyle;
    excludeAssetId?: string;
  }
): QdrantFilter {
  const must: QdrantFilter["must"] = [
    { key: "project_id", match: { value: projectId } },
  ];

  if (options?.assetType) {
    must.push({ key: "asset_type", match: { value: options.assetType } });
  }

  if (options?.entityId) {
    must.push({ key: "entity_id", match: { value: options.entityId } });
  }

  if (options?.entityType) {
    must.push({ key: "entity_type", match: { value: options.entityType } });
  }

  if (options?.style) {
    must.push({ key: "style", match: { value: options.style } });
  }

  const filter: QdrantFilter = { must };

  // Exclude a specific asset (e.g., the reference image in similarity search)
  if (options?.excludeAssetId) {
    filter.must_not = [
      { key: "asset_id", match: { value: options.excludeAssetId } },
    ];
  }

  return filter;
}

/**
 * Transform Qdrant results to ImageSearchHit format.
 */
function transformResults(results: QdrantSearchResult[]): ImageSearchHit[] {
  return results.map((hit) => ({
    assetId: String(hit.id),
    imageUrl: (hit.payload.public_url as string) ?? "",
    score: hit.score,
    storagePath: hit.payload.storage_path as string | undefined,
    entityId: hit.payload.entity_id as string | undefined,
    entityType: hit.payload.entity_type as EntityType | undefined,
    assetType: hit.payload.asset_type as AssetType | undefined,
    style: hit.payload.style as ImageStyle | undefined,
    createdAt: hit.payload.created_at as string | undefined,
  }));
}

/**
 * Resolve entity name to entity ID.
 */
async function resolveEntityId(
  supabase: SupabaseClient,
  projectId: string,
  entityName: string,
  entityType?: EntityType
): Promise<string | null> {
  let query = supabase
    .from("entities")
    .select("id")
    .eq("project_id", projectId)
    .ilike("name", entityName);

  if (entityType) {
    query = query.eq("type", entityType);
  }

  const { data, error } = await query.limit(1).single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

// =============================================================================
// Executors
// =============================================================================

/**
 * Execute search_images: text→image search using CLIP.
 */
export async function executeSearchImages(
  input: SearchImagesInput,
  deps: ExecutorDeps
): Promise<SearchImagesResult> {
  const { supabase, billing } = deps;
  const { projectId, query, limit = 5 } = input;

  // 1. Check access
  await assertProjectAccess(supabase, projectId, billing.userId);

  // 2. Check CLIP/Qdrant availability
  if (!isClipConfigured()) {
    throw new Error("CLIP embedding service not configured");
  }

  if (!isQdrantConfigured()) {
    throw new Error("Vector search service not configured");
  }

  // 3. Generate CLIP text embedding for the query
  const { embedding } = await generateClipTextEmbedding(query);

  // 4. Build filter
  const filter = buildImageFilter(projectId, {
    assetType: input.assetType,
    entityType: input.entityType,
    style: input.style,
  });

  // 5. Search Qdrant
  const qdrantResults = await searchPoints(embedding, limit, filter, {
    collection: SAGA_IMAGES_COLLECTION,
  });

  // 6. Transform and return results
  return {
    query,
    results: transformResults(qdrantResults),
  };
}

/**
 * Execute find_similar_images: image→image similarity search using CLIP.
 */
export async function executeFindSimilarImages(
  input: FindSimilarImagesInput,
  deps: ExecutorDeps
): Promise<FindSimilarImagesResult> {
  const { supabase, billing } = deps;
  const { projectId, assetId, limit = 5 } = input;

  // 1. Check access
  await assertProjectAccess(supabase, projectId, billing.userId);

  // 2. Check Qdrant availability
  if (!isQdrantConfigured()) {
    throw new Error("Vector search service not configured");
  }

  // 3. Get the reference asset's CLIP embedding from database
  const { data: asset, error: assetError } = await supabase
    .from("project_assets")
    .select("id, clip_embedding, clip_sync_status, storage_path")
    .eq("id", assetId)
    .eq("project_id", projectId)
    .single();

  if (assetError || !asset) {
    throw new Error("Reference asset not found in project");
  }

  // 4. Get embedding (or handle missing)
  let referenceEmbedding: number[];

  if (asset.clip_embedding) {
    // Parse the pgvector format
    referenceEmbedding = fromPgVector(asset.clip_embedding);
  } else if (asset.clip_sync_status === "pending" || asset.clip_sync_status === "error") {
    // Could implement on-demand backfill here in the future
    throw new Error(
      `Reference asset has no CLIP embedding (status: ${asset.clip_sync_status}). ` +
      "Try regenerating the image or wait for sync to complete."
    );
  } else {
    throw new Error("Reference asset has no CLIP embedding");
  }

  // 5. Build filter (exclude the reference image itself)
  const filter = buildImageFilter(projectId, {
    assetType: input.assetType,
    excludeAssetId: assetId,
  });

  // 6. Search Qdrant for similar images
  const qdrantResults = await searchPoints(referenceEmbedding, limit, filter, {
    collection: SAGA_IMAGES_COLLECTION,
  });

  // 7. Transform and return results
  return {
    referenceAssetId: assetId,
    results: transformResults(qdrantResults),
  };
}

/**
 * Resolve entity name to asset ID for find_similar_images.
 * Returns the entity's portrait asset ID if available.
 */
export async function resolveEntityPortraitAssetId(
  supabase: SupabaseClient,
  projectId: string,
  entityName: string,
  entityType?: EntityType
): Promise<string | null> {
  let query = supabase
    .from("entities")
    .select("portrait_asset_id")
    .eq("project_id", projectId)
    .ilike("name", entityName);

  if (entityType) {
    query = query.eq("type", entityType);
  }

  const { data, error } = await query.limit(1).single();

  if (error || !data || !data.portrait_asset_id) {
    return null;
  }

  return data.portrait_asset_id;
}
