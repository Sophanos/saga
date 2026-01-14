import { useMemo, useState } from "react";
import { Plus, Shapes, X } from "lucide-react";
import {
  Button,
  FormField,
  Input,
  Select,
  TextArea,
  cn,
} from "@mythos/ui";
import type { PropertyValue } from "@mythos/core";

export type JsonSchema = Record<string, unknown>;

export type JsonSchemaProperty = {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: unknown[];
  items?: {
    type?: string | string[];
    enum?: unknown[];
  };
};

export type ObjectSchemaInfo = {
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  additionalProperties?: boolean;
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeSchemaType(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const firstType = value.find((entry) => typeof entry === "string");
    return typeof firstType === "string" ? firstType : undefined;
  }
  return undefined;
}

export function humanizePropertyName(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getObjectSchemaInfo(schema: unknown): ObjectSchemaInfo | null {
  if (!isPlainObject(schema)) return null;

  const schemaType = normalizeSchemaType(schema["type"]);
  const propertiesRaw = schema["properties"];
  const properties = isPlainObject(propertiesRaw)
    ? (propertiesRaw as Record<string, JsonSchemaProperty>)
    : {};
  const required = Array.isArray(schema["required"])
    ? schema["required"].filter((key) => typeof key === "string")
    : [];
  const additionalProperties =
    typeof schema["additionalProperties"] === "boolean"
      ? schema["additionalProperties"]
      : undefined;

  if (schemaType && schemaType !== "object" && !propertiesRaw) {
    return null;
  }

  return {
    properties,
    required,
    additionalProperties,
  };
}

export function parseJsonValue(
  raw: string
): { ok: true; value: unknown } | { ok: false; message: string } {
  if (!raw.trim()) {
    return { ok: true, value: undefined };
  }

  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid JSON value",
    };
  }
}

interface StringListFieldProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  testId?: string;
}

