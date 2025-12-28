import { useMythosStore } from "../stores";

/**
 * Hook for accessing and managing the current editor mode.
 *
 * - Writer mode: Focused on narrative flow and creative writing
 * - DM (Dungeon Master) mode: Focused on entity stats, world state, and game mechanics
 */
export function useMode() {
  const mode = useMythosStore((state) => state.ui.mode);
  const setMode = useMythosStore((state) => state.setMode);
  const toggleMode = useMythosStore((state) => state.toggleMode);

  const isDM = mode === "dm";
  const isWriter = mode === "writer";

  return {
    mode,
    isDM,
    isWriter,
    setMode,
    toggleMode,
  };
}
