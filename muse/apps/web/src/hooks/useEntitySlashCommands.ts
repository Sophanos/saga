import { useMemo } from "react";
import { useProjectTypeRegistry } from "./useProjectTypeRegistry";
import type { SlashCommandItem } from "@mythos/editor";
import { getGraphEntityIcon } from "@mythos/core";

/**
 * Generate dynamic slash commands for entity types based on the project's type registry.
 * Each entity type (character, location, etc.) gets its own slash command for quick creation.
 */
export function useEntitySlashCommands(): SlashCommandItem[] {
  const registry = useProjectTypeRegistry();

  return useMemo(() => {
    if (!registry?.entityTypes) return [];

    return Object.entries(registry.entityTypes).map(([type, def]) => ({
      id: `create-${type}`,
      label: def.displayName || type,
      description: `Create a new ${def.displayName || type}`,
      icon: def.icon || getGraphEntityIcon(registry, type) || "CirclePlus",
      category: "Create",
      keywords: [type, "create", "new", "node", "entity", def.displayName?.toLowerCase() || ""].filter(Boolean),
      action: () => {
        window.dispatchEvent(
          new CustomEvent("editor:create-node", {
            detail: { entityType: type },
          })
        );
      },
    }));
  }, [registry]);
}
