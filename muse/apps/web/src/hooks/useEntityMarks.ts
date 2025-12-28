import { useCallback, useEffect, useRef } from "react";
import type { Editor } from "@mythos/editor";
import type { Entity, EntityType, DetectedEntity } from "@mythos/core";

/**
 * Represents a text range to mark with entity information
 */
export interface EntityMarkRange {
  /** Starting character offset in the text (0-indexed) */
  startOffset: number;
  /** Ending character offset in the text (exclusive) */
  endOffset: number;
  /** Entity ID to associate with this mark */
  entityId: string;
  /** Entity type for styling */
  entityType: EntityType;
}

/**
 * Convert character offset to ProseMirror document position
 *
 * ProseMirror positions include node boundaries (e.g., paragraph start/end),
 * so we need to walk through the document and count text characters to find
 * the correct position.
 */
function charOffsetToDocPos(editor: Editor, charOffset: number): number {
  const doc = editor.state.doc;
  let currentCharOffset = 0;
  let docPos = 0;

  doc.descendants((node, pos) => {
    if (docPos !== 0) return false; // Already found, stop searching

    if (node.isText && node.text) {
      const textLen = node.text.length;
      if (currentCharOffset + textLen >= charOffset) {
        // Found the text node containing our offset
        docPos = pos + (charOffset - currentCharOffset);
        return false;
      }
      currentCharOffset += textLen;
    } else if (node.isBlock && !node.isTextblock) {
      // Block nodes add line breaks to getText()
      currentCharOffset += 1;
    }
    return true; // Continue searching
  });

  // If not found, return the end of the document
  if (docPos === 0 && charOffset > 0) {
    docPos = doc.content.size;
  }

  return docPos;
}

/**
 * Find all occurrences of entity names/aliases in document text
 * Returns text ranges where marks should be applied
 */
