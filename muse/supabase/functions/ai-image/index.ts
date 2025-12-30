/**
 * AI Image Generation Edge Function
 *
 * Generates AI images using OpenRouter SDK with multimodal image generation.
 * Stores images in Supabase Storage and creates project_assets records.
 *
 * @module ai-image
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import OpenRouter from "https://esm.sh/@openrouter/sdk@latest";
import { handleCorsPreFlight, getCorsHeaders } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  ErrorCode,
} from "../_shared/errors.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  type BillingCheck,
} from "../_shared/billing.ts";
import {
  buildImagePrompt,
  STYLE_PROMPTS,
  type GenerateImageArgs,
} from "../_shared/tools/generate-image.ts";
import type { ImageStyle, AspectRatio, AssetType } from "../_shared/tools/types.ts";

// =============================================================================
// Types
// =============================================================================

interface AIImageRequest {
  /** Project ID (required for storage path and DB records) */
  projectId: string;
  /** Entity ID to link the image to (optional) */
  entityId?: string;
  /** Asset type for classification */
  assetType?: AssetType;
  /** Main subject description */
  subject: string;
  /** Entity name for context */
  entityName?: string;
  /** Visual description from entity */
  visualDescription?: string;
  /** Art style preset */
  style?: ImageStyle;
  /** Aspect ratio */
  aspectRatio?: AspectRatio;
  /** Whether to set as entity portrait (default: true if entityId provided) */
  setAsPortrait?: boolean;
  /** Pre-built prompt (overrides subject/style/etc) */
  promptOverride?: string;
  /** Negative prompt */
  negativePrompt?: string;
}

interface AIImageResponse {
  /** Generated asset ID */
  assetId: string;
  /** Storage path in bucket */
  storagePath: string;
  /** Signed URL for the image */
  imageUrl: string;
  /** Entity ID if portrait was set */
  entityId?: string;
}

// =============================================================================
// Constants
// =============================================================================

const IMAGE_MODEL = "google/gemini-2.5-flash-preview-05-20";
const STORAGE_BUCKET = "project-assets";
const SIGNED_URL_EXPIRY_SECONDS = 365 * 24 * 60 * 60; // 1 year

// =============================================================================
// Helpers
// =============================================================================

/**
 * Decode base64 data URL to Uint8Array
 */
function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string; ext: string } {
  // Extract mime type and base64 data
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid data URL format");
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  // Decode base64
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Determine extension
  const ext = mimeType.includes("png") ? "png" :
              mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" :
              mimeType.includes("webp") ? "webp" : "png";

  return { bytes, mimeType, ext };
}

/**
 * Generate storage path for the image
 */
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
 * Verify project access for a user
 */
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
    // Check if user is a collaborator
    const { data: collab, error: collabError } = await supabase
      .from("project_collaborators")
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
 * Verify entity belongs to project
 */
async function assertEntityInProject(
  supabase: ReturnType<typeof createSupabaseClient>,
  entityId: string,
  projectId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("entities")
    .select("id")
    .eq("id", entityId)
    .eq("project_id", projectId)
    .single();

  if (error || !data) {
    throw new Error("Entity not found in project");
  }
}

// =============================================================================
// Main Handler
// =============================================================================

