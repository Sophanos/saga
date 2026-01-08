/**
 * Commands - registry and definitions
 */

export * from './types';
export { commandRegistry } from './registry';

import { commandRegistry } from './registry';
import { entityCommands } from './entity-commands';
import { navigationCommands } from './navigation-commands';
import { generalCommands } from './general-commands';

export function initializeCommands(): void {
  commandRegistry.registerMany(entityCommands);
  commandRegistry.registerMany(navigationCommands);
  commandRegistry.registerMany(generalCommands);
}

// Auto-initialize
initializeCommands();
