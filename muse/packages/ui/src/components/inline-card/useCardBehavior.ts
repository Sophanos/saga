/**
 * useCardBehavior - Shared behavior for inline cards
 *
 * Handles: auto-collapse, pin state, expand/collapse, hover
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseCardBehaviorOptions {
  /** Initial expanded state */
  defaultExpanded?: boolean;
  /** Called when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Selector for elements that should not trigger auto-collapse */
  ignoreSelector?: string;
  /** Disable auto-collapse entirely */
  disableAutoCollapse?: boolean;
}

export interface UseCardBehaviorReturn {
  isExpanded: boolean;
  isPinned: boolean;
  isHovered: boolean;
  setIsExpanded: (expanded: boolean) => void;
  setIsPinned: (pinned: boolean) => void;
  setIsHovered: (hovered: boolean) => void;
  toggle: () => void;
  pin: () => void;
  unpin: () => void;
  collapse: () => void;
  expand: () => void;
  cardRef: React.RefObject<HTMLDivElement>;
}

export function useCardBehavior(
  options: UseCardBehaviorOptions = {}
): UseCardBehaviorReturn {
  const {
    defaultExpanded = true,
    onExpandedChange,
    ignoreSelector = ".inline-card__input",
    disableAutoCollapse = false,
  } = options;

  const [isExpanded, setIsExpandedState] = useState(defaultExpanded);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const setIsExpanded = useCallback(
    (expanded: boolean) => {
      setIsExpandedState(expanded);
      onExpandedChange?.(expanded);
    },
    [onExpandedChange]
  );

  // Auto-collapse when user types elsewhere (unless pinned)
  useEffect(() => {
    if (!isExpanded || isPinned || disableAutoCollapse) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // Ignore if typing in our own inputs
      if (ignoreSelector && target.closest(ignoreSelector)) return;

      // Ignore if typing inside this card
      if (cardRef.current?.contains(target)) return;

      // Ignore modifier-only keys
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;

      // Ignore navigation keys
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Home",
          "End",
          "PageUp",
          "PageDown",
          "Escape",
          "Tab",
        ].includes(e.key)
      )
        return;

      // If typing in the editor (outside this card), collapse
      if (target.closest(".ProseMirror")) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, isPinned, disableAutoCollapse, ignoreSelector, setIsExpanded]);

  const toggle = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded, setIsExpanded]);

  const pin = useCallback(() => setIsPinned(true), []);
  const unpin = useCallback(() => setIsPinned(false), []);
  const collapse = useCallback(() => setIsExpanded(false), [setIsExpanded]);
  const expand = useCallback(() => setIsExpanded(true), [setIsExpanded]);

  return {
    isExpanded,
    isPinned,
    isHovered,
    setIsExpanded,
    setIsPinned,
    setIsHovered,
    toggle,
    pin,
    unpin,
    collapse,
    expand,
    cardRef,
  };
}