async function handleGenerateImage(
  req: AIImageRequest,
  apiKey: string,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>,
  origin: string | null
): Promise<Response> {
  const logPrefix = "[ai-image]";
  console.log(`${logPrefix} Starting image generation for project: ${req.projectId}`);

  try {
    // 1. Verify project access
    await assertProjectAccess(supabase, req.projectId, billing.userId);

    // 2. Verify entity if provided
    if (req.entityId) {
      await assertEntityInProject(supabase, req.entityId, req.projectId);
    }

    // 3. Build the generation prompt
    const prompt = req.promptOverride ?? buildImagePrompt({
      subject: req.subject,
      entityName: req.entityName,
      visualDescription: req.visualDescription,
      style: req.style,
      aspectRatio: req.aspectRatio,
      negativePrompt: req.negativePrompt,
    });

    console.log(`${logPrefix} Generating with prompt: ${prompt.slice(0, 100)}...`);

    // 4. Call OpenRouter for image generation
    const openRouter = new OpenRouter({ apiKey });
    
    const result = await openRouter.chat.send({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
      stream: false,
    });

    // 5. Extract image from response
    const message = result.choices?.[0]?.message;
    if (!message?.images?.length) {
      console.error(`${logPrefix} No image in response:`, JSON.stringify(result, null, 2));
      throw new Error("No image generated by the model");
    }

    const imageDataUrl = message.images[0].imageUrl?.url;
    if (!imageDataUrl) {
      throw new Error("Image URL not found in response");
    }

    console.log(`${logPrefix} Image generated, uploading to storage...`);

    // 6. Decode and prepare for upload
    const { bytes, mimeType, ext } = decodeDataUrl(imageDataUrl);
    const storagePath = generateStoragePath(req.projectId, req.entityId, ext);

    // 7. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`${logPrefix} Storage upload failed:`, uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    console.log(`${logPrefix} Uploaded to: ${storagePath}`);

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
        generation_model: IMAGE_MODEL,
        generation_params: {
          style: req.style ?? "fantasy_art",
          aspectRatio: req.aspectRatio ?? "3:4",
          subject: req.subject,
        },
        mime_type: mimeType,
      })
      .select("id")
      .single();

    if (assetError || !assetData) {
      console.error(`${logPrefix} Failed to create asset record:`, assetError);
      throw new Error("Failed to save asset record");
    }

    const assetId = assetData.id;
    console.log(`${logPrefix} Created asset record: ${assetId}`);

    // 10. Update entity portrait if requested
    const setAsPortrait = req.setAsPortrait !== false; // Default to true
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
        // Non-fatal - image was still generated and saved
      } else {
        console.log(`${logPrefix} Updated entity portrait: ${req.entityId}`);
      }
    }

    // 11. Return success response
    const response: AIImageResponse = {
      assetId,
      storagePath,
      imageUrl: signedUrl,
      entityId: req.entityId,
    };

    console.log(`${logPrefix} Image generation complete`);
    return createSuccessResponse(response, origin);

  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    return handleAIError(error, origin, { context: "image_generation" });
  }
}

// =============================================================================
// Serve
// =============================================================================

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only accept POST
  if (req.method !== "POST") {
    return createErrorResponse(
      ErrorCode.VALIDATION,
      "Method not allowed",
      origin
    );
  }

  try {
    // Parse request body
    const body = await req.json() as AIImageRequest;

    // Validate required fields
    if (!body.projectId) {
      return createErrorResponse(
        ErrorCode.VALIDATION,
        "projectId is required",
        origin
      );
    }

    if (!body.subject) {
      return createErrorResponse(
        ErrorCode.VALIDATION,
        "subject is required",
        origin
      );
    }

    // Check billing and get API key
    const supabase = createSupabaseClient();
    const billing = await checkBillingAndGetKey(req, supabase, {
      endpoint: "image" as any, // Will need to add to AIEndpoint union
      allowAnonymousTrial: false, // Image gen should require auth
    });

    if (!billing.canProceed) {
      return createErrorResponse(
        ErrorCode.BILLING,
        billing.error ?? "Billing check failed",
        origin,
        { errorCode: billing.errorCode }
      );
    }

    if (!billing.apiKey) {
      return createErrorResponse(
        ErrorCode.BILLING,
        "No API key available for image generation",
        origin
      );
    }

    // Handle image generation
    return handleGenerateImage(body, billing.apiKey, billing, supabase, origin);

  } catch (error) {
    console.error("[ai-image] Request error:", error);
    return handleAIError(error, origin);
  }
});
