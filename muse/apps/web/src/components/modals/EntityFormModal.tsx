import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { X, Wand2, Save, Loader2, AlertCircle, Plus } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  ScrollArea,
  Input,
  FormField,
  TextArea,
  cn,
} from "@mythos/ui";
import type {
  Entity,
  GraphEntityType,
  PropertyValue,
} from "@mythos/core";
import {
  WRITER_ENTITY_TYPES,
  getGraphEntityIcon,
  getGraphEntityLabel,
  getRegistryEntityHexColor,
  type ProjectGraphRegistryDisplay,
} from "@mythos/core";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { executeNameGenerator } from "../../services/ai/agentRuntimeClient";
import { useMythosStore } from "../../stores";
import { resolveLucideIcon } from "../../utils/iconResolver";
import {
  JsonSchemaObjectEditor,
  getObjectSchemaInfo,
  isPlainObject,
  normalizeSchemaType,
  parseJsonValue,
  type JsonSchema,
} from "../forms/JsonSchemaObjectEditor";
import { useAuthStore } from "../../stores/auth";
import type { NameCulture, NameStyle } from "@mythos/agent-protocol";

// ============================================================================
// Types
// ============================================================================

type FormMode = "create" | "edit";

type ResolvedRegistry = {
  entityTypes: Record<
    string,
    { schema?: JsonSchema; displayName?: string; icon?: string; color?: string }
  >;
  relationshipTypes: Record<
    string,
    { displayName?: string }
  >;
};

interface EntityFormData {
  name: string;
  aliases: string[];
  type: GraphEntityType;
  notes?: string;
  properties?: Record<string, PropertyValue>;
}

