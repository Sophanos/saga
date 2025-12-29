// Command registry and types
export {
  commandRegistry,
  type Command,
  type CommandCategory,
  type CommandContext,
} from "./registry";

// Command definitions
export { entityCommands } from "./entity-commands";
export { aiCommands } from "./ai-commands";
export { navigationCommands } from "./navigation-commands";
export { generalCommands } from "./general-commands";

// Import and register all commands
import { commandRegistry } from "./registry";
import { entityCommands } from "./entity-commands";
import { aiCommands } from "./ai-commands";
import { navigationCommands } from "./navigation-commands";
import { generalCommands } from "./general-commands";

/**
 * Initialize the command registry with all default commands.
 * Call this once at app startup.
 */
export function initializeCommands(): void {
  commandRegistry.registerMany(entityCommands);
  commandRegistry.registerMany(aiCommands);
  commandRegistry.registerMany(navigationCommands);
  commandRegistry.registerMany(generalCommands);
}

// Auto-initialize on import
initializeCommands();