function StringListField({
  label,
  values,
  onChange,
  placeholder,
  testId,
}: StringListFieldProps) {
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onChange([...values, newItem.trim()]);
    setNewItem("");
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <FormField label={label}>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder={placeholder}
            className="flex-1"
            data-testid={testId}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAdd}
            disabled={!newItem.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {values.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {values.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs",
                  "bg-mythos-bg-tertiary text-mythos-text-secondary"
                )}
              >
                {item}
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
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

export interface JsonSchemaObjectEditorProps {
  schema: JsonSchema | null;
  value: Record<string, PropertyValue>;
  onChange: (next: Record<string, PropertyValue>) => void;
  rawJson: string;
  onRawJsonChange: (value: string) => void;
  onRawFocus?: () => void;
  onRawBlur?: () => void;
  errors?: Record<string, string>;
  pathPrefix: "properties" | "metadata";
  title?: string;
  fieldTestIdPrefix?: string;
  rawTestId?: string;
}

export function JsonSchemaObjectEditor({
  schema,
  value,
  onChange,
  rawJson,
  onRawJsonChange,
  onRawFocus,
  onRawBlur,
  errors = {},
  pathPrefix,
  title,
  fieldTestIdPrefix,
  rawTestId,
}: JsonSchemaObjectEditorProps): JSX.Element {
  const schemaInfo = useMemo(() => getObjectSchemaInfo(schema), [schema]);

  const schemaFields = useMemo(() => {
    if (!schemaInfo) return [];
    return Object.entries(schemaInfo.properties).map(([key, schema]) => ({
      key,
      schema,
      required: schemaInfo.required.includes(key),
    }));
  }, [schemaInfo]);

  const showSchemaFields = schemaFields.length > 0;
  const allowRawProperties =
    !schemaInfo || schemaInfo.additionalProperties !== false;
  const schemaNeedsRawEditor = schemaFields.some((field) => {
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
  const showRawEditor =
    (!showSchemaFields && allowRawProperties) ||
    schemaNeedsRawEditor ||
    Boolean(schemaInfo?.additionalProperties);

  const updateValue = (key: string, nextValue: PropertyValue | undefined) => {
    const next = { ...value };
    if (nextValue === undefined) {
      delete next[key];
    } else {
      next[key] = nextValue;
    }
    onChange(next);
  };

  const renderSchemaField = (field: {
    key: string;
    schema: JsonSchemaProperty;
    required: boolean;
  }) => {
    const currentValue = value[field.key];
    const label = field.schema.title ?? humanizePropertyName(field.key);
    const description =
      typeof field.schema.description === "string" ? field.schema.description : null;
    const errorKey = `${pathPrefix}.${field.key}`;
    const errorMessage = errors[errorKey];
    const enumValues = Array.isArray(field.schema.enum) ? field.schema.enum : null;
    const fieldTestId = fieldTestIdPrefix
      ? `${fieldTestIdPrefix}-${field.key}`
      : undefined;

    if (enumValues && enumValues.length > 0) {
      const selectedValue = enumValues.find(
        (entry) => String(entry) === String(currentValue)
      );
      return (
        <FormField
          key={field.key}
          label={label}
          required={field.required}
          error={errorMessage}
        >
          <Select
            value={selectedValue !== undefined ? String(selectedValue) : ""}
            onChange={(next) => {
              const matched = enumValues.find(
                (entry) => String(entry) === String(next)
              );
              updateValue(field.key, matched as PropertyValue | undefined);
            }}
            options={enumValues.map((entry) => ({
              value: String(entry),
              label: String(entry),
            }))}
            data-testid={fieldTestId}
          />
          {description && (
            <p className="text-xs text-mythos-text-muted mt-1">{description}</p>
          )}
        </FormField>
      );
    }

    const schemaType = normalizeSchemaType(field.schema.type);

    if (schemaType === "boolean") {
      return (
        <FormField
          key={field.key}
          label={label}
          required={field.required}
          error={errorMessage}
        >
          <Select
            value={
              currentValue === true
                ? "true"
                : currentValue === false
                  ? "false"
                  : ""
            }
            onChange={(next) => {
              if (next === "true") {
                updateValue(field.key, true);
              } else if (next === "false") {
                updateValue(field.key, false);
              } else {
                updateValue(field.key, undefined);
              }
            }}
            options={[
              { value: "true", label: "True" },
              { value: "false", label: "False" },
            ]}
            data-testid={fieldTestId}
          />
          {description && (
            <p className="text-xs text-mythos-text-muted mt-1">{description}</p>
          )}
        </FormField>
      );
    }

    if (schemaType === "number" || schemaType === "integer") {
      const numberValue = typeof currentValue === "number" ? currentValue : "";
      return (
        <FormField
          key={field.key}
          label={label}
          required={field.required}
          error={errorMessage}
        >
          <Input
            type="number"
            step={schemaType === "integer" ? 1 : "any"}
            value={numberValue}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw.trim() === "") {
                updateValue(field.key, undefined);
                return;
              }
              const parsed = Number(raw);
              if (Number.isNaN(parsed)) return;
              updateValue(
                field.key,
                schemaType === "integer" ? Math.trunc(parsed) : parsed
              );
            }}
            data-testid={fieldTestId}
          />
          {description && (
            <p className="text-xs text-mythos-text-muted mt-1">{description}</p>
          )}
        </FormField>
      );
    }

    if (schemaType === "array") {
      const itemType = normalizeSchemaType(field.schema.items?.type);
      const itemEnum =
        field.schema.items && Array.isArray(field.schema.items.enum)
          ? field.schema.items.enum
          : null;
      if (itemType === "string" && !itemEnum) {
        const listValue = Array.isArray(currentValue)
          ? currentValue.filter((entry) => typeof entry === "string")
          : [];
        return (
          <div key={field.key} className="space-y-1">
            <StringListField
              label={label}
              values={listValue}
              onChange={(next) => updateValue(field.key, next)}
              placeholder={`Add ${label.toLowerCase()}...`}
              testId={fieldTestId}
            />
            {errorMessage && (
              <p className="text-xs text-mythos-accent-red">{errorMessage}</p>
            )}
            {description && (
              <p className="text-xs text-mythos-text-muted">{description}</p>
            )}
          </div>
        );
      }
    }

    if (!schemaType || schemaType === "string") {
      return (
        <FormField
          key={field.key}
          label={label}
          required={field.required}
          error={errorMessage}
        >
          <Input
            value={typeof currentValue === "string" ? currentValue : ""}
            onChange={(e) => updateValue(field.key, e.target.value)}
            data-testid={fieldTestId}
          />
          {description && (
            <p className="text-xs text-mythos-text-muted mt-1">{description}</p>
          )}
        </FormField>
      );
    }

    return (
      <FormField
        key={field.key}
        label={label}
        required={field.required}
        error={errorMessage}
      >
        <TextArea
          value={currentValue === undefined ? "" : JSON.stringify(currentValue, null, 2)}
          onChange={(_value) => {}}
          rows={2}
          disabled
        />
        {description && (
          <p className="text-xs text-mythos-text-muted mt-1">{description}</p>
        )}
        <p className="text-xs text-mythos-text-muted mt-1">
          Unsupported schema type. Use the JSON editor below.
        </p>
      </FormField>
    );
  };

  return (
    <div className="border-t border-mythos-border-default pt-4">
      {title && (
        <h3 className="text-sm font-medium text-mythos-text-secondary mb-3">
          {title}
        </h3>
      )}

      {!showSchemaFields && !showRawEditor && (
        <div className="py-6 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-mythos-bg-tertiary mb-3">
            <Shapes className="w-5 h-5 text-mythos-text-muted" />
          </div>
          <p className="text-sm text-mythos-text-muted">
            No custom properties defined for this type.
          </p>
        </div>
      )}

      {showSchemaFields && (
        <div className="space-y-4">
          {schemaFields.map((field) => renderSchemaField(field))}
        </div>
      )}

      {showRawEditor && (
        <div className={cn("space-y-2", showSchemaFields ? "mt-4" : "")}> 
          <FormField
            label={
              showSchemaFields
                ? "Advanced JSON"
                : pathPrefix === "metadata"
                  ? "Metadata (JSON)"
                  : "Properties (JSON)"
            }
            error={errors[pathPrefix]}
          >
            <TextArea
              value={rawJson}
              onChange={(nextValue) => onRawJsonChange(nextValue)}
              onFocus={onRawFocus}
              onBlur={onRawBlur}
              rows={6}
              placeholder='{"key":"value"}'
              data-testid={rawTestId}
            />
          </FormField>
          <p className="text-xs text-mythos-text-muted">
            Values must be a JSON object. Invalid JSON will be rejected on save.
          </p>
        </div>
      )}
    </div>
  );
}