interface EntityFormModalProps {
  isOpen: boolean;
  mode: FormMode;
  entityType?: GraphEntityType;
  entity?: Entity;
  isSaving?: boolean;
  saveError?: string | null;
  onClose: () => void;
  onSave: (data: EntityFormData) => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default entity types for fallback when registry is unavailable.
 */
const DEFAULT_ENTITY_TYPES: GraphEntityType[] = WRITER_ENTITY_TYPES;

// ============================================================================
// Entity Type Selector
// ============================================================================

interface EntityTypeOption {
  type: GraphEntityType;
  label: string;
  iconName?: string;
  color?: string;
}

interface EntityTypeSelectorProps {
  value: GraphEntityType;
  onChange: (type: GraphEntityType) => void;
  options: EntityTypeOption[];
  disabled?: boolean;
}

function EntityTypeSelector({
  value,
  onChange,
  options,
  disabled,
}: EntityTypeSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {options.map((option) => {
        const Icon = resolveLucideIcon(option.iconName);
        const isSelected = option.type === value;
        const color = option.color ?? "#64748b";

        return (
          <button
            key={option.type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.type)}
            data-testid={`entity-form-type-${option.type}`}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
              isSelected
                ? "border-mythos-accent-primary bg-mythos-accent-primary/10"
                : "border-mythos-border-default hover:border-mythos-text-muted/50 hover:bg-mythos-bg-tertiary",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Icon
              className="w-5 h-5"
              style={{ color: isSelected ? color : color }}
            />
            <span
              className={cn(
                "text-xs font-medium",
                isSelected ? "text-mythos-accent-primary" : "text-mythos-text-secondary"
              )}
              style={!isSelected ? { color } : undefined}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AliasesField({
  aliases,
  onChange,
}: {
  aliases: string[];
  onChange: (aliases: string[]) => void;
}) {
  const [newAlias, setNewAlias] = useState("");

  const handleAdd = () => {
    if (newAlias.trim()) {
      onChange([...aliases, newAlias.trim()]);
      setNewAlias("");
    }
  };

  return (
    <FormField label="Aliases">
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add an alias..."
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAdd}
            disabled={!newAlias.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {aliases.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {aliases.map((alias, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-mythos-bg-tertiary text-mythos-text-secondary"
              >
                {alias}
                <button
                  type="button"
                  onClick={() => onChange(aliases.filter((_, i) => i !== index))}
                  className="hover:text-mythos-accent-red transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </FormField>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

function getInitialFormData(mode: FormMode, entityType?: GraphEntityType, entity?: Entity): EntityFormData {
  if (mode === "edit" && entity) {
    return {
      name: entity.name,
      aliases: entity.aliases,
      type: entity.type,
      notes: entity.notes,
      properties: entity.properties ?? {},
    };
  }

  return {
    name: "",
    aliases: [],
    type: entityType || "character",
    notes: "",
    properties: {},
  };
}

export function EntityFormModal({
  isOpen,
  mode,
  entityType,
  entity,
  isSaving = false,
  saveError = null,
  onClose,
  onSave,
}: EntityFormModalProps) {
  const [formData, setFormData] = useState<EntityFormData>(() =>
    getInitialFormData(mode, entityType, entity)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rawPropertiesJson, setRawPropertiesJson] = useState(() =>
    JSON.stringify(
      getInitialFormData(mode, entityType, entity).properties ?? {},
      null,
      2
    )
  );
  const [isEditingRawProperties, setIsEditingRawProperties] = useState(false);

  // Name generation state
  const [isGeneratingNames, setIsGeneratingNames] = useState(false);
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);
  const user = useAuthStore((state) => state.user);
  const currentProject = useMythosStore((state) => state.project.currentProject);
  const projectId = currentProject?.id;
  const registry = useQuery(
    api.projectTypeRegistry.getResolved,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  ) as ResolvedRegistry | undefined;

  // Cast for helper functions that expect ProjectGraphRegistryDisplay
  const registryDisplay = registry as ProjectGraphRegistryDisplay | null | undefined;

  const schemaInfo = useMemo(() => {
    const schema = registry?.entityTypes?.[formData.type]?.schema;
    return getObjectSchemaInfo(schema);
  }, [registry, formData.type]);

  const registryEntityTypes = useMemo(
    () => Object.keys(registry?.entityTypes ?? {}) as GraphEntityType[],
    [registry]
  );
  const registryEntityTypesKey = useMemo(
    () => registryEntityTypes.slice().sort().join(","),
    [registryEntityTypes]
  );

  const entityTypeOptions = useMemo(() => {
    const types = registryEntityTypes.length > 0 ? registryEntityTypes : DEFAULT_ENTITY_TYPES;
    const sorted = [...types].sort((a, b) => {
      const aLabel = getGraphEntityLabel(registryDisplay ?? null, a);
      const bLabel = getGraphEntityLabel(registryDisplay ?? null, b);
      return aLabel.localeCompare(bLabel);
    });
    return sorted.map((type) => ({
      type,
      label: getGraphEntityLabel(registryDisplay ?? null, type),
      iconName: getGraphEntityIcon(registryDisplay ?? null, type),
      color: getRegistryEntityHexColor(registryDisplay ?? null, type),
    }));
  }, [registryEntityTypesKey, registry]);

  const schemaFieldEntries = useMemo(() => {
    if (!schemaInfo) return [];
    return Object.entries(schemaInfo.properties).map(([key, schema]) => ({
      key,
      schema,
      required: schemaInfo.required.includes(key),
    }));
  }, [schemaInfo]);

  const showSchemaFields = schemaFieldEntries.length > 0;
  const allowRawProperties =
    !schemaInfo || schemaInfo.additionalProperties !== false;
  const schemaNeedsRawEditor = schemaFieldEntries.some((field) => {
    const fieldType = normalizeSchemaType(field.schema.type);
    const hasEnum = Array.isArray(field.schema.enum) && field.schema.enum.length > 0;
    if (hasEnum) return false;
    if (fieldType === "string" || fieldType === "number" || fieldType === "integer") {
      return false;
    }
    if (fieldType === "boolean") return false;
    if (fieldType === "array") {
      const itemType = normalizeSchemaType(field.schema.items?.type);
      return itemType !== "string" || Boolean(field.schema.items?.enum);
    }
    return fieldType !== undefined;
  });
  const showRawPropertiesEditor =
    (!showSchemaFields && allowRawProperties) ||
    schemaNeedsRawEditor ||
    Boolean(schemaInfo?.additionalProperties);

  // Reset form when modal opens with different entity/mode
  useEffect(() => {
    if (isOpen) {
      const initial = getInitialFormData(mode, entityType, entity);
      setFormData(initial);
      setRawPropertiesJson(JSON.stringify(initial.properties ?? {}, null, 2));
      setErrors({});
      setGeneratedNames([]);
      setIsEditingRawProperties(false);
    }
  }, [isOpen, mode, entityType, entity]);

  useEffect(() => {
    if (!isOpen || mode !== "create") return;
    const availableTypes =
      registryEntityTypes.length > 0 ? registryEntityTypes : DEFAULT_ENTITY_TYPES;
    if (availableTypes.length === 0) return;
    if (!availableTypes.includes(formData.type)) {
      setFormData((prev) => ({ ...prev, type: availableTypes[0], properties: {} }));
      setRawPropertiesJson("{}");
    }
  }, [
    formData.type,
    isOpen,
    mode,
    registryEntityTypesKey,
    registryEntityTypes,
  ]);

  useEffect(() => {
    if (!isOpen || isEditingRawProperties) return;
    setRawPropertiesJson(JSON.stringify(formData.properties ?? {}, null, 2));
  }, [formData.properties, isEditingRawProperties, isOpen]);

  // Generate names using AI
  const handleGenerateNames = useCallback(async () => {
    const projectId = currentProject?.id;
    if (!projectId) {
      console.warn("[EntityFormModal] Missing project for name generation");
      return;
    }

    setIsGeneratingNames(true);
    setGeneratedNames([]);
    try {
      const prefs = user?.preferences?.writing;
      const result = await executeNameGenerator(
        {
          entityType: formData.type,
          count: 5,
          culture: (prefs?.namingCulture as NameCulture) || undefined,
          style: (prefs?.namingStyle as NameStyle) || "standard",
          avoid: formData.aliases.length > 0 ? formData.aliases : undefined,
        },
        { projectId }
      );
      setGeneratedNames(result.names.map((n) => n.name));
    } catch (error) {
      console.error("[EntityFormModal] Name generation failed:", error);
    } finally {
      setIsGeneratingNames(false);
    }
  }, [currentProject?.id, formData.type, formData.aliases, user?.preferences?.writing]);

  // Select a generated name
  const handleSelectName = useCallback((name: string) => {
    setFormData((prev) => ({ ...prev, name }));
    setGeneratedNames([]);
    // Clear name error
    setErrors((prev) => {
      const next = { ...prev };
      delete next["name"];
      return next;
    });
  }, []);

  const updateFormData = useCallback((updates: Partial<EntityFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const fieldNames = Object.keys(updates);
    setErrors((prev) => {
      const next = { ...prev };
      fieldNames.forEach((f) => delete next[f]);
      return next;
    });
  }, []);

  const handlePropertiesChange = useCallback(
    (nextProperties: Record<string, PropertyValue>) => {
      setFormData((prev) => ({ ...prev, properties: nextProperties }));
      setErrors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key === "properties" || key.startsWith("properties.")) {
            delete next[key];
          }
        });
        return next;
      });
    },
    []
  );

  const handleRawPropertiesChange = useCallback(
    (value: string) => {
      setRawPropertiesJson(value);
      const parsed = parseJsonValue(value);
      if (!parsed.ok) {
        setErrors((prev) => ({
          ...prev,
          properties: parsed.message,
        }));
        return;
      }

      setErrors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key === "properties" || key.startsWith("properties.")) {
            delete next[key];
          }
        });
        return next;
      });

      if (parsed.value === undefined) {
        updateFormData({ properties: {} });
        return;
      }

      if (!isPlainObject(parsed.value)) {
        setErrors((prev) => ({
          ...prev,
          properties: "Properties must be a JSON object.",
        }));
        return;
      }

      updateFormData({ properties: parsed.value as Record<string, PropertyValue> });
    },
    [updateFormData]
  );

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors["name"] = "Name is required";
    }

    if (schemaInfo) {
      for (const requiredKey of schemaInfo.required) {
        const value = formData.properties?.[requiredKey];
        const isMissing =
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0);
        if (isMissing) {
          newErrors[`properties.${requiredKey}`] = "Required";
        }
      }
    }

    if (!showSchemaFields && !allowRawProperties) {
      newErrors["properties"] =
        "Schema does not allow additional properties for this type.";
    } else if (showRawPropertiesEditor) {
      const parsed = parseJsonValue(rawPropertiesJson);
      if (!parsed.ok) {
        newErrors["properties"] = parsed.message;
      } else if (
        parsed.value !== undefined &&
        !isPlainObject(parsed.value)
      ) {
        newErrors["properties"] = "Properties must be a JSON object.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    formData,
    schemaInfo,
    showSchemaFields,
    allowRawProperties,
    rawPropertiesJson,
    showRawPropertiesEditor,
  ]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (validate()) {
        onSave(formData);
      }
    },
    [formData, validate, onSave]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  const title = mode === "create" ? "Create Entity" : `Edit ${entity?.name || "Entity"}`;
  const typeIconName = getGraphEntityIcon(registryDisplay ?? null, formData.type);
  const TypeIcon = resolveLucideIcon(typeIconName);
  const typeColor = getRegistryEntityHexColor(registryDisplay ?? null, formData.type);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entity-form-title"
      data-testid="entity-form-modal"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-2xl mx-4 shadow-xl border-mythos-border-default max-h-[90vh] flex flex-col">
        <CardHeader className="pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TypeIcon className="w-5 h-5" style={{ color: typeColor }} />
              <CardTitle id="entity-form-title" className="text-lg">
                {title}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          {mode === "create" && (
            <CardDescription className="pt-1">
              Add a new entity to your world. Choose a type and fill in the details.
            </CardDescription>
          )}
        </CardHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 overflow-hidden py-0">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6 pb-4">
                {saveError && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30 text-mythos-accent-red text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{saveError}</span>
                  </div>
                )}

                {/* Entity Type Selector (only for create mode) */}
                {mode === "create" && (
                  <FormField label="Entity Type" required>
                    <EntityTypeSelector
                      value={formData.type}
                      options={entityTypeOptions}
                      disabled={entityTypeOptions.length === 0}
                      onChange={(type) => {
                        updateFormData({ type, properties: {} });
                        setRawPropertiesJson("{}");
                      }}
                    />
                  </FormField>
                )}

                {/* Base Fields */}
                <div className="grid grid-cols-1 gap-4">
                  <FormField label="Name" required error={errors["name"]}>
                    <div className="flex gap-2">
                      <Input
                        value={formData.name}
                        onChange={(e) => updateFormData({ name: e.target.value })}
                        placeholder={`Enter ${getGraphEntityLabel(registryDisplay ?? null, formData.type)} name...`}
                        autoFocus
                        className="flex-1"
                        data-testid="entity-form-name"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleGenerateNames}
                        disabled={isGeneratingNames}
                        title="Generate name suggestions"
                        className="shrink-0"
                      >
                        {isGeneratingNames ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {/* Generated name suggestions */}
                    {generatedNames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {generatedNames.map((name, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectName(name)}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                              "bg-mythos-accent-primary/10 text-mythos-accent-primary",
                              "hover:bg-mythos-accent-primary/20 border border-mythos-accent-primary/30"
                            )}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </FormField>

                  <AliasesField
                    aliases={formData.aliases}
                    onChange={(aliases) => updateFormData({ aliases })}
                  />

                  <FormField label="Notes">
                    <TextArea
                      value={formData.notes || ""}
                      onChange={(v) => updateFormData({ notes: v })}
                      placeholder="General notes about this entity..."
                      rows={2}
                    />
                  </FormField>
                </div>

                <JsonSchemaObjectEditor
                  schema={registry?.entityTypes?.[formData.type]?.schema ?? null}
                  value={(formData.properties ?? {}) as Record<string, PropertyValue>}
                  onChange={handlePropertiesChange}
                  rawJson={rawPropertiesJson}
                  onRawJsonChange={handleRawPropertiesChange}
                  onRawFocus={() => setIsEditingRawProperties(true)}
                  onRawBlur={() => setIsEditingRawProperties(false)}
                  errors={errors}
                  pathPrefix="properties"
                  title={`${getGraphEntityLabel(registryDisplay ?? null, formData.type)} Properties`}
                  fieldTestIdPrefix="entity-form-prop"
                  rawTestId="entity-form-properties-json"
                />
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="flex justify-between gap-2 pt-4 flex-shrink-0 border-t border-mythos-border-default">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              data-testid="entity-form-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="gap-1.5 min-w-[120px]"
              disabled={isSaving}
              data-testid="entity-form-save"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Saving..." : mode === "create" ? "Create" : "Save Changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export type { EntityFormData, FormMode, EntityFormModalProps };
