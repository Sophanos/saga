import { useMemo } from "react";

export type HudPlacement = "below" | "above" | "left" | "right";

export interface HudPosition {
  x: number;
  y: number;
  placement: HudPlacement;
}

export interface UseHudPositionOptions {
  /** The click/trigger position */
  position: { x: number; y: number } | null;
  /** Width of the HUD popup */
  hudWidth?: number;
  /** Height of the HUD popup */
  hudHeight?: number;
  /** Padding from viewport edges */
  viewportPadding?: number;
  /** Preferred placement (will try alternatives if doesn't fit) */
  preferredPlacement?: HudPlacement;
}

/**
 * Hook for calculating popup position from click coordinates.
 * Ensures the HUD stays within viewport bounds.
 *
 * @returns Calculated position with x, y coordinates and placement direction
 */
export function useHudPosition({
  position,
  hudWidth = 320,
  hudHeight = 400,
  viewportPadding = 16,
  preferredPlacement = "below",
}: UseHudPositionOptions): HudPosition | null {
  return useMemo(() => {
    if (!position) {
      return null;
    }

    const { x: clickX, y: clickY } = position;

    // Get viewport dimensions
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 1080;

    // Calculate available space in each direction
    const spaceAbove = clickY - viewportPadding;
    const spaceBelow = viewportHeight - clickY - viewportPadding;
    const spaceLeft = clickX - viewportPadding;
    const spaceRight = viewportWidth - clickX - viewportPadding;

    // Determine placement based on available space
    let placement: HudPlacement = preferredPlacement;
    let finalX = clickX;
    let finalY = clickY;

    // Try preferred placement first, then alternatives
    const placements: HudPlacement[] = [preferredPlacement];

    if (preferredPlacement === "below") {
      placements.push("above", "right", "left");
    } else if (preferredPlacement === "above") {
      placements.push("below", "right", "left");
    } else if (preferredPlacement === "right") {
      placements.push("left", "below", "above");
    } else {
      placements.push("right", "below", "above");
    }

    for (const tryPlacement of placements) {
      let fits = false;
      let testX = clickX;
      let testY = clickY;

      switch (tryPlacement) {
        case "below":
          if (spaceBelow >= hudHeight) {
            testY = clickY;
            fits = true;
          }
          break;
        case "above":
          if (spaceAbove >= hudHeight) {
            testY = clickY - hudHeight;
            fits = true;
          }
          break;
        case "right":
          if (spaceRight >= hudWidth) {
            testX = clickX;
            testY = clickY - hudHeight / 2;
            fits = true;
          }
          break;
        case "left":
          if (spaceLeft >= hudWidth) {
            testX = clickX - hudWidth;
            testY = clickY - hudHeight / 2;
            fits = true;
          }
          break;
      }

      if (fits) {
        placement = tryPlacement;
        finalX = testX;
        finalY = testY;
        break;
      }
    }

    // Horizontal adjustment: center HUD on click point, but keep in viewport
    if (placement === "below" || placement === "above") {
      finalX = clickX - hudWidth / 2;

      // Clamp to viewport
      if (finalX < viewportPadding) {
        finalX = viewportPadding;
      } else if (finalX + hudWidth > viewportWidth - viewportPadding) {
        finalX = viewportWidth - hudWidth - viewportPadding;
      }
    }

    // Vertical adjustment: keep in viewport
    if (placement === "left" || placement === "right") {
      if (finalY < viewportPadding) {
        finalY = viewportPadding;
      } else if (finalY + hudHeight > viewportHeight - viewportPadding) {
        finalY = viewportHeight - hudHeight - viewportPadding;
      }
    }

    return {
      x: Math.round(finalX),
      y: Math.round(finalY),
      placement,
    };
  }, [position, hudWidth, hudHeight, viewportPadding, preferredPlacement]);
}
