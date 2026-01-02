/**
 * AI Image Generation Edge Function
 *
 * Generates AI images using Vercel AI SDK via OpenRouter (primary)
 * or Gemini direct (fallback).
 *
 * Primary: OpenRouter with google/gemini-2.5-flash-image
 * Fallback: @ai-sdk/google with gemini-2.0-flash-preview-image-generation
 *
 * @module ai-image
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { generateText } from "https://esm.sh/ai@6.0.0";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  ErrorCode,
} from "../_shared/errors.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  recordAIRequest,
  type BillingCheck,
} from "../_shared/billing.ts";
import {
  createDynamicOpenRouter,
  createDynamicGemini,
} from "../_shared/providers.ts";
import {
  buildImagePrompt,
  STYLE_PROMPTS,
} from "../_shared/tools/generate-image.ts";
import { buildEditPrompt } from "../_shared/tools/edit-image.ts";
import type { ImageStyle, AspectRatio, AssetType } from "../_shared/tools/types.ts";
import {
  generateClipImageEmbedding,
  toPgVector,
  isClipConfigured,
} from "../_shared/clip.ts";
import {
  upsertPoints,
  isQdrantConfigured,
} from "../_shared/qdrant.ts";

// =============================================================================
// Types
// =============================================================================

// Base generate request (original)
interface GenerateRequest {
  kind?: "generate";
  projectId: string;
  entityId?: string;
  assetType?: AssetType;
  subject: string;
  entityName?: string;
  visualDescription?: string;
  style?: ImageStyle;
  aspectRatio?: AspectRatio;
  setAsPortrait?: boolean;
  promptOverride?: string;
  negativePrompt?: string;
}

// Phase 4: Scene illustration request
type SceneFocus = "action" | "dialogue" | "establishing" | "dramatic";

interface CharacterReference {
  name: string;
  entityId: string;
  portraitUrl?: string;
}

interface SceneRequest {
  kind: "scene";
  projectId: string;
  sceneText: string;
  characterReferences?: CharacterReference[];
  style?: ImageStyle;
  aspectRatio?: AspectRatio;
  assetType?: AssetType;
  sceneFocus?: SceneFocus;
  negativePrompt?: string;
}

// Image edit request
type EditMode = "inpaint" | "outpaint" | "remix" | "style_transfer";

interface EditRequest {
  kind: "edit";
  projectId: string;
  assetId: string;
  editInstruction: string;
  editMode?: EditMode;
  style?: ImageStyle;
  aspectRatio?: AspectRatio;
  preserveAspectRatio?: boolean;
  assetType?: AssetType;
  setAsPortrait?: boolean;
  negativePrompt?: string;
}

type AIImageRequest = GenerateRequest | SceneRequest | EditRequest;

function isSceneRequest(req: AIImageRequest): req is SceneRequest {
  return req.kind === "scene";
}

function isEditRequest(req: AIImageRequest): req is EditRequest {
  return req.kind === "edit";
}

interface AIImageResponse {
  assetId: string;
  storagePath: string;
  imageUrl: string;
  entityId?: string;
  /** Whether this was a cache hit (existing identical generation) */
  cached?: boolean;
  /** Number of times this asset has been reused from cache */
  cacheHitCount?: number;
}

// Phase 4: Scene response
interface SceneCharacter {
  name: string;
  entityId?: string;
  hadPortraitReference: boolean;
}

interface SceneResponse extends AIImageResponse {
  sceneDescription: string;
  charactersIncluded: SceneCharacter[];
}

// =============================================================================
// Constants
// =============================================================================

// OpenRouter image models (primary)
const OPENROUTER_IMAGE_MODEL = "google/gemini-2.5-flash-image";
// Gemini direct fallback
const GEMINI_IMAGE_MODEL = "gemini-2.0-flash-preview-image-generation";

const STORAGE_BUCKET = "project-assets";
const SIGNED_URL_EXPIRY_SECONDS = 365 * 24 * 60 * 60; // 1 year
const IMAGE_GEN_TIMEOUT_MS = 50_000; // 50 seconds
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_SUBJECT_LENGTH = 500;
const MAX_PROMPT_LENGTH = 2000;
const MAX_VISUAL_DESC_LENGTH = 1000;
const MAX_SCENE_TEXT_LENGTH = 3000;
const MAX_CHARACTER_REFS = 4; // Limit portraits to control payload size
const MAX_EDIT_INSTRUCTION_LENGTH = 1200;
const CACHE_LOCK_TTL_SECONDS = 120;
const CACHE_WAIT_ATTEMPTS = 6;
const CACHE_WAIT_DELAY_MS = 500;

// Scene focus composition prompts
const SCENE_FOCUS_PROMPTS: Record<SceneFocus, string> = {
  action: "dynamic composition, motion blur, intense movement, action pose, dramatic angle",
  dialogue: "conversational framing, eye contact, intimate composition, character interaction focus",
  establishing: "wide shot, environmental focus, setting the scene, atmospheric perspective",
  dramatic: "dramatic lighting, emotional intensity, key moment, cinematic composition",
};

// =============================================================================
// Helpers
// =============================================================================

async function cleanupStorageBlob(
  supabase: ReturnType<typeof createSupabaseClient>,
  path: string,
  logPrefix: string
): Promise<void> {
  try {
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    console.log(`${logPrefix} Cleaned up orphan file: ${path}`);
  } catch (e) {
    console.error(`${logPrefix} Failed to cleanup orphan blob: ${path}`, e);
  }
}

function generateStoragePath(
  projectId: string,
  entityId: string | undefined,
  ext: string
): string {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID();
  const folder = entityId ?? "general";
  return `${projectId}/${folder}/${timestamp}-${uuid}.${ext}`;
}

/**
 * Generate deterministic cache hash for generation parameters.
 * Uses MD5 of canonical JSON for fast lookup.
 */
