/**
 * AI Image Analysis Edge Function
 *
 * Analyzes uploaded/reference images to extract visual details for entity creation.
 * Stores images, generates CLIP embeddings, and uses multimodal AI for analysis.
 *
 * Primary: OpenRouter with google/gemini-2.5-flash-image
 * Fallback: @ai-sdk/google with gemini-2.0-flash
 *
 * @module ai-image-analyze
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { generateObject } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
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
import { entityTypeSchema } from "../_shared/tools/types.ts";
import type { EntityType } from "../_shared/tools/types.ts";
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

type ExtractionFocus = "full" | "appearance" | "environment" | "object";

interface AIImageAnalyzeRequest {
  projectId: string;
  imageSource: string;
  entityTypeHint?: EntityType;
  extractionFocus?: ExtractionFocus;
  // API-level extension for composite flow:
  entityId?: string;
  setAsPortrait?: boolean;
}

interface VisualDescription {
  height?: string;
  build?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  skinTone?: string;
  distinguishingFeatures?: string[];
  clothing?: string;
  accessories?: string[];
  climate?: string;
  atmosphere?: string;
  category?: string;
  material?: string;
  artStyle?: string;
  mood?: string;
}

interface AIImageAnalyzeResponse {
  suggestedEntityType: EntityType;
  suggestedName?: string;
  visualDescription: VisualDescription;
  description: string;
  confidence: number;
  assetId?: string;
  imageUrl?: string;
}

// =============================================================================
// Constants
// =============================================================================

const OPENROUTER_VISION_MODEL = "google/gemini-2.5-flash-image";
const GEMINI_VISION_MODEL = "gemini-2.0-flash";

const STORAGE_BUCKET = "project-assets";
const SIGNED_URL_EXPIRY_SECONDS = 365 * 24 * 60 * 60; // 1 year
const ANALYSIS_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// =============================================================================
// Analysis Schema
// =============================================================================

const visualDescriptionSchema = z.object({
  // Character-specific
  height: z.string().optional().describe("Height description (e.g., 'tall', 'short', 'average')"),
  build: z.string().optional().describe("Body build (e.g., 'athletic', 'slender', 'stocky')"),
  hairColor: z.string().optional().describe("Hair color"),
  hairStyle: z.string().optional().describe("Hair style description"),
  eyeColor: z.string().optional().describe("Eye color"),
  skinTone: z.string().optional().describe("Skin tone description"),
  distinguishingFeatures: z.array(z.string()).optional().describe("Notable features like scars, tattoos"),
  clothing: z.string().optional().describe("Clothing description"),
  accessories: z.array(z.string()).optional().describe("Accessories like jewelry, weapons"),
  // Location-specific
  climate: z.string().optional().describe("Climate/weather of the location"),
  atmosphere: z.string().optional().describe("Mood/atmosphere of the location"),
  // Item-specific
  category: z.string().optional().describe("Item category (weapon, armor, artifact, etc.)"),
  material: z.string().optional().describe("Primary material"),
  // General
  artStyle: z.string().optional().describe("Detected art style"),
  mood: z.string().optional().describe("Overall mood/feeling"),
});

const analysisResultSchema = z.object({
  suggestedEntityType: z.enum([
    "character", "location", "item", "faction", "magic_system", "event", "concept"
  ]).describe("Most likely entity type based on image content"),
  suggestedName: z.string().optional().describe("Suggested name if visible or discernible"),
  visualDescription: visualDescriptionSchema,
  description: z.string().describe("Natural language description of the image (2-3 sentences)"),
  confidence: z.number().min(0).max(1).describe("Confidence in the analysis (0-1)"),
});

// =============================================================================
// Helpers
// =============================================================================

function generateStoragePath(projectId: string, entityId: string | undefined, ext: string): string {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID();
  const folder = entityId ?? "uploads";
  return `${projectId}/${folder}/${timestamp}-${uuid}.${ext}`;
}

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

function parseImageDataUrl(dataUrl: string): { mimeType: string; base64: string; bytes: Uint8Array } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL format");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return { mimeType, base64, bytes };
}

function getExtFromMimeType(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildAnalysisPrompt(focus: ExtractionFocus, typeHint?: EntityType): string {
  let focusInstruction = "";
  switch (focus) {
    case "appearance":
      focusInstruction = "Focus on physical appearance details: height, build, hair, eyes, skin, clothing, accessories.";
      break;
    case "environment":
      focusInstruction = "Focus on environmental details: climate, atmosphere, architecture, lighting, mood.";
      break;
    case "object":
      focusInstruction = "Focus on object details: category, material, function, notable features.";
      break;
    default:
      focusInstruction = "Extract all relevant visual details.";
  }

  const typeHintInstruction = typeHint
    ? `The image is expected to be a ${typeHint}, but verify this from the content.`
    : "Determine the most appropriate entity type from the image content.";

  return `Analyze this image for a creative writing project.

${typeHintInstruction}
${focusInstruction}

Extract visual details that would be useful for describing this in a story.
Be specific and descriptive. If you can see text or a name, include it as suggestedName.
Set confidence based on image clarity and how certain you are about the analysis.`;
}

// =============================================================================
// Analysis with Fallback
// =============================================================================

interface AnalysisResult {
  object: z.infer<typeof analysisResultSchema>;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

async function analyzeWithFallback(
  imageDataUrl: string,
  prompt: string,
  openRouterKey: string | null,
  geminiKey: string | null,
  logPrefix: string
): Promise<AnalysisResult> {
  // Try OpenRouter first (primary)
  if (openRouterKey) {
    try {
      console.log(`${logPrefix} Trying OpenRouter with ${OPENROUTER_VISION_MODEL}...`);
      const openRouter = createDynamicOpenRouter(openRouterKey);

      const result = await generateObject({
        model: openRouter(OPENROUTER_VISION_MODEL),
        schema: analysisResultSchema,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", image: imageDataUrl },
              { type: "text", text: prompt },
            ],
          },
        ],
        abortSignal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
      });

      console.log(`${logPrefix} OpenRouter analysis success`);
      return {
        object: result.object,
        model: OPENROUTER_VISION_MODEL,
        usage: result.usage,
      };
    } catch (error) {
      console.warn(`${logPrefix} OpenRouter failed:`, error);
      console.log(`${logPrefix} Falling back to Gemini direct...`);
    }
  }

  // Fallback to Gemini direct
  if (geminiKey) {
    console.log(`${logPrefix} Using Gemini direct with ${GEMINI_VISION_MODEL}...`);
    const gemini = createDynamicGemini(geminiKey);

    const result = await generateObject({
      model: gemini(GEMINI_VISION_MODEL),
      schema: analysisResultSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: imageDataUrl },
            { type: "text", text: prompt },
          ],
        },
      ],
      abortSignal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
    });

    console.log(`${logPrefix} Gemini analysis success`);
    return {
      object: result.object,
      model: GEMINI_VISION_MODEL,
      usage: result.usage,
    };
  }

  throw new Error("No API key available for image analysis");
}

// =============================================================================
// Main Handler
// =============================================================================

async function handleAnalyzeImage(
  req: AIImageAnalyzeRequest,
  billing: BillingCheck,
  supabase: ReturnType<typeof createSupabaseClient>,
  origin: string | null
): Promise<Response> {
  const logPrefix = "[ai-image-analyze]";
  const startTime = Date.now();
  console.log(`${logPrefix} Starting image analysis for project: ${req.projectId}`);

  try {
    // 1. Verify project access
    await assertProjectAccess(supabase, req.projectId, billing.userId);

    // 2. Verify entity if provided
    let entityType: string | null = null;
    if (req.entityId) {
      const entity = await assertEntityInProject(supabase, req.entityId, req.projectId);
      entityType = entity.type;
    }

    // 3. Parse image source
    let imageBytes: Uint8Array;
    let mimeType: string;
    let base64ForClip: string;
    let imageDataUrl: string;

    if (req.imageSource.startsWith("data:")) {
      // Base64 data URL
      const parsed = parseImageDataUrl(req.imageSource);
      imageBytes = parsed.bytes;
      mimeType = parsed.mimeType;
      base64ForClip = parsed.base64;
      imageDataUrl = req.imageSource;
    } else {
      // Storage path - fetch from Supabase
      console.log(`${logPrefix} Fetching image from storage: ${req.imageSource}`);
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(req.imageSource);

      if (error || !data) {
        throw new Error(`Failed to fetch image from storage: ${error?.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      imageBytes = new Uint8Array(arrayBuffer);
      mimeType = data.type || "image/png";
      base64ForClip = uint8ArrayToBase64(imageBytes);
      imageDataUrl = `data:${mimeType};base64,${base64ForClip}`;
    }

    // Validate size
    if (imageBytes.length > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image too large: ${Math.round(imageBytes.length / 1024 / 1024)}MB exceeds 10MB limit`);
    }

    console.log(`${logPrefix} Image loaded (${mimeType}, ${imageBytes.length} bytes)`);

    // 4. Get API keys
    const openRouterKey = billing.apiKey;
    const geminiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? null;

    // 5. Build analysis prompt and run multimodal analysis
    const focus = req.extractionFocus ?? "full";
    const prompt = buildAnalysisPrompt(focus, req.entityTypeHint);

    const analysisResult = await analyzeWithFallback(
      imageDataUrl,
      prompt,
      openRouterKey,
      geminiKey,
      logPrefix
    );

    console.log(`${logPrefix} Analysis complete: ${analysisResult.object.suggestedEntityType}`);

    // 6. Store image in Supabase Storage (with cleanup on failure)
    const ext = getExtFromMimeType(mimeType);
    const storagePath = generateStoragePath(req.projectId, req.entityId, ext);
    let uploadedPath: string | null = null;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, imageBytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`${logPrefix} Storage upload failed:`, uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Track uploaded path for cleanup on subsequent failures
    uploadedPath = storagePath;
    console.log(`${logPrefix} Uploaded to: ${storagePath}`);

    // 7. Create signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      await cleanupStorageBlob(supabase, uploadedPath, logPrefix);
      throw new Error("Failed to create signed URL");
    }

    const signedUrl = signedUrlData.signedUrl;

    // 8. Create project_assets record
    const assetType = req.setAsPortrait ? "portrait" : "reference";
    const { data: assetData, error: assetError } = await supabase
      .from("project_assets")
      .insert({
        project_id: req.projectId,
        entity_id: req.entityId ?? null,
        asset_type: assetType,
        storage_path: storagePath,
        public_url: signedUrl,
        generation_prompt: null, // Not generated, uploaded
        generation_model: "user_upload",
        generation_params: {
          source: "reference_upload",
          entityTypeHint: req.entityTypeHint,
          extractionFocus: focus,
          analysisModel: analysisResult.model,
        },
        mime_type: mimeType,
      })
      .select("id")
      .single();

    if (assetError || !assetData) {
      console.error(`${logPrefix} Failed to create asset record:`, assetError);
      await cleanupStorageBlob(supabase, uploadedPath, logPrefix);
      throw new Error("Failed to save asset record");
    }

    const assetId = assetData.id;
    console.log(`${logPrefix} Created asset record: ${assetId}`);

    // 9. Update entity portrait if requested
    if (req.setAsPortrait && req.entityId) {
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

    // 10. Generate CLIP embedding and sync to Qdrant (non-blocking failure)
    try {
      if (isClipConfigured() && isQdrantConfigured()) {
        console.log(`${logPrefix} Generating CLIP embedding...`);

        const clipResult = await generateClipImageEmbedding(base64ForClip, { mimeType });

        console.log(`${logPrefix} CLIP embedding generated (${clipResult.embedding.length} dims)`);

        // Prepare Qdrant payload
        const qdrantPayload = {
          project_id: req.projectId,
          asset_id: assetId,
          entity_id: req.entityId ?? null,
          entity_type: entityType ?? analysisResult.object.suggestedEntityType,
          asset_type: assetType,
          style: analysisResult.object.visualDescription.artStyle ?? null,
          storage_path: storagePath,
          public_url: signedUrl,
          created_at: new Date().toISOString(),
        };

        await upsertPoints(
          [{ id: assetId, vector: clipResult.embedding, payload: qdrantPayload }],
          { collection: "saga_images" }
        );

        console.log(`${logPrefix} Synced to Qdrant saga_images collection`);

        // Update project_assets with CLIP data
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
        endpoint: "image-analyze",
        model: analysisResult.model,
        modelType: "vision",
        usage: {
          promptTokens: analysisResult.usage?.promptTokens ?? 0,
          completionTokens: analysisResult.usage?.completionTokens ?? 0,
          totalTokens: analysisResult.usage?.totalTokens ?? 0,
        },
        success: true,
        latencyMs: Date.now() - startTime,
      });
    } catch (e) {
      console.warn(`${logPrefix} Failed to record AI request:`, e);
    }

    // 12. Return success response
    const response: AIImageAnalyzeResponse = {
      suggestedEntityType: analysisResult.object.suggestedEntityType as EntityType,
      suggestedName: analysisResult.object.suggestedName,
      visualDescription: analysisResult.object.visualDescription,
      description: analysisResult.object.description,
      confidence: analysisResult.object.confidence,
      assetId,
      imageUrl: signedUrl,
    };

    console.log(`${logPrefix} Analysis complete`);
    return createSuccessResponse(response, origin);

  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    return handleAIError(error, origin, { providerName: "ai-image-analyze" });
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
    const body = await req.json() as AIImageAnalyzeRequest;

    // Validate required fields
    if (!body.projectId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, "projectId is required", origin);
    }

    if (!body.imageSource) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, "imageSource is required", origin);
    }

    // Check billing
    const supabase = createSupabaseClient();
    const billing = await checkBillingAndGetKey(req, supabase, {
      endpoint: "image-analyze",
      allowAnonymousTrial: false,
    });

    if (!billing.canProceed) {
      return createErrorResponse(ErrorCode.FORBIDDEN, billing.error ?? "Billing check failed", origin, { errorCode: billing.errorCode });
    }

    if (!billing.apiKey && !Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY")) {
      return createErrorResponse(ErrorCode.FORBIDDEN, "API key required for image analysis", origin);
    }

    return handleAnalyzeImage(body, billing, supabase, origin);

  } catch (error) {
    console.error("[ai-image-analyze] Handler error:", error);
    return handleAIError(error, origin);
  }
});
