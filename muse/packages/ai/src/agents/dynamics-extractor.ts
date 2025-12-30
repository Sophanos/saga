import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "../providers";
import { DYNAMICS_EXTRACTOR_SYSTEM } from "../prompts/dynamics";
import type { Interaction, InteractionType } from "@mythos/core";

/**
 * Zod schema for extracted interaction
 */
const extractedInteractionSchema = z.object({
  source: z.string().describe("The character or entity performing the action"),
  action: z.string().describe("The interaction verb like ATTACKS, SPEAKS, ENTERS"),
  target: z.string().describe("The target character, entity, or location"),
  type: z.enum(["neutral", "hostile", "hidden", "passive"]).describe("Interaction category"),
  isHidden: z.boolean().describe("Whether this is a secret action only DM should see"),
  isHostile: z.boolean().describe("Whether this is a conflict-driven action"),
  effect: z.string().optional().describe("Mechanical effect like '-2 WIS' or 'gains trust'"),
  note: z.string().optional().describe("Additional context for DM or hidden info"),
  sceneMarker: z.string().optional().describe("Scene context like 'Sc 1' or location"),
});

/**
 * Zod schema for dynamics extraction result
 */
const dynamicsExtractionResultSchema = z.object({
  interactions: z.array(extractedInteractionSchema),
  summary: z.string().describe("Brief summary of the key dynamics in this passage"),
});

/**
 * Type definitions based on Zod schemas
 */
export type ExtractedInteraction = z.infer<typeof extractedInteractionSchema>;
export type DynamicsExtractionResult = z.infer<typeof dynamicsExtractionResultSchema>;

/**
 * Input options for dynamics extraction
 */
export interface DynamicsExtractionInput {
  /** The prose text to analyze */
  content: string;
  /** Optional scene marker for context */
  sceneMarker?: string;
  /** Optional document ID for tracking */
  documentId?: string;
  /** Optional known entities for better name resolution */
  knownEntities?: Array<{ id: string; name: string; type: string }>;
}

/**
 * Full result including converted Interaction objects
 */
export interface DynamicsResult {
  /** Raw extracted interactions */
  extracted: DynamicsExtractionResult;
  /** Interactions converted to core Interaction type */
  interactions: Interaction[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * DynamicsExtractor - AI agent for extracting character interactions from prose
 *
 * Uses Vercel AI SDK's generateObject with Zod schema validation for
 * type-safe structured output.
 */
export class DynamicsExtractor {
  private model = getModel("fast"); // Use fast model for real-time extraction

  /**
   * Extract dynamics/interactions from prose text
   *
   * @param input - The extraction input with content and options
   * @returns DynamicsResult with extracted interactions
   */
  async extract(input: DynamicsExtractionInput): Promise<DynamicsResult> {
    const startTime = Date.now();

    // Build context message
    let userMessage = `## Prose Text to Analyze:\n${input.content}`;

    if (input.sceneMarker) {
      userMessage += `\n\n## Current Scene: ${input.sceneMarker}`;
    }

    if (input.knownEntities && input.knownEntities.length > 0) {
      userMessage += `\n\n## Known Entities:\n${JSON.stringify(input.knownEntities, null, 2)}`;
    }

    try {
      // Use generateObject for structured output with Zod validation
      const result = await generateObject({
        model: this.model,
        system: DYNAMICS_EXTRACTOR_SYSTEM,
        schema: dynamicsExtractionResultSchema,
        prompt: userMessage,
        temperature: 0.3,
        maxOutputTokens: 4096,
      });

      // Convert extracted interactions to core Interaction type
      const interactions = this.convertToInteractions(
        result.object.interactions,
        input.documentId,
        input.sceneMarker
      );

      return {
        extracted: result.object,
        interactions,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error("[DynamicsExtractor] Extraction failed:", error);

      // Return empty result on failure
      return {
        extracted: {
          interactions: [],
          summary: "Extraction failed. Please try again.",
        },
        interactions: [],
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Quick extraction with just content string
   */
  async quickExtract(content: string): Promise<DynamicsResult> {
    return this.extract({ content });
  }

  /**
   * Extract only hostile/conflict interactions
   */
  async extractHostile(content: string): Promise<DynamicsResult> {
    const result = await this.extract({ content });

    return {
      ...result,
      interactions: result.interactions.filter(
        (i) => i.type === "hostile" || this.isHostileAction(i.action)
      ),
    };
  }

  /**
   * Extract only hidden/secret interactions
   */
  async extractHidden(content: string): Promise<DynamicsResult> {
    const result = await this.extract({ content });

    return {
      ...result,
      interactions: result.interactions.filter(
        (i) => i.type === "hidden" || i.note?.includes("secret")
      ),
    };
  }

  /**
   * Convert extracted interactions to core Interaction type
   */
  private convertToInteractions(
    extracted: ExtractedInteraction[],
    documentId?: string,
    defaultSceneMarker?: string
  ): Interaction[] {
    return extracted.map((ext, index) => ({
      id: this.generateId(ext, index),
      source: ext.source,
      action: ext.action.toUpperCase(),
      target: ext.target,
      type: ext.type as InteractionType,
      time: ext.sceneMarker || defaultSceneMarker || "Sc 1",
      effect: ext.effect,
      note: this.buildNote(ext),
      documentId,
      createdAt: new Date(),
    }));
  }

  /**
   * Generate a unique ID for an interaction
   */
  private generateId(interaction: ExtractedInteraction, index: number): string {
    const timestamp = Date.now();
    const source = interaction.source.toLowerCase().replace(/\s+/g, "_").slice(0, 10);
    const action = interaction.action.toLowerCase().slice(0, 5);
    return `int_${source}_${action}_${timestamp}_${index}`;
  }

  /**
   * Build the note field combining hidden flags and context
   */
  private buildNote(interaction: ExtractedInteraction): string | undefined {
    const parts: string[] = [];

    if (interaction.isHidden) {
      parts.push("[HIDDEN - DM Only]");
    }

    if (interaction.isHostile) {
      parts.push("[HOSTILE]");
    }

    if (interaction.note) {
      parts.push(interaction.note);
    }

    return parts.length > 0 ? parts.join(" ") : undefined;
  }

  /**
   * Check if an action is inherently hostile
   */
  private isHostileAction(action: string): boolean {
    const hostileActions = [
      "ATTACKS",
      "BETRAYS",
      "THREATENS",
      "DECEIVES",
      "STEALS",
      "CAPTURES",
      "WOUNDS",
      "KILLS",
      "PLOTS",
      "POISONS",
    ];
    return hostileActions.includes(action.toUpperCase());
  }
}

// Singleton instance for convenience
export const dynamicsExtractor = new DynamicsExtractor();

/**
 * Convenience function for quick dynamics extraction
 */
export async function extractDynamics(
  content: string,
  options?: Omit<DynamicsExtractionInput, "content">
): Promise<DynamicsResult> {
  return dynamicsExtractor.extract({ content, ...options });
}

/**
 * Convenience function for extracting hostile interactions only
 */
export async function extractHostileDynamics(content: string): Promise<DynamicsResult> {
  return dynamicsExtractor.extractHostile(content);
}

/**
 * Convenience function for extracting hidden interactions only
 */
export async function extractHiddenDynamics(content: string): Promise<DynamicsResult> {
  return dynamicsExtractor.extractHidden(content);
}
