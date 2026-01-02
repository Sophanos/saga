/**
 * Asset Cleanup Edge Function
 *
 * Handles hard deletion of soft-deleted assets:
 * 1. Delete Qdrant point (saga_images collection)
 * 2. Delete storage blob (project-assets bucket)
 * 3. Delete database record
 *
 * Called by pg_cron or manually for maintenance.
 *
 * @module asset-cleanup
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  deletePoints,
  isQdrantConfigured,
} from "../_shared/qdrant.ts";

// =============================================================================
// Constants
// =============================================================================

const STORAGE_BUCKET = "project-assets";
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_RETENTION_DAYS = 7;

// =============================================================================
// Types
// =============================================================================

interface CleanupRequest {
  batchSize?: number;
  retentionDays?: number;
  dryRun?: boolean;
}

interface CleanupResult {
  processed: number;
  qdrantDeleted: number;
  storageDeleted: number;
  dbDeleted: number;
  errors: string[];
}

interface AssetToClean {
  id: string;
  storage_path: string;
  clip_sync_status: string;
}

// =============================================================================
// Cleanup Logic
// =============================================================================

async function cleanupAssets(
  supabase: SupabaseClient,
  options: CleanupRequest
): Promise<CleanupResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const dryRun = options.dryRun ?? false;

  const result: CleanupResult = {
    processed: 0,
    qdrantDeleted: 0,
    storageDeleted: 0,
    dbDeleted: 0,
    errors: [],
  };

  console.log(`[asset-cleanup] Starting cleanup: batchSize=${batchSize}, retentionDays=${retentionDays}, dryRun=${dryRun}`);

  // Get assets ready for cleanup
  const { data: assets, error: fetchError } = await supabase.rpc("get_assets_for_cleanup", {
    p_batch_size: batchSize,
    p_retention_days: retentionDays,
  });

  if (fetchError) {
    result.errors.push(`Failed to fetch assets: ${fetchError.message}`);
    console.error("[asset-cleanup] Fetch error:", fetchError);
    return result;
  }

  if (!assets || assets.length === 0) {
    console.log("[asset-cleanup] No assets to clean up");
    return result;
  }

  console.log(`[asset-cleanup] Found ${assets.length} assets to clean up`);
  result.processed = assets.length;

  const successfulAssetIds: string[] = [];

  for (const asset of assets as AssetToClean[]) {
    let assetSuccess = true;

    // Step 1: Delete from Qdrant (if synced)
    if (asset.clip_sync_status === "synced" && isQdrantConfigured()) {
      try {
        if (!dryRun) {
          await deletePoints([asset.id], { collection: "saga_images" });
        }
        result.qdrantDeleted++;
        console.log(`[asset-cleanup] Qdrant point deleted: ${asset.id}`);
      } catch (error) {
        const msg = `Qdrant delete failed for ${asset.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[asset-cleanup] ${msg}`);
        result.errors.push(msg);
        // Continue anyway - Qdrant point can be orphaned, not fatal
      }
    }

    // Step 2: Delete from Storage
    try {
      if (!dryRun) {
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([asset.storage_path]);

        if (storageError) {
          throw new Error(storageError.message);
        }
      }
      result.storageDeleted++;
      console.log(`[asset-cleanup] Storage blob deleted: ${asset.storage_path}`);
    } catch (error) {
      const msg = `Storage delete failed for ${asset.storage_path}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[asset-cleanup] ${msg}`);
      result.errors.push(msg);
      assetSuccess = false;
      // Continue anyway - storage blob can be orphaned (less critical)
    }

    if (assetSuccess) {
      successfulAssetIds.push(asset.id);
    }
  }

  // Step 3: Hard delete DB records for successfully cleaned assets
  if (successfulAssetIds.length > 0 && !dryRun) {
    const { data: deletedCount, error: deleteError } = await supabase.rpc("hard_delete_assets", {
      p_asset_ids: successfulAssetIds,
    });

    if (deleteError) {
      result.errors.push(`DB delete failed: ${deleteError.message}`);
      console.error("[asset-cleanup] DB delete error:", deleteError);
    } else {
      result.dbDeleted = deletedCount ?? 0;
      console.log(`[asset-cleanup] DB records deleted: ${result.dbDeleted}`);
    }
  }

  console.log(`[asset-cleanup] Complete: processed=${result.processed}, qdrant=${result.qdrantDeleted}, storage=${result.storageDeleted}, db=${result.dbDeleted}, errors=${result.errors.length}`);
  return result;
}

// =============================================================================
// Serve
// =============================================================================

serve(async (req: Request): Promise<Response> => {
  // Only allow POST (for security)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify service role key (this should only be called by cron or admin)
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceKey) {
    console.error("[asset-cleanup] Missing SUPABASE_SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check for service role authorization
  if (!authHeader || !authHeader.includes(serviceKey)) {
    console.warn("[asset-cleanup] Unauthorized request");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let body: CleanupRequest = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine, use defaults
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const result = await cleanupAssets(supabase, body);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[asset-cleanup] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
