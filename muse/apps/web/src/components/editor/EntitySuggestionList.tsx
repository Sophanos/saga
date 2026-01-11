import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import {
  User,
  MapPin,
  Sword,
  Wand2,
  Building2,
  Calendar,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@mythos/ui";
import type { Entity, GraphEntityType } from "@mythos/core";
import {
  WRITER_ENTITY_TYPE_CONFIG,
  getEntityColor,
  type EntityIconName,
} from "@mythos/core";

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

export interface EntitySuggestionListProps {
  items: Entity[];
  command: (entity: Entity) => void;
}

export interface EntitySuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/**
 * EntitySuggestionList - A dropdown list for @mention autocomplete
 *
 * Renders a list of entity suggestions with:
 * - Entity icons based on type
 * - Keyboard navigation (arrow keys + enter)
 * - Hover selection
 */
export const EntitySuggestionList = forwardRef<
  EntitySuggestionListRef,
  EntitySuggestionListProps
>((props, ref) => {
  const { items, command } = props;
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Select an entity and execute command
  const selectItem = useCallback(
    (index: number) => {
      const entity = items[index];
      if (entity) {
        command(entity);
      }
    },
    [items, command]
  );

  // Navigate up in the list
  const upHandler = useCallback(() => {
    setSelectedIndex((current) =>
      current === 0 ? items.length - 1 : current - 1
    );
  }, [items.length]);

  // Navigate down in the list
  const downHandler = useCallback(() => {
    setSelectedIndex((current) =>
      current === items.length - 1 ? 0 : current + 1
    );
  }, [items.length]);

  // Select current item
  const enterHandler = useCallback(() => {
    selectItem(selectedIndex);
  }, [selectItem, selectedIndex]);

  // Expose keyboard handler to parent
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  // Empty state
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "bg-mythos-bg-secondary border border-mythos-text-muted/30",
          "rounded-lg shadow-lg shadow-black/30 overflow-hidden",
          "min-w-[200px] py-2 px-3"
        )}
      >
        <span className="text-sm text-mythos-text-muted">
          No entities found
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-mythos-bg-secondary border border-mythos-text-muted/30",
        "rounded-lg shadow-lg shadow-black/30 overflow-hidden",
        "min-w-[200px] max-h-[300px] overflow-y-auto"
      )}
    >
      <ul className="py-1" role="listbox">
        {items.map((entity, index) => {
          const Icon = getEntityIconComponent(entity.type);
          const colorClass = getEntityColor(entity.type);

          return (
            <li
              key={entity.id}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <button
                type="button"
                onClick={() => selectItem(index)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left",
                  "transition-colors duration-75",
                  index === selectedIndex
                    ? "bg-mythos-bg-tertiary"
                    : "hover:bg-mythos-bg-tertiary/50"
                )}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0", colorClass)} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-mythos-text-primary truncate block">
                    {entity.name}
                  </span>
                  {entity.aliases.length > 0 && (
                    <span className="text-xs text-mythos-text-muted truncate block">
                      aka {entity.aliases.slice(0, 2).join(", ")}
                      {entity.aliases.length > 2 && "..."}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                    "bg-mythos-bg-primary/50",
                    colorClass
                  )}
                >
                  {entity.type.replace("_", " ")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

EntitySuggestionList.displayName = "EntitySuggestionList";
