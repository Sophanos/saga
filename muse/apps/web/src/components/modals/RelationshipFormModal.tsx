import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Save, Loader2, AlertCircle } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  ScrollArea,
  FormField,
  Input,
  Select,
  TextArea,
} from "@mythos/ui";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useMythosStore } from "../../stores";
import type { PropertyValue } from "@mythos/core";
import {
  JsonSchemaObjectEditor,
  getObjectSchemaInfo,
  isPlainObject,
  normalizeSchemaType,
  parseJsonValue,
  type JsonSchema,
} from "../forms/JsonSchemaObjectEditor";

// ============================================================================
// Types
// ============================================================================

type FormMode = "create" | "edit";

type ResolvedRegistry = {
  relationshipTypes?: Record<
    string,
    { schema?: JsonSchema; displayName?: string; icon?: string; color?: string }
  >;
};

export type RelationshipFormData = {
  sourceId: string;
  targetId: string;
  type: string;
  bidirectional: boolean;
  strength?: number;
  notes?: string;
  metadata: Record<string, PropertyValue>;
};

export interface RelationshipFormModalProps {
  isOpen: boolean;
  mode: FormMode;
  relationshipId?: string;
  initial?: Partial<RelationshipFormData>;
  isSaving?: boolean;
  saveError?: string | null;
  onClose: () => void;
  onSave: (data: RelationshipFormData) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getInitialFormData(
  mode: FormMode,
  relationship: RelationshipFormData | null,
  initial?: Partial<RelationshipFormData>
): RelationshipFormData {
  if (mode === "edit" && relationship) {
    return {
      sourceId: relationship.sourceId,
      targetId: relationship.targetId,
      type: relationship.type,
      bidirectional: relationship.bidirectional ?? false,
      strength: relationship.strength,
      notes: relationship.notes ?? "",
      metadata: relationship.metadata ?? {},
    };
  }

  return {
    sourceId: initial?.sourceId ?? "",
    targetId: initial?.targetId ?? "",
    type: initial?.type ?? "",
    bidirectional: initial?.bidirectional ?? false,
    strength: initial?.strength,
    notes: initial?.notes ?? "",
    metadata: initial?.metadata ?? {},
  };
}

export function RelationshipFormModal({
  isOpen,
  mode,
  relationshipId,
  initial,
  isSaving = false,
  saveError = null,
  onClose,
  onSave,
}: RelationshipFormModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const relationships = useMythosStore((s) => s.world.relationships);
  const entities = useMythosStore((s) => s.world.entities);
  const projectId = useMythosStore((s) => s.project.currentProject?.id);

  const registry = useQuery(
    api.projectTypeRegistry.getResolved,
    projectId ? { projectId } : "skip"
  ) as ResolvedRegistry | undefined;

  const relationship = useMemo(() => {
    if (!relationshipId) return null;
    const found = relationships.find((rel) => rel.id === relationshipId);
    if (!found) return null;
    return {
      sourceId: found.sourceId,
      targetId: found.targetId,
      type: found.type,
      bidirectional: found.bidirectional ?? false,
      strength: found.strength ?? undefined,
      notes: found.notes ?? "",
      metadata: (found.metadata ?? {}) as Record<string, PropertyValue>,
    } satisfies RelationshipFormData;
  }, [relationshipId, relationships]);

  const [formData, setFormData] = useState<RelationshipFormData>(() =>
    getInitialFormData(mode, relationship, initial)
  );
  const [rawMetadataJson, setRawMetadataJson] = useState(() =>
    JSON.stringify(
      getInitialFormData(mode, relationship, initial).metadata ?? {},
      null,
      2
    )
  );
  const [isEditingRawMetadata, setIsEditingRawMetadata] = useState(false);

  const relationshipTypeOptions = useMemo(() => {
    const types = Object.keys(registry?.relationshipTypes ?? {});
    return types.sort((a, b) => {
      const aLabel = registry?.relationshipTypes?.[a]?.displayName ?? a;
      const bLabel = registry?.relationshipTypes?.[b]?.displayName ?? b;
      return aLabel.localeCompare(bLabel);
    });
  }, [registry]);
  const relationshipTypeOptionsKey = useMemo(
    () => relationshipTypeOptions.slice().sort().join(","),
    [relationshipTypeOptions]
  );

  const schemaInfo = useMemo(() => {
    const schema = registry?.relationshipTypes?.[formData.type]?.schema;
    return getObjectSchemaInfo(schema);
  }, [registry, formData.type]);

  const schemaFieldEntries = useMemo(() => {
    if (!schemaInfo) return [];
    return Object.entries(schemaInfo.properties).map(([key, schema]) => ({
      key,
      schema,
      required: schemaInfo.required.includes(key),
    }));
  }, [schemaInfo]);

  const showSchemaFields = schemaFieldEntries.length > 0;
  const allowRawMetadata =
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
  const showRawMetadataEditor =
    (!showSchemaFields && allowRawMetadata) ||
    schemaNeedsRawEditor ||
    Boolean(schemaInfo?.additionalProperties);

  useEffect(() => {
    if (!isOpen) return;
    const nextInitial = getInitialFormData(mode, relationship, initial);
    setFormData(nextInitial);
    setRawMetadataJson(JSON.stringify(nextInitial.metadata ?? {}, null, 2));
    setErrors({});
    setIsEditingRawMetadata(false);
  }, [isOpen, mode, relationship, relationshipId, initial]);

  useEffect(() => {
    if (!isOpen || mode !== "create") return;
    if (relationshipTypeOptions.length === 0) return;
    if (!formData.type || !relationshipTypeOptions.includes(formData.type)) {
      setFormData((prev) => ({ ...prev, type: relationshipTypeOptions[0] ?? "" }));
    }
  }, [
    formData.type,
    isOpen,
    mode,
    relationshipTypeOptionsKey,
    relationshipTypeOptions,
  ]);

  useEffect(() => {
    if (!isOpen || isEditingRawMetadata) return;
    setRawMetadataJson(JSON.stringify(formData.metadata ?? {}, null, 2));
  }, [formData.metadata, isEditingRawMetadata, isOpen]);

  const updateFormData = useCallback(
    (updates: Partial<RelationshipFormData>) => {
      setFormData((prev) => ({ ...prev, ...updates }));
      const fieldNames = Object.keys(updates);
      setErrors((prev) => {
        const next = { ...prev };
        fieldNames.forEach((f) => delete next[f]);
        return next;
      });
    },
    []
  );

  const handleMetadataChange = useCallback(
    (nextMetadata: Record<string, PropertyValue>) => {
      setFormData((prev) => ({ ...prev, metadata: nextMetadata }));
      setErrors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key === "metadata" || key.startsWith("metadata.")) {
            delete next[key];
          }
        });
        return next;
      });
    },
    []
  );

  const handleRawMetadataChange = useCallback(
    (value: string) => {
      setRawMetadataJson(value);
      const parsed = parseJsonValue(value);
      if (!parsed.ok) {
        setErrors((prev) => ({
          ...prev,
          metadata: parsed.message,
        }));
        return;
      }

      setErrors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key === "metadata" || key.startsWith("metadata.")) {
            delete next[key];
          }
        });
        return next;
      });

      if (parsed.value === undefined) {
        updateFormData({ metadata: {} });
        return;
      }

      if (!isPlainObject(parsed.value)) {
        setErrors((prev) => ({
          ...prev,
          metadata: "Metadata must be a JSON object.",
        }));
        return;
      }

      updateFormData({ metadata: parsed.value as Record<string, PropertyValue> });
    },
    [updateFormData]
  );

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.type) {
      newErrors["type"] = "Relationship type is required";
    }

    if (!formData.sourceId || !formData.targetId) {
      newErrors["metadata"] = "Source and target are required";
    }

    if (schemaInfo) {
      for (const requiredKey of schemaInfo.required) {
        const value = formData.metadata?.[requiredKey];
        const isMissing =
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0);
        if (isMissing) {
          newErrors[`metadata.${requiredKey}`] = "Required";
        }
      }
    }

    if (!showSchemaFields && !allowRawMetadata) {
      newErrors["metadata"] =
        "Schema does not allow additional metadata for this relationship.";
    } else if (showRawMetadataEditor) {
      const parsed = parseJsonValue(rawMetadataJson);
      if (!parsed.ok) {
        newErrors["metadata"] = parsed.message;
      } else if (parsed.value !== undefined && !isPlainObject(parsed.value)) {
        newErrors["metadata"] = "Metadata must be a JSON object.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    allowRawMetadata,
    formData,
    rawMetadataJson,
    schemaInfo,
    showRawMetadataEditor,
    showSchemaFields,
  ]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      onSave(formData);
    },
    [formData, onSave, validate]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  const sourceName = entities.get(formData.sourceId)?.name ?? "Unknown";
  const targetName = entities.get(formData.targetId)?.name ?? "Unknown";
  const title = mode === "create" ? "Create Relationship" : "Edit Relationship";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="relationship-form-title"
      data-testid="relationship-form-modal"
    >
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <Card className="relative z-10 w-full max-w-2xl mx-4 shadow-xl border-mythos-border-default max-h-[90vh] flex flex-col">
        <CardHeader className="pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle id="relationship-form-title" className="text-lg">
              {title}
            </CardTitle>
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

                <div className="grid grid-cols-1 gap-4">
                  <FormField label="Source">
                    <Input value={sourceName} disabled />
                  </FormField>
                  <FormField label="Target">
                    <Input value={targetName} disabled />
                  </FormField>

                  <FormField label="Relationship Type" required error={errors["type"]}>
                    <Select
                      value={formData.type}
                      onChange={(next) => updateFormData({ type: next })}
                      options={[
                        { value: "", label: "Select a type..." },
                        ...relationshipTypeOptions.map((type) => ({
                          value: type,
                          label: registry?.relationshipTypes?.[type]?.displayName ?? type,
                        })),
                      ]}
                      data-testid="relationship-form-type"
                    />
                  </FormField>

                  <FormField label="Bidirectional">
                    <Select
                      value={formData.bidirectional ? "true" : "false"}
                      onChange={(next) => updateFormData({ bidirectional: next === "true" })}
                      options={[
                        { value: "false", label: "No" },
                        { value: "true", label: "Yes" },
                      ]}
                      data-testid="relationship-form-bidirectional"
                    />
                  </FormField>

                  <FormField label="Strength">
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={formData.strength ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw.trim() === "") {
                          updateFormData({ strength: undefined });
                          return;
                        }
                        const next = Number(raw);
                        if (Number.isNaN(next)) return;
                        updateFormData({ strength: Math.min(1, Math.max(0, next)) });
                      }}
                      data-testid="relationship-form-strength"
                    />
                  </FormField>

                  <FormField label="Notes">
                    <TextArea
                      value={formData.notes ?? ""}
                      onChange={(value) => updateFormData({ notes: value })}
                      rows={3}
                      data-testid="relationship-form-notes"
                    />
                  </FormField>
                </div>

                {(showSchemaFields || showRawMetadataEditor || !schemaInfo) && (
                  <JsonSchemaObjectEditor
                    schema={registry?.relationshipTypes?.[formData.type]?.schema ?? null}
                    value={formData.metadata ?? {}}
                    onChange={handleMetadataChange}
                    rawJson={rawMetadataJson}
                    onRawJsonChange={handleRawMetadataChange}
                    onRawFocus={() => setIsEditingRawMetadata(true)}
                    onRawBlur={() => setIsEditingRawMetadata(false)}
                    errors={errors}
                    pathPrefix="metadata"
                    title="Metadata"
                    fieldTestIdPrefix="relationship-form-metadata"
                    rawTestId="relationship-form-metadata-json"
                  />
                )}
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="flex justify-between gap-2 pt-4 flex-shrink-0 border-t border-mythos-border-default">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              data-testid="relationship-form-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="gap-1.5 min-w-[120px]"
              disabled={isSaving}
              data-testid="relationship-form-save"
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
