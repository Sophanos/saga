import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { SlashCommandItem } from '@mythos/editor';
import { groupByCategory } from '@mythos/editor';

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  editor: Editor;
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const grouped = groupByCategory(items);
    const categories = Object.keys(grouped);

    // Flatten for keyboard navigation
    const flatItems = items;

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev <= 0 ? flatItems.length - 1 : prev - 1));
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev >= flatItems.length - 1 ? 0 : prev + 1));
          return true;
        }
        if (event.key === 'Enter') {
          const item = flatItems[selectedIndex];
          if (item) {
            command(item);
          }
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="slash-menu">
          <div className="slash-menu-empty">No results</div>
        </div>
      );
    }

    let globalIndex = 0;

    return (
      <div className="slash-menu">
        {categories.map((category) => (
          <div key={category} className="slash-menu-category">
            <div className="slash-menu-category-label">{category}</div>
            {grouped[category].map((item) => {
              const index = globalIndex++;
              return (
                <button
                  key={item.id}
                  className={`slash-menu-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => command(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="slash-menu-item-icon">{getIcon(item.icon)}</span>
                  <div className="slash-menu-item-content">
                    <span className="slash-menu-item-label">{item.label}</span>
                    {item.description && (
                      <span className="slash-menu-item-description">{item.description}</span>
                    )}
                  </div>
                  {item.shortcut && (
                    <span className="slash-menu-item-shortcut">{item.shortcut}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        <style>{`
          .slash-menu {
            background: var(--color-bg-elevated, #fff);
            border: 1px solid var(--color-border, #e5e7eb);
            border-radius: var(--radius-lg, 12px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            max-height: 320px;
            overflow-y: auto;
            min-width: 280px;
            padding: var(--space-1, 4px);
          }

          .slash-menu-empty {
            padding: var(--space-3, 12px);
            color: var(--color-text-secondary, #6b7280);
            text-align: center;
            font-size: var(--text-sm, 14px);
          }

          .slash-menu-category {
            margin-bottom: var(--space-1, 4px);
          }

          .slash-menu-category-label {
            font-size: var(--text-xs, 12px);
            font-weight: var(--font-medium, 500);
            color: var(--color-text-ghost, #9ca3af);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: var(--space-2, 8px) var(--space-3, 12px);
            padding-top: var(--space-3, 12px);
          }

          .slash-menu-category:first-child .slash-menu-category-label {
            padding-top: var(--space-2, 8px);
          }

          .slash-menu-item {
            display: flex;
            align-items: center;
            gap: var(--space-3, 12px);
            width: 100%;
            padding: var(--space-2, 8px) var(--space-3, 12px);
            border: none;
            background: transparent;
            cursor: pointer;
            border-radius: var(--radius-md, 8px);
            text-align: left;
            transition: background 0.1s;
          }

          .slash-menu-item:hover,
          .slash-menu-item.selected {
            background: var(--color-bg-hover, #f3f4f6);
          }

          .slash-menu-item-icon {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--color-text-secondary, #6b7280);
            flex-shrink: 0;
          }

          .slash-menu-item-content {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .slash-menu-item-label {
            font-size: var(--text-sm, 14px);
            font-weight: var(--font-medium, 500);
            color: var(--color-text, #111827);
          }

          .slash-menu-item-description {
            font-size: var(--text-xs, 12px);
            color: var(--color-text-secondary, #6b7280);
          }

          .slash-menu-item-shortcut {
            font-size: var(--text-xs, 12px);
            color: var(--color-text-ghost, #9ca3af);
            font-family: var(--font-mono, monospace);
            flex-shrink: 0;
          }
        `}</style>
      </div>
    );
  }
);

SlashCommandMenu.displayName = 'SlashCommandMenu';

function getIcon(iconName?: string): string {
  const icons: Record<string, string> = {
    Sparkles: '✨',
    Type: 'T',
    Heading1: 'H₁',
    Heading2: 'H₂',
    Heading3: 'H₃',
    List: '•',
    ListOrdered: '1.',
    CheckSquare: '☐',
    Quote: '"',
    Code: '</>',
    Minus: '—',
    Table: '⊞',
    Image: '🖼',
    FileText: '📄',
    FileCode: '<>',
    Maximize2: '⤢',
    RefreshCw: '↻',
  };
  return icons[iconName || ''] || '•';
}