async function generateCacheHash(params: {
  projectId: string;
  prompt: string;
  style: string;
  aspectRatio: string;
}): Promise<string> {
  // Canonical JSON (sorted keys, normalized values)
  const canonical = JSON.stringify({
    aspectRatio: params.aspectRatio,
    projectId: params.projectId,
    prompt: params.prompt.trim().toLowerCase(),
    style: params.style,
  });

  // MD5-like hash using SubtleCrypto (SHA-256 truncated for speed)
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Use first 16 bytes (32 hex chars) for reasonable uniqueness
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Refresh signed URL for a cached asset.
 */
async function refreshSignedUrl(
  supabase: ReturnType<typeof createSupabaseClient>,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn("[ai-image] Failed to refresh signed URL:", error);
    return null;
  }
  return data.signedUrl;
}

async function assertProjectAccess(
  supabase: ReturnType<typeof createSupabaseClient>,
  projectId: string,
  userId: string | null
): Promise<void> {
  if (!userId) {
    throw new Error("Authentication required for project operations");
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

async function assertEntityInProject(
  supabase: ReturnType<typeof createSupabaseClient>,
  entityId: string,
  projectId: string
): Promise<{ id: string; type: string | null }> {
  const { data, error } = await supabase
    .from("entities")
    .select("id, type")
    .eq("id", entityId)
    .eq("project_id", projectId)
    .single();

  if (error || !data) {
    throw new Error("Entity not found in project");
  }

  return { id: data.id, type: data.type ?? null };
}

function getExtFromMimeType(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

/**
 * Convert Uint8Array to base64 string (chunk-based for performance)
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }
  return btoa(chunks.join(""));
}

interface CachedAssetRow {
  id: string;
  storage_path: string;
  cache_hit_count?: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function lookupCachedAsset(
  supabase: ReturnType<typeof createSupabaseClient>,
  projectId: string,
  generationHash: string,
  logPrefix: string
): Promise<CachedAssetRow | null> {
  const { data, error } = await supabase.rpc("lookup_asset_cache", {
    p_project_id: projectId,
    p_generation_hash: generationHash,
  });

  if (error) {
    console.warn(`${logPrefix} Cache lookup failed:`, error);
    return null;
  }

  return data && data.length > 0 ? (data[0] as CachedAssetRow) : null;
}

async function waitForCachedAsset(
  supabase: ReturnType<typeof createSupabaseClient>,
  projectId: string,
  generationHash: string,
  logPrefix: string,
  attempts = CACHE_WAIT_ATTEMPTS,
  delayMs = CACHE_WAIT_DELAY_MS
): Promise<CachedAssetRow | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await sleep(delayMs);
    const cached = await lookupCachedAsset(supabase, projectId, generationHash, logPrefix);
    if (cached) {
      return cached;
    }
  }
  return null;
}

// =============================================================================
// Image Generation with Fallback
// =============================================================================

interface GeneratedImage {
  uint8Array: Uint8Array;
  mimeType: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

/**
 * Generate image using OpenRouter (primary) with Gemini fallback
 */
async function generateImageWithFallback(
  prompt: string,
  openRouterKey: string | null,
  geminiKey: string | null,
  logPrefix: string
): Promise<GeneratedImage> {
  // Try OpenRouter first (primary)
  if (openRouterKey) {
    try {
      console.log(`${logPrefix} Trying OpenRouter with ${OPENROUTER_IMAGE_MODEL}...`);
      const openRouter = createDynamicOpenRouter(openRouterKey);

      const result = await generateText({
        model: openRouter(OPENROUTER_IMAGE_MODEL),
        prompt,
        abortSignal: AbortSignal.timeout(IMAGE_GEN_TIMEOUT_MS),
      });

      const imageFile = result.files?.find((f) => f.mediaType.startsWith("image/"));
      if (imageFile) {
        console.log(`${logPrefix} OpenRouter success`);
        return {
          uint8Array: imageFile.uint8Array,
          mimeType: imageFile.mediaType,
          model: OPENROUTER_IMAGE_MODEL,
          usage: result.usage,
        };
      }

      console.warn(`${logPrefix} OpenRouter returned no image, falling back to Gemini...`);
    } catch (error) {
      console.warn(`${logPrefix} OpenRouter failed:`, error);
      console.log(`${logPrefix} Falling back to Gemini direct...`);
    }
  }

  // Fallback to Gemini direct
  if (geminiKey) {
    console.log(`${logPrefix} Using Gemini direct with ${GEMINI_IMAGE_MODEL}...`);
    const gemini = createDynamicGemini(geminiKey);

    const result = await generateText({
      model: gemini(GEMINI_IMAGE_MODEL),
      prompt,
      abortSignal: AbortSignal.timeout(IMAGE_GEN_TIMEOUT_MS),
    });

    const imageFile = result.files?.find((f) => f.mediaType.startsWith("image/"));
    if (imageFile) {
      console.log(`${logPrefix} Gemini success`);
      return {
        uint8Array: imageFile.uint8Array,
        mimeType: imageFile.mediaType,
        model: GEMINI_IMAGE_MODEL,
        usage: result.usage,
      };
    }

    throw new Error("Gemini returned no image");
  }

  throw new Error("No API key available for image generation");
}

/**
 * Generate image using multimodal content (images + text) with fallback.
 * Used for image editing and scene illustration with reference images.
 */
async function generateImageWithFallbackFromContent(
  content: Array<{ type: "text" | "image"; text?: string; image?: string }>,
  openRouterKey: string | null,
  geminiKey: string | null,
  logPrefix: string
): Promise<GeneratedImage> {
  // Try OpenRouter first
  if (openRouterKey) {
    try {
      console.log(`${logPrefix} Trying OpenRouter multimodal with ${OPENROUTER_IMAGE_MODEL}...`);
      const openRouter = createDynamicOpenRouter(openRouterKey);

      const result = await generateText({
        model: openRouter(OPENROUTER_IMAGE_MODEL),
        messages: [{ role: "user", content }],
        abortSignal: AbortSignal.timeout(IMAGE_GEN_TIMEOUT_MS),
      });

      const imageFile = result.files?.find((f) => f.mediaType.startsWith("image/"));
      if (imageFile) {
        console.log(`${logPrefix} OpenRouter multimodal success`);
        return {
          uint8Array: imageFile.uint8Array,
          mimeType: imageFile.mediaType,
          model: OPENROUTER_IMAGE_MODEL,
          usage: result.usage,
        };
      }

      console.warn(`${logPrefix} OpenRouter multimodal returned no image, falling back...`);
    } catch (error) {
      console.warn(`${logPrefix} OpenRouter multimodal failed:`, error);
    }
  }

  // Fallback to Gemini direct
  if (geminiKey) {
    console.log(`${logPrefix} Using Gemini direct multimodal with ${GEMINI_IMAGE_MODEL}...`);
    const gemini = createDynamicGemini(geminiKey);

    const result = await generateText({
      model: gemini(GEMINI_IMAGE_MODEL),
      messages: [{ role: "user", content }],
      abortSignal: AbortSignal.timeout(IMAGE_GEN_TIMEOUT_MS),
    });

    const imageFile = result.files?.find((f) => f.mediaType.startsWith("image/"));
    if (imageFile) {
      console.log(`${logPrefix} Gemini multimodal success`);
      return {
        uint8Array: imageFile.uint8Array,
        mimeType: imageFile.mediaType,
        model: GEMINI_IMAGE_MODEL,
        usage: result.usage,
      };
    }

    throw new Error("Gemini returned no image (multimodal)");
  }

  throw new Error("No API key available for image editing");
}

/**
 * Download an existing asset from Storage and convert to data URL.
 */
async function downloadAssetAsDataUrl(
  supabase: ReturnType<typeof createSupabaseClient>,
  storagePath: string,
  mimeTypeHint: string | null,
  logPrefix: string
): Promise<{ dataUrl: string; mimeType: string; bytes: Uint8Array }> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) {
    console.error(`${logPrefix} Failed to download asset from storage:`, error);
    throw new Error("Failed to download source asset");
  }

  const arrayBuffer = await data.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      `Source image too large: ${Math.round(bytes.length / 1024 / 1024)}MB exceeds 10MB limit`
    );
  }

  const mimeType = data.type || mimeTypeHint || "image/png";
  const base64 = uint8ArrayToBase64(bytes);
  return {
    bytes,
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`,
  };
}

// =============================================================================
// Main Handler
// =============================================================================

async function handleGenerateImage(
  req: AIImageRequest,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>,
  origin: string | null
): Promise<Response> {
  const logPrefix = "[ai-image]";
  const startTime = Date.now();
  console.log(`${logPrefix} Starting image generation for project: ${req.projectId}`);

  try {
    // 1. Verify project access
    await assertProjectAccess(supabase, req.projectId, billing.userId);

    // 2. Verify entity if provided and get entity type
    let entityType: string | null = null;
    if (req.entityId) {
      const entity = await assertEntityInProject(supabase, req.entityId, req.projectId);
      entityType = entity.type;
    }

    // 3. Build the generation prompt
    const prompt = req.promptOverride ?? buildImagePrompt({
      subject: req.subject,
      entityName: req.entityName,
      visualDescription: req.visualDescription,
      style: req.style ?? "fantasy_art",
      aspectRatio: req.aspectRatio ?? "3:4",
      negativePrompt: req.negativePrompt,
    });

    console.log(`${logPrefix} Generating with prompt: ${prompt.slice(0, 100)}...`);

    // 3b. Check cache for existing identical generation
    const style = req.style ?? "fantasy_art";
    const aspectRatio = req.aspectRatio ?? "3:4";
    const cacheHash = await generateCacheHash({
      projectId: req.projectId,
      prompt,
      style,
      aspectRatio,
    });

    console.log(`${logPrefix} Cache hash: ${cacheHash.slice(0, 8)}...`);

    // Try to acquire cache lock (prevents duplicate generations)
    const { data: lockResult } = await supabase.rpc("try_cache_lock", {
      p_project_id: req.projectId,
      p_generation_hash: cacheHash,
      p_ttl_seconds: CACHE_LOCK_TTL_SECONDS,
    });
    let lockAcquired = lockResult === true;

    if (lockAcquired) {
      console.log(`${logPrefix} Lock acquired, checking cache...`);
    } else {
      console.log(`${logPrefix} Lock unavailable, waiting for cached result...`);
    }

    try {
      let cached = await lookupCachedAsset(supabase, req.projectId, cacheHash, logPrefix);
      if (!cached && !lockAcquired) {
        cached = await waitForCachedAsset(supabase, req.projectId, cacheHash, logPrefix);
      }

      if (cached) {
        console.log(`${logPrefix} Cache HIT: ${cached.id}`);

        // Refresh signed URL (may have expired)
        const refreshedUrl = await refreshSignedUrl(supabase, cached.storage_path);
        if (refreshedUrl) {
          // Update cache hit counter
          await supabase.rpc("record_cache_hit", { p_asset_id: cached.id });

          // Update public_url in DB with refreshed URL
          await supabase
            .from("project_assets")
            .update({ public_url: refreshedUrl })
            .eq("id", cached.id);

          // Update entity portrait if requested
          const setAsPortrait = req.setAsPortrait !== false;
          if (setAsPortrait && req.entityId) {
            await supabase
              .from("entities")
              .update({
                portrait_url: refreshedUrl,
                portrait_asset_id: cached.id,
              })
              .eq("id", req.entityId)
              .eq("project_id", req.projectId);
          }

          // Record AI request (cached hit - 0 tokens)
          try {
            await recordAIRequest(supabase, billing, {
              endpoint: "image",
              model: "cache-hit",
              modelType: "cache",
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
              success: true,
              latencyMs: Date.now() - startTime,
              metadata: { cached: true, cacheHitCount: (cached.cache_hit_count ?? 0) + 1 },
            });
          } catch (e) {
            console.warn(`${logPrefix} Failed to record cached AI request:`, e);
          }

          // Release lock
          if (lockAcquired) {
            await supabase.rpc("release_cache_lock", {
              p_project_id: req.projectId,
              p_generation_hash: cacheHash,
            });
          }

          const response: AIImageResponse = {
            assetId: cached.id,
            storagePath: cached.storage_path,
            imageUrl: refreshedUrl,
            entityId: req.entityId,
            cached: true,
            cacheHitCount: (cached.cache_hit_count ?? 0) + 1,
          };

          return createSuccessResponse(response, origin);
        } else {
          console.warn(`${logPrefix} Cached asset URL refresh failed, regenerating...`);
        }
      }

      if (!lockAcquired) {
        const { data: retryLock } = await supabase.rpc("try_cache_lock", {
          p_project_id: req.projectId,
          p_generation_hash: cacheHash,
          p_ttl_seconds: CACHE_LOCK_TTL_SECONDS,
        });
        lockAcquired = retryLock === true;
        if (lockAcquired) {
          console.log(`${logPrefix} Lock acquired after wait, generating new image...`);
        } else {
          return createErrorResponse(
            ErrorCode.RATE_LIMITED,
            "Image generation already in progress. Please retry shortly.",
            origin
          );
        }
      }

      console.log(`${logPrefix} Cache MISS, generating new image...`);
    } catch (cacheError) {
      // Cache check failure is non-fatal - continue with generation
      console.warn(`${logPrefix} Cache check failed (continuing):`, cacheError);
    }

    // 4. Get API keys
    const openRouterKey = billing.apiKey; // OpenRouter is primary
    const geminiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? null;

    // 5. Generate image with fallback
    const generated = await generateImageWithFallback(
      prompt,
      openRouterKey,
      geminiKey,
      logPrefix
    );

    // Validate size
    if (generated.uint8Array.length > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image too large: ${Math.round(generated.uint8Array.length / 1024 / 1024)}MB exceeds 10MB limit`);
    }

    console.log(`${logPrefix} Image generated (${generated.mimeType}, ${generated.uint8Array.length} bytes), uploading...`);

    // 6. Prepare for upload
    const ext = getExtFromMimeType(generated.mimeType);
    const storagePath = generateStoragePath(req.projectId, req.entityId, ext);

    // 7. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, generated.uint8Array, {
        contentType: generated.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`${logPrefix} Storage upload failed:`, uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    console.log(`${logPrefix} Uploaded to: ${storagePath}`);

    let uploadedPath: string | null = storagePath;

    try {
      // 8. Create signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error(`${logPrefix} Failed to create signed URL:`, signedUrlError);
        throw new Error("Failed to create signed URL");
      }

      const signedUrl = signedUrlData.signedUrl;

      // 9. Create project_assets record
      const assetType = req.assetType ?? (req.entityId ? "portrait" : "other");
      const { data: assetData, error: assetError } = await supabase
        .from("project_assets")
        .insert({
          project_id: req.projectId,
          entity_id: req.entityId ?? null,
          asset_type: assetType,
          storage_path: storagePath,
          public_url: signedUrl,
          generation_prompt: prompt,
          generation_model: generated.model,
          generation_params: {
            style,
            aspectRatio,
            subject: req.subject,
          },
          generation_hash: cacheHash,
          mime_type: generated.mimeType,
        })
        .select("id")
        .single();

      if (assetError || !assetData) {
        console.error(`${logPrefix} Failed to create asset record:`, assetError);
        throw new Error("Failed to save asset record");
      }

      const assetId = assetData.id;
      console.log(`${logPrefix} Created asset record: ${assetId}`);

      uploadedPath = null;

      // 10. Update entity portrait if requested
      const setAsPortrait = req.setAsPortrait !== false;
      if (setAsPortrait && req.entityId) {
        const { error: updateError } = await supabase
          .from("entities")
          .update({
            portrait_url: signedUrl,
            portrait_asset_id: assetId,
          })
          .eq("id", req.entityId)
          .eq("project_id", req.projectId);

        if (updateError) {
          console.warn(`${logPrefix} Failed to update entity portrait:`, updateError);
        } else {
          console.log(`${logPrefix} Updated entity portrait: ${req.entityId}`);
        }
      }

      // 11. Generate CLIP embedding and sync to Qdrant (non-blocking failure)
      try {
        if (isClipConfigured() && isQdrantConfigured()) {
          console.log(`${logPrefix} Generating CLIP embedding...`);

          // Convert image bytes to base64
          const imageBase64 = uint8ArrayToBase64(generated.uint8Array);

          // Generate CLIP embedding
          const clipResult = await generateClipImageEmbedding(imageBase64, {
            mimeType: generated.mimeType,
          });

          console.log(`${logPrefix} CLIP embedding generated (${clipResult.embedding.length} dims)`);

          // Prepare Qdrant payload (snake_case keys)
          const qdrantPayload = {
            project_id: req.projectId,
            asset_id: assetId,
            entity_id: req.entityId ?? null,
            entity_type: entityType,
            asset_type: assetType,
            style: req.style ?? null,
            storage_path: storagePath,
            public_url: signedUrl,
            created_at: new Date().toISOString(),
          };

          // Upsert to Qdrant saga_images collection
          await upsertPoints(
            [
              {
                id: assetId,
                vector: clipResult.embedding,
                payload: qdrantPayload,
              },
            ],
            { collection: "saga_images" }
          );

          console.log(`${logPrefix} Synced to Qdrant saga_images collection`);

          // Update project_assets with CLIP embedding and sync status
          const { error: clipUpdateError } = await supabase
            .from("project_assets")
            .update({
              clip_embedding: toPgVector(clipResult.embedding),
              clip_sync_status: "synced",
              clip_synced_at: new Date().toISOString(),
              clip_last_error: null,
            })
            .eq("id", assetId);

          if (clipUpdateError) {
            console.warn(`${logPrefix} Failed to update CLIP columns:`, clipUpdateError);
          }
        } else {
          console.log(`${logPrefix} CLIP/Qdrant not configured, skipping embedding sync`);
        }
      } catch (clipError) {
        // CLIP failure is non-fatal - log and update status
        console.error(`${logPrefix} CLIP sync failed:`, clipError);
        try {
          await supabase
            .from("project_assets")
            .update({
              clip_sync_status: "error",
              clip_last_error: clipError instanceof Error ? clipError.message : String(clipError),
            })
            .eq("id", assetId);
        } catch (updateErr) {
          console.error(`${logPrefix} Failed to update CLIP error status:`, updateErr);
        }
      }

      // 12. Record AI request
      try {
        await recordAIRequest(supabase, billing, {
          endpoint: "image",
          model: generated.model,
          modelType: "image",
          usage: {
            promptTokens: generated.usage?.promptTokens ?? 0,
            completionTokens: generated.usage?.completionTokens ?? 0,
            totalTokens: generated.usage?.totalTokens ?? 0,
          },
          success: true,
          latencyMs: Date.now() - startTime,
        });
      } catch (e) {
        console.warn(`${logPrefix} Failed to record AI request:`, e);
      }

      // 13. Return success response
      const response: AIImageResponse = {
        assetId,
        storagePath,
        imageUrl: signedUrl,
        entityId: req.entityId,
      };

      console.log(`${logPrefix} Image generation complete`);

      // Release cache lock
      if (lockAcquired) {
        try {
          await supabase.rpc("release_cache_lock", {
            p_project_id: req.projectId,
            p_generation_hash: cacheHash,
          });
        } catch (e) {
          console.warn(`${logPrefix} Failed to release cache lock:`, e);
        }
      }

      return createSuccessResponse(response, origin);

    } catch (error) {
      // Release cache lock on error
      if (lockAcquired) {
        try {
          await supabase.rpc("release_cache_lock", {
            p_project_id: req.projectId,
            p_generation_hash: cacheHash,
          });
        } catch (e) {
          console.warn(`${logPrefix} Failed to release cache lock:`, e);
        }
      }
      if (uploadedPath) {
        await cleanupStorageBlob(supabase, uploadedPath, logPrefix);
      }
      throw error;
    }

  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    return handleAIError(error, origin, { providerName: "ai-image" });
  }
}

