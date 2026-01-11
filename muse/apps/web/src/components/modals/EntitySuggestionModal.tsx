import { useState, useCallback, useMemo, useEffect } from "react";
import {
  X,
  User,
  Sword,
  MapPin,
  Sparkles,
  Building2,
  Wand2,
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Check,
  Loader2,
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
  cn,
} from "@mythos/ui";
import type {
  DetectedEntity,
  DetectionWarning,
  GraphEntityType,
} from "@mythos/core";
import {
  WRITER_ENTITY_TYPE_CONFIG,
  WRITER_ENTITY_TYPES,
  getEntityColor,
  getEntityLabel,
  type EntityIconName,
} from "@mythos/core";

interface EntitySuggestionModalProps {
  isOpen: boolean;
  entities: DetectedEntity[];
  warnings: DetectionWarning[];
  onClose: () => void;
  onApply: (selectedEntities: DetectedEntity[]) => void;
  isProcessing: boolean;
}

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
  const iconName = WRITER_ENTITY_TYPE_CONFIG[type as keyof typeof WRITER_ENTITY_TYPE_CONFIG]?.icon ?? "User";
  return ENTITY_ICONS[iconName] ?? User;
}

// Confidence threshold for auto-selection
const AUTO_SELECT_THRESHOLD = 0.7;

// Confidence badge component
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const colorClass =
    confidence >= 0.8
      ? "bg-mythos-accent-green/20 text-mythos-accent-green"
      : confidence >= 0.5
        ? "bg-mythos-accent-amber/20 text-mythos-accent-amber"
        : "bg-mythos-accent-red/20 text-mythos-accent-red";

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
        colorClass
      )}
    >
      {percentage}%
    </span>
  );
}

// Entity type icon component
function EntityTypeIcon({
  type,
  className,
}: {
  type: GraphEntityType;
  className?: string;
}) {
  const Icon = getEntityIconComponent(type);
  const colorClass = getEntityColor(type);
  return <Icon className={cn("w-4 h-4", colorClass, className)} />;
}

