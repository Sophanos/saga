import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = "Select...",
      disabled,
      className,
      id,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selectedOption = options.find((o) => o.value === value);
    const selectedIndex = options.findIndex((o) => o.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Reset highlighted index when dropdown opens
    useEffect(() => {
      if (isOpen) {
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      }
    }, [isOpen, selectedIndex]);

    // Scroll highlighted option into view
    useEffect(() => {
      if (isOpen && listRef.current && highlightedIndex >= 0) {
        const highlightedEl = listRef.current.children[
          highlightedIndex
        ] as HTMLElement;
        if (highlightedEl) {
          highlightedEl.scrollIntoView({ block: "nearest" });
        }
      }
    }, [isOpen, highlightedIndex]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;

        switch (e.key) {
          case "Enter":
          case " ":
            e.preventDefault();
            if (isOpen && highlightedIndex >= 0) {
              onChange(options[highlightedIndex].value);
              setIsOpen(false);
            } else {
              setIsOpen(true);
            }
            break;
          case "ArrowDown":
            e.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
            } else {
              setHighlightedIndex((prev) =>
                prev < options.length - 1 ? prev + 1 : prev
              );
            }
            break;
          case "ArrowUp":
            e.preventDefault();
            if (isOpen) {
              setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
            }
            break;
          case "Escape":
            e.preventDefault();
            setIsOpen(false);
            break;
          case "Tab":
            setIsOpen(false);
            break;
        }
      },
      [disabled, isOpen, highlightedIndex, options, onChange]
    );

    return (
      <div ref={containerRef} className="relative">
        <button
          ref={ref}
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={id}
          className={cn(
            "flex items-center justify-between w-full h-9 px-3 py-1 rounded-md text-sm",
            "border border-mythos-border-default bg-mythos-bg-secondary",
            "hover:bg-mythos-bg-tertiary transition-colors",
            "focus:outline-none focus:ring-1 focus:ring-mythos-accent-primary",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <span
            className={
              selectedOption
                ? "text-mythos-text-primary"
                : "text-mythos-text-muted"
            }
          >
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-mythos-text-muted transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={
              highlightedIndex >= 0
                ? `select-option-${highlightedIndex}`
                : undefined
            }
            className={cn(
              "absolute z-50 mt-1 w-full max-h-60 overflow-auto py-1 rounded-md",
              "bg-mythos-bg-secondary border border-mythos-border-default",
              "shadow-lg shadow-black/20"
            )}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`select-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onChange(option.value);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 cursor-pointer",
                  "text-sm text-mythos-text-secondary",
                  "hover:bg-mythos-bg-tertiary",
                  option.value === value && "bg-mythos-bg-tertiary",
                  highlightedIndex === index && "bg-mythos-bg-tertiary"
                )}
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check className="w-4 h-4 text-mythos-accent-primary" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