// =============================================================================
// Scene Illustration Handler
// =============================================================================

/**
 * Fetch portrait image data for character references.
 */
async function fetchPortraitData(
  supabase: ReturnType<typeof createSupabaseClient>,
  portraitUrl: string,
  logPrefix: string
): Promise<string | null> {
  try {
    // Try to download from storage if it's a signed URL
    const response = await fetch(portraitUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`${logPrefix} Failed to fetch portrait: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = uint8ArrayToBase64(bytes);
    const contentType = response.headers.get("content-type") || "image/png";

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.warn(`${logPrefix} Failed to fetch portrait data:`, error);
    return null;
  }
}

/**
 * Build scene illustration prompt with character context.
 */
function buildScenePrompt(
  sceneText: string,
  characterNames: string[],
  style: ImageStyle,
  sceneFocus: SceneFocus,
  negativePrompt?: string
): string {
  const parts: string[] = [];

  // Scene description
  parts.push(`Illustrate this scene: ${sceneText}`);

  // Characters
  if (characterNames.length > 0) {
    parts.push(`Characters present: ${characterNames.join(", ")}`);
  }

  // Style
  parts.push(STYLE_PROMPTS[style]);

  // Scene focus composition
  parts.push(SCENE_FOCUS_PROMPTS[sceneFocus]);

  // Always add quality guidance
  parts.push("high quality, detailed, cinematic");
  parts.push("no text, no watermarks, no signatures, no speech bubbles");

  // Negative prompt
  if (negativePrompt) {
    parts.push(`avoid: ${negativePrompt}`);
  }

  return parts.join(", ");
}

/**
 * Handle scene illustration request (Phase 4).
 */
async function handleIllustrateScene(
  req: SceneRequest,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>,
  origin: string | null
): Promise<Response> {
  const logPrefix = "[ai-image:scene]";
  const startTime = Date.now();
  console.log(`${logPrefix} Starting scene illustration for project: ${req.projectId}`);

  try {
    // 1. Verify project access
    await assertProjectAccess(supabase, req.projectId, billing.userId);

    // 2. Process character references
    const charactersIncluded: SceneCharacter[] = [];
    const portraitDataUrls: string[] = [];
    const characterNames: string[] = [];

    if (req.characterReferences && req.characterReferences.length > 0) {
      // Limit to MAX_CHARACTER_REFS to control payload size
      const refs = req.characterReferences.slice(0, MAX_CHARACTER_REFS);

      // Process all character references in parallel
      const processedRefs = await Promise.all(
        refs.map(async (ref) => {
          let hasPortrait = false;
          let portraitData: string | null = null;

          // Verify entity belongs to project
          if (ref.entityId) {
            try {
              await assertEntityInProject(supabase, ref.entityId, req.projectId);

              // Fetch portrait data if URL provided
              if (ref.portraitUrl) {
                portraitData = await fetchPortraitData(supabase, ref.portraitUrl, logPrefix);
                if (portraitData) {
                  hasPortrait = true;
                }
              }
            } catch (e) {
              console.warn(`${logPrefix} Character ${ref.name} entity validation failed:`, e);
            }
          }

          return {
            name: ref.name,
            entityId: ref.entityId,
            hasPortrait,
            portraitData,
          };
        })
      );

      // Collect results from parallel processing
      for (const processed of processedRefs) {
        characterNames.push(processed.name);
        if (processed.portraitData) {
          portraitDataUrls.push(processed.portraitData);
        }
        charactersIncluded.push({
          name: processed.name,
          entityId: processed.entityId,
          hadPortraitReference: processed.hasPortrait,
        });
      }
    }

    console.log(`${logPrefix} Processing ${charactersIncluded.length} characters, ${portraitDataUrls.length} with portraits`);

    // 3. Build the generation prompt
    const style = req.style ?? "fantasy_art";
    const sceneFocus = req.sceneFocus ?? "dramatic";
    const prompt = buildScenePrompt(
      req.sceneText,
      characterNames,
      style,
      sceneFocus,
      req.negativePrompt
    );

    console.log(`${logPrefix} Generating with prompt: ${prompt.slice(0, 100)}...`);

    // 4. Get API keys
    const openRouterKey = billing.apiKey;
    const geminiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? null;

    // 5. Generate image
    // If we have portrait references, use multimodal with images
    let generated: GeneratedImage;

    if (portraitDataUrls.length > 0 && openRouterKey) {
      // Use multimodal generation with portrait references
      console.log(`${logPrefix} Using multimodal generation with ${portraitDataUrls.length} portrait refs`);
      try {
        const openRouter = createDynamicOpenRouter(openRouterKey);

        // Build message with images and text
        const content: Array<{ type: "text" | "image"; text?: string; image?: string }> = [];
        
        // Add portrait references first
        for (const dataUrl of portraitDataUrls) {
          content.push({ type: "image", image: dataUrl });
        }
        
        // Add the prompt
        content.push({
          type: "text",
          text: `Using the character portraits above as visual references for consistency, ${prompt}`,
        });

        const result = await generateText({
          model: openRouter(OPENROUTER_IMAGE_MODEL),
          messages: [{ role: "user", content }],
          abortSignal: AbortSignal.timeout(IMAGE_GEN_TIMEOUT_MS),
        });

        const imageFile = result.files?.find((f) => f.mediaType.startsWith("image/"));
        if (imageFile) {
          generated = {
            uint8Array: imageFile.uint8Array,
            mimeType: imageFile.mediaType,
            model: OPENROUTER_IMAGE_MODEL,
            usage: result.usage,
          };
        } else {
          throw new Error("No image in multimodal response");
        }
      } catch (error) {
        console.warn(`${logPrefix} Multimodal generation failed, falling back to text-only:`, error);
        generated = await generateImageWithFallback(prompt, openRouterKey, geminiKey, logPrefix);
      }
    } else {
      // Standard text-only generation
      generated = await generateImageWithFallback(prompt, openRouterKey, geminiKey, logPrefix);
    }

    // Validate size
    if (generated.uint8Array.length > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image too large: ${Math.round(generated.uint8Array.length / 1024 / 1024)}MB exceeds 10MB limit`);
    }

    console.log(`${logPrefix} Image generated (${generated.mimeType}, ${generated.uint8Array.length} bytes), uploading...`);

    // 6. Prepare for upload
    const ext = getExtFromMimeType(generated.mimeType);
    const storagePath = generateStoragePath(req.projectId, undefined, ext);

    // 7. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, generated.uint8Array, {
        contentType: generated.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`${logPrefix} Storage upload failed:`, uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    console.log(`${logPrefix} Uploaded to: ${storagePath}`);

    let uploadedPath: string | null = storagePath;

    try {
      // 8. Create signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error("Failed to create signed URL");
      }

      const signedUrl = signedUrlData.signedUrl;

      // 9. Create project_assets record
      const assetType = req.assetType ?? "scene";
      const { data: assetData, error: assetError } = await supabase
        .from("project_assets")
        .insert({
          project_id: req.projectId,
          entity_id: null, // Scenes aren't tied to single entity
          asset_type: assetType,
          storage_path: storagePath,
          public_url: signedUrl,
          generation_prompt: prompt,
          generation_model: generated.model,
          generation_params: {
            kind: "scene",
            style,
            aspectRatio: req.aspectRatio ?? "16:9",
            sceneFocus,
            sceneText: req.sceneText.slice(0, 500),
            characterNames,
          },
          mime_type: generated.mimeType,
        })
        .select("id")
        .single();

      if (assetError || !assetData) {
        console.error(`${logPrefix} Failed to create asset record:`, assetError);
        throw new Error("Failed to save asset record");
      }

      const assetId = assetData.id;
      console.log(`${logPrefix} Created asset record: ${assetId}`);

      uploadedPath = null;

      // 10. CLIP embedding and Qdrant sync
      try {
        if (isClipConfigured() && isQdrantConfigured()) {
          console.log(`${logPrefix} Generating CLIP embedding...`);

          const imageBase64 = uint8ArrayToBase64(generated.uint8Array);
          const clipResult = await generateClipImageEmbedding(imageBase64, {
            mimeType: generated.mimeType,
          });

          const qdrantPayload = {
            project_id: req.projectId,
            asset_id: assetId,
            entity_id: null,
            entity_type: null,
            asset_type: assetType,
            style: style,
            storage_path: storagePath,
            public_url: signedUrl,
            created_at: new Date().toISOString(),
          };

          await upsertPoints(
            [{ id: assetId, vector: clipResult.embedding, payload: qdrantPayload }],
            { collection: "saga_images" }
          );

          console.log(`${logPrefix} Synced to Qdrant saga_images collection`);

          await supabase
            .from("project_assets")
            .update({
              clip_embedding: toPgVector(clipResult.embedding),
              clip_sync_status: "synced",
              clip_synced_at: new Date().toISOString(),
              clip_last_error: null,
            })
            .eq("id", assetId);
        }
      } catch (clipError) {
        console.error(`${logPrefix} CLIP sync failed:`, clipError);
        try {
          await supabase
            .from("project_assets")
            .update({
              clip_sync_status: "error",
              clip_last_error: clipError instanceof Error ? clipError.message : String(clipError),
            })
            .eq("id", assetId);
        } catch (e) {
          console.error(`${logPrefix} Failed to update CLIP error status:`, e);
        }
      }

      // 11. Record AI request
      try {
        await recordAIRequest(supabase, billing, {
          endpoint: "image-scene",
          model: generated.model,
          modelType: "image",
          usage: {
            promptTokens: generated.usage?.promptTokens ?? 0,
            completionTokens: generated.usage?.completionTokens ?? 0,
            totalTokens: generated.usage?.totalTokens ?? 0,
          },
          success: true,
          latencyMs: Date.now() - startTime,
        });
      } catch (e) {
        console.warn(`${logPrefix} Failed to record AI request:`, e);
      }

      // 12. Build scene description
      const sceneDescription = req.sceneText.length > 100
        ? req.sceneText.slice(0, 100) + "..."
        : req.sceneText;

      // 13. Return success response
      const response: SceneResponse = {
        assetId,
        storagePath,
        imageUrl: signedUrl,
        sceneDescription,
        charactersIncluded,
      };

      console.log(`${logPrefix} Scene illustration complete`);
      return createSuccessResponse(response, origin);

    } catch (error) {
      if (uploadedPath) {
        await cleanupStorageBlob(supabase, uploadedPath, logPrefix);
      }
      throw error;
    }

  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    return handleAIError(error, origin, { providerName: "ai-image-scene" });
  }
}

