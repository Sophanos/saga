/**
 * useIsCommandLocked - Shared hook for checking command lock state
 *
 * Used by:
 * - useGlobalShortcuts.ts - To prevent execution of locked commands
 * - CommandPalette.tsx - To show locked state in UI
 *
 * A command is locked when:
 * 1. The project is in gardener mode (progressive disclosure)
 * 2. The command has a requiredModule
 * 3. That module is not yet unlocked
 */

import { useCallback } from "react";
import { useIsGardenerMode, useUnlockedModules } from "@mythos/state";
import type { Command } from "../commands/registry";

/**
 * Hook that returns a callback to check if a command is locked
 *
 * In gardener mode (progressive disclosure), commands are locked
 * until their required module is unlocked through user actions.
 *
 * @example
 * const isCommandLocked = useIsCommandLocked();
 *
 * if (isCommandLocked(command)) {
 *   console.log(`Command is locked. ${getUnlockHint(command.requiredModule!)}`);
 *   return;
 * }
 * command.execute(ctx);
 */
export function useIsCommandLocked(): (cmd: Command) => boolean {
  const isGardener = useIsGardenerMode();
  const unlockedModules = useUnlockedModules();

  return useCallback(
    (cmd: Command): boolean => {
      // Architect mode: everything unlocked
      if (!isGardener) return false;
      // No module requirement: not locked
      if (!cmd.requiredModule) return false;
      // Check if required module is unlocked
      return unlockedModules?.[cmd.requiredModule] !== true;
    },
    [isGardener, unlockedModules]
  );
}
