/**
 * Command definitions barrel export
 */

export { entityCommands } from './entity';
export { navigationCommands } from './navigation';
export { generalCommands } from './general';
export { widgetCommands } from './widget';

import { entityCommands } from './entity';
import { navigationCommands } from './navigation';
import { generalCommands } from './general';
import { widgetCommands } from './widget';
import { commandRegistry } from '../registry';

/**
 * Register all built-in commands with the registry
 */
export function registerAllCommands(): void {
  commandRegistry.registerMany([
    ...entityCommands,
    ...navigationCommands,
    ...generalCommands,
    ...widgetCommands,
  ]);
}
