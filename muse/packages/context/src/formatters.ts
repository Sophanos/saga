/**
 * @mythos/context - Formatters
 *
 * Functions to format context for display or prompt injection.
 */

import type {
  ProfileContext,
  WorldContextSummary,
  UnifiedContextHints,
} from "./types";

/**
 * Format profile context for display.
 */
export function formatProfileContext(profile: ProfileContext): string {
  const parts: string[] = [];

  if (profile.preferredGenre) {
    parts.push(`Genre: ${profile.preferredGenre}`);
  }
  if (profile.namingCulture) {
    parts.push(`Naming Culture: ${profile.namingCulture}`);
  }
  if (profile.namingStyle) {
    parts.push(`Name Style: ${profile.namingStyle}`);
  }
  if (profile.logicStrictness) {
    parts.push(`Logic Strictness: ${profile.logicStrictness}`);
  }

  return parts.join(" | ");
}

/**
 * Format world context summary.
 */
export function formatWorldContext(world: WorldContextSummary): string {
  const parts: string[] = [];

  if (world.entities.length > 0) {
    const entityTypes = new Map<string, number>();
    for (const e of world.entities) {
      entityTypes.set(e.type, (entityTypes.get(e.type) ?? 0) + 1);
    }
    const typeSummary = Array.from(entityTypes.entries())
      .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
      .join(", ");
    parts.push(`Entities: ${typeSummary}`);
  }

  if (world.relationships.length > 0) {
    parts.push(`Relationships: ${world.relationships.length}`);
  }

  return parts.join(" | ");
}

/**
 * Format context hints for a compact display.
 */
export function formatContextHints(hints: UnifiedContextHints): string {
  const sections: string[] = [];

  if (hints.profile) {
    const profileStr = formatProfileContext(hints.profile);
    if (profileStr) {
      sections.push(`[Profile] ${profileStr}`);
    }
  }

  if (hints.world) {
    const worldStr = formatWorldContext(hints.world);
    if (worldStr) {
      sections.push(`[World] ${worldStr}`);
    }
  }

  if (hints.editor?.documentTitle) {
    let editorStr = hints.editor.documentTitle;
    if (hints.editor.selectionText) {
      editorStr += ` (selection: ${hints.editor.selectionText.slice(0, 30)}...)`;
    }
    sections.push(`[Editor] ${editorStr}`);
  }

  return sections.join("\n");
}

/**
 * Check if context hints are empty.
 */
export function isContextHintsEmpty(hints: UnifiedContextHints): boolean {
  return (
    !hints.profile &&
    !hints.world &&
    !hints.editor &&
    !hints.conversationId
  );
}
