import type {
  GenerateTemplateArgs,
  GenerateTemplateResult,
  GenesisEntity,
  TemplateDraft,
  TemplateDocumentKind,
  TemplateEntityKind,
  TemplateLinterRule,
  TemplateRelationshipKind,
  TemplateUIModule,
} from "../../../packages/agent-protocol/src/tools";
import {
  DOMAIN_BLUEPRINTS,
  ENTITY_CATEGORY_COLORS,
  ENTITY_CATEGORY_VALUES,
  FIELD_KIND_VALUES,
  LINTER_CATEGORY_VALUES,
  LINTER_SEVERITY_VALUES,
  RELATIONSHIP_CATEGORY_VALUES,
  UI_MODULE_ALLOWLIST,
  type DomainBlueprint,
  type DomainKey,
} from "./generateTemplateBlueprints";
import { DEFAULT_MODEL, OPENROUTER_API_URL } from "./openRouter";

type NormalizedGenerateTemplateArgs = {
  prompt: string;
  baseTemplateId?: string;
  complexity: "simple" | "standard" | "complex";
  genreHints?: string[];
};

const GENERATE_TEMPLATE_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["template"],
  properties: {
    template: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "description",
        "category",
        "tags",
        "entityKinds",
        "relationshipKinds",
        "documentKinds",
        "uiModules",
        "linterRules",
      ],
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        baseTemplateId: { type: "string" },
        entityKinds: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "label", "labelPlural", "category", "color", "icon", "fields"],
            properties: {
              kind: { type: "string" },
              label: { type: "string" },
              labelPlural: { type: "string" },
              category: { type: "string", enum: ENTITY_CATEGORY_VALUES },
              color: { type: "string" },
              icon: { type: "string" },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "label", "kind"],
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    kind: { type: "string", enum: FIELD_KIND_VALUES },
                    description: { type: "string" },
                  },
                },
              },
            },
          },
        },
        relationshipKinds: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "label", "category"],
            properties: {
              kind: { type: "string" },
              label: { type: "string" },
              category: { type: "string", enum: RELATIONSHIP_CATEGORY_VALUES },
            },
          },
        },
        documentKinds: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "label"],
            properties: {
              kind: { type: "string" },
              label: { type: "string" },
              allowChildren: { type: "boolean" },
            },
          },
        },
        uiModules: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["module", "enabled"],
            properties: {
              module: { type: "string", enum: Array.from(UI_MODULE_ALLOWLIST) },
              enabled: { type: "boolean" },
              order: { type: "number" },
            },
          },
        },
        linterRules: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "description", "defaultSeverity", "category"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              description: { type: "string" },
              defaultSeverity: { type: "string", enum: LINTER_SEVERITY_VALUES },
              category: { type: "string", enum: LINTER_CATEGORY_VALUES },
            },
          },
        },
      },
    },
    suggestedStarterEntities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tempId", "name", "type"],
        properties: {
          tempId: { type: "string" },
          name: { type: "string" },
          type: { type: "string" },
          description: { type: "string" },
          properties: { type: "object", additionalProperties: true },
        },
      },
    },
  },
} as const;

function normalizeGenerateTemplateArgs(input: unknown): NormalizedGenerateTemplateArgs {
  if (!input || typeof input !== "object") {
    throw new Error("generate_template input is required");
  }
  const record = input as Record<string, unknown>;
  const prompt =
    (typeof record["prompt"] === "string" && (record["prompt"] as string).trim()) ||
    (typeof record["storyDescription"] === "string" && (record["storyDescription"] as string).trim()) ||
    (typeof record["description"] === "string" && (record["description"] as string).trim());

  if (!prompt) {
    throw new Error("generate_template requires a prompt");
  }

  const complexityRaw = typeof record["complexity"] === "string" ? record["complexity"] : "standard";
  const complexity =
    complexityRaw === "simple" || complexityRaw === "complex" ? complexityRaw : "standard";
  const baseTemplateId = typeof record["baseTemplateId"] === "string" ? record["baseTemplateId"] : undefined;
  const genreHints = Array.isArray(record["genreHints"])
    ? (record["genreHints"] as unknown[]).filter((hint) => typeof hint === "string")
    : undefined;

  return {
    prompt,
    baseTemplateId,
    complexity,
    genreHints,
  };
}

