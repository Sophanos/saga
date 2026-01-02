/**
 * Project mappers: DB <-> Core type conversions
 */

import type { Database } from "../types/database";
import type { Project, TemplateId, TemplateOverrides } from "@mythos/core";

// DB types
export type DbProject = Database["public"]["Tables"]["projects"]["Row"];

function getProp<T>(obj: Record<string, unknown> | null | undefined, key: string): T | undefined {
  if (!obj) return undefined;
  return obj[key] as T | undefined;
}

export function mapDbProjectToProject(dbProject: DbProject): Project {
  const styleConfig = dbProject.style_config as Record<string, unknown> | null;
  const memoryControls = getProp<Project["config"]["memoryControls"]>(styleConfig, "memoryControls");

  // Build templateOverrides if any config exists (Migration 005)
  let templateOverrides: TemplateOverrides | undefined;
  const hasEntityKinds = dbProject.entity_kinds_config && dbProject.entity_kinds_config.length > 0;
  const hasRelationshipKinds = dbProject.relationship_kinds_config && dbProject.relationship_kinds_config.length > 0;
  const hasDocumentKinds = dbProject.document_kinds_config && dbProject.document_kinds_config.length > 0;
  const hasUiConfig = dbProject.ui_config && Object.keys(dbProject.ui_config).length > 0;

  if (hasEntityKinds || hasRelationshipKinds || hasDocumentKinds || hasUiConfig) {
    templateOverrides = {};
    if (hasEntityKinds) {
      templateOverrides.customEntityKinds = dbProject.entity_kinds_config as TemplateOverrides["customEntityKinds"];
    }
    if (hasRelationshipKinds) {
      templateOverrides.customRelationshipKinds = dbProject.relationship_kinds_config as TemplateOverrides["customRelationshipKinds"];
    }
    if (hasDocumentKinds) {
      templateOverrides.customDocumentKinds = dbProject.document_kinds_config as TemplateOverrides["customDocumentKinds"];
    }
    if (hasUiConfig) {
      templateOverrides.uiModuleOverrides = dbProject.ui_config as TemplateOverrides["uiModuleOverrides"];
    }
  }

  return {
    id: dbProject.id,
    name: dbProject.name,
    description: dbProject.description ?? undefined,
    templateId: (dbProject.template_id as TemplateId) ?? undefined,
    templateOverrides,
    config: {
      genre: dbProject.genre as Project["config"]["genre"],
      styleMode: getProp<Project["config"]["styleMode"]>(styleConfig, "styleMode") ?? "manga",
      arcTemplate: getProp<Project["config"]["arcTemplate"]>(styleConfig, "arcTemplate") ?? "three_act",
      linterConfig: (dbProject.linter_config as Project["config"]["linterConfig"]) ?? {},
      memoryControls,
    },
    createdAt: new Date(dbProject.created_at),
    updatedAt: new Date(dbProject.updated_at),
  };
}
