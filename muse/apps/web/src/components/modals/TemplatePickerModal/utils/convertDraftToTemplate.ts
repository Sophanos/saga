import type {
  ProjectTemplate,
  TemplateCategory,
  Genre,
  StyleMode,
  RelationshipKindDefinition,
  DocumentKindDefinition,
  LinterRuleDefinition,
} from "@mythos/core";
import type { TemplateDraft } from "@mythos/agent-protocol";

/**
 * Convert a TemplateDraft from the AI to a full ProjectTemplate.
 * Fills in defaults for fields the AI doesn't generate.
 */
export function convertDraftToTemplate(draft: TemplateDraft): ProjectTemplate {
  const templateId = `ai-${Date.now()}`;

  // Map AI category to valid TemplateCategory
  const categoryMap: Record<string, TemplateCategory> = {
    fantasy: "fantasy",
    scifi: "scifi",
    "science fiction": "scifi",
    horror: "horror",
    literary: "literary",
    ttrpg: "ttrpg",
    manga: "manga",
    anime: "manga",
    visual: "visual",
    screenplay: "screenplay",
    serial: "serial",
  };

  const category: TemplateCategory =
    categoryMap[draft.category.toLowerCase()] ?? "custom";

  // Map relationship category from AI draft to valid RelationshipKindDefinition category
  const relationshipCategoryMap: Record<string, RelationshipKindDefinition["category"]> = {
    interpersonal: "social",
    familial: "familial",
    power: "professional",
    ability: "magical",
    custom: "narrative",
  };

  // Map linter category from AI draft to valid LinterRuleDefinition category
  const linterCategoryMap: Record<string, LinterRuleDefinition["category"]> = {
    character: "consistency",
    world: "continuity",
    plot: "pacing",
    timeline: "continuity",
    style: "style",
  };

  const defaultGenreByCategory: Partial<Record<TemplateCategory, Genre>> = {
    fantasy: "high_fantasy",
    scifi: "science_fiction",
    horror: "horror",
    literary: "literary",
    ttrpg: "high_fantasy",
    manga: "manga_shounen",
    visual: "literary",
    screenplay: "literary",
    serial: "progression_fantasy",
  };

  const defaultStyleModeByCategory: Partial<Record<TemplateCategory, StyleMode>> = {
    manga: "manga",
    horror: "noir",
    literary: "minimalist",
    screenplay: "minimalist",
  };

  const suggestedGenresByCategory: Partial<Record<TemplateCategory, Genre[]>> = {
    fantasy: ["high_fantasy", "urban_fantasy", "grimdark"],
    scifi: ["science_fiction", "thriller"],
    horror: ["horror", "thriller"],
    literary: ["literary", "slice_of_life"],
    manga: ["manga_shounen", "manga_seinen", "manga_shoujo", "manga_josei"],
    ttrpg: ["high_fantasy", "litrpg", "progression_fantasy"],
    serial: ["progression_fantasy", "litrpg"],
  };

  const defaultGenre = defaultGenreByCategory[category] ?? "literary";
  const defaultStyleMode = defaultStyleModeByCategory[category] ?? "minimalist";
  const suggestedGenres = suggestedGenresByCategory[category] ?? [defaultGenre];

  return {
    id: templateId,
    name: draft.name,
    description: draft.description,
    icon: "sparkles",
    category,
    tags: draft.tags,

    // Genre & Style defaults
    defaultGenre,
    suggestedGenres,
    defaultStyleMode,
    defaultArcTemplate: "three_act",

    // Entity configuration from draft
    entityKinds: draft.entityKinds.map((ek) => ({
      kind: ek.kind,
      label: ek.label,
      labelPlural: ek.labelPlural,
      category: ek.category,
      color: ek.color,
      icon: ek.icon,
      fields: ek.fields.map((f) => ({
        id: f.id,
        label: f.label,
        kind: f.kind,
        description: f.description,
      })),
    })),
    defaultEntityKinds: draft.entityKinds.map((ek) => ek.kind),

    // Relationship configuration from draft
    relationshipKinds: draft.relationshipKinds.map((rk) => ({
      kind: rk.kind,
      label: rk.label,
      category: relationshipCategoryMap[rk.category] ?? "narrative",
      color: "#888888", // Default color for relationships
    })),

    // Document configuration from draft
    documentKinds: draft.documentKinds.map((dk) => ({
      kind: dk.kind,
      label: dk.label,
      labelPlural: `${dk.label}s`, // Simple pluralization
      icon: "file-text",
      allowChildren: dk.allowChildren ?? false,
    })) as DocumentKindDefinition[],
    defaultDocumentKind: draft.documentKinds[0]?.kind ?? "chapter",

    // UI configuration - use defaults with draft overrides
    uiModules: draft.uiModules.map((um) => ({
      module: um.module as ProjectTemplate["uiModules"][number]["module"],
      enabled: um.enabled,
      order: um.order,
    })),
    defaultMode: "writer",
    dmModeEnabled: true,

    // Linter rules from draft
    linterRules: draft.linterRules.map((lr) => ({
      id: lr.id,
      label: lr.label,
      description: lr.description,
      defaultSeverity: lr.defaultSeverity === "error" ? "error"
        : lr.defaultSeverity === "warning" ? "warning"
        : lr.defaultSeverity === "info" ? "info"
        : "info",
      category: linterCategoryMap[lr.category] ?? "consistency",
    })) as LinterRuleDefinition[],
  };
}
