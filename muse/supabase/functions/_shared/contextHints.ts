/**
 * Shared context hints types for Saga prompt assembly.
 */

import type { EditorContext } from "./tools/types.ts";
import type { ProfileContext, SmartModeConfig } from "./memory/types.ts";

export interface EntitySummary {
  id: string;
  name: string;
  type: string;
  summary?: string;
}

export interface RelationshipSummary {
  sourceId: string;
  targetId: string;
  type: string;
}

export interface WorldContextSummary {
  entities: EntitySummary[];
  relationships: RelationshipSummary[];
}

export interface ProjectPersonalizationContext {
  genre?: string;
  styleMode?: string;
  guardrails?: {
    plot?: "no_plot_generation" | "suggestions_only" | "allow_generation";
    edits?: "proofread_only" | "line_edits" | "rewrite";
    strictness?: "low" | "medium" | "high";
    no_judgement_mode?: boolean;
  };
  smartMode?: SmartModeConfig;
}

export interface UnifiedContextHints {
  profile?: ProfileContext;
  world?: WorldContextSummary;
  editor?: EditorContext;
  conversationId?: string;
  project?: ProjectPersonalizationContext;
}

export function formatWorldContextSummary(
  world: WorldContextSummary,
  options?: { maxEntities?: number; maxRelationships?: number }
): string {
  const maxEntities = options?.maxEntities ?? 20;
  const maxRelationships = options?.maxRelationships ?? 20;
  const lines: string[] = [];

  if (world.entities.length > 0) {
    lines.push("Entities:");
    const visible = world.entities.slice(0, maxEntities);
    for (const entity of visible) {
      const summary = entity.summary ? `: ${entity.summary}` : "";
      lines.push(`- ${entity.name} (${entity.type})${summary}`);
    }
    if (world.entities.length > maxEntities) {
      lines.push(`- ... (${world.entities.length - maxEntities} more entities)`);
    }
  } else {
    lines.push("Entities: none");
  }

  if (world.relationships.length > 0) {
    lines.push("Relationships:");
    const visible = world.relationships.slice(0, maxRelationships);
    for (const rel of visible) {
      lines.push(`- ${rel.sourceId} ${rel.type} ${rel.targetId}`);
    }
    if (world.relationships.length > maxRelationships) {
      lines.push(`- ... (${world.relationships.length - maxRelationships} more relationships)`);
    }
  } else {
    lines.push("Relationships: none");
  }

  return lines.join("\n");
}

