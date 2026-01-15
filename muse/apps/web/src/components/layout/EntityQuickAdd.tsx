/**
 * EntityQuickAdd - Discord-style inline entity creation
 *
 * Replaces modal workflow with inline input. Appears in sidebar.
 * Design: Minimal, unobtrusive, matches sidebar styling.
 */

import { useState, useRef, useEffect } from "react";
import {
  User,
  MapPin,
  Sword,
  Zap,
  Users,
  ChevronDown,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@mythos/ui";
import type { EntityType } from "@mythos/core";

// ============================================================================
// Types
// ============================================================================

interface EntityTypeOption {
  type: EntityType;
  icon: typeof User;
  label: string;
  color: string;
}

export interface EntityQuickAddProps {
  onSubmit: (name: string, type: EntityType) => void;
  onCancel: () => void;
  className?: string;
}

export interface EntityQuickAddTriggerProps {
  onClick: () => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ENTITY_TYPES: EntityTypeOption[] = [
  { type: "character", icon: User, label: "Character", color: "text-mythos-entity-character" },
  { type: "location", icon: MapPin, label: "Location", color: "text-mythos-entity-location" },
  { type: "item", icon: Sword, label: "Item", color: "text-mythos-entity-item" },
  { type: "magic_system", icon: Zap, label: "Magic System", color: "text-mythos-entity-magic" },
  { type: "faction", icon: Users, label: "Faction", color: "text-mythos-accent-purple" },
];

// ============================================================================
// EntityQuickAddTrigger - The "+" button
// ============================================================================

export function EntityQuickAddTrigger({ onClick, className }: EntityQuickAddTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center w-5 h-5 rounded",
        "text-mythos-text-muted hover:text-mythos-text-secondary",
        "hover:bg-mythos-bg-hover transition-colors",
        className
      )}
      title="Add entity"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  );
}

// ============================================================================
// EntityQuickAdd - The inline input form
// ============================================================================

export function EntityQuickAdd({ onSubmit, onCancel, className }: EntityQuickAddProps) {
  const [selectedType, setSelectedType] = useState<EntityTypeOption>(ENTITY_TYPES[0]);
  const [name, setName] = useState("");
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (typePickerOpen) {
          setTypePickerOpen(false);
        } else {
          onCancel();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, typePickerOpen]);

  // Close type picker on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setTypePickerOpen(false);
      }
    }
    if (typePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [typePickerOpen]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed) {
      onSubmit(trimmed, selectedType.type);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const SelectedIcon = selectedType.icon;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative animate-in slide-in-from-top-1 fade-in-0 duration-150",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg",
          "bg-mythos-bg-tertiary/50 border border-mythos-border-default",
          "focus-within:border-mythos-accent-primary/50 focus-within:ring-1 focus-within:ring-mythos-accent-primary/20",
          "transition-all"
        )}
      >
        {/* Type picker button */}
        <button
          onClick={() => setTypePickerOpen(!typePickerOpen)}
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-l-lg",
            "text-mythos-text-secondary hover:text-mythos-text-primary",
            "hover:bg-mythos-bg-hover transition-colors",
            "border-r border-mythos-border-subtle"
          )}
        >
          <SelectedIcon className={cn("w-3.5 h-3.5", selectedType.color)} />
          <ChevronDown className="w-3 h-3 text-mythos-text-muted" />
        </button>

        {/* Name input */}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`New ${selectedType.label.toLowerCase()}...`}
          className={cn(
            "flex-1 min-w-0 px-2 py-1.5 text-sm",
            "bg-transparent text-mythos-text-primary placeholder:text-mythos-text-muted",
            "outline-none"
          )}
        />

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className={cn(
            "p-1.5 rounded-r-lg",
            "text-mythos-text-muted hover:text-mythos-text-secondary",
            "hover:bg-mythos-bg-hover transition-colors"
          )}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Type picker dropdown */}
      {typePickerOpen && (
        <div
          className={cn(
            "absolute left-0 top-full mt-1 z-50",
            "w-44 py-1 rounded-lg",
            "bg-mythos-bg-secondary border border-mythos-border-default",
            "shadow-lg shadow-black/20",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          {ENTITY_TYPES.map((option) => {
            const isSelected = option.type === selectedType.type;
            const OptionIcon = option.icon;

            return (
              <button
                key={option.type}
                onClick={() => {
                  setSelectedType(option);
                  setTypePickerOpen(false);
                  inputRef.current?.focus();
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left",
                  "text-sm transition-colors",
                  isSelected
                    ? "bg-mythos-bg-hover text-mythos-text-primary"
                    : "text-mythos-text-secondary hover:bg-mythos-bg-hover hover:text-mythos-text-primary"
                )}
              >
                <OptionIcon className={cn("w-4 h-4", option.color)} />
                <span>{option.label}</span>
                {isSelected && (
                  <span className="ml-auto text-mythos-accent-primary">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Hint */}
      <div className="flex items-center gap-2 mt-1.5 px-1 text-[10px] text-mythos-text-muted">
        <span>
          <kbd className="px-1 py-0.5 rounded bg-mythos-bg-tertiary border border-mythos-border-subtle">
            ↵
          </kbd>{" "}
          create
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-mythos-bg-tertiary border border-mythos-border-subtle">
            esc
          </kbd>{" "}
          cancel
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Combined Component - Manages toggle state
// ============================================================================

interface EntityQuickAddContainerProps {
  onSubmit: (name: string, type: EntityType) => void;
  className?: string;
}

export function EntityQuickAddContainer({ onSubmit, className }: EntityQuickAddContainerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (name: string, type: EntityType) => {
    onSubmit(name, type);
    setIsOpen(false);
  };

  if (!isOpen) {
    return <EntityQuickAddTrigger onClick={() => setIsOpen(true)} className={className} />;
  }

  return (
    <EntityQuickAdd
      onSubmit={handleSubmit}
      onCancel={() => setIsOpen(false)}
      className={className}
    />
  );
}

export default EntityQuickAddContainer;