function findEntityOccurrences(
  text: string,
  entities: Entity[]
): EntityMarkRange[] {
  const ranges: EntityMarkRange[] = [];

  for (const entity of entities) {
    // Build list of names to search for (main name + aliases)
    const namesToSearch = [entity.name, ...(entity.aliases || [])];

    for (const name of namesToSearch) {
      if (!name || name.length < 2) continue;

      // Case-insensitive search with word boundaries
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escapedName}\\b`, "gi");
      let match;

      while ((match = regex.exec(text)) !== null) {
        ranges.push({
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          entityId: entity.id,
          entityType: entity.type as EntityType,
        });
      }
    }
  }

  // Sort by start offset (ascending), then by length (longer first for overlap handling)
  ranges.sort((a, b) => {
    if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
    return (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset);
  });

  // Remove overlapping ranges (keep longer matches)
  const nonOverlapping: EntityMarkRange[] = [];
  let lastEnd = -1;

  for (const range of ranges) {
    if (range.startOffset >= lastEnd) {
      nonOverlapping.push(range);
      lastEnd = range.endOffset;
    }
  }

  return nonOverlapping;
}

/**
 * Apply EntityMark to a range in the editor
 */
function applyEntityMarkToRange(
  editor: Editor,
  range: EntityMarkRange
): boolean {
  try {
    const from = charOffsetToDocPos(editor, range.startOffset);
    const to = charOffsetToDocPos(editor, range.endOffset);

    if (from >= to || from < 0) {
      console.warn("[useEntityMarks] Invalid range:", { from, to, range });
      return false;
    }

    // Check if mark already exists at this position
    const $from = editor.state.doc.resolve(from);
    const existingMarks = $from.marks();
    const hasEntityMark = existingMarks.some((m) => m.type.name === "entity");

    if (hasEntityMark) {
      return false; // Already marked
    }

    // Apply the entity mark
    editor
      .chain()
      .setTextSelection({ from, to })
      .setEntityMark({
        entityId: range.entityId,
        entityType: range.entityType,
      })
      .run();

    return true;
  } catch (error) {
    console.error("[useEntityMarks] Error applying mark:", error);
    return false;
  }
}

/**
 * Hook for managing EntityMark application in the editor
 *
 * Provides utilities to:
 * - Apply marks to detected entity occurrences
 * - Apply marks to existing entities on document load
 * - Scan and mark entity references in text
 */
export function useEntityMarks(editor: Editor | null) {
  // Track whether we've applied initial marks for this document
  const appliedInitialMarksRef = useRef<string | null>(null);

  /**
   * Apply EntityMarks for detected entities with known occurrences
   * Used after entity detection to mark the detected mentions
   */
  const applyMarksForDetectedEntities = useCallback(
    (detectedEntities: DetectedEntity[], pasteOffset: number = 0) => {
      if (!editor || editor.isDestroyed) return;

      const ranges: EntityMarkRange[] = [];

      for (const detected of detectedEntities) {
        if (!detected.occurrences) continue;

        const entityId = detected.matchedExistingId || detected.tempId || "";
        if (!entityId) continue;

        for (const occ of detected.occurrences) {
          ranges.push({
            startOffset: pasteOffset + occ.startOffset,
            endOffset: pasteOffset + occ.endOffset,
            entityId,
            entityType: detected.type as EntityType,
          });
        }
      }

      // Sort ranges in reverse order to apply from end to start
      // This prevents position shifts from affecting subsequent marks
      ranges.sort((a, b) => b.startOffset - a.startOffset);

      // Store current selection to restore after
      const { from: selFrom, to: selTo } = editor.state.selection;

      // Batch the mark applications
      let marksApplied = 0;
      for (const range of ranges) {
        if (applyEntityMarkToRange(editor, range)) {
          marksApplied++;
        }
      }

      // Restore selection
      editor.commands.setTextSelection({ from: selFrom, to: selTo });

      if (marksApplied > 0) {
        console.log(`[useEntityMarks] Applied ${marksApplied} marks for detected entities`);
      }
    },
    [editor]
  );

  /**
   * Scan document and apply EntityMarks for all known entities
   * Used on document load to mark existing entity references
   */
  const applyMarksForExistingEntities = useCallback(
    (entities: Entity[], documentId?: string) => {
      if (!editor || editor.isDestroyed) return;
      if (entities.length === 0) return;

      // Avoid re-applying marks for the same document
      if (documentId && appliedInitialMarksRef.current === documentId) {
        return;
      }

      const text = editor.getText();
      if (!text || text.length < 2) return;

      const ranges = findEntityOccurrences(text, entities);

      if (ranges.length === 0) {
        if (documentId) {
          appliedInitialMarksRef.current = documentId;
        }
        return;
      }

      // Store current selection to restore after
      const { from: selFrom, to: selTo } = editor.state.selection;

      // Apply in reverse order to prevent position shifts
      const reversedRanges = [...ranges].reverse();
      let marksApplied = 0;

      for (const range of reversedRanges) {
        if (applyEntityMarkToRange(editor, range)) {
          marksApplied++;
        }
      }

      // Restore selection
      editor.commands.setTextSelection({ from: selFrom, to: selTo });

      if (documentId) {
        appliedInitialMarksRef.current = documentId;
      }

      if (marksApplied > 0) {
        console.log(`[useEntityMarks] Applied ${marksApplied} marks for existing entities`);
      }
    },
    [editor]
  );

  /**
   * Apply EntityMark for a single entity at specific positions
   * Used after creating an entity via @mention or other direct creation
   */
  const applyMarkForEntity = useCallback(
    (entity: Entity, startOffset: number, endOffset: number) => {
      if (!editor || editor.isDestroyed) return;

      const range: EntityMarkRange = {
        startOffset,
        endOffset,
        entityId: entity.id,
        entityType: entity.type as EntityType,
      };

      applyEntityMarkToRange(editor, range);
    },
    [editor]
  );

  /**
   * Clear the initial marks tracking (call on document change)
   */
  const resetInitialMarksTracking = useCallback(() => {
    appliedInitialMarksRef.current = null;
  }, []);

  return {
    applyMarksForDetectedEntities,
    applyMarksForExistingEntities,
    applyMarkForEntity,
    resetInitialMarksTracking,
  };
}

/**
 * Effect hook to automatically apply marks when document loads
 */
export function useAutoApplyEntityMarks(
  editor: Editor | null,
  entities: Entity[],
  documentId: string | null
) {
  const { applyMarksForExistingEntities, resetInitialMarksTracking } =
    useEntityMarks(editor);

  // Reset tracking when document changes
  useEffect(() => {
    resetInitialMarksTracking();
  }, [documentId, resetInitialMarksTracking]);

  // Apply marks when document is ready and entities are available
  useEffect(() => {
    if (!editor || editor.isDestroyed || !documentId) return;
    if (entities.length === 0) return;

    // Small delay to ensure content is loaded
    const timeoutId = setTimeout(() => {
      applyMarksForExistingEntities(entities, documentId);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [editor, entities, documentId, applyMarksForExistingEntities]);
}
