/**
 * RegistryEditorModal - Project Type Registry Editor
 *
 * Placeholder-first implementation for editing entity and relationship types.
 * Allows customizing schemas, icons, colors, and approval settings per project.
 */

import { useState, useMemo } from "react";
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  ChevronRight,
  Tag,
  Code,
  RotateCcw,
} from "lucide-react";
import {
  Button,
  Card,
  ScrollArea,
  Input,
  FormField,
  Select,
  cn,
} from "@mythos/ui";
import { resolveLucideIcon } from "../../utils/iconResolver";

// ============================================================================
// Mock Data (placeholder until backend wiring)
// ============================================================================

interface MockTypeDef {
  type: string;
  displayName: string;
  icon: string;
  color: string;
  riskLevel: "low" | "high" | "core";
  fictional: boolean;
  schemaFields: MockSchemaField[];
}

interface MockSchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "select";
  required: boolean;
  options?: string[];
}

interface MockRelationshipTypeDef {
  type: string;
  displayName: string;
  bidirectional: boolean;
  sourceTypes: string[];
  targetTypes: string[];
}

const MOCK_ENTITY_TYPES: MockTypeDef[] = [
  {
    type: "character",
    displayName: "Character",
    icon: "User",
    color: "#8b5cf6",
    riskLevel: "core",
    fictional: true,
    schemaFields: [
      { name: "age", type: "number", required: false },
      { name: "occupation", type: "string", required: false },
      { name: "status", type: "select", required: false, options: ["Active", "Deceased", "Unknown"] },
    ],
  },
  {
    type: "location",
    displayName: "Location",
    icon: "MapPin",
    color: "#10b981",
    riskLevel: "low",
    fictional: true,
    schemaFields: [
      { name: "region", type: "string", required: false },
      { name: "climate", type: "string", required: false },
    ],
  },
  {
    type: "item",
    displayName: "Item",
    icon: "Sword",
    color: "#f59e0b",
    riskLevel: "low",
    fictional: true,
    schemaFields: [
      { name: "rarity", type: "select", required: false, options: ["Common", "Uncommon", "Rare", "Legendary"] },
      { name: "magical", type: "boolean", required: false },
    ],
  },
  {
    type: "faction",
    displayName: "Faction",
    icon: "Building",
    color: "#ef4444",
    riskLevel: "high",
    fictional: true,
    schemaFields: [
      { name: "alignment", type: "string", required: false },
      { name: "size", type: "select", required: false, options: ["Small", "Medium", "Large", "Empire"] },
    ],
  },
  {
    type: "event",
    displayName: "Event",
    icon: "Calendar",
    color: "#06b6d4",
    riskLevel: "low",
    fictional: true,
    schemaFields: [
      { name: "date", type: "date", required: false },
      { name: "significance", type: "select", required: false, options: ["Minor", "Major", "World-changing"] },
    ],
  },
];

const MOCK_RELATIONSHIP_TYPES: MockRelationshipTypeDef[] = [
  { type: "ally", displayName: "Ally", bidirectional: true, sourceTypes: ["character"], targetTypes: ["character", "faction"] },
  { type: "enemy", displayName: "Enemy", bidirectional: true, sourceTypes: ["character", "faction"], targetTypes: ["character", "faction"] },
  { type: "owns", displayName: "Owns", bidirectional: false, sourceTypes: ["character"], targetTypes: ["item", "location"] },
  { type: "origin", displayName: "Origin", bidirectional: false, sourceTypes: ["character"], targetTypes: ["location"] },
  { type: "member_of", displayName: "Member Of", bidirectional: false, sourceTypes: ["character"], targetTypes: ["faction"] },
  { type: "located_in", displayName: "Located In", bidirectional: false, sourceTypes: ["location", "item"], targetTypes: ["location"] },
];

const ICON_OPTIONS = [
  { value: "User", label: "User" },
  { value: "Users", label: "Users" },
  { value: "MapPin", label: "MapPin" },
  { value: "Map", label: "Map" },
  { value: "Sword", label: "Sword" },
  { value: "Shield", label: "Shield" },
  { value: "Building", label: "Building" },
  { value: "Castle", label: "Castle" },
  { value: "Calendar", label: "Calendar" },
  { value: "Clock", label: "Clock" },
  { value: "Tag", label: "Tag" },
  { value: "Star", label: "Star" },
];