// Type selector dropdown
function TypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: GraphEntityType;
  onChange: (type: GraphEntityType) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = useCallback(
    (type: GraphEntityType) => {
      onChange(type);
      setIsOpen(false);
    },
    [onChange]
  );

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
          "border border-mythos-text-muted/30 bg-mythos-bg-tertiary",
          "hover:bg-mythos-bg-secondary transition-colors",
          "focus:outline-none focus:ring-1 focus:ring-mythos-accent-primary",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <EntityTypeIcon type={value} className="w-3 h-3" />
        <span className="text-mythos-text-secondary">
          {getEntityLabel(value)}
        </span>
        <ChevronDown className="w-3 h-3 text-mythos-text-muted" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <ul
            role="listbox"
            className={cn(
              "absolute z-20 mt-1 w-40 py-1 rounded-md",
              "bg-mythos-bg-secondary border border-mythos-text-muted/30",
              "shadow-lg shadow-black/20"
            )}
          >
            {WRITER_ENTITY_TYPES.map((type) => (
              <li
                key={type}
                role="option"
                aria-selected={type === value}
                onClick={() => handleSelect(type)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 cursor-pointer",
                  "text-xs text-mythos-text-secondary",
                  "hover:bg-mythos-bg-tertiary",
                  type === value && "bg-mythos-bg-tertiary"
                )}
              >
                <EntityTypeIcon type={type} className="w-3 h-3" />
                <span>{getEntityLabel(type)}</span>
                {type === value && (
                  <Check className="w-3 h-3 ml-auto text-mythos-accent-primary" />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Entity row component
function EntityRow({
  entity,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onTypeChange,
  disabled,
}: {
  entity: DetectedEntity;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onTypeChange: (type: GraphEntityType) => void;
  disabled?: boolean;
}) {
  const hasOccurrences = entity.occurrences.length > 0;

  return (
    <div
      className={cn(
        "rounded-md border transition-colors",
        isSelected
          ? "border-mythos-accent-primary/50 bg-mythos-bg-tertiary/50"
          : "border-mythos-border-default bg-mythos-bg-secondary"
      )}
      data-testid="entity-detect-result"
      data-entity-name={entity.name}
      data-entity-type={entity.type}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        {/* Checkbox */}
        <label className="relative flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            disabled={disabled}
            className="sr-only peer"
            aria-label={`Select ${entity.name}`}
          />
          <div
            className={cn(
              "w-4 h-4 rounded border transition-colors",
              "flex items-center justify-center",
              isSelected
                ? "bg-mythos-accent-primary border-mythos-accent-primary"
                : "border-mythos-text-muted/50 bg-mythos-bg-tertiary",
              "peer-focus:ring-2 peer-focus:ring-mythos-accent-primary/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSelected && <Check className="w-3 h-3 text-mythos-bg-primary" />}
          </div>
        </label>

        {/* Expand button */}
        <button
          type="button"
          onClick={onToggleExpand}
          disabled={!hasOccurrences}
          className={cn(
            "p-0.5 rounded transition-colors",
            hasOccurrences
              ? "hover:bg-mythos-bg-tertiary text-mythos-text-muted hover:text-mythos-text-primary"
              : "text-mythos-text-muted/30 cursor-default"
          )}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse details" : "Expand details"}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Type icon */}
        <EntityTypeIcon type={entity.type} />

        {/* Name */}
        <span className="flex-1 font-medium text-mythos-text-primary truncate">
          {entity.name}
          {entity.matchedExistingId && (
            <span className="ml-2 text-xs text-mythos-accent-green">
              (existing)
            </span>
          )}
        </span>

        {/* Type selector */}
        <TypeSelector
          value={entity.type}
          onChange={onTypeChange}
          disabled={disabled}
        />

        {/* Confidence badge */}
        <ConfidenceBadge confidence={entity.confidence} />
      </div>

      {/* Expanded details */}
      {isExpanded && hasOccurrences && (
        <div className="px-3 pb-3 pt-0 border-t border-mythos-text-muted/10">
          {/* Aliases */}
          {entity.suggestedAliases.length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] uppercase text-mythos-text-muted tracking-wider">
                Aliases:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {entity.suggestedAliases.map((alias, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-mythos-bg-tertiary text-mythos-text-secondary"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Occurrences */}
          <div className="mt-2">
            <span className="text-[10px] uppercase text-mythos-text-muted tracking-wider">
              Occurrences ({entity.occurrences.length}):
            </span>
            <ul className="mt-1 space-y-1">
              {entity.occurrences.slice(0, 3).map((occurrence, i) => (
                <li
                  key={i}
                  className="text-[11px] text-mythos-text-secondary font-mono"
                >
                  <span className="text-mythos-text-muted">...</span>
                  {occurrence.context.substring(
                    0,
                    occurrence.context.indexOf(occurrence.matchedText)
                  )}
                  <span className="text-mythos-accent-primary font-semibold">
                    {occurrence.matchedText}
                  </span>
                  {occurrence.context.substring(
                    occurrence.context.indexOf(occurrence.matchedText) +
                      occurrence.matchedText.length
                  )}
                  <span className="text-mythos-text-muted">...</span>
                </li>
              ))}
              {entity.occurrences.length > 3 && (
                <li className="text-[10px] text-mythos-text-muted">
                  +{entity.occurrences.length - 3} more occurrences
                </li>
              )}
            </ul>
          </div>

          {/* Inferred properties */}
          {entity.inferredProperties &&
            Object.keys(entity.inferredProperties).length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] uppercase text-mythos-text-muted tracking-wider">
                  Inferred Properties:
                </span>
                <div className="mt-1 text-[11px] text-mythos-text-secondary">
                  {Object.entries(entity.inferredProperties).map(
                    ([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-mythos-text-muted capitalize">
                          {key.replace(/_/g, " ")}:
                        </span>
                        <span>{String(value)}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// Warnings section component
function WarningsSection({ warnings }: { warnings: DetectionWarning[] }) {
  if (warnings.length === 0) return null;

  const getWarningColor = (type: DetectionWarning["type"]) => {
    switch (type) {
      case "conflicting_type":
        return "text-mythos-accent-red";
      case "low_confidence":
        return "text-mythos-accent-amber";
      case "ambiguous_reference":
      case "possible_alias":
      default:
        return "text-mythos-accent-yellow";
    }
  };

  return (
    <div className="mb-4 p-3 rounded-md border border-mythos-accent-amber/30 bg-mythos-accent-amber/5">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-mythos-accent-amber" />
        <span className="text-sm font-medium text-mythos-accent-amber">
          Warnings ({warnings.length})
        </span>
      </div>
      <ul className="space-y-1">
        {warnings.map((warning, i) => (
          <li
            key={i}
            className={cn("text-xs", getWarningColor(warning.type))}
          >
            <span className="uppercase text-[10px] opacity-75 mr-1">
              [{warning.type.replace(/_/g, " ")}]
            </span>
            {warning.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EntitySuggestionModal({
  isOpen,
  entities,
  warnings,
  onClose,
  onApply,
  isProcessing,
}: EntitySuggestionModalProps) {
  // Track selected entities by tempId
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Track expanded entities by tempId
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Track type overrides by tempId
  const [typeOverrides, setTypeOverrides] = useState<
    Record<string, GraphEntityType>
  >({});

  // Auto-select high-confidence entities on mount or when entities change
  useEffect(() => {
    const highConfidenceIds = entities
      .filter((e) => e.confidence >= AUTO_SELECT_THRESHOLD)
      .map((e) => e.tempId);
    setSelectedIds(new Set(highConfidenceIds));
    setExpandedIds(new Set());
    setTypeOverrides({});
  }, [entities]);

  // Group entities by type
  const groupedEntities = useMemo(() => {
    const groups: Record<string, DetectedEntity[]> = {};
    entities.forEach((entity) => {
      const effectiveType = typeOverrides[entity.tempId] || entity.type;
      if (!groups[effectiveType]) {
        groups[effectiveType] = [];
      }
      groups[effectiveType].push(entity);
    });

    return groups;
  }, [entities, typeOverrides]);

  const orderedTypes = useMemo(() => {
    const known = new Set(WRITER_ENTITY_TYPES);
    const extras = Object.keys(groupedEntities)
      .filter((type) => !known.has(type as GraphEntityType))
      .sort();
    return [...WRITER_ENTITY_TYPES, ...extras];
  }, [groupedEntities]);

  // Get selected entities with type overrides applied
  const selectedEntities = useMemo(() => {
    return entities
      .filter((e) => selectedIds.has(e.tempId))
      .map((e) => ({
        ...e,
        type: typeOverrides[e.tempId] || e.type,
      }));
  }, [entities, selectedIds, typeOverrides]);

  // Toggle selection
  const toggleSelect = useCallback((tempId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  }, []);

  // Toggle expansion
  const toggleExpand = useCallback((tempId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  }, []);

  // Change entity type
  const changeType = useCallback((tempId: string, type: GraphEntityType) => {
    setTypeOverrides((prev) => ({
      ...prev,
      [tempId]: type,
    }));
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(entities.map((e) => e.tempId)));
  }, [entities]);

  // Select none
  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Handle apply
  const handleApply = useCallback(() => {
    onApply(selectedEntities);
  }, [onApply, selectedEntities]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const selectedCount = selectedIds.size;
  const totalCount = entities.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entity-modal-title"
      data-testid="entity-detect-modal"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-2xl mx-4 shadow-xl border-mythos-border-default max-h-[85vh] flex flex-col">
        <CardHeader className="pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-mythos-accent-primary" />
              <CardTitle id="entity-modal-title" className="text-lg">
                Detected Entities
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isProcessing}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="pt-1">
            {totalCount} entities detected in your text. Review and select the
            ones you want to add to your project.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden py-0">
          {/* Selection controls */}
          <div className="flex items-center gap-4 pb-3 border-b border-mythos-border-default">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              disabled={isProcessing || selectedCount === totalCount}
              className="h-7 text-xs"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={selectNone}
              disabled={isProcessing || selectedCount === 0}
              className="h-7 text-xs"
            >
              Select None
            </Button>
            <span className="ml-auto text-xs text-mythos-text-muted">
              {selectedCount} of {totalCount} selected
            </span>
          </div>

          {/* Warnings */}
          <div className="pt-3">
            <WarningsSection warnings={warnings} />
          </div>

          {/* Entity list */}
          <ScrollArea className="h-[calc(100%-60px)]" data-testid="entity-detect-results">
            <div className="space-y-4 pr-4 pb-4">
              {orderedTypes.map((type) => {
                const typeEntities = groupedEntities[type] ?? [];
                if (typeEntities.length === 0) return null;

                return (
                  <div key={type}>
                    <h3 className="flex items-center gap-2 mb-2 text-sm font-medium text-mythos-text-secondary">
                      <EntityTypeIcon type={type} />
                      <span>{getEntityLabel(type)}s</span>
                      <span className="text-mythos-text-muted">
                        ({typeEntities.length})
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {typeEntities.map((entity) => (
                        <EntityRow
                          key={entity.tempId}
                          entity={entity}
                          isSelected={selectedIds.has(entity.tempId)}
                          isExpanded={expandedIds.has(entity.tempId)}
                          onToggleSelect={() => toggleSelect(entity.tempId)}
                          onToggleExpand={() => toggleExpand(entity.tempId)}
                          onTypeChange={(newType) =>
                            changeType(entity.tempId, newType)
                          }
                          disabled={isProcessing}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="flex justify-between gap-2 pt-4 flex-shrink-0 border-t border-mythos-border-default">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Skip
          </Button>
          <Button
            onClick={handleApply}
            disabled={isProcessing || selectedCount === 0}
            className="gap-1.5 min-w-[140px]"
            data-testid="entity-create-from-detection"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Apply & Create ({selectedCount})
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
