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

type AIImageRequest = GenerateRequest | SceneRequest;

function isSceneRequest(req: AIImageRequest): req is SceneRequest {
  return req.kind === "scene";
}

interface AIImageResponse {
  assetId: string;
  storagePath: string;
  imageUrl: string;
  entityId?: string;
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
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
            style: req.style ?? "fantasy_art",
            aspectRatio: req.aspectRatio ?? "3:4",
            subject: req.subject,
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
      return createSuccessResponse(response, origin);

    } catch (error) {
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

      for (const ref of refs) {
        characterNames.push(ref.name);

        // Verify entity belongs to project
        let hasPortrait = false;
        if (ref.entityId) {
          try {
            await assertEntityInProject(supabase, ref.entityId, req.projectId);

            // Fetch portrait data if URL provided
            if (ref.portraitUrl) {
              const portraitData = await fetchPortraitData(supabase, ref.portraitUrl, logPrefix);
              if (portraitData) {
                portraitDataUrls.push(portraitData);
                hasPortrait = true;
              }
            }
          } catch (e) {
            console.warn(`${logPrefix} Character ${ref.name} entity validation failed:`, e);
          }
        }

        charactersIncluded.push({
          name: ref.name,
          entityId: ref.entityId,
          hadPortraitReference: hasPortrait,
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
// Serve
// =============================================================================

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
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