const COLOR_OPTIONS = [
  "#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#22c55e",
  "#84cc16", "#eab308", "#f59e0b", "#f97316", "#ef4444", "#ec4899",
];

const RISK_OPTIONS = [
  { value: "low", label: "Low (auto-approve)" },
  { value: "high", label: "High (review required)" },
  { value: "core", label: "Core (locked type)" },
];

const IDENTITY_OPTIONS = [
  { value: "fictional", label: "Fictional (AI can modify)" },
  { value: "real", label: "Real (protected identity)" },
];

type TabId = "entities" | "relationships";

// ============================================================================
// Sub-components
// ============================================================================

interface EntityTypeCardProps {
  typeDef: MockTypeDef;
  isSelected: boolean;
  onClick: () => void;
}

function EntityTypeCard({ typeDef, isSelected, onClick }: EntityTypeCardProps) {
  const Icon = resolveLucideIcon(typeDef.icon);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
        isSelected
          ? "border-mythos-accent-primary bg-mythos-accent-primary/10"
          : "border-mythos-border-default hover:border-mythos-text-muted/50 hover:bg-mythos-bg-tertiary"
      )}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${typeDef.color}20` }}
      >
        <Icon className="w-5 h-5" style={{ color: typeDef.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-mythos-text-primary">
            {typeDef.displayName}
          </span>
          {typeDef.riskLevel === "core" && (
            <Lock className="w-3 h-3 text-mythos-text-muted" />
          )}
        </div>
        <span className="text-xs text-mythos-text-muted">
          {typeDef.schemaFields.length} fields
        </span>
      </div>
      <ChevronRight className={cn(
        "w-4 h-4 text-mythos-text-muted transition-transform",
        isSelected && "rotate-90"
      )} />
    </button>
  );
}

interface EntityTypeEditorProps {
  typeDef: MockTypeDef;
  onUpdate: (updated: MockTypeDef) => void;
}

function EntityTypeEditor({ typeDef, onUpdate }: EntityTypeEditorProps) {
  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Display Name">
          <Input
            value={typeDef.displayName}
            onChange={(e) => onUpdate({ ...typeDef, displayName: e.target.value })}
            placeholder="e.g., Character"
          />
        </FormField>
        <FormField label="Type Key">
          <Input
            value={typeDef.type}
            disabled
            className="text-mythos-text-muted"
          />
        </FormField>
      </div>

      {/* Icon and Color */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Icon">
          <Select
            value={typeDef.icon}
            onChange={(icon) => onUpdate({ ...typeDef, icon })}
            options={ICON_OPTIONS}
          />
        </FormField>

        <FormField label="Color">
          <div className="flex flex-wrap gap-1.5 p-2 border border-mythos-border-default rounded-lg bg-mythos-bg-secondary">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onUpdate({ ...typeDef, color })}
                className={cn(
                  "w-6 h-6 rounded-full transition-transform",
                  typeDef.color === color && "ring-2 ring-offset-2 ring-offset-mythos-bg-primary ring-mythos-accent-primary scale-110"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </FormField>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Risk Level">
          <Select
            value={typeDef.riskLevel}
            onChange={(level) => onUpdate({ ...typeDef, riskLevel: level as MockTypeDef["riskLevel"] })}
            options={RISK_OPTIONS}
          />
        </FormField>

        <FormField label="Identity">
          <Select
            value={typeDef.fictional ? "fictional" : "real"}
            onChange={(v) => onUpdate({ ...typeDef, fictional: v === "fictional" })}
            options={IDENTITY_OPTIONS}
          />
        </FormField>
      </div>

      {/* Schema Fields */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-mythos-text-primary">Schema Fields</h4>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Field
          </Button>
        </div>
        <div className="space-y-2">
          {typeDef.schemaFields.map((field) => (
            <div
              key={field.name}
              className="flex items-center gap-3 p-3 rounded-lg border border-mythos-border-default"
            >
              <Code className="w-4 h-4 text-mythos-text-muted" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-mythos-text-primary">
                  {field.name}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-mythos-text-muted capitalize">
                    {field.type}
                  </span>
                  {field.required && (
                    <span className="text-xs text-mythos-accent-red">Required</span>
                  )}
                  {field.options && (
                    <span className="text-xs text-mythos-text-muted">
                      ({field.options.length} options)
                    </span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-mythos-accent-red">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {typeDef.schemaFields.length === 0 && (
            <div className="text-center py-6 text-sm text-mythos-text-muted">
              No custom fields defined
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RelationshipTypeCard({ rel }: { rel: MockRelationshipTypeDef }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-mythos-border-default">
      <div className="w-8 h-8 rounded-lg bg-mythos-bg-tertiary flex items-center justify-center">
        {rel.bidirectional ? (
          <span className="text-mythos-text-muted">↔</span>
        ) : (
          <span className="text-mythos-text-muted">→</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-mythos-text-primary">
          {rel.displayName}
        </span>
        <div className="text-xs text-mythos-text-muted mt-0.5">
          {rel.sourceTypes.join(", ")} → {rel.targetTypes.join(", ")}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7">
        <Pencil className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface RegistryEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RegistryEditorModal({ isOpen, onClose }: RegistryEditorModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("entities");
  const [selectedType, setSelectedType] = useState<string | null>("character");
  const [entityTypes, setEntityTypes] = useState(MOCK_ENTITY_TYPES);
  const [isLocked, setIsLocked] = useState(false);

  const selectedTypeDef = useMemo(
    () => entityTypes.find((t) => t.type === selectedType),
    [entityTypes, selectedType]
  );

  const handleUpdateType = (updated: MockTypeDef) => {
    setEntityTypes((types) =>
      types.map((t) => (t.type === updated.type ? updated : t))
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-4xl max-h-[85vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mythos-border-default">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-mythos-accent-primary/20 flex items-center justify-center">
              <Tag className="w-5 h-5 text-mythos-accent-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-mythos-text-primary">
                Project Type Registry
              </h2>
              <p className="text-sm text-mythos-text-muted">
                Customize entity types, schemas, and approval rules
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLocked(!isLocked)}
              className="gap-1.5"
            >
              {isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Locked
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  Unlocked
                </>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="border-b border-mythos-border-default px-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("entities")}
              className={cn(
                "py-2.5 px-1 text-sm font-medium border-b-2 transition-colors",
                activeTab === "entities"
                  ? "border-mythos-accent-primary text-mythos-text-primary"
                  : "border-transparent text-mythos-text-muted hover:text-mythos-text-secondary"
              )}
            >
              Entity Types
            </button>
            <button
              onClick={() => setActiveTab("relationships")}
              className={cn(
                "py-2.5 px-1 text-sm font-medium border-b-2 transition-colors",
                activeTab === "relationships"
                  ? "border-mythos-accent-primary text-mythos-text-primary"
                  : "border-transparent text-mythos-text-muted hover:text-mythos-text-secondary"
              )}
            >
              Relationship Types
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 flex min-h-0">
          {activeTab === "entities" && (
            <>
              {/* Entity type list */}
              <div className="w-64 border-r border-mythos-border-default p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-mythos-text-muted">Types</h4>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <ScrollArea className="flex-1 -mx-2 px-2">
                  <div className="space-y-2">
                    {entityTypes.map((typeDef) => (
                      <EntityTypeCard
                        key={typeDef.type}
                        typeDef={typeDef}
                        isSelected={selectedType === typeDef.type}
                        onClick={() => setSelectedType(typeDef.type)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Editor */}
              <ScrollArea className="flex-1 p-6">
                {selectedTypeDef ? (
                  <EntityTypeEditor
                    typeDef={selectedTypeDef}
                    onUpdate={handleUpdateType}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-mythos-text-muted">
                    Select a type to edit
                  </div>
                )}
              </ScrollArea>
            </>
          )}

          {activeTab === "relationships" && (
            <ScrollArea className="flex-1 p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-mythos-text-primary">
                  Relationship Types ({MOCK_RELATIONSHIP_TYPES.length})
                </h4>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Add Relationship Type
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {MOCK_RELATIONSHIP_TYPES.map((rel) => (
                  <RelationshipTypeCard key={rel.type} rel={rel} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-mythos-border-default">
          <Button variant="outline" size="sm" className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Template Defaults
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button>Save Changes</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default RegistryEditorModal;