// =============================================================================
// Image Edit Handler
// =============================================================================

/**
 * Handle image edit request.
 * Downloads existing asset, applies multimodal edit, stores as new asset.
 */
async function handleEditImage(
  req: EditRequest,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>,
  origin: string | null
): Promise<Response> {
  const logPrefix = "[ai-image:edit]";
  const startTime = Date.now();

  console.log(`${logPrefix} Starting image edit for project: ${req.projectId}, asset: ${req.assetId}`);

  try {
    // 1) Verify project access
    await assertProjectAccess(supabase, req.projectId, billing.userId);

    // 2) Fetch the source asset (must belong to project)
    const { data: sourceAsset, error: sourceErr } = await supabase
      .from("project_assets")
      .select("id, entity_id, asset_type, storage_path, mime_type, generation_prompt, generation_params")
      .eq("id", req.assetId)
      .eq("project_id", req.projectId)
      .single();

    if (sourceErr || !sourceAsset) {
      console.error(`${logPrefix} Source asset lookup failed:`, sourceErr);
      throw new Error("Source asset not found in project");
    }

    const entityId = sourceAsset.entity_id ?? undefined;

    // 3) Determine defaults from source
    const srcParams = (sourceAsset.generation_params ?? {}) as Record<string, unknown>;
    const srcStyle = typeof srcParams.style === "string" ? (srcParams.style as ImageStyle) : undefined;
    const srcAspectRatio =
      typeof srcParams.aspectRatio === "string" ? (srcParams.aspectRatio as AspectRatio) : undefined;

    const preserveAspectRatio = req.preserveAspectRatio !== false;
    const style = req.style ?? srcStyle ?? "fantasy_art";
    const aspectRatio = preserveAspectRatio
      ? (srcAspectRatio ?? req.aspectRatio)
      : (req.aspectRatio ?? srcAspectRatio);

    const assetType: AssetType =
      req.assetType ?? (sourceAsset.asset_type as AssetType | null) ?? (entityId ? "portrait" : "other");

    const editMode = req.editMode ?? "remix";

    // 4) Download source image as data URL
    const source = await downloadAssetAsDataUrl(
      supabase,
      sourceAsset.storage_path,
      sourceAsset.mime_type ?? null,
      logPrefix
    );

    // 5) Build edit prompt text
    const prompt = buildEditPrompt({
      editInstruction: req.editInstruction,
      editMode,
      style,
      aspectRatio,
      originalPrompt: sourceAsset.generation_prompt ?? undefined,
      negativePrompt: req.negativePrompt,
    });

    console.log(`${logPrefix} Editing prompt: ${prompt.slice(0, 120)}...`);

    // 6) Generate edited image (multimodal: reference image + instruction)
    const openRouterKey = billing.apiKey;
    const geminiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? null;

    const content: Array<{ type: "text" | "image"; text?: string; image?: string }> = [
      { type: "image", image: source.dataUrl },
      { type: "text", text: prompt },
    ];

    const generated = await generateImageWithFallbackFromContent(content, openRouterKey, geminiKey, logPrefix);

    if (generated.uint8Array.length > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(
        `Edited image too large: ${Math.round(generated.uint8Array.length / 1024 / 1024)}MB exceeds 10MB limit`
      );
    }

    // 7) Upload edited image
    const ext = getExtFromMimeType(generated.mimeType);
    const storagePath = generateStoragePath(req.projectId, entityId, ext);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, generated.uint8Array, {
        contentType: generated.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`${logPrefix} Storage upload failed:`, uploadError);
      throw new Error(`Failed to upload edited image: ${uploadError.message}`);
    }

    let uploadedPath: string | null = storagePath;

    try {
      // 8) Signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error("Failed to create signed URL");
      }

      const signedUrl = signedUrlData.signedUrl;

      // 9) Insert new project_assets row (non-destructive)
      const insertPayload: Record<string, unknown> = {
        project_id: req.projectId,
        entity_id: entityId ?? null,
        asset_type: assetType,
        storage_path: storagePath,
        public_url: signedUrl,
        generation_prompt: prompt,
        generation_model: generated.model,
        generation_params: {
          kind: "edit",
          parentAssetId: req.assetId,
          editMode,
          editInstruction: req.editInstruction.slice(0, 500),
          style,
          aspectRatio: aspectRatio ?? null,
          preserveAspectRatio,
        },
        mime_type: generated.mimeType,
        parent_asset_id: req.assetId,
      };

      const { data: assetData, error: assetError } = await supabase
        .from("project_assets")
        .insert(insertPayload)
        .select("id")
        .single();

      if (assetError || !assetData) {
        console.error(`${logPrefix} Failed to create edited asset record:`, assetError);
        throw new Error("Failed to save edited asset record");
      }

      const newAssetId = assetData.id as string;
      uploadedPath = null;

      // 10) Update entity portrait if requested
      const setAsPortrait = req.setAsPortrait !== false;
      if (setAsPortrait && entityId) {
        const { error: updateError } = await supabase
          .from("entities")
          .update({
            portrait_url: signedUrl,
            portrait_asset_id: newAssetId,
          })
          .eq("id", entityId)
          .eq("project_id", req.projectId);

        if (updateError) {
          console.warn(`${logPrefix} Failed to update entity portrait:`, updateError);
        }
      }

      // 11) CLIP embedding + Qdrant (non-fatal)
      try {
        if (isClipConfigured() && isQdrantConfigured()) {
          const imageBase64 = uint8ArrayToBase64(generated.uint8Array);
          const clipResult = await generateClipImageEmbedding(imageBase64, { mimeType: generated.mimeType });

          const qdrantPayload = {
            project_id: req.projectId,
            asset_id: newAssetId,
            parent_asset_id: req.assetId,
            entity_id: entityId ?? null,
            entity_type: null,
            asset_type: assetType,
            style: style ?? null,
            storage_path: storagePath,
            public_url: signedUrl,
            created_at: new Date().toISOString(),
          };

          await upsertPoints(
            [{ id: newAssetId, vector: clipResult.embedding, payload: qdrantPayload }],
            { collection: "saga_images" }
          );

          await supabase
            .from("project_assets")
            .update({
              clip_embedding: toPgVector(clipResult.embedding),
              clip_sync_status: "synced",
              clip_synced_at: new Date().toISOString(),
              clip_last_error: null,
            })
            .eq("id", newAssetId);
        }
      } catch (clipError) {
        console.error(`${logPrefix} CLIP sync failed:`, clipError);
        try {
          await supabase
            .from("project_assets")
            .update({
              clip_sync_status: "error",
              clip_last_error: clipError instanceof Error ? clipError.message : String(clipError),
            })
            .eq("id", newAssetId);
        } catch (e) {
          console.error(`${logPrefix} Failed to update CLIP error status:`, e);
        }
      }

      // 12) Record AI request
      try {
        await recordAIRequest(supabase, billing, {
          endpoint: "image-edit",
          model: generated.model,
          modelType: "image",
          usage: {
            promptTokens: generated.usage?.promptTokens ?? 0,
            completionTokens: generated.usage?.completionTokens ?? 0,
            totalTokens: generated.usage?.totalTokens ?? 0,
          },
          success: true,
          latencyMs: Date.now() - startTime,
        });
      } catch (e) {
        console.warn(`${logPrefix} Failed to record AI request:`, e);
      }

      return createSuccessResponse(
        {
          assetId: newAssetId,
          storagePath,
          imageUrl: signedUrl,
          entityId,
          parentAssetId: req.assetId,
        },
        origin
      );
    } catch (error) {
      if (uploadedPath) {
        await cleanupStorageBlob(supabase, uploadedPath, logPrefix);
      }
      throw error;
    }
  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    return handleAIError(error, origin, { providerName: "ai-image-edit" });
  }
}