function resolveDomainKey(baseTemplateId?: string): DomainKey {
  if (!baseTemplateId) return "story";
  const normalized = baseTemplateId.trim().toLowerCase();
  if (normalized === "writer" || normalized === "story" || normalized === "world") return "story";
  if (normalized === "product") return "product";
  if (normalized === "engineering") return "engineering";
  if (normalized === "design") return "design";
  if (normalized === "comms" || normalized === "communications") return "comms";
  if (normalized === "cinema" || normalized === "film") return "cinema";
  return "story";
}

function buildGenerateTemplatePrompts(params: {
  args: NormalizedGenerateTemplateArgs;
  domain: DomainBlueprint;
  resolvedBaseTemplateId: string | undefined;
}): { systemPrompt: string; userPrompt: string } {
  const { args, domain, resolvedBaseTemplateId } = params;
  const genreHints = args.genreHints?.length ? args.genreHints.join(", ") : "";

  const systemPrompt = [
    "You are a Mythos template architect.",
    "Your task is to generate a TemplateDraft that defines entity kinds, relationships, document kinds, UI modules, and linter rules.",
    "Return JSON only. Do not include commentary or markdown.",
    "Stay within 6-12 entity kinds, 4-10 relationship kinds, and 3-8 document kinds.",
    "Keep labels short, concrete, and readable.",
  ].join("\n");

  const userPrompt = [
    `Domain: ${domain.label}`,
    `Summary: ${domain.summary}`,
    resolvedBaseTemplateId ? `Base template id: ${resolvedBaseTemplateId}` : "",
    args.complexity ? `Complexity: ${args.complexity}` : "",
    genreHints ? `Genre hints: ${genreHints}` : "",
    "",
    "Use these blueprint seeds as a starting point:",
    JSON.stringify(
      {
        entityKindSeeds: domain.entityKindSeeds,
        relationshipKindSeeds: domain.relationshipKindSeeds,
        documentKindSeeds: domain.documentKindSeeds,
        uiModuleSeeds: domain.uiModuleSeeds,
        linterRuleSeeds: domain.linterRuleSeeds,
      },
      null,
      2
    ),
    "",
    `User idea: ${args.prompt}`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  return { systemPrompt, userPrompt };
}

function normalizeKind(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sanitizeStringArray(values: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) return fallback;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function ensureHexColor(value: string | undefined, category: TemplateEntityKind["category"]): string {
  if (value && /^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return ENTITY_CATEGORY_COLORS[category] ?? "#8b5cf6";
}

function sanitizeEntityKinds(
  values: unknown,
  fallback: DomainBlueprint
): TemplateEntityKind[] {
  const seeds = fallback.entityKindSeeds;
  const list = Array.isArray(values) ? (values as TemplateEntityKind[]) : [];
  const seen = new Set<string>();
  const result: TemplateEntityKind[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rawKind = typeof item.kind === "string" ? item.kind : "";
    const kind = normalizeKind(rawKind);
    if (!kind || seen.has(kind)) continue;
    const category = ENTITY_CATEGORY_VALUES.includes(item.category)
      ? item.category
      : "abstract";
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : kind.replace(/_/g, " ");
    const labelPlural = typeof item.labelPlural === "string" && item.labelPlural.trim()
      ? item.labelPlural.trim()
      : `${label}s`;
    const fields = Array.isArray(item.fields) ? item.fields : [];
    const normalizedFields = fields
      .map((field: unknown) => {
        if (!field || typeof field !== "object") return null;
        const f = field as Record<string, unknown>;
        const fieldId = typeof f["id"] === "string" ? normalizeKind(f["id"]) : "";
        const fieldLabel = typeof f["label"] === "string" ? (f["label"] as string).trim() : "";
        const fieldKind = (FIELD_KIND_VALUES as readonly string[]).includes(f["kind"] as string)
          ? (f["kind"] as TemplateEntityKind["fields"][number]["kind"])
          : "text";
        if (!fieldId || !fieldLabel) return null;
        return {
          id: fieldId,
          label: fieldLabel,
          kind: fieldKind,
          description: typeof f["description"] === "string" ? f["description"] : undefined,
        };
      })
      .filter(Boolean) as TemplateEntityKind["fields"];

    const fieldsWithDefault = normalizedFields.length
      ? normalizedFields
      : [
          { id: "summary", label: "Summary", kind: "text" as const },
          { id: "tags", label: "Tags", kind: "tags" as const },
        ];

    result.push({
      kind,
      label,
      labelPlural,
      category,
      color: ensureHexColor(item.color, category),
      icon: typeof item.icon === "string" && item.icon.trim() ? item.icon.trim() : "sparkles",
      fields: fieldsWithDefault,
    });
    seen.add(kind);
    if (result.length >= 18) break;
  }

  if (result.length > 0) return result;

  return seeds.map((seed) => {
    const labelPlural = `${seed.label}s`;
    return {
      kind: seed.kind,
      label: seed.label,
      labelPlural,
      category: seed.category,
      color: ensureHexColor(undefined, seed.category),
      icon: "sparkles",
      fields: [
        { id: "summary", label: "Summary", kind: "text" },
        { id: "tags", label: "Tags", kind: "tags" },
      ],
    };
  });
}

function sanitizeRelationshipKinds(
  values: unknown,
  fallback: DomainBlueprint
): TemplateRelationshipKind[] {
  const seeds = fallback.relationshipKindSeeds;
  const list = Array.isArray(values) ? (values as TemplateRelationshipKind[]) : [];
  const seen = new Set<string>();
  const result: TemplateRelationshipKind[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rawKind = typeof item.kind === "string" ? item.kind : "";
    const kind = normalizeKind(rawKind);
    if (!kind || seen.has(kind)) continue;
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : kind.replace(/_/g, " ");
    const category = RELATIONSHIP_CATEGORY_VALUES.includes(item.category)
      ? item.category
      : "custom";
    result.push({ kind, label, category });
    seen.add(kind);
    if (result.length >= 16) break;
  }

  if (result.length > 0) return result;

  return seeds.map((seed) => ({
    kind: seed.kind,
    label: seed.label,
    category: seed.category,
  }));
}

function sanitizeDocumentKinds(
  values: unknown,
  fallback: DomainBlueprint
): TemplateDocumentKind[] {
  const seeds = fallback.documentKindSeeds;
  const list = Array.isArray(values) ? (values as TemplateDocumentKind[]) : [];
  const seen = new Set<string>();
  const result: TemplateDocumentKind[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rawKind = typeof item.kind === "string" ? item.kind : "";
    const kind = normalizeKind(rawKind);
    if (!kind || seen.has(kind)) continue;
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : kind.replace(/_/g, " ");
    result.push({
      kind,
      label,
      allowChildren: typeof item.allowChildren === "boolean" ? item.allowChildren : false,
    });
    seen.add(kind);
    if (result.length >= 10) break;
  }

  if (result.length > 0) return result;

  return seeds.map((seed) => ({
    kind: seed.kind,
    label: seed.label,
    allowChildren: seed.allowChildren ?? false,
  }));
}

function sanitizeUIModules(values: unknown, fallback: DomainBlueprint): TemplateUIModule[] {
  const seeds = fallback.uiModuleSeeds;
  const list = Array.isArray(values) ? (values as TemplateUIModule[]) : [];
  const result: TemplateUIModule[] = [];
  const seen = new Set<string>();

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const moduleName = typeof item.module === "string" ? item.module : "";
    if (!moduleName || !UI_MODULE_ALLOWLIST.has(moduleName) || seen.has(moduleName)) continue;
    result.push({
      module: moduleName,
      enabled: typeof item.enabled === "boolean" ? item.enabled : true,
      order: typeof item.order === "number" ? item.order : undefined,
    });
    seen.add(moduleName);
  }

  if (result.length > 0) return result;

  return seeds.filter((seed) => UI_MODULE_ALLOWLIST.has(seed.module as string));
}

function sanitizeLinterRules(values: unknown, fallback: DomainBlueprint): TemplateLinterRule[] {
  const seeds = fallback.linterRuleSeeds;
  const list = Array.isArray(values) ? (values as TemplateLinterRule[]) : [];
  const seen = new Set<string>();
  const result: TemplateLinterRule[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rawId = typeof item.id === "string" ? item.id : "";
    const id = normalizeKind(rawId);
    if (!id || seen.has(id)) continue;
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : id.replace(/_/g, " ");
    const description = typeof item.description === "string" && item.description.trim()
      ? item.description.trim()
      : label;
    const defaultSeverity = LINTER_SEVERITY_VALUES.includes(item.defaultSeverity)
      ? item.defaultSeverity
      : "info";
    const category = LINTER_CATEGORY_VALUES.includes(item.category)
      ? item.category
      : "style";
    result.push({ id, label, description, defaultSeverity, category });
    seen.add(id);
    if (result.length >= 12) break;
  }

  if (result.length > 0) return result;

  return seeds.map((seed) => ({
    id: seed.id,
    label: seed.label,
    description: seed.description,
    defaultSeverity: seed.defaultSeverity,
    category: seed.category,
  }));
}

function sanitizeTemplateDraft(
  draft: TemplateDraft,
  domain: DomainBlueprint,
  baseTemplateId?: string
): TemplateDraft {
  const name = typeof draft.name === "string" && draft.name.trim()
    ? draft.name.trim()
    : `${domain.label} Template`;
  const description = typeof draft.description === "string" && draft.description.trim()
    ? draft.description.trim()
    : domain.summary;
  const category = typeof draft.category === "string" && draft.category.trim()
    ? draft.category.trim()
    : domain.tags[0] ?? "custom";
  const tags = sanitizeStringArray(draft.tags, domain.tags);

  return {
    name,
    description,
    category,
    tags,
    baseTemplateId: baseTemplateId ?? draft.baseTemplateId,
    entityKinds: sanitizeEntityKinds(draft.entityKinds, domain),
    relationshipKinds: sanitizeRelationshipKinds(draft.relationshipKinds, domain),
    documentKinds: sanitizeDocumentKinds(draft.documentKinds, domain),
    uiModules: sanitizeUIModules(draft.uiModules, domain),
    linterRules: sanitizeLinterRules(draft.linterRules, domain),
  };
}

async function requestGenerateTemplateResult(params: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  responseFormat: Record<string, unknown>;
}): Promise<GenerateTemplateResult> {
  const { apiKey, systemPrompt, userPrompt, responseFormat } = params;
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://mythos.app",
      "X-Title": "Saga AI",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: responseFormat,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  return JSON.parse(content) as GenerateTemplateResult;
}

export async function executeGenerateTemplate(input: GenerateTemplateArgs): Promise<GenerateTemplateResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const normalized = normalizeGenerateTemplateArgs(input);
  const domainKey = resolveDomainKey(normalized.baseTemplateId);
  const domain = DOMAIN_BLUEPRINTS[domainKey];
  const fallbackBaseTemplateId: Record<DomainKey, string> = {
    story: "writer",
    product: "product",
    engineering: "engineering",
    design: "design",
    comms: "comms",
    cinema: "cinema",
  };
  const resolvedBaseTemplateId = normalized.baseTemplateId ?? fallbackBaseTemplateId[domainKey];
  const { systemPrompt, userPrompt } = buildGenerateTemplatePrompts({
    args: normalized,
    domain,
    resolvedBaseTemplateId,
  });

  let rawResult: GenerateTemplateResult;
  try {
    rawResult = await requestGenerateTemplateResult({
      apiKey,
      systemPrompt,
      userPrompt,
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "generate_template_result",
          schema: GENERATE_TEMPLATE_RESULT_SCHEMA,
        },
      },
    });
  } catch (error) {
    rawResult = await requestGenerateTemplateResult({
      apiKey,
      systemPrompt,
      userPrompt,
      responseFormat: { type: "json_object" },
    });
  }

  const template = rawResult?.template ?? {
    name: "",
    description: "",
    category: "custom",
    tags: [],
    baseTemplateId: resolvedBaseTemplateId,
    entityKinds: [],
    relationshipKinds: [],
    documentKinds: [],
    uiModules: [],
    linterRules: [],
  };

  const sanitizedTemplate = sanitizeTemplateDraft(template, domain, resolvedBaseTemplateId);
  const suggestedStarterEntities = Array.isArray(rawResult?.suggestedStarterEntities)
    ? (rawResult.suggestedStarterEntities as GenesisEntity[])
    : undefined;

  return {
    template: sanitizedTemplate,
    suggestedStarterEntities,
  };
}
