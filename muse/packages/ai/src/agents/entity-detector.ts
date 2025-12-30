import { generateText } from "ai";
import { getModel } from "../providers";
import {
  ENTITY_DETECTOR_SYSTEM,
  ENTITY_DETECTOR_USER_TEMPLATE,
} from "../prompts/entity-detector";
import type {
  DetectedEntity,
  DetectionResult,
  DetectionInput,
  DetectionOptions,
  EntityOccurrence,
  DetectionStats,
  EntityType,
} from "@mythos/core";

/**
 * Default detection options
 */
const DEFAULT_OPTIONS: Required<DetectionOptions> = {
  minConfidence: 0.5,
  entityTypes: ["character", "location", "item", "magic_system", "faction", "event", "concept"],
  detectAliases: true,
  matchExisting: true,
  maxEntities: 100,
  includeContext: true,
  contextLength: 50,
};

/**
 * EntityDetector - AI agent for detecting narrative entities in text
 *
 * This is the core "WOW" feature of Mythos IDE. It analyzes pasted or written
 * text to identify characters, locations, items, factions, and other narrative
 * entities, returning their exact positions for editor highlighting.
 */
export class EntityDetector {
  private model = getModel("analysis");

  /**
   * Detect entities in the provided text
   *
   * @param input - Detection input containing text and options
   * @returns DetectionResult with entities and their positions
   */
  async detect(input: DetectionInput): Promise<DetectionResult> {
    const startTime = Date.now();
    const options = { ...DEFAULT_OPTIONS, ...input.options };

    // Build the user message
    const existingEntitiesForPrompt = options.matchExisting && input.existingEntities
      ? input.existingEntities.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          aliases: e.aliases,
        }))
      : undefined;

    const userMessage = ENTITY_DETECTOR_USER_TEMPLATE(
      input.text,
      existingEntitiesForPrompt
    );

    // Call the AI model
    const result = await generateText({
      model: this.model,
      system: ENTITY_DETECTOR_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0.2, // Low temperature for accurate position detection
      maxOutputTokens: 8192, // Allow for long responses with many entities
    });

    // Parse and validate the response
    let rawResult: DetectionResult;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawResult = JSON.parse(jsonMatch[0]) as DetectionResult;
      } else {
        console.error("No JSON found in entity detector response:", result.text);
        return this.emptyResult(input.text, startTime);
      }
    } catch (error) {
      console.error("Failed to parse entity detector response:", error, result.text);
      return this.emptyResult(input.text, startTime);
    }

    // Validate and correct positions
    const validatedEntities = this.validateAndCorrectPositions(
      rawResult.entities || [],
      input.text,
      options
    );

    // Filter by options
    const filteredEntities = this.applyFilters(validatedEntities, options);

    // Build stats
    const stats = this.buildStats(filteredEntities, input.text, startTime);

    return {
      entities: filteredEntities,
      warnings: rawResult.warnings || [],
      stats,
    };
  }

  /**
   * Validate entity positions and attempt to correct any errors
   */
  private validateAndCorrectPositions(
    entities: DetectedEntity[],
    text: string,
    options: Required<DetectionOptions>
  ): DetectedEntity[] {
    return entities.map((entity) => {
      const validatedOccurrences = entity.occurrences
        .map((occ) => this.validateOccurrence(occ, text, entity.name, options))
        .filter((occ): occ is EntityOccurrence => occ !== null);

      return {
        ...entity,
        occurrences: validatedOccurrences,
      };
    }).filter((entity) => entity.occurrences.length > 0);
  }

  /**
   * Validate a single occurrence and attempt correction if positions are wrong
   */
  private validateOccurrence(
    occurrence: EntityOccurrence,
    text: string,
    entityName: string,
    options: Required<DetectionOptions>
  ): EntityOccurrence | null {
    const { startOffset, endOffset, matchedText } = occurrence;

    // Check if the reported positions are valid
    if (startOffset >= 0 && endOffset <= text.length && startOffset < endOffset) {
      const actualText = text.substring(startOffset, endOffset);
      if (actualText === matchedText) {
        // Positions are correct, add context if needed
        return {
          ...occurrence,
          context: options.includeContext
            ? this.extractContext(text, startOffset, endOffset, options.contextLength)
            : occurrence.context,
        };
      }
    }

    // Positions are wrong, try to find the actual position
    const correctedPosition = this.findTextPosition(text, matchedText, startOffset);
    if (correctedPosition) {
      return {
        startOffset: correctedPosition.start,
        endOffset: correctedPosition.end,
        matchedText,
        context: options.includeContext
          ? this.extractContext(text, correctedPosition.start, correctedPosition.end, options.contextLength)
          : occurrence.context,
      };
    }

    // Try searching for the entity name if matchedText not found
    if (matchedText !== entityName) {
      const namePosition = this.findTextPosition(text, entityName, startOffset);
      if (namePosition) {
        return {
          startOffset: namePosition.start,
          endOffset: namePosition.end,
          matchedText: entityName,
          context: options.includeContext
            ? this.extractContext(text, namePosition.start, namePosition.end, options.contextLength)
            : occurrence.context,
        };
      }
    }

    // Could not validate or correct this occurrence
    console.warn(`Could not validate occurrence of "${matchedText}" at ${startOffset}-${endOffset}`);
    return null;
  }

  /**
   * Find the position of text, searching near the expected position first
   */
  private findTextPosition(
    text: string,
    searchText: string,
    expectedPosition: number
  ): { start: number; end: number } | null {
    // First, try exact match at expected position
    const exactStart = text.indexOf(searchText, Math.max(0, expectedPosition - 50));
    if (exactStart !== -1 && Math.abs(exactStart - expectedPosition) < 100) {
      return { start: exactStart, end: exactStart + searchText.length };
    }

    // Search from the beginning
    const firstMatch = text.indexOf(searchText);
    if (firstMatch !== -1) {
      return { start: firstMatch, end: firstMatch + searchText.length };
    }

    // Try case-insensitive search
    const lowerText = text.toLowerCase();
    const lowerSearch = searchText.toLowerCase();
    const caseInsensitiveMatch = lowerText.indexOf(lowerSearch);
    if (caseInsensitiveMatch !== -1) {
      return {
        start: caseInsensitiveMatch,
        end: caseInsensitiveMatch + searchText.length,
      };
    }

    return null;
  }

  /**
   * Extract context around a position
   */
  private extractContext(
    text: string,
    startOffset: number,
    endOffset: number,
    contextLength: number
  ): string {
    const contextStart = Math.max(0, startOffset - contextLength);
    const contextEnd = Math.min(text.length, endOffset + contextLength);

    let context = "";

    if (contextStart > 0) {
      context += "...";
    }

    context += text.substring(contextStart, contextEnd);

    if (contextEnd < text.length) {
      context += "...";
    }

    return context;
  }

  /**
   * Apply filters based on options
   */
  private applyFilters(
    entities: DetectedEntity[],
    options: Required<DetectionOptions>
  ): DetectedEntity[] {
    let filtered = entities;

    // Filter by confidence
    filtered = filtered.filter((e) => e.confidence >= options.minConfidence);

    // Filter by entity type
    if (options.entityTypes.length < 7) {
      filtered = filtered.filter((e) =>
        options.entityTypes.includes(e.type as EntityType)
      );
    }

    // Limit number of entities
    if (options.maxEntities > 0 && filtered.length > options.maxEntities) {
      // Sort by confidence and take top N
      filtered = filtered
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, options.maxEntities);
    }

    return filtered;
  }

  /**
   * Build statistics for the detection run
   */
  private buildStats(
    entities: DetectedEntity[],
    text: string,
    startTime: number
  ): DetectionStats {
    const byType: Record<EntityType, number> = {
      character: 0,
      location: 0,
      item: 0,
      magic_system: 0,
      faction: 0,
      event: 0,
      concept: 0,
    };

    let matchedToExisting = 0;
    let newEntities = 0;

    for (const entity of entities) {
      byType[entity.type]++;
      if (entity.matchedExistingId) {
        matchedToExisting++;
      } else {
        newEntities++;
      }
    }

    return {
      charactersAnalyzed: text.length,
      totalEntities: entities.length,
      byType,
      matchedToExisting,
      newEntities,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Return an empty result for error cases
   */
  private emptyResult(text: string, startTime: number): DetectionResult {
    return {
      entities: [],
      warnings: [
        {
          type: "low_confidence",
          message: "Failed to parse AI response. No entities detected.",
        },
      ],
      stats: {
        charactersAnalyzed: text.length,
        totalEntities: 0,
        byType: {
          character: 0,
          location: 0,
          item: 0,
          magic_system: 0,
          faction: 0,
          event: 0,
          concept: 0,
        },
        matchedToExisting: 0,
        newEntities: 0,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Find all occurrences of an entity name in text
   * Useful for finding additional mentions not caught by AI
   */
  findAllOccurrences(
    text: string,
    names: string[],
    contextLength: number = 50
  ): EntityOccurrence[] {
    const occurrences: EntityOccurrence[] = [];

    for (const name of names) {
      let searchPos = 0;
      while (searchPos < text.length) {
        const pos = text.indexOf(name, searchPos);
        if (pos === -1) break;

        // Check word boundaries to avoid partial matches
        const beforeChar = pos > 0 ? text[pos - 1] : " ";
        const afterChar = pos + name.length < text.length ? text[pos + name.length] : " ";

        if (this.isWordBoundary(beforeChar) && this.isWordBoundary(afterChar)) {
          occurrences.push({
            startOffset: pos,
            endOffset: pos + name.length,
            matchedText: name,
            context: this.extractContext(text, pos, pos + name.length, contextLength),
          });
        }

        searchPos = pos + 1;
      }
    }

    // Sort by position
    return occurrences.sort((a, b) => a.startOffset - b.startOffset);
  }

  /**
   * Check if a character is a word boundary
   */
  private isWordBoundary(char: string): boolean {
    return /[\s.,!?;:'"()\[\]{}<>\/\\-]/.test(char);
  }
}

// Singleton instance for convenience
export const entityDetector = new EntityDetector();

/**
 * Convenience function for quick detection
 */
export async function detectEntities(
  text: string,
  options?: DetectionOptions
): Promise<DetectionResult> {
  return entityDetector.detect({ text, options });
}

/**
 * Convenience function for detection with existing entities
 */
export async function detectEntitiesWithContext(
  input: DetectionInput
): Promise<DetectionResult> {
  return entityDetector.detect(input);
}