// =============================================================================
// Delete Handler
// =============================================================================

interface DeleteAssetRequest {
  assetId: string;
  projectId: string;
}

async function handleDeleteAsset(
  req: Request,
  origin: string | null
): Promise<Response> {
  const logPrefix = "[ai-image:delete]";

  try {
    const body = await req.json() as DeleteAssetRequest;

    if (!body.assetId || !body.projectId) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "assetId and projectId are required",
        origin
      );
    }

    const supabase = createSupabaseClient();
    const billing = await checkBillingAndGetKey(req, supabase, {
      endpoint: "image",
      allowAnonymousTrial: false,
    });

    if (!billing.canProceed || !billing.userId) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        "Authentication required",
        origin
      );
    }

    // Verify project access
    await assertProjectAccess(supabase, body.projectId, billing.userId);

    // Verify asset belongs to project and is not already deleted
    const { data: asset, error: assetError } = await supabase
      .from("project_assets")
      .select("id, project_id")
      .eq("id", body.assetId)
      .eq("project_id", body.projectId)
      .is("deleted_at", null)
      .single();

    if (assetError || !asset) {
      return createErrorResponse(ErrorCode.NOT_FOUND, "Asset not found", origin);
    }

    // Soft delete via RPC
    const { error: deleteError } = await supabase.rpc("soft_delete_asset", {
      p_asset_id: body.assetId,
    });

    if (deleteError) {
      console.error(`${logPrefix} Soft delete failed:`, deleteError);
      return createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        "Failed to delete asset",
        origin
      );
    }

    console.log(`${logPrefix} Soft deleted asset: ${body.assetId}`);

    return createSuccessResponse({ deleted: true, assetId: body.assetId }, origin);
  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    return handleAIError(error, origin, { providerName: "ai-image-delete" });
  }
}

