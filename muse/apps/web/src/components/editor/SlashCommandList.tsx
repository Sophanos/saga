import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { FilePlus } from "lucide-react";
import { cn } from "@mythos/ui";
import type { SlashCommandItem } from "@mythos/editor";

export interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandList = forwardRef<
  SlashCommandListRef,
  SlashCommandListProps
>((props, ref) => {
  const { items, command } = props;
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    },
    [items, command]
  );

  const upHandler = useCallback(() => {
    setSelectedIndex((current) =>
      current === 0 ? items.length - 1 : current - 1
    );
  }, [items.length]);

  const downHandler = useCallback(() => {
    setSelectedIndex((current) =>
      current === items.length - 1 ? 0 : current + 1
    );
  }, [items.length]);

  const enterHandler = useCallback(() => {
    selectItem(selectedIndex);
  }, [selectItem, selectedIndex]);

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
          No commands found
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-mythos-bg-secondary border border-mythos-text-muted/30",
        "rounded-lg shadow-lg shadow-black/30 overflow-hidden",
        "min-w-[220px] max-h-[260px] overflow-y-auto"
      )}
    >
      <ul className="py-1" role="listbox">
        {items.map((item, index) => (
          <li
            key={item.id}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <button
              type="button"
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "w-full flex items-start gap-2 px-3 py-2 text-left",
                "transition-colors duration-75",
                index === selectedIndex
                  ? "bg-mythos-bg-tertiary"
                  : "hover:bg-mythos-bg-tertiary/50"
              )}
            >
              <FilePlus className="w-4 h-4 mt-0.5 text-mythos-text-secondary" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-mythos-text-primary truncate block">
                  {item.label}
                </span>
                {item.description && (
                  <span className="text-xs text-mythos-text-muted truncate block">
                    {item.description}
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});

SlashCommandList.displayName = "SlashCommandList";
