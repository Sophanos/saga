import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import {
  X,
  User,
  Sword,
  MapPin,
  Sparkles,
  Building2,
  Wand2,
  Calendar,
  Plus,
  Save,
  Loader2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
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
  Select,
  TextArea,
  cn,
} from "@mythos/ui";
import type {
  Entity,
  GraphEntityType,
  Character,
  Location,
  Item,
  MagicSystem,
  Faction,
  JungianArchetype,
  Trait,
  PropertyValue,
} from "@mythos/core";
import {
  WRITER_ENTITY_TYPE_CONFIG,
  WRITER_ENTITY_TYPES,
  getEntityColor,
  getEntityLabel,
  type EntityIconName,
} from "@mythos/core";
import { api } from "../../../../convex/_generated/api";
import { executeNameGenerator } from "../../services/ai/agentRuntimeClient";
import { useMythosStore } from "../../stores";
import { useAuthStore } from "../../stores/auth";
import type { NameCulture, NameStyle } from "@mythos/agent-protocol";

// ============================================================================
// Types
// ============================================================================

type FormMode = "create" | "edit";

interface EntityFormData {
  name: string;
  aliases: string[];
  type: GraphEntityType;
  notes?: string;
  properties?: Record<string, PropertyValue>;
  // Character fields
  archetype?: JungianArchetype;
  traits?: Trait[];
  backstory?: string;
  goals?: string[];
  fears?: string[];
  voiceNotes?: string;
  // Location fields
  parentLocation?: string;
  climate?: string;
  atmosphere?: string;
  // Item fields
  category?: Item["category"];
  rarity?: Item["rarity"];
  abilities?: string[];
  // Magic System fields
  rules?: string[];
  limitations?: string[];
  costs?: string[];
  // Faction fields
  leader?: string;
  headquarters?: string;
  factionGoals?: string[];
  rivals?: string[];
  allies?: string[];
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
 * Entity types available for form selection (excludes event/concept)
 */
const ENTITY_TYPES: GraphEntityType[] = WRITER_ENTITY_TYPES.filter(
  (type) => type !== "event" && type !== "concept"
);

/**
 * Map icon names to React components
 */
const ENTITY_ICONS: Record<EntityIconName, LucideIcon> = {
  User,
  MapPin,
  Sword,
  Wand2,
  Building2,
  Calendar,
  Sparkles,
};

/**
 * Get the icon component for an entity type
 */
function getEntityIconComponent(type: GraphEntityType): LucideIcon {
  const iconName =
    WRITER_ENTITY_TYPE_CONFIG[type as keyof typeof WRITER_ENTITY_TYPE_CONFIG]?.icon ?? "User";
  return ENTITY_ICONS[iconName] ?? User;
}

const JUNGIAN_ARCHETYPES: JungianArchetype[] = [
  "hero",
  "mentor",
  "threshold_guardian",
  "herald",
  "shapeshifter",
  "shadow",
  "ally",
  "trickster",
  "mother",
  "father",
  "child",
  "maiden",
  "wise_old_man",
  "wise_old_woman",
  "anima",
  "animus",
];

const ITEM_CATEGORIES: Item["category"][] = [
  "weapon",
  "armor",
  "artifact",
  "consumable",
  "key",
  "other",
];

const ITEM_RARITIES: Item["rarity"][] = [
  "common",
  "uncommon",
  "rare",
  "legendary",
  "unique",
];

const TRAIT_TYPES: Trait["type"][] = ["strength", "weakness", "neutral", "shadow"];

// ============================================================================
// Helper Components
// ============================================================================

type JsonSchema = Record<string, unknown>;

type JsonSchemaProperty = {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: unknown[];
  items?: {
    type?: string | string[];
    enum?: unknown[];
  };
};

type ObjectSchemaInfo = {
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  additionalProperties?: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSchemaType(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const firstType = value.find((entry) => typeof entry === "string");
    return typeof firstType === "string" ? firstType : undefined;
  }
  return undefined;
}

function humanizePropertyName(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getObjectSchemaInfo(schema: unknown): ObjectSchemaInfo | null {
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

function parseJsonValue(
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
}

function StringListField({ label, values, onChange, placeholder }: StringListFieldProps) {
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (newItem.trim()) {
      onChange([...values, newItem.trim()]);
      setNewItem("");
    }
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <FormField label={label}>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1"
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
                key={index}
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

interface TraitListFieldProps {
  traits: Trait[];
  onChange: (traits: Trait[]) => void;
}

function TraitListField({ traits, onChange }: TraitListFieldProps) {
  const [newTraitName, setNewTraitName] = useState("");
  const [newTraitType, setNewTraitType] = useState<Trait["type"]>("neutral");

  const handleAdd = () => {
    if (newTraitName.trim()) {
      onChange([...traits, { name: newTraitName.trim(), type: newTraitType }]);
      setNewTraitName("");
      setNewTraitType("neutral");
    }
  };

  const handleRemove = (index: number) => {
    onChange(traits.filter((_, i) => i !== index));
  };

  const getTraitColor = (type: Trait["type"]) => {
    switch (type) {
      case "strength":
        return "bg-mythos-accent-green/20 text-mythos-accent-green border-mythos-accent-green/30";
      case "weakness":
        return "bg-mythos-accent-red/20 text-mythos-accent-red border-mythos-accent-red/30";
      case "shadow":
        return "bg-mythos-accent-purple/20 text-mythos-accent-purple border-mythos-accent-purple/30";
      default:
        return "bg-mythos-bg-tertiary text-mythos-text-secondary border-mythos-text-muted/30";
    }
  };

  return (
    <FormField label="Character Traits">
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={newTraitName}
            onChange={(e) => setNewTraitName(e.target.value)}
            placeholder="Trait name..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Select
            value={newTraitType}
            onChange={(v) => setNewTraitType(v as Trait["type"])}
            options={TRAIT_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
            className="w-32"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAdd}
            disabled={!newTraitName.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {traits.map((trait, index) => (
              <span
                key={index}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border",
                  getTraitColor(trait.type)
                )}
              >
                <span className="font-medium">{trait.name}</span>
                <span className="opacity-60 text-[10px] uppercase">{trait.type}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="hover:opacity-70 transition-opacity ml-0.5"
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
// Entity Type Selector
// ============================================================================

interface EntityTypeSelectorProps {
  value: GraphEntityType;
  onChange: (type: GraphEntityType) => void;
  disabled?: boolean;
}

function EntityTypeSelector({ value, onChange, disabled }: EntityTypeSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {ENTITY_TYPES.map((type) => {
        const Icon = getEntityIconComponent(type);
        const colorClass = getEntityColor(type);
        const label = getEntityLabel(type);
        const isSelected = type === value;

        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
              isSelected
                ? "border-mythos-accent-primary bg-mythos-accent-primary/10"
                : "border-mythos-border-default hover:border-mythos-text-muted/50 hover:bg-mythos-bg-tertiary",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Icon className={cn("w-5 h-5", isSelected ? "text-mythos-accent-primary" : colorClass)} />
            <span className={cn(
              "text-xs font-medium",
              isSelected ? "text-mythos-accent-primary" : "text-mythos-text-secondary"
            )}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Type-Specific Form Sections
// ============================================================================

interface CharacterFieldsProps {
  data: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
}

function CharacterFields({ data, onChange }: CharacterFieldsProps) {
  return (
    <div className="space-y-4">
      <FormField label="Archetype">
        <Select
          value={data.archetype || ""}
          onChange={(v) => onChange({ archetype: v as JungianArchetype })}
          options={[
            { value: "", label: "Select an archetype..." },
            ...JUNGIAN_ARCHETYPES.map((a) => ({
              value: a,
              label: a.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
            })),
          ]}
        />
      </FormField>

      <TraitListField
        traits={data.traits || []}
        onChange={(traits) => onChange({ traits })}
      />

      <FormField label="Backstory">
        <TextArea
          value={data.backstory || ""}
          onChange={(v) => onChange({ backstory: v })}
          placeholder="Character's background and history..."
          rows={4}
        />
      </FormField>

      <StringListField
        label="Goals"
        values={data.goals || []}
        onChange={(goals) => onChange({ goals })}
        placeholder="Add a goal..."
      />

      <StringListField
        label="Fears"
        values={data.fears || []}
        onChange={(fears) => onChange({ fears })}
        placeholder="Add a fear..."
      />

      <FormField label="Voice Notes">
        <TextArea
          value={data.voiceNotes || ""}
          onChange={(v) => onChange({ voiceNotes: v })}
          placeholder="How does this character speak? Accent, vocabulary, mannerisms..."
          rows={3}
        />
      </FormField>
    </div>
  );
}

interface LocationFieldsProps {
  data: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
}

function LocationFields({ data, onChange }: LocationFieldsProps) {
  return (
    <div className="space-y-4">
      <FormField label="Climate">
        <Input
          value={data.climate || ""}
          onChange={(e) => onChange({ climate: e.target.value })}
          placeholder="e.g., Tropical, Arctic, Temperate..."
        />
      </FormField>

      <FormField label="Atmosphere">
        <TextArea
          value={data.atmosphere || ""}
          onChange={(v) => onChange({ atmosphere: v })}
          placeholder="The mood and feeling of this place..."
          rows={3}
        />
      </FormField>
    </div>
  );
}

interface ItemFieldsProps {
  data: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
}

function ItemFields({ data, onChange }: ItemFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Category" required>
          <Select
            value={data.category || "other"}
            onChange={(v) => onChange({ category: v as Item["category"] })}
            options={ITEM_CATEGORIES.map((c) => ({
              value: c,
              label: c.charAt(0).toUpperCase() + c.slice(1),
            }))}
          />
        </FormField>

        <FormField label="Rarity">
          <Select
            value={data.rarity || ""}
            onChange={(v) => onChange({ rarity: (v || undefined) as Item["rarity"] })}
            options={[
              { value: "", label: "Select rarity..." },
              ...ITEM_RARITIES.filter((r): r is NonNullable<Item["rarity"]> => r !== undefined).map((r) => ({
                value: r,
                label: r.charAt(0).toUpperCase() + r.slice(1),
              })),
            ]}
          />
        </FormField>
      </div>

      <StringListField
        label="Abilities"
        values={data.abilities || []}
        onChange={(abilities) => onChange({ abilities })}
        placeholder="Add an ability..."
      />
    </div>
  );
}

interface MagicSystemFieldsProps {
  data: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
}

function MagicSystemFields({ data, onChange }: MagicSystemFieldsProps) {
  return (
    <div className="space-y-4">
      <StringListField
        label="Rules"
        values={data.rules || []}
        onChange={(rules) => onChange({ rules })}
        placeholder="Add a rule..."
      />

      <StringListField
        label="Limitations"
        values={data.limitations || []}
        onChange={(limitations) => onChange({ limitations })}
        placeholder="Add a limitation..."
      />

      <StringListField
        label="Costs"
        values={data.costs || []}
        onChange={(costs) => onChange({ costs })}
        placeholder="Add a cost..."
      />
    </div>
  );
}

interface FactionFieldsProps {
  data: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
}

function FactionFields({ data, onChange }: FactionFieldsProps) {
  return (
    <div className="space-y-4">
      <FormField label="Leader">
        <Input
          value={data.leader || ""}
          onChange={(e) => onChange({ leader: e.target.value })}
          placeholder="Name of the faction leader..."
        />
      </FormField>

      <FormField label="Headquarters">
        <Input
          value={data.headquarters || ""}
          onChange={(e) => onChange({ headquarters: e.target.value })}
          placeholder="Main base or location..."
        />
      </FormField>

      <StringListField
        label="Goals"
        values={data.factionGoals || []}
        onChange={(factionGoals) => onChange({ factionGoals })}
        placeholder="Add a goal..."
      />

      <StringListField
        label="Rivals"
        values={data.rivals || []}
        onChange={(rivals) => onChange({ rivals })}
        placeholder="Add a rival faction..."
      />

      <StringListField
        label="Allies"
        values={data.allies || []}
        onChange={(allies) => onChange({ allies })}
        placeholder="Add an allied faction..."
      />
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

function getInitialFormData(mode: FormMode, entityType?: GraphEntityType, entity?: Entity): EntityFormData {
  if (mode === "edit" && entity) {
    const base: EntityFormData = {
      name: entity.name,
      aliases: entity.aliases,
      type: entity.type,
      notes: entity.notes,
      properties: entity.properties ?? {},
    };

    switch (entity.type) {
      case "character": {
        const char = entity as Character;
        return {
          ...base,
          archetype: char.archetype,
          traits: char.traits,
          backstory: char.backstory,
          goals: char.goals,
          fears: char.fears,
          voiceNotes: char.voiceNotes,
        };
      }
      case "location": {
        const loc = entity as Location;
        return {
          ...base,
          parentLocation: loc.parentLocation,
          climate: loc.climate,
          atmosphere: loc.atmosphere,
        };
      }
      case "item": {
        const item = entity as Item;
        return {
          ...base,
          category: item.category,
          rarity: item.rarity,
          abilities: item.abilities,
        };
      }
      case "magic_system": {
        const magic = entity as MagicSystem;
        return {
          ...base,
          rules: magic.rules,
          limitations: magic.limitations,
          costs: magic.costs,
        };
      }
      case "faction": {
        const faction = entity as Faction;
        return {
          ...base,
          leader: faction.leader,
          headquarters: faction.headquarters,
          factionGoals: faction.goals,
          rivals: faction.rivals,
          allies: faction.allies,
        };
      }
      default:
        return base;
    }
  }

  return {
    name: "",
    aliases: [],
    type: entityType || "character",
    notes: "",
    properties: {},
    traits: [],
    goals: [],
    fears: [],
    rules: [],
    limitations: [],
    costs: [],
    abilities: [],
    factionGoals: [],
    rivals: [],
    allies: [],
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
    projectId ? { projectId } : "skip"
  ) as { entityTypes?: Record<string, { schema?: JsonSchema }> } | undefined;

  const schemaInfo = useMemo(() => {
    const schema = registry?.entityTypes?.[formData.type]?.schema;
    return getObjectSchemaInfo(schema);
  }, [registry, formData.type]);

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

  const updatePropertyValue = useCallback(
    (key: string, value: PropertyValue | undefined) => {
      setFormData((prev) => {
        const nextProperties = { ...(prev.properties ?? {}) };
        if (value === undefined) {
          delete nextProperties[key];
        } else {
          nextProperties[key] = value;
        }
        return { ...prev, properties: nextProperties };
      });

      setErrors((prev) => {
        const next = { ...prev };
        delete next[`properties.${key}`];
        delete next["properties"];
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

  const renderSchemaField = useCallback(
    (field: { key: string; schema: JsonSchemaProperty; required: boolean }) => {
      const value = formData.properties?.[field.key];
      const label = field.schema.title ?? humanizePropertyName(field.key);
      const description =
        typeof field.schema.description === "string" ? field.schema.description : null;
      const errorKey = `properties.${field.key}`;
      const errorMessage = errors[errorKey];
      const enumValues = Array.isArray(field.schema.enum) ? field.schema.enum : null;

      if (enumValues && enumValues.length > 0) {
        const selectedValue = enumValues.find(
          (entry) => String(entry) === String(value)
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
                updatePropertyValue(
                  field.key,
                  matched as PropertyValue | undefined
                );
              }}
              options={enumValues.map((entry) => ({
                value: String(entry),
                label: String(entry),
              }))}
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
                value === true
                  ? "true"
                  : value === false
                    ? "false"
                    : ""
              }
              onChange={(next) => {
                if (next === "true") {
                  updatePropertyValue(field.key, true);
                } else if (next === "false") {
                  updatePropertyValue(field.key, false);
                } else {
                  updatePropertyValue(field.key, undefined);
                }
              }}
              options={[
                { value: "true", label: "True" },
                { value: "false", label: "False" },
              ]}
            />
            {description && (
              <p className="text-xs text-mythos-text-muted mt-1">{description}</p>
            )}
          </FormField>
        );
      }

      if (schemaType === "number" || schemaType === "integer") {
        const numberValue = typeof value === "number" ? value : "";
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
                  updatePropertyValue(field.key, undefined);
                  return;
                }
                const parsed = Number(raw);
                if (Number.isNaN(parsed)) return;
                updatePropertyValue(
                  field.key,
                  schemaType === "integer" ? Math.trunc(parsed) : parsed
                );
              }}
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
          const listValue = Array.isArray(value)
            ? value.filter((entry) => typeof entry === "string")
            : [];
          return (
            <div key={field.key} className="space-y-1">
              <StringListField
                label={label}
                values={listValue}
                onChange={(next) => updatePropertyValue(field.key, next)}
                placeholder={`Add ${label.toLowerCase()}...`}
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
              value={typeof value === "string" ? value : ""}
              onChange={(e) => updatePropertyValue(field.key, e.target.value)}
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
            value={value === undefined ? "" : JSON.stringify(value, null, 2)}
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
    },
    [errors, formData.properties, updatePropertyValue]
  );

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors["name"] = "Name is required";
    }

    if (formData.type === "item" && !formData.category) {
      newErrors["category"] = "Category is required for items";
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
  const TypeIcon = getEntityIconComponent(formData.type);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entity-form-title"
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
              <TypeIcon className={cn("w-5 h-5", getEntityColor(formData.type))} />
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
                        placeholder={`Enter ${formData.type.replace("_", " ")} name...`}
                        autoFocus
                        className="flex-1"
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

                  <StringListField
                    label="Aliases"
                    values={formData.aliases}
                    onChange={(aliases) => updateFormData({ aliases })}
                    placeholder="Add an alias..."
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

                {/* Divider */}
                <div className="border-t border-mythos-border-default pt-4">
                  <h3 className="text-sm font-medium text-mythos-text-secondary mb-4">
                    {getEntityLabel(formData.type)} Details
                  </h3>

                  {/* Type-specific fields */}
                  {formData.type === "character" && (
                    <CharacterFields data={formData} onChange={updateFormData} />
                  )}
                  {formData.type === "location" && (
                    <LocationFields data={formData} onChange={updateFormData} />
                  )}
                  {formData.type === "item" && (
                    <ItemFields data={formData} onChange={updateFormData} />
                  )}
                  {formData.type === "magic_system" && (
                    <MagicSystemFields data={formData} onChange={updateFormData} />
                  )}
                  {formData.type === "faction" && (
                    <FactionFields data={formData} onChange={updateFormData} />
                  )}
                </div>

                {(showSchemaFields || showRawPropertiesEditor || !schemaInfo) && (
                  <div className="border-t border-mythos-border-default pt-4">
                    <h3 className="text-sm font-medium text-mythos-text-secondary mb-3">
                      Custom Properties
                    </h3>

                    {!showSchemaFields && !showRawPropertiesEditor && (
                      <p className="text-xs text-mythos-text-muted">
                        This type does not allow additional properties.
                      </p>
                    )}

                    {showSchemaFields && (
                      <div className="space-y-4">
                        {schemaFields.map((field) => renderSchemaField(field))}
                      </div>
                    )}

                    {showRawPropertiesEditor && (
                      <div className={cn("space-y-2", showSchemaFields ? "mt-4" : "")}>
                        <FormField
                          label={showSchemaFields ? "Advanced JSON" : "Properties (JSON)"}
                          error={errors["properties"]}
                        >
                          <TextArea
                            value={rawPropertiesJson}
                            onChange={(value) => handleRawPropertiesChange(value)}
                            onFocus={() => setIsEditingRawProperties(true)}
                            onBlur={() => setIsEditingRawProperties(false)}
                            rows={6}
                            placeholder='{"key":"value"}'
                          />
                        </FormField>
                        <p className="text-xs text-mythos-text-muted">
                          Values must be a JSON object. Invalid JSON will be rejected on save.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="flex justify-between gap-2 pt-4 flex-shrink-0 border-t border-mythos-border-default">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" className="gap-1.5 min-w-[120px]" disabled={isSaving}>
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
