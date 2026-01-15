/**
 * TOC - Table of Contents component
 *
 * Reusable navigation list for artifact sections, document headings, etc.
 */

import { cn } from "../lib/utils";

export interface TocItem {
  id: string;
  label: string;
  depth?: number;
  meta?: string;
}

export interface TocProps {
  title?: string;
  items: TocItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  maxDepth?: number;
  className?: string;
}

export function TOC({
  title,
  items,
  activeId,
  onSelect,
  maxDepth = 3,
  className,
}: TocProps) {
  const filteredItems = items.filter((item) => (item.depth ?? 0) <= maxDepth);

  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label={title ?? "Table of contents"}>
      {title && (
        <div className="px-2 py-1 text-xs font-medium text-mythos-text-secondary uppercase tracking-wide">
          {title}
        </div>
      )}
      <ul className="flex flex-col gap-0.5">
        {filteredItems.map((item) => (
          <TocEntry
            key={item.id}
            item={item}
            isActive={activeId === item.id}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </nav>
  );
}

interface TocEntryProps {
  item: TocItem;
  isActive: boolean;
  onSelect: (id: string) => void;
}

function TocEntry({ item, isActive, onSelect }: TocEntryProps) {
  const depth = item.depth ?? 0;
  const paddingLeft = 8 + depth * 12;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className={cn(
          "w-full text-left text-sm py-1.5 rounded-md transition-colors",
          "hover:bg-mythos-bg-tertiary hover:text-mythos-text-primary",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-mythos-accent-primary",
          isActive
            ? "bg-mythos-accent-primary/10 text-mythos-accent-primary font-medium"
            : "text-mythos-text-secondary"
        )}
        style={{ paddingLeft, paddingRight: 8 }}
      >
        <span className="truncate block">{item.label}</span>
        {item.meta && (
          <span className="text-xs text-mythos-text-tertiary ml-1">
            {item.meta}
          </span>
        )}
      </button>
    </li>
  );
}