// =============================================================================
// Serve
// =============================================================================

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Handle DELETE requests for soft delete
  if (req.method === "DELETE") {
    return handleDeleteAsset(req, origin);
  }

  if (req.method !== "POST") {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, "Method not allowed", origin);
  }

  try {
    const body = await req.json() as AIImageRequest;

    // Validate required fields
    if (!body.projectId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, "projectId is required", origin);
    }

    // Check billing
    const supabase = createSupabaseClient();
    const billing = await checkBillingAndGetKey(req, supabase, {
      endpoint: "image",
      allowAnonymousTrial: false,
    });

    if (!billing.canProceed) {
      return createErrorResponse(ErrorCode.FORBIDDEN, billing.error ?? "Billing check failed", origin, { errorCode: billing.errorCode });
    }

    if (!billing.apiKey && !Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY")) {
      return createErrorResponse(ErrorCode.FORBIDDEN, "API key required for image generation", origin);
    }

    // Route to appropriate handler
    if (isSceneRequest(body)) {
      // Scene illustration request
      if (!body.sceneText) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, "sceneText is required for scene generation", origin);
      }
      if (body.sceneText.length > MAX_SCENE_TEXT_LENGTH) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, `sceneText exceeds ${MAX_SCENE_TEXT_LENGTH} characters`, origin);
      }
      return handleIllustrateScene(body, billing, supabase, origin);
    } else if (isEditRequest(body)) {
      // Image edit request
      if (!body.assetId) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, "assetId is required for image editing", origin);
      }
      if (!body.editInstruction) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, "editInstruction is required for image editing", origin);
      }
      if (body.editInstruction.length > MAX_EDIT_INSTRUCTION_LENGTH) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `editInstruction exceeds ${MAX_EDIT_INSTRUCTION_LENGTH} characters`,
          origin
        );
      }
      return handleEditImage(body, billing, supabase, origin);
    } else {
      // Standard generate request
      if (!body.subject) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, "subject is required", origin);
      }
      if (body.subject.length > MAX_SUBJECT_LENGTH) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, `subject exceeds ${MAX_SUBJECT_LENGTH} characters`, origin);
      }
      if (body.promptOverride && body.promptOverride.length > MAX_PROMPT_LENGTH) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, `promptOverride exceeds ${MAX_PROMPT_LENGTH} characters`, origin);
      }
      if (body.visualDescription && body.visualDescription.length > MAX_VISUAL_DESC_LENGTH) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, `visualDescription exceeds ${MAX_VISUAL_DESC_LENGTH} characters`, origin);
      }
      return handleGenerateImage(body, billing, supabase, origin);
    }

  } catch (error) {
    console.error("[ai-image] Handler error:", error);
    return handleAIError(error, origin);
  }
});
